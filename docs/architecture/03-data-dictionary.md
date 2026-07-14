# 03 — Data Dictionary

Attribute-level definitions for the core entities introduced in the
[domain model](02-domain-model.md). This is a *semantic* dictionary — it defines
what each field means and the rules around it. Storage is **JSON-backed**: each
entity is a JSON document conforming to a published JSON Schema, so these
definitions map directly onto document fields (string ids, string enums,
ISO-8601 timestamps, explicit units). See
[data storage](11-data-storage.md) for the storage model, aggregate boundaries
and example documents/schemas.

Conventions used below:
- **PK** — identity of the record. Every entity has an opaque surrogate id plus,
  where noted, a human-facing number governed by configurable numbering rules.
- **FK** — reference to another entity.
- *Italic* fields are optional.
- All entities carry standard audit fields (`createdAt`, `createdBy`,
  `updatedAt`, `updatedBy`) and a tenant reference (`organizationId`) unless the
  entity *is* the tenant. These are not repeated per-table below.

---

## Asset management

### Asset
The maintainable thing. The most-referenced record in the system.

| Field | Meaning / rules |
|-------|-----------------|
| PK `id` | Surrogate id. |
| `assetNumber` | Human-facing, unique per organization; governed by numbering rules. |
| `name`, `description` | Display name and free text. |
| FK `assetTypeId` | Classification / model class. |
| FK `locationId` | **Physical** placement (Site→Building→Location). Required. |
| *FK `functionalLocationId`* | **Functional / system** placement. Optional, independent of physical. |
| *FK `parentAssetId`* | Parent in the asset (component) hierarchy. |
| *`manufacturer`, `model`, `serialNumber`* | Nameplate data. |
| *`installedOn`, `commissionedOn`* | Lifecycle dates. |
| `status` | `proposed \| operating \| isolated \| failed \| retired`. Drives what work is allowed. |
| `criticality` | Rating on the org's criticality scale; feeds prioritisation and risk. |
| *`consequenceRating`* | Consequence-of-failure rating (paired with criticality). |
| *FK `responsibleTeamId`* | Owning/responsible team. |
| *`expectedLifeMonths`, `replacementCost`* | For lifecycle & renewal planning. |
| *`warranty` / FK `warrantyContractId`* | Warranty and service-contract linkage. |
| *`attributes`* | Extensible custom attributes (typed key/values), defaulted from `AssetType`. |
| *`identifiers`* | QR / barcode / NFC / RFID tag values used for scan-to-find. |
| — documents, drawings, manuals, photos | Held as attachments (see [cross-cutting concerns](07-cross-cutting-concerns.md#attachments--documents)). |
| — history | Work, failure, inspection and cost history are *derived* by query, not stored on the asset. |

### AssetType
Classification and defaults. Reduces per-asset data entry and standardises
custom attributes.

| Field | Meaning |
|-------|---------|
| PK `id` | |
| `code`, `name` | Classification identity. |
| *`parentTypeId`* | Type hierarchy (e.g. Pump → Centrifugal Pump). |
| *`defaultAttributes`* | Attribute schema inherited by assets of this type. |
| *`expectedLifeMonths`* | Default expected life. |
| — compatible parts | Which `Part`s fit this model (many-to-many). |

### Location (physical) & FunctionalLocation
Two structurally identical self-referencing trees with different meaning.

| Field | Meaning |
|-------|---------|
| PK `id` | |
| `code`, `name` | |
| *`parentId`* | Self-reference; forms the tree. |
| `kind` (Location only) | `site \| building \| floor \| room \| position` — the physical granularity. |
| `path` | Materialised ancestry (e.g. `HQ / B2 / ER2`) for fast display and filtering. |

Keeping these as two separate trees — rather than one tree with a "type" flag —
is deliberate: it prevents the physical and functional structures from ever
being conflated and lets an asset sit in both at once.

### Meter
A counter/measurement used to trigger meter-based PM and to record condition.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `assetId` | |
| `name`, `unit` | e.g. "Run hours", `h`. |
| `type` | `continuous \| gauge` (ever-increasing counter vs point reading). |
| `lastReading`, `lastReadingAt` | Cached latest, with full history in readings. |
| *`rollover`* | Max value before wrap, for physical counters. |

---

## Maintenance strategy

The full application model — how these objects combine to apply maintenance at
scale without copying plans onto assets — is in
[maintenance strategy application](10-maintenance-strategy-application.md). This
section defines the entities; that document defines the behaviour.

Six objects work together: **job plan** (*what*), **maintenance schedule**
(*when & where*), **maintenance strategy** (a package of schedules),
**applicability rule** (which assets inherit it), **asset exception** (justified
deviations) and the **work-order snapshot** (what was actually issued — see
[versioning](#versioning)).

### JobPlan (versioned)
Reusable content — *what is done*. The unit that makes PM creation painless. Never
copied onto assets; referenced by schedules.

| Field | Meaning |
|-------|---------|
| PK `id`, `version` | Version-controlled; see [versioning](#versioning). |
| `code`, `name` | |
| `lifecycleState` | `draft \| approved \| active \| superseded \| retired`. |
| `estimatedLabour` | Planned hours, optionally per trade. |
| — tasks | Ordered `JobPlanTask`s. |
| — planned parts | Parts expected to be consumed. |
| — required skills, tools, permits | Prerequisites surfaced onto generated work. |
| *`parameters`* | Named values (e.g. operating voltage, trip time) **resolved from the asset / model template** at generation — one parameterised plan instead of many near-identical copies. |
| `safetyInstructions` | Standing safety notes / references. |

### JobPlanTask (versioned)
One step within a job plan.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `jobPlanId`, `version` | |
| `sequence`, `instruction` | Ordered step text. |
| `responseType` | For check steps: `passfail \| numeric \| text \| choice \| none`. |
| *`acceptableRange`* | Low/high bounds for numeric checks. |
| *`requiredSkillIds`* | Competency needed for this step. |

### MaintenanceSchedule
*When & where* work happens — the trigger that converts a job plan into work at
the right time and place. Belongs to a strategy; references (does not embed) a
job plan, so the same plan runs quarterly at one site and six-monthly at another.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `strategyId` | The strategy this schedule is part of. |
| FK `jobPlanId` (+version pinning policy) | Content to generate. |
| `triggerType` | `calendar \| fixed_date \| meter \| runtime \| event \| condition \| seasonal`. |
| `frequency` | e.g. every 3 months / every 500 h. |
| `recurrenceBasis` | `fixed` (from due date) vs `completion` (from last completion). |
| *`meterId`, `meterInterval`* | For meter/runtime triggers. |
| *`gracePeriod`, `tolerance`* | Completion window before a PM is "missed". |
| *`leadTime`, `seasonalWindow`, `maintenanceWindow`* | Planning settings. |
| *FK `responsibleTeamId`, `priority`* | Default team and work-order priority. |
| `generationMode` | `per_asset` (one work order per applicable asset) or `route` (one work order covering many assets — see [doc 10](10-maintenance-strategy-application.md#routes-for-many-asset-inspections)). |
| `regulatory` | Flag: statutory / compliance PM (affects reporting & deferral rules). |
| `status` | `active \| paused`. |
| — forecast | Next due date/meter is derived; PM forecasting reads across schedules. |

### MaintenanceStrategy
A **package of related schedules** for a class of equipment (e.g. "Standby
Generator – Standard Strategy"). Assigning it applies the whole programme at once.

| Field | Meaning |
|-------|---------|
| PK `id`, `code`, `name` | |
| `approach` | `run_to_failure \| preventive \| condition_based \| predictive`. |
| — schedules | The `MaintenanceSchedule`s it contains. |
| — applicability | The `ApplicabilityRule`(s) that resolve it to assets. |
| *`rationale`* | Why this strategy (links to reliability analysis in later releases). |
| `status` | `draft \| active \| superseded`. |

### ApplicabilityRule
Determines **which assets inherit** a strategy. Evaluated continuously: assets
entering or leaving the criteria gain or lose the strategy (subject to
approval/preview).

| Field | Meaning |
|-------|---------|
| PK `id`, FK `strategyId` | |
| `level` | `class \| subtype \| model \| site \| asset` — the application level; **most specific wins**. |
| `criteria` | Attribute predicate, e.g. `class=CRAH AND status=Operating AND criticality>=3 AND manufacturer=Stulz AND site=SYD1`. |
| `status` | `draft \| active` — draft rules can be impact-previewed before commit. |
| — resolved assets | Derived set; the system can explain *why* each asset matches. |

### AssetException
A justified, visible deviation from an asset's inherited strategy — recorded
instead of copying the strategy onto the asset and breaking inheritance.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `assetId`, FK `strategyId` | The asset and the strategy it deviates from. |
| `kind` | `frequency_change \| add_task \| exclude_task \| different_team \| suspend \| model_specific_procedure`. |
| `detail` | The specifics (e.g. "battery-impedance test every 3 months instead of 6"). |
| *`effectiveFrom`, `effectiveTo`* | For temporary deviations/suspensions. |
| `justification`, `approvedBy` | Why, and who authorised it — surfaced in maintenance reviews. |

---

## Work management

### WorkOrderType
The configurable catalogue of *kinds of work* an organisation performs. Replaces
a hard-coded `type` enum on the work order so the classification can be seeded,
extended and reported on. A `WorkOrder` references one type by `code`. Plantree
seeds a built-in set (`PM`, `RM`, `AD`, `OP`); orgs may add more (e.g. corrective,
project, safety) and re-label, recolour, reorder or deactivate existing ones —
but the seeded (`system`) types can only be deactivated, never deleted, so history
and reporting stay stable.

| Field | Meaning |
|-------|---------|
| PK `id`, `code` | `code` is the human-facing key (`PM`, `RM`, `AD`, `OP`) reported by and referenced from work orders. |
| `name`, *`description`* | Display name and explanation. |
| `category` | `maintenance \| operations \| administrative` — top-level grouping for cost rollups and dashboards. |
| `nature` | `proactive \| reactive \| not_applicable` — drives the proactive-vs-reactive (PM/RM) maintenance KPI. |
| `requiresAsset` | Whether the type must name an asset (maintenance yes; admin/ops often no). |
| `requiresFailureReport` | Whether close-out expects failure/cause/remedy coding (true for reactive). |
| *`workflowProfile`* | Lifecycle profile the type follows; null = the org default (see [doc 05](05-work-management-lifecycle.md#configurability)). |
| *`colour`, `icon`, `sortOrder`* | Presentation in boards, calendars, pickers and charts. |
| `system`, `active` | `system` marks built-in (undeletable) types; `active` controls availability for new work. |

### WorkRequest
Reported demand, before commitment.

| Field | Meaning |
|-------|---------|
| PK `id`, `requestNumber` | |
| FK `assetId` / FK `locationId` | What/where. |
| `summary`, `description` | |
| `reportedBy`, `reportedAt` | Requester and time. |
| `priority` | Requester-suggested; planner may override on the work order. |
| `status` | `submitted \| under_review \| approved \| rejected \| converted`. |
| *FK `workOrderId`* | Set when converted. |
| *`source`* | `portal \| email \| inspection \| alarm \| mobile`. |

### WorkOrder
The costable unit of work. See the [lifecycle](05-work-management-lifecycle.md)
for the state machine.

| Field | Meaning |
|-------|---------|
| PK `id`, `workOrderNumber` | |
| FK `assetId` | Primary asset the work is against. |
| FK `workOrderTypeCode` | The kind of work, referencing a `WorkOrderType` by `code`. Seeded set: `PM \| RM \| AD \| OP`; organisations may add their own. Was a fixed enum; now a configurable catalogue. |
| `priority`, `dueDate` | |
| `status` | The lifecycle state (see doc 05). |
| *FK `scheduleId`* / *FK `workRequestId`* | Provenance: generated by a maintenance schedule or converted from a request. |
| *FK `jobPlanId` + `jobPlanVersion`* | Pinned content version used. |
| `assignedTo` | Individual, `Crew`, or `Contractor`. |
| `estimatedLabour`, `actualLabour` | Planned vs booked hours (actual derived from labour entries). |
| *`scheduledStart`, `scheduledEnd`* | Set during scheduling. |
| *FK `parentWorkOrderId`* | For multi-stage / follow-up work. |
| *`dependsOn`* | Predecessor work orders (scheduling dependencies). |
| — tasks, labour, parts, failure, permits, attachments, comments | Child records. |

### WorkOrderTask
An instantiated step / checklist item on a work order.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `workOrderId` | |
| FK `jobPlanTaskId` + version | Origin (null for ad-hoc steps). |
| `sequence`, `instruction` | Copied from the pinned job-plan version. |
| `responseType`, `response`, *`recordedRange`* | Captured result and any reading. |
| `completed`, `completedBy`, `completedAt` | |

### LabourEntry
Time booked against work. The basis of labour cost and utilisation.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `workOrderId` | |
| FK `userId` **or** `crewId` | Who. |
| `hours`, `date` | |
| *`rate`, `trade`* | For cost roll-up and multi-trade work. |
| *`startAt`, `endAt`* | For timer-based capture. |

### FailureReport
Failure/cause/remedy coding — the raw material for reliability analysis.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `workOrderId` | |
| `failureCode`, `causeCode`, `remedyCode` | From configurable, taxonomy-aligned code lists. |
| *`downtimeStart`, `downtimeEnd`* | For availability / MTBF / MTTR. |
| *`observations`* | Free text and meter readings at failure. |

---

## Inspections & rounds

### FormTemplate (versioned)
Definition of an inspection or round form.

| Field | Meaning |
|-------|---------|
| PK `id`, `version` | Versioned like job plans. |
| `name`, `purpose` | e.g. operator round, compliance inspection, calibration, condition assessment. |
| — questions | Ordered items: pass/fail, numeric (+range), text, choice; conditional visibility rules. |
| — rules | Mandatory readings/photos; auto-defect creation on fail; escalation on critical finding. |

### Inspection
A completed form instance.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `formTemplateId` + version | |
| FK `assetId` / FK `locationId` | Target. |
| `performedBy`, `performedAt`, *`location`* | Sign-off, timestamp, GPS evidence. |
| — answers | Responses; out-of-range/failed answers may spawn a `WorkRequest`. |
| *`signature`* | Electronic sign-off. |

---

## Inventory & procurement

### Part
A catalogue item.

| Field | Meaning |
|-------|---------|
| PK `id`, `partNumber` | |
| `name`, `description`, *`manufacturerPartNo`* | |
| `unitOfIssue` | e.g. each, m, L. |
| `serialised`, `repairable` | Serial tracking and rotable-spare behaviour. |
| *`shelfLifeDays`, `lotTracked`* | Expiry and lot/batch control. |
| — compatible asset types | Many-to-many with `AssetType`. |
| — stock levels | On-hand / available / reserved / on-order are computed per `Store` from transactions. |
| *`min`, `max`, `reorderPoint`* | Per store, drive reorder alerts. |

### Store / Bin
Physical stocking locations. `Store` is a stockroom; `Bin` is a location within.

### InventoryTransaction
The single source of truth for stock movement. Balances are derived from these.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `partId`, FK `binId` | |
| `type` | `receipt \| issue \| return \| transfer \| adjust \| count`. |
| `quantity` (signed) | |
| *FK `workOrderId`* | Links consumption to work. |
| *`lot`, `serial`, `expiry`* | For lot/serial/shelf-life tracking. |

### PartsUsage
The reserve-then-consume link between work and stock.

| Field | Meaning |
|-------|---------|
| PK `id`, FK `workOrderId`, FK `partId` | |
| `plannedQty`, `reservedQty`, `consumedQty` | Reserved at scheduling; deducted on issue. |
| *`unitPriceAtUse`* | Snapshotted for cost. |

### Supplier / PurchaseOrder / Contract
Managed procurement — Plantree captures the requirement and hands the financial
transaction to ERP.

| Entity | Key fields |
|--------|-----------|
| `Supplier` | code, name, contacts, performance score. |
| `PurchaseOrder` | number, supplier, lines (part, qty, price), status (`requisition \| approved \| ordered \| received`), *ERP reference*. |
| `Contract` | supplier, type (`service \| warranty`), value, start/expiry, alert thresholds, rate card / call-out fees. |

---

## People, contractors & access

| Entity | Key fields |
|--------|-----------|
| `User` | identity ref (SSO), name, role(s), team, skills, active. |
| `Role` | permission set; site/asset-level scoping (see [governance](07-cross-cutting-concerns.md#administration--governance)). |
| `Crew` | named group of users for scheduling/dispatch. |
| `Skill` | competency/licence/cert with optional expiry; held by users, required by tasks. |
| `Contractor` | company, contacts, insurance/licence expiries, induction & competency records, performance score. |
| `Permit` | type (`permit_to_work \| isolation \| loto`), status, linked work order, issued/returned, evidence. |

---

## Platform (cross-cutting)

| Entity | Key fields |
|--------|-----------|
| `Notification` | rule, subject, channel (`in_app \| email \| sms \| teams \| slack`), state (`pending \| sent \| acknowledged \| suppressed`). |
| `AuditEvent` | entity, entity id, action, actor, timestamp, before/after diff. Immutable. |

---

## Versioning

`JobPlan`, `JobPlanTask` and `FormTemplate` are **version-controlled**. Job plans
move through a controlled lifecycle — `draft → approved → active → superseded →
retired` — and the rules are:

- Editing a published version creates a **new version**; prior versions are
  retained, never mutated. Future work uses the new **active** version.
- **Open work** either retains its original version or is *deliberately* upgraded
  — never silently.
- **Completed work permanently retains the version actually performed.**

### The work-order snapshot

Pinning a version reference is not enough on its own — a live reference could make
an old work order appear to have followed today's procedure. So when a schedule
generates a work order, Plantree **snapshots** the applicable content onto it: the
pinned job-plan version, the parameter values resolved from the asset/model, the
tasks, readings and acceptance criteria, and any active `AssetException`. The
snapshot is what the technician executes and what history keeps.

Therefore any historical record can always be shown with the *exact* instructions,
parameters and acceptance criteria that applied when it was performed — even years
later, after the plan, parameters or strategy have changed many times. This is
what makes Plantree's history trustworthy for audit, compliance and reliability
analysis. The full model is in
[maintenance strategy application](10-maintenance-strategy-application.md#the-work-order-snapshot).
