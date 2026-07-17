# 13 — Workflow Configuration

The [work-management lifecycle](05-work-management-lifecycle.md) ships a sensible
default, but the states, their names, and the moves between them are **data, not
code** — a [`WorkflowProfile`](../../schemas/workflow-profile.schema.json) an
organisation edits. This document defines that model: how states, transitions,
triggers and guards fit together, and the deliberate choices that keep it small.

> The same machine drives **work requests and work orders** — different profiles,
> one mechanism. A `WorkOrderType` may name a profile; null uses the org default.

## States are just identity + label

A state is `{ id, label }` and nothing more. `id` is stable and referenced by
`WorkOrder.status`, the transitions, and history; `label` is display text you can
rename freely. States are listed in display order, capped at **25** (a longer
lifecycle is a design smell, and a 25-column board is unreadable).

Crucially, states carry **no semantic tags** — no category, no
initial/terminal/pauses-SLA flags. Everything that used to live there is either
*derived* or pushed *downstream*:

| Question | Where the answer comes from |
|----------|-----------------------------|
| Where can work be created? | `entryStates` (explicit) — creation is an action that targets one of these. Requested-style work enters at the first state; PM/scheduled work enters mid-graph (e.g. `planned`). |
| Which states are terminal? | **Derived from the graph**: a state with no outgoing transition (e.g. `closed`, `rejected`). This handles multiple terminals naturally, and a transient state like `cancelled` — which has an outgoing `onEntry` to `closed` — is correctly *not* terminal. |
| Is this state "open" / "in progress" / overdue? | **Downstream rules**, not a property. Board columns are the states themselves; KPIs, overdue and SLA are configurable filters/rules evaluated over the recorded transition history (see below). |

Renaming a state = change `label`. Adding/removing = edit `states[]` and the
transitions; deleting a state that records occupy needs a remap.

## Transitions are first-class

The `transitions[]` array **is** the allowable-transition configuration — a move
not listed is forbidden. (An editor can group them by `from` so it reads as a
per-state "can go to" list; it's the same graph.) Each transition splits into
three orthogonal parts:

- **Trigger** — what initiates it
- **Guards** — boolean expressions that must all hold (else it's blocked, or
  doesn't fire)
- **Actions** — side effects once it succeeds (notify, reserve/deduct parts,
  create follow-up, finalise costs, webhook, run automation)

### Trigger types

| Trigger | Fires when | Example |
|---------|-----------|---------|
| `manual` (default) | a user initiates it; guards gate the button | Approve, Start work |
| `onEntry` | immediately on entering `from` — makes `from` a transient pass-through | `cancelled → closed` at once |
| `timer` | after a dwell in `from` (`afterHours`/`afterDays`), measured from the recorded entry time | `completed → closed` after 5 days |
| `condition` | when its `when` expression becomes true | all tasks done → auto-advance |

### The guard / condition expression language

A small, safe boolean mini-language — **no code execution, no property access,
no globals**. Literals (`number`, `'string'`, `true/false/null`), names
(variables or function calls), the operators `! - * / + - < <= > >= == != && ||`
and parentheses. Names resolve from a scope the host builds per record:

- **History-derived helpers** (built in): `hoursInState([id])`,
  `daysInState([id])`, `inState(id)`.
- **Domain predicates & variables** (host-supplied): `allTasksComplete()`,
  `partsReserved()`, `windowSet()`, `permitsIssued()`, `assigned()`,
  `role('approver')`, `withinApprovalLimit()`, `priority`, `cost`, …

```
daysInState('completed') >= 5
allTasksComplete() && partsReserved()
role('approver') && cost <= approverLimit
```

This is the primary mechanism for "custom" logic. Above it sit two escape hatches
for the genuinely bespoke — an action of type `run_automation` (config *selects*
registered, pre-written behaviour) and `webhook` (raw). The ladder is
**expression → named automation → raw** so the overwhelming majority stays
declarative and auditable.

## Automatic transitions fire lazily

There is no always-on scheduler in the [serverless, file-based
deployment](12-deployment.md), so automatic transitions are evaluated **when a
record is loaded or touched** — the same high-water-mark pattern
[PM generation](10-maintenance-strategy-application.md) uses. Concretely:

- **`onEntry`** runs **synchronously** in the same operation, so
  `cancelled → closed` is atomic — a cancel and its close land together.
- **`timer` / `condition`** are due-checked on load. "Auto-close after 5 days"
  means *the next time the record is opened after day 5, it closes*. The recorded
  transition time is the evaluation moment (a deployment may choose to backdate to
  when it became due — pick one and document it).
- Every automatic transition is **recorded in history** as actor `system` with a
  reason (`"Auto: Completed → Closed after 5d in Completed."`), consistent with
  *all state changes are recorded*.
- Cascades are **loop-protected** — a mis-configured `onEntry` cycle is caught
  rather than spinning.

## Why the history is the substrate

Because every transition is timestamped in `statusHistory`, all the time-shaped
questions compute from it rather than from flags: time-in-state, cycle time,
SLA clocks (including pauses, expressed as rules that reference states), overdue,
and dashboard segments. States stay pure; behaviour is rules over the log. This
is what lets a site rename or re-shape its lifecycle without touching the engine.

## Mapping to the code

- **Schema** — [`schemas/workflow-profile.schema.json`](../../schemas/workflow-profile.schema.json)
  (states, transitions, triggers, actions; the expression language is documented
  in its `$comment`).
- **Engine** — [`apps/work-orders/workflow-engine.js`](../../apps/work-orders/workflow-engine.js):
  the expression evaluator, graph-derived terminality/entry, `available()` (manual
  transitions + guard results), and `advance()` / `apply()` (lazy automatic
  firing, history recording, loop protection). Unit-tested in
  `workflow-engine.test.js`.
- **Default profile** — [`samples/workflow-profiles/wfp_default.json`](../../samples/workflow-profiles/wfp_default.json).
