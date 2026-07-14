/*
 * Tests for the PM generation engine. No dependencies — run with:
 *   node apps/work-orders/pm-generate.test.js
 * Exits non-zero on the first failed assertion.
 */
const PMGenerate = require("./pm-generate.js");

let passed = 0;
function ok(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); process.exit(1); }
  passed++;
}
function eq(a, b, msg) { ok(a === b, msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }

// A resolved effective plan: a generator service programme with cadences that
// align on month boundaries, so nesting (cannibalism) is exercised cleanly.
const plan = {
  id: "acp_gen_test",
  code: "GEN",
  version: 1,
  workOrderTypeCode: "PM",
  safetyInstructions: "Lock off before intrusive work.",
  estimatedLabourHours: 3,
  requiredPermits: [],
  parameters: [{ key: "oilGrade", label: "Oil grade", value: "15W-40", unit: null }],
  frequencies: [
    { id: "m", unit: "month", interval: 1 },
    { id: "q", unit: "month", interval: 3 },
    { id: "s", unit: "month", interval: 6 },
    { id: "y", unit: "year", interval: 1 }
  ],
  tasks: [
    { id: "t1", instruction: "Monthly checks.", responseType: "passfail", frequencyIds: ["m"] },
    { id: "t2", instruction: "Quarterly service.", responseType: "passfail", frequencyIds: ["q"] },
    { id: "t3", instruction: "Major service.", responseType: "passfail", frequencyIds: ["s"] },
    { id: "t4", instruction: "Annual load test.", responseType: "numeric", frequencyIds: ["y"] },
    { id: "t5", instruction: "Visual inspection.", responseType: "passfail", frequencyIds: ["m", "q", "s", "y"] }
  ]
};

function schedule() {
  return {
    id: "sch_test", type: "maintenanceSchedule",
    assetId: "ast_gen1", jobPlanId: "acp_gen_test", planLevel: "class",
    anchorDate: "2026-01-01", mergeWindowDays: 0, leadTimeDays: 0,
    priority: "medium", responsibleTeamId: "crew_syd_mech", workflowProfileKey: "default",
    active: true, highWaterMarks: {}, rev: 0,
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
  };
}

// ---- 1. Generation + nesting over the first year ----
const r1 = PMGenerate.generate({ plan, schedule: schedule(), asOf: "2026-12-31", generatedAt: "2026-01-01T00:00:00Z" });
// 11 monthly + 3 quarterly + 1 six-monthly due dates (yearly falls 2027-01-01, out of window)
// = 15 occurrences collapsing (4 absorbed) into 11 work orders.
eq(r1.workOrders.length, 11, "first-year work-order count");

const byDue = {};
r1.workOrders.forEach(w => { byDue[w.dueDate.slice(0, 10)] = w; });

// April: monthly + quarterly coincide -> quarterly drives, 3 tasks (t1,t2,t5).
const apr = byDue["2026-04-01"];
ok(apr && /3-Monthly/.test(apr.title), "April WO driven by quarterly");
eq(apr.tasks.length, 3, "April WO task count");
ok(/absorbs Monthly/.test(apr.title), "April WO absorbs monthly");

// July: monthly + quarterly + six-monthly coincide -> six-monthly drives, 4 tasks.
const jul = byDue["2026-07-01"];
ok(jul && /6-Monthly/.test(jul.title), "July WO driven by six-monthly");
eq(jul.tasks.length, 4, "July WO task count (t1,t2,t3,t5)");

// A plain monthly month (e.g. May) -> monthly, 2 tasks (t1,t5).
eq(byDue["2026-05-01"].tasks.length, 2, "May WO task count");

// Every generated order enters at 'planned' with a snapshot and provenance.
r1.workOrders.forEach(w => {
  eq(w.status, "planned", "generated status");
  eq(w.statusHistory[0].from, null, "entry event from=null");
  eq(w.statusHistory[0].to, "planned", "entry event to=planned");
  eq(w.scheduleId, "sch_test", "provenance scheduleId");
  ok(w.snapshot && w.snapshot.jobPlanVersion === 1, "snapshot pinned version");
  eq(w.jobPlanVersion, 1, "pinned jobPlanVersion");
});

// High-water marks advanced to each frequency's last due in the window.
eq(r1.schedule.highWaterMarks.m, "2026-12-01", "HWM monthly");
eq(r1.schedule.highWaterMarks.q, "2026-10-01", "HWM quarterly");
eq(r1.schedule.highWaterMarks.s, "2026-07-01", "HWM six-monthly");
ok(!("y" in r1.schedule.highWaterMarks), "HWM yearly absent (no due in window)");

// ---- 2. Idempotency: re-run with the advanced schedule, same asOf -> nothing ----
const r2 = PMGenerate.generate({ plan, schedule: r1.schedule, asOf: "2026-12-31", generatedAt: "2026-12-31T00:00:00Z" });
eq(r2.workOrders.length, 0, "idempotent re-run generates nothing");

// ---- 3. Extend the horizon into 2027: the annual falls due and absorbs all ----
const r3 = PMGenerate.generate({ plan, schedule: r1.schedule, asOf: "2027-01-31", generatedAt: "2027-01-01T00:00:00Z" });
const annual = r3.workOrders.find(w => /Yearly/.test(w.title));
ok(annual, "annual WO generated in 2027");
eq(annual.dueDate.slice(0, 10), "2027-01-01", "annual due date");
ok(/absorbs/.test(annual.title), "annual absorbs shorter cadences");
eq(annual.tasks.length, 5, "annual WO includes all tasks (t1..t5)");

// ---- 4. Deterministic ids (safe to re-generate / dedup on) ----
eq(jul.id, "wo_sch_test_s_20260701", "deterministic work-order id");

// ---- 5. Inactive schedule generates nothing ----
const inactive = Object.assign(schedule(), { active: false });
eq(PMGenerate.generate({ plan, schedule: inactive, asOf: "2026-12-31" }).workOrders.length, 0, "inactive schedule");

// ---- 6. Calendar-correct month arithmetic (Jan 31 + 1 month -> Feb 28) ----
const feb = PMGenerate._internals.addMonths(new Date("2026-01-31T00:00:00Z"), 1);
eq(feb.toISOString().slice(0, 10), "2026-02-28", "month-end clamp");

console.log("ok — " + passed + " assertions passed");
