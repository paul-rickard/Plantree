# Work orders — PM generation engine

The link between the [job-plans module](../job-plans/README.md) and work
management: it turns a **maintenance schedule** (a plan applied to an asset) into
`planned` **work orders**, applies task-×-frequency dropping and nesting, and
advances per-frequency high-water marks so re-running is **idempotent** — the
behaviour [doc 05](../../docs/architecture/05-work-management-lifecycle.md#pm-generated-vs-requested-work)
calls for in the serverless, lazy-generation deployment.

## What's here

| File | Purpose |
|------|---------|
| `pm-generate.js` | **The engine.** Dependency-free, no build. Loads as `window.PMGenerate` (browser `<script>`) or `require("./pm-generate.js")` (Node). |
| `pm-generate.test.js` | Node test — 85 assertions on nesting, idempotency, deterministic ids and calendar math. Run: `node apps/work-orders/pm-generate.test.js`. |
| `pm-generation-demo.html` | Self-contained browser demo — set an anchor / horizon / merge window and watch the nested work orders fall out. |

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

- Wire the engine into the job-plans app so opening an asset with applied plans
  lazily generates its due work.
- A work-order **list/board + detail** view with the state machine driven by the
  [workflow profile](../../schemas/workflow-profile.schema.json) (transition
  buttons gated by guards).
- The `WorkRequest → WorkOrder` **convert** flow.
