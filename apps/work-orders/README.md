# Work orders — the app + PM generation engine

The work-management module: a **work-order app** (board + detail with the
lifecycle state machine) and the **PM generation engine** that feeds it. Together
they close the loop from the [job-plans module](../job-plans/README.md) — a plan
applied to an asset becomes scheduled, dispatched, executed and costed work.

## The app (`app.html`)

A single self-contained app — no server, no build — open it in a browser.

- **Board + list** — work orders grouped by lifecycle category (Open / Active /
  On hold / Done / Rejected), plus incoming **requests**. Search across both.
- **The state machine, live** — a selected order shows exactly the transitions
  its [workflow profile](../../schemas/workflow-profile.schema.json) allows from
  its current state, each with its **guards** evaluated in place: a transition is
  disabled until its checkable guards are met (e.g. *Complete* needs *actuals
  captured*; *Schedule* needs *parts reserved* + *window set*). Role/approval
  guards show as advisory. Rejections and holds prompt for a reason.
- **Do the work** — capture task pass/fail and numeric readings (out-of-range is
  flagged), log labour, watch reserve-then-consume parts and the cost roll-up,
  and read the audited transition **history** as a timeline. Every order carries
  its **content snapshot** (pinned plan version + resolved parameters).
- **Generate PM work** — the topbar button runs the engine below against a seeded
  generator schedule and drops the due (nested) orders straight onto the board;
  press it again and nothing happens — it's idempotent.
- **Convert a request** — triage an incoming request into a reactive work order
  that enters at `requested`, carrying provenance.

## The generation engine

Turns a **maintenance schedule** (a plan applied to an asset) into `planned`
**work orders**, applies task-×-frequency dropping and nesting, and advances
per-frequency high-water marks so re-running is **idempotent** — the behaviour
[doc 05](../../docs/architecture/05-work-management-lifecycle.md#pm-generated-vs-requested-work)
calls for in the serverless, lazy-generation deployment.

## What's here

| File | Purpose |
|------|---------|
| `app.html` | **The app** — board + detail, the state machine driven by the workflow profile. Loads `pm-generate.js` and `workflow-engine.js`. |
| `pm-generate.js` | **PM engine.** Dependency-free. `window.PMGenerate` (browser) or `require(...)` (Node). |
| `pm-generate.test.js` | Node test — 85 assertions (nesting, idempotency, ids, calendar math). |
| `pm-generation-demo.html` | Self-contained browser demo of nested PM generation. |
| `workflow-engine.js` | **Workflow engine.** The configurable state machine (see [doc 13](../../docs/architecture/13-workflow-configuration.md)): a safe guard-expression evaluator, graph-derived terminality, `available()` (manual transitions + guards) and `advance()`/`apply()` (lazy `onEntry`/`timer`/`condition` firing). `window.Workflow` or `require(...)`. |
| `workflow-engine.test.js` | Node test — 34 assertions (expression language, terminality, guards, cancel→closed cascade, lazy timer, loop protection). |

### Configurable workflow

The lifecycle is **data** ([`WorkflowProfile`](../../schemas/workflow-profile.schema.json)),
not code. States are `{id,label}`; transitions are first-class with a **trigger**
(manual / onEntry / timer / condition), **guard expressions**
(`actualsCaptured()`, `role('approver')`, `daysInState('completed') >= 5`) and
**actions**. Terminality is derived from the graph. Automatic transitions fire
**lazily** on load — e.g. cancelling an order cascades `cancelled → closed`
on-entry (recorded as `system`), and `completed → closed` auto-fires after 5 days.
The app renders the action bar and its guard chips straight from the engine; the
board's 5-bucket grouping is a presentation-only `STATE_GROUP` map (a view
concern), so states stay pure. Full model in
[doc 13](../../docs/architecture/13-workflow-configuration.md).

Related contracts: [`maintenance-schedule.schema.json`](../../schemas/maintenance-schedule.schema.json)
(the per-asset schedule + high-water marks) and
[`work-order.schema.json`](../../schemas/work-order.schema.json) (what it emits).
The engine's output validates against the latter.

## How it works

```
generate({ plan, schedule, asOf, generatedAt, horizonDays })
  -> { workOrders, schedule (advanced highWaterMarks), log }
```

1. **Resolve is the app's job.** The engine takes a *resolved effective plan* —
   the snapshot the job-plans app already computes by walking Class → Model →
   Instance inheritance — so timing/nesting/emission stay cleanly separated from
   inheritance resolution.
2. **Due dates.** For each frequency, the k-th occurrence is `anchor + k×(interval×unit)`
   (calendar-correct months/years, with month-end clamping). Only dates after the
   frequency's high-water mark and up to `asOf + leadTimeDays (+ horizonDays)` are
   considered.
3. **Nesting (cannibalism).** Due dates within `mergeWindowDays` of each other
   collapse into **one** work order: the longest-interval frequency drives it and
   absorbs the shorter ones, whose tasks join as the de-duplicated union. So an
   annual due date coincident with 6-monthly, quarterly and monthly yields a
   single annual order carrying every task, not four overlapping ones.
4. **Emission.** Each order enters at `planned`, carries a **content snapshot**
   (pinned plan version + resolved parameters + safety), the merged task list,
   provenance (`scheduleId`, `jobPlanId`+`jobPlanVersion`) and an audited
   `statusHistory`. Ids are deterministic (`wo_<scheduleId>_<freqId>_<yyyymmdd>`).
5. **Idempotency.** Every covered due date advances that frequency's high-water
   mark, so a second run over the same window emits nothing. The high-water marks
   live on the schedule document — the durable state that makes lazy,
   open-the-app generation safe to run repeatedly.

## Deliberately out of scope (for now)

- **Meter/runtime triggers** — this engine handles calendar frequencies (the
  matrix model); runtime/cycle/event triggers are R2 (advanced PM).
- **Reserve-then-consume** — generated orders list planned parts but don't yet
  move stock; that happens at the `scheduled`/`completed` transitions once
  inventory exists.
- **Persistence & scheduling cadence** — *when* generation runs (a server timer
  vs lazy on app-open) is a deployment concern; the engine is a pure function you
  call either way.

## What's next

- **The app** — ✅ done (`app.html`): board + detail, guard-gated transitions,
  task/labour/parts capture, PM generation and request conversion.
- Wire generation into the **job-plans app** so opening an asset with applied
  plans lazily generates its due work (the two apps currently share schemas and
  the engine but not a single shell).
- **Persistence** — save orders back to JSON files (the File System Access flow
  the job-plans app already uses), so the board survives a reload.
- Deeper capture (R2): failure/cause/remedy coding UI, follow-up work orders from
  out-of-range readings, offline sync.
