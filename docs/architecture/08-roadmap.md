# 08 — Release Roadmap

The sequencing rationale: **build an unusually good CMMS first.** Work-order
speed, mobile usability, clean asset hierarchies and painless PM creation create
more value than reproducing the full complexity of an enterprise EAM in release
one. Each release is a coherent, shippable step — not a feature dump — and the
order is chosen so the [asset spine](02-domain-model.md#the-spine) is solid
before anything is built on top of it.

## Release 1 — MVP: the maintenance loop works end to end

**Goal:** a small team can register assets, raise and complete work, run basic
PM, and see what's going on — on desktop and mobile web.

- **Asset register & dual hierarchy** — assets, types, physical location tree,
  functional/system tree, parent/child, custom attributes, status, criticality,
  attachments, tag identification.
- **Work management (core)** — work requests, work orders, the default
  [lifecycle](05-work-management-lifecycle.md), tasks/checklists, labour and
  parts capture (basic), attachments, comments, follow-up work, audit history.
- **Preventive maintenance (core)** — versioned job plans & task templates,
  time/calendar/meter schedules, automatic work-order generation, PM forecast,
  grace periods, regulatory flags.
- **Mobile web** — assigned work, asset lookup, checklists/readings, photos,
  time & parts, follow-up defects (online; offline lands in R2).
- **Notifications (core)** — assignment, due/overdue, in-app + email.
- **Dashboards (core)** — open/overdue work, planned vs reactive, PM
  completion, backlog; every KPI drills to records.
- **Platform basics** — REST API, CSV import/export with validation, RBAC, audit
  log, configurable numbering, sensible default workflow.

**Why here:** this is the whole spine — asset → strategy → work order → cost →
history — end to end. It is independently useful and is the foundation
everything else attaches to.

## Release 2 — make the field and the planner excellent

**Goal:** deepen the two experiences that decide adoption — the technician in
the field and the planner building the schedule — and turn on inventory.

- **Offline mobile** — full offline capture with idempotent sync; QR/barcode
  scanning.
- **Planning & scheduling** — calendar/list/Gantt/Kanban, drag-and-drop, crew &
  technician availability, skills matching, maintenance windows, dependencies,
  schedule-compliance measurement, daily dispatch.
- **Inspections & rounds** — configurable versioned forms, ranges, conditional
  questions, auto-defect creation, escalation, electronic sign-off, offline
  completion, calibration/condition records.
- **Inventory & tools** — catalogue, stores/bins, reserve-then-consume, min/max
  & reorder points, cycle counts, serialised/repairable spares, shelf-life &
  lot/batch, tool issue/return, stockout reporting.
- **Advanced PM** — runtime/cycle/event triggers, route-based maintenance, task
  bundling, missed/deferred handling.
- **Work management depth** — failure/cause/remedy codes, configurable workflow
  engine.

**Why here:** the MVP proves the loop; R2 makes the day-to-day fast and connects
work to parts. Offline and scheduling are the features that separate a tolerable
CMMS from one people actually like.

## Release 3 — the extended enterprise

**Goal:** bring in the parties and systems around maintenance — contractors,
procurement, ERP, multi-site governance — and open the platform.

- **Procurement & contracts** — requisitions, approvals, RFQs, POs, goods
  receipt, ERP hand-off, supplier catalogue & performance, contracts with expiry
  alerts, rate cards.
- **Contractors & permits** — contractor portal, insurance/licence/induction
  tracking, SWMS/JHA, permit-to-work, isolation/LOTO, contractor timesheets &
  performance.
- **Advanced reporting** — MTBF/MTTR, availability/downtime, cost by asset/system,
  utilisation, contractor performance, bad actors/chronic faults, compliance.
- **Integrations** — documented API depth, webhooks, BMS/SCADA integration,
  automatic work orders from alarms, meter/condition ingestion, ERP & identity
  integration, SSO (Entra ID).
- **Multi-site controls** — deeper multi-company/multi-site/multi-tenant
  structures, site/asset-level access, approval limits & delegation.

**Why here:** these depend on a solid work/asset/inventory core and are where
larger organisations onboard. Doing them earlier would slow the core down for
users who aren't ready for them.

## Release 4 — from CMMS toward EAM

**Goal:** move up the value chain into reliability, prediction and lifecycle —
the enterprise EAM territory — now that the operational core is excellent.

- **Reliability & asset-performance** — FMEA, failure taxonomies, RCA, RCM
  strategies, asset health scores, risk/criticality matrices.
- **Predictive & condition** — condition-trend analysis, predictive maintenance,
  remaining useful life, condition-based PM triggers.
- **Lifecycle & capital** — lifecycle cost, renewal & capital planning, asset
  replacement prioritisation, maintenance optimisation.
- **Advanced platform** — IoT ingestion at scale, GIS/floorplan integration, AI
  assistance.

**Why here:** reliability analysis is only as good as the failure and cost
history feeding it — which the earlier releases have now accumulated. Building it
first would mean sophisticated analysis over empty data.

## Roadmap at a glance

| Release | Theme | Headline capabilities |
|---------|-------|-----------------------|
| **MVP** | The loop works | Asset register + dual hierarchy, work requests/orders, core PM, job plans, attachments, mobile web, notifications, dashboards |
| **R2** | Field & planner | Offline mobile, scanning, planning/scheduling, inspections, inventory, failure codes, configurable workflows |
| **R3** | Extended enterprise | Contractors, procurement, permits, advanced reporting, APIs/webhooks, BMS/SCADA, multi-site controls |
| **R4** | Toward EAM | Reliability analysis, asset health, predictive maintenance, GIS, capital planning, AI assistance |

## Guiding rule

At every release boundary, the question is not "what else can we add?" but
"**is the core still excellent?**" IoT, GIS and predictive capabilities
increasingly differentiate enterprise products, but they earn their place only
after work-order speed, mobile usability, clean hierarchies and painless PM are
genuinely good. That ordering is the product's central bet.
