/*
 * Plantree — PM work-order generation engine
 * ------------------------------------------------------------------
 * Turns a maintenance schedule (a plan applied to an asset) into
 * "planned" work orders, applying task-x-frequency dropping and
 * nesting (cannibalism), and advancing per-frequency high-water marks
 * so re-running is idempotent.
 *
 * No dependencies, no build. Loads two ways:
 *   - browser:  <script src="pm-generate.js"></script>  ->  window.PMGenerate
 *   - node:     const PMGenerate = require("./pm-generate.js")
 *
 * The engine takes a RESOLVED effective plan (the snapshot shape the
 * job-plans app already computes by walking Class -> Model -> Instance
 * inheritance) — resolution is the app's job, timing/nesting/emission
 * is this engine's. Output work orders conform to
 * schemas/work-order.schema.json; the returned schedule carries the
 * updated highWaterMarks to persist.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMGenerate = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- date helpers (calendar-correct, no libraries) ----
  function parseDate(iso) {
    // Treat date-only ISO as UTC midnight so arithmetic is TZ-stable.
    var d = new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso);
    if (isNaN(d.getTime())) throw new Error("Invalid date: " + iso);
    return d;
  }
  function toISODate(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { var r = new Date(d.getTime()); r.setUTCDate(r.getUTCDate() + n); return r; }
  function addMonths(d, n) {
    var r = new Date(d.getTime());
    var day = r.getUTCDate();
    r.setUTCDate(1);
    r.setUTCMonth(r.getUTCMonth() + n);
    // clamp to end of month (e.g. Jan 31 + 1 month -> Feb 28/29)
    var last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
    r.setUTCDate(Math.min(day, last));
    return r;
  }
  // The k-th occurrence (k >= 1) of a frequency measured from the anchor.
  function occurrence(anchor, unit, interval, k) {
    var step = interval * k;
    switch (unit) {
      case "day": return addDays(anchor, step);
      case "week": return addDays(anchor, step * 7);
      case "month": return addMonths(anchor, step);
      case "year": return addMonths(anchor, step * 12);
      default: throw new Error("Unknown frequency unit: " + unit);
    }
  }
  // Approximate period length in days — only used to rank which frequency
  // is "longest" when nesting. Ordering, not exact duration, is what matters.
  function periodDays(unit, interval) {
    var base = { day: 1, week: 7, month: 30, year: 365 }[unit];
    if (!base) throw new Error("Unknown frequency unit: " + unit);
    return base * interval;
  }
  function freqLabel(f) {
    if (f.label) return f.label;
    var U = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };
    if (f.interval === 1) return U[f.unit];
    if (f.unit === "month") return f.interval + "-Monthly";
    if (f.unit === "year") return f.interval + "-Yearly";
    return "Every " + f.interval + " " + f.unit + "s";
  }

  // ---- core ----
  // Every due date for one frequency in (afterExclusive, throughInclusive].
  function dueDatesFor(freq, anchor, afterExclusive, throughInclusive) {
    var out = [];
    for (var k = 1; k <= 100000; k++) {
      var due = occurrence(anchor, freq.unit, freq.interval, k);
      if (due.getTime() > throughInclusive.getTime()) break;
      if (due.getTime() > afterExclusive.getTime()) out.push(due);
    }
    return out;
  }

  function tasksForFrequencies(plan, freqIds) {
    var set = {};
    freqIds.forEach(function (fid) { set[fid] = true; });
    var seen = {};
    var out = [];
    (plan.tasks || []).forEach(function (t) {
      var hit = (t.frequencyIds || []).some(function (fid) { return set[fid]; });
      if (hit && !seen[t.id]) { seen[t.id] = true; out.push(t); }
    });
    return out;
  }

  /*
   * generate({ plan, schedule, asOf, generatedAt, horizonDays })
   *   plan        - resolved effective plan for this asset/level:
   *                 { id, code, version, workOrderTypeCode, safetyInstructions,
   *                   estimatedLabourHours, parameters:[{key,label,value,unit}],
   *                   requiredPermits:[], frequencies:[{id,unit,interval,label}],
   *                   tasks:[{id,instruction,responseType,unit,acceptableRange,
   *                           choices,frequencyIds}] }
   *   schedule    - a MaintenanceSchedule document
   *   asOf        - ISO date; generate due dates up to asOf + leadTimeDays
   *   generatedAt - ISO date-time stamped on the created orders (defaults to asOf)
   *   horizonDays - optional extra look-ahead beyond leadTimeDays (default 0)
   *
   * Returns { workOrders, schedule (with advanced highWaterMarks), log }.
   */
  function generate(opts) {
    var plan = opts.plan;
    var schedule = opts.schedule;
    if (!plan || !schedule) throw new Error("generate requires { plan, schedule }");

    var log = [];
    var workOrders = [];
    var newHWM = Object.assign({}, schedule.highWaterMarks || {});

    if (schedule.active === false) {
      log.push("Schedule " + schedule.id + " is inactive — nothing generated.");
      return { workOrders: workOrders, schedule: schedule, log: log };
    }

    var anchor = parseDate(schedule.anchorDate);
    var lead = schedule.leadTimeDays || 0;
    var horizon = opts.horizonDays || 0;
    var through = addDays(parseDate(opts.asOf), lead + horizon);
    var generatedAt = opts.generatedAt || (opts.asOf + "T00:00:00Z");
    var mergeWindow = schedule.mergeWindowDays || 0;

    // 1. Collect due-date events per frequency, after each freq's high-water mark.
    var events = [];
    var lastDuePerFreq = {};
    (plan.frequencies || []).forEach(function (f) {
      var hwm = newHWM[f.id] ? parseDate(newHWM[f.id]) : anchor;
      // If never generated, the anchor itself is not a due date (first due is +1 interval);
      // dueDatesFor starts at k=1 from the anchor, so passing anchor as the exclusive
      // lower bound correctly yields anchor+interval as the first due.
      var lower = newHWM[f.id] ? hwm : addDays(anchor, -1);
      var dues = dueDatesFor(f, anchor, lower, through);
      dues.forEach(function (due) {
        events.push({ freq: f, due: due, rank: periodDays(f.unit, f.interval) });
      });
      if (dues.length) lastDuePerFreq[f.id] = dues[dues.length - 1];
    });

    if (!events.length) {
      log.push("No frequencies fell due for " + schedule.id + " through " + toISODate(through) + ".");
      return { workOrders: workOrders, schedule: withHWM(schedule, newHWM, generatedAt), log: log };
    }

    // 2. Sort by due date, then longest-period-first so the driver leads its group.
    events.sort(function (a, b) {
      return a.due - b.due || b.rank - a.rank;
    });

    // 3. Nest: walk events; group those within mergeWindow days of the group's first.
    var groups = [];
    var current = null;
    events.forEach(function (ev) {
      if (current && (ev.due.getTime() - current.start.getTime()) <= mergeWindow * 86400000) {
        current.members.push(ev);
      } else {
        current = { start: ev.due, members: [ev] };
        groups.push(current);
      }
    });

    // 4. Emit one work order per group (driver = longest period in the group).
    groups.forEach(function (g) {
      var driver = g.members.reduce(function (a, b) { return b.rank > a.rank ? b : a; });
      var absorbed = g.members.filter(function (m) { return m !== driver; });
      var freqIds = g.members.map(function (m) { return m.freq.id; });
      var tasks = tasksForFrequencies(plan, freqIds);
      workOrders.push(buildWorkOrder(plan, schedule, driver, absorbed, tasks, generatedAt));
      var note = freqLabel(driver.freq) + " @ " + toISODate(driver.due);
      if (absorbed.length) note += " (absorbs " + absorbed.map(function (m) { return freqLabel(m.freq); }).join(", ") + ")";
      log.push("WO " + workOrders[workOrders.length - 1].workOrderNumber + " — " + note + ", " + tasks.length + " task(s)");
    });

    // 5. Advance high-water marks: every due date in the window is covered
    //    (as a driver or absorbed), so each frequency's mark moves to its last due.
    Object.keys(lastDuePerFreq).forEach(function (fid) {
      newHWM[fid] = toISODate(lastDuePerFreq[fid]);
    });

    return { workOrders: workOrders, schedule: withHWM(schedule, newHWM, generatedAt), log: log };
  }

  function withHWM(schedule, hwm, generatedAt) {
    var next = Object.assign({}, schedule, {
      highWaterMarks: hwm,
      rev: (schedule.rev || 0) + 1,
      updatedAt: generatedAt,
      updatedBy: "system:pm-generator"
    });
    return next;
  }

  function buildWorkOrder(plan, schedule, driver, absorbed, tasks, generatedAt) {
    var dueISODate = toISODate(driver.due);
    // Deterministic id from schedule + driver frequency + due date => idempotent
    // (a second generation of the same occurrence would collide, but the
    // high-water mark prevents re-emission in the first place).
    var stamp = dueISODate.replace(/-/g, "");
    var id = "wo_" + schedule.id + "_" + driver.freq.id + "_" + stamp;
    var number = "WO-" + dueISODate.slice(0, 4) + "-" + schedule.assetId + "-" + driver.freq.id + "-" + stamp.slice(4);
    var typeCode = plan.workOrderTypeCode || "PM";
    var dueDateTime = dueISODate + "T00:00:00Z";

    var absorbNote = absorbed.length
      ? " (absorbs " + absorbed.map(function (m) { return freqLabel(m.freq); }).join(", ") + ")"
      : "";

    return {
      id: id,
      type: "workOrder",
      workOrderNumber: number,
      assetId: schedule.assetId,
      workOrderTypeCode: typeCode,
      title: freqLabel(driver.freq) + " — " + (plan.code || plan.id || "plan") + absorbNote,
      description: "Generated from schedule " + schedule.id + " (" + freqLabel(driver.freq) + " cadence).",
      priority: schedule.priority || "medium",
      status: "planned",
      dueDate: dueDateTime,
      scheduledStart: null,
      scheduledEnd: null,
      workflowProfileKey: schedule.workflowProfileKey || null,
      scheduleId: schedule.id,
      workRequestId: null,
      jobPlanId: plan.id || schedule.jobPlanId,
      jobPlanVersion: plan.version != null ? plan.version : null,
      parentWorkOrderId: null,
      dependsOn: [],
      assignedTo: schedule.responsibleTeamId
        ? { kind: "crew", id: schedule.responsibleTeamId, name: null }
        : null,
      estimatedLabourHours: plan.estimatedLabourHours != null ? plan.estimatedLabourHours : null,
      actualLabourHours: null,
      onHold: null,
      snapshot: {
        jobPlanCode: plan.code || null,
        jobPlanVersion: plan.version != null ? plan.version : null,
        safetyInstructions: plan.safetyInstructions || null,
        workOrderTypeCode: typeCode,
        parameters: (plan.parameters || []).map(function (p) {
          return { key: p.key, label: p.label != null ? p.label : null, value: p.value, unit: p.unit != null ? p.unit : null };
        }),
        takenAt: generatedAt
      },
      tasks: tasks.map(function (t, i) {
        return {
          id: "wot_" + (i + 1),
          jobPlanTaskId: t.id,
          sequence: i + 1,
          instruction: t.instruction,
          responseType: t.responseType,
          unit: t.unit != null ? t.unit : null,
          acceptableRange: t.acceptableRange != null ? t.acceptableRange : null,
          choices: t.choices != null ? t.choices : null,
          response: null,
          outOfRange: null,
          completed: false,
          completedBy: null,
          completedAt: null
        };
      }),
      labour: [],
      parts: [],
      failure: null,
      requiredPermits: (plan.requiredPermits || []).slice(),
      attachments: [],
      comments: [],
      statusHistory: [
        {
          from: null,
          to: "planned",
          at: generatedAt,
          by: "system:pm-generator",
          reason: "Generated from schedule " + schedule.id + " — " + freqLabel(driver.freq) + " due " + dueISODate + "."
        }
      ],
      rev: 0,
      createdAt: generatedAt,
      createdBy: "system:pm-generator",
      updatedAt: generatedAt,
      updatedBy: "system:pm-generator"
    };
  }

  return {
    generate: generate,
    // exposed for testing / reuse
    _internals: {
      occurrence: occurrence,
      dueDatesFor: dueDatesFor,
      addMonths: addMonths,
      addDays: addDays,
      periodDays: periodDays,
      freqLabel: freqLabel,
      tasksForFrequencies: tasksForFrequencies
    }
  };
});
