# Work-order types — out-of-the-box seed set

These documents are the built-in work-order type catalogue Plantree seeds for a
new organisation. Each conforms to
[`schemas/work-order-type.schema.json`](../../schemas/work-order-type.schema.json).
A `WorkOrder` references one of these by its `code` (`workOrderTypeCode`).

Work-order types are **data, not a fixed enum** — an organisation can add its own
(e.g. `CM` Corrective, `PR` Project, `SF` Safety), re-label, recolour, reorder or
deactivate them. The four seeded (`system: true`) types below can be deactivated
but not deleted, so history and reporting stay stable.

| Code | Name | Category | Nature | Asset? | Failure coding? | Default priority |
|------|------|----------|--------|--------|-----------------|------------------|
| `PM` | Preventative Maintenance | maintenance | proactive | required | no | 3 |
| `RM` | Reactive Maintenance | maintenance | reactive | required | yes | 2 |
| `AD` | Administrative | administrative | not_applicable | optional | no | 4 |
| `OP` | Operations | operations | not_applicable | optional | no | 4 |

- **`category`** groups types for cost rollups and dashboards.
- **`nature`** feeds the proactive-vs-reactive (PM/RM) KPI — a core maintenance
  maturity measure. Only `maintenance`-category types carry a proactive/reactive
  nature; the rest are `not_applicable`.
- **`requiresAsset` / `requiresFailureReport`** drive form behaviour: reactive
  breakdowns expect failure/cause/remedy coding; admin and operations work need
  neither an asset nor failure coding.
- **`workflowProfile`** is `null` on all seeds, meaning they follow the org's
  default lifecycle (see
  [work-management-lifecycle](../../docs/architecture/05-work-management-lifecycle.md#configurability)).
  Point a type at a different profile to give it its own state machine.
