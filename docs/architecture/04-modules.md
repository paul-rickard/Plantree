# 04 — Modules & Capabilities

The product concept is organised into 14 functional areas. This document keeps
that structure, but for each area it records: the **bounded context** it lives
in (see [domain model](02-domain-model.md#bounded-contexts)), the **release** it
first lands in (see [roadmap](08-roadmap.md)), and the concrete capabilities.

Release key: **MVP** · **R2** · **R3** · **R4**.

---

## 1. Asset register — *Asset Management* — MVP

The register is the foundation; everything references an asset.

- Asset number, name, description; type & classification.
- Site / building / room / precise location (**physical** hierarchy).
- System & functional-location hierarchy (**functional**), independent of
  physical — a UPS in Electrical Room 2 supporting Power Train A.
- Parent/child asset (component) hierarchy.
- Manufacturer, model, serial; install & commission dates.
- Status: proposed · operating · isolated · failed · retired.
- Criticality & consequence rating; ownership & responsible team.
- Warranty & service-contract linkage; expected life & replacement cost.
- Technical specs & custom attributes (defaulted by asset type).
- Documents, drawings, manuals, photos.
- QR / barcode / NFC / RFID identification for scan-to-find.
- Complete work, failure, inspection and cost history (derived by query).

## 2. Work management — *Work Management* — MVP (core), R2 (failure codes, config workflow)

The operational heart. See the [lifecycle](05-work-management-lifecycle.md).

- Work & service requests; faults, defects, corrective work.
- Planned and unplanned work orders; priority, criticality, due dates.
- Assignment to individuals, crews or contractors.
- Configurable status workflow.
- Labour estimates & actual hours; planned & consumed materials.
- Tools, permits and access requirements.
- Procedures, checklists, safety instructions.
- Photos, files, notes, technician comments.
- Failure / cause / remedy codes *(R2)*.
- Meter readings & condition observations.
- Follow-up work creation; supervisor review & close-out approval.
- Full change & audit history.

## 3. Preventive maintenance — *Maintenance Strategy* — MVP (time/calendar/meter), R2 (advanced triggers, routes, fleet rules)

The application model — apply once, assign by rule, generate per asset only when
needed — is detailed in
[maintenance strategy application](10-maintenance-strategy-application.md).

- **Separate plan from schedule:** versioned job plans (*what*) referenced by
  maintenance schedules (*when & where*); one plan serves many frequencies.
- **Strategies as packages** of schedules, applied to a class of equipment in one
  action (e.g. commissioning a generator applies its whole programme).
- **Class / subtype / model / site / asset application** with most-specific
  override, and a visible explanation of *why* a plan applies.
- **Parameterised plans** — values (voltage, trip time, …) resolved from the
  asset/model template instead of duplicating near-identical plans.
- **Asset exceptions** — justified, visible deviations rather than copied plans.
- **Applicability rules** over asset attributes with an **impact preview** and
  approval before fleet-wide changes *(R2)*.
- Time / calendar / meter schedules; runtime / cycle / consumption, event- and
  condition-based triggers *(R2/R4 for condition)*; seasonal maintenance.
- Fixed-date vs completion-based recurrence.
- Automatic work-order generation with **content snapshot**; PM forecasting.
- Task bundling; route-based maintenance *(R2)*.
- Grace periods & completion tolerances; missed / overdue / deferred handling.
- Regulatory & statutory flags.

## 4. Planning & scheduling — *Work Management* — R2

- Calendar, list, Gantt and Kanban views; drag-and-drop.
- Crew & technician availability; skills / licences / competencies.
- Shift & roster calendars; estimated labour & duration.
- Parts & tool availability checks; maintenance windows.
- Operational outage coordination; backlog management.
- Weekly scheduling, daily dispatch; schedule-compliance measurement.
- Multi-trade, multi-stage work; dependencies between work orders.

## 5. Inspections & rounds — *Inspections & Rounds* — R2

- Configurable digital forms; pass/fail, numeric, text, multiple-choice.
- Acceptable operating ranges; mandatory readings & photos; conditional
  questions.
- Automatic defect creation; automatic escalation for critical findings.
- Operator rounds; compliance inspections; condition assessments; calibration
  records.
- Electronic sign-off; timestamp & location evidence; offline completion.

## 6. Mobile technician experience — *cross-cutting* — MVP (mobile web), R2 (offline, scanning)

Mobile is a **primary interface**, not a reduced desktop. See
[cross-cutting concerns](07-cross-cutting-concerns.md#mobile--offline).

- View & update assigned work; work offline and sync later *(R2)*.
- Scan QR/barcodes *(R2)*; access asset history, drawings, manuals.
- Complete checklists & readings; add photos, video, voice notes.
- Record time & parts; request assistance or reassignment.
- Capture customer/supervisor signatures; create follow-up defects.
- Push notifications.

## 7. Parts, inventory & tools — *Inventory & Procurement* — R2

- Parts catalogue; multiple stores & bin locations.
- On-hand / available / reserved / on-order quantities.
- Parts associated with asset models; issue / return / transfer / adjust.
- **Reserve-then-consume**: reserve on schedule, deduct on issue/consumption.
- Min/max, reorder points; cycle counts & stocktakes.
- Serialised & repairable spares; shelf-life; lot/batch tracking.
- Tool issue & return; supplier & price history.
- Stockout & obsolete-inventory reporting.

## 8. Procurement & contracts — *Inventory & Procurement* — R3

Manage the requirement; hand the financial transaction to ERP.

- Requisitions & approval workflows; RFQs; purchase orders; goods receipt.
- Invoice matching / ERP hand-off; supplier catalogue.
- Contractor records; service agreements; warranty claims.
- Contract values & expiry alerts; supplier performance; rate cards & call-out
  fees.

## 9. Contractors & permits — *People, Contractors & Access* — R3

- Contractor portal; work acceptance & progress updates.
- Insurance & licence expiry; induction & competency records.
- Site access requirements; SWMS; risk assessments / JHAs.
- Permit-to-work; isolation and lockout/tagout records.
- Contractor timesheets & charges; completion evidence; performance scores.

## 10. Notifications & operational communication — *Platform* — MVP (core), R2/R3 (channels, escalation)

- Assignment / reassignment; due & overdue warnings; critical-fault escalation.
- Parts-availability, warranty & contract-expiry alerts.
- In-app, email, SMS, Teams, Slack.
- Time-based escalation; shift-handover notes; watchers/followers.
- Work-order comments & mentions; configurable rules; suppression &
  acknowledgement.

## 11. Reporting & dashboards — *Platform* — MVP (core dashboards), R3 (advanced)

Every KPI must **drill down to the underlying records**. Excel export is
supported but never *required* to understand a result.

- Open & overdue work; work by priority/site/trade/status.
- Planned vs reactive; PM completion & schedule compliance.
- Backlog age & labour weeks; asset availability & downtime; MTBF & MTTR.
- Repeat failures; maintenance cost by asset & system; labour utilisation.
- Parts consumption & stockouts; contractor performance.
- Asset condition & health *(R4)*; regulatory compliance; bad actors / chronic
  faults.

## 12. Reliability & asset-performance management — *Reliability* — R4

Moves Plantree from CMMS toward EAM.

- FMEA; standard failure taxonomies; root-cause analysis.
- RCM strategies; asset health scores; risk & criticality matrices.
- Condition-trend analysis; predictive maintenance; remaining useful life.
- Maintenance optimisation; lifecycle cost; renewal & capital planning; asset
  replacement prioritisation.

## 13. Integration & automation — *Platform* — MVP (API/CSV), R3 (BMS/SCADA/ERP), R4 (IoT/GIS)

- Documented REST/GraphQL API; webhooks; bulk CSV/Excel import & export.
- SCADA/BMS/IoT integrations; automatic work orders from alarms; meter &
  condition ingestion.
- ERP/finance, HR/identity, GIS/floorplan, DMS integration.
- Email-to-work-request; SSO (Entra ID or other IdP); Power BI / analytics.
- Configurable workflow engine; no-code automation rules.

## 14. Administration & governance — *Platform* — MVP (core), R3 (multi-site/tenant depth)

- Multi-company / multi-site / multi-tenant structures.
- Role-based permissions; site- and asset-level access restrictions.
- Configurable fields, forms, statuses; approval limits & delegation.
- Record-numbering rules; audit logs; electronic signatures.
- Data retention & archival; import validation & duplicate detection.
- Data-quality dashboards; localisation, time zones, units; accessibility;
  backup & recovery; API/integration monitoring.

---

## Capability → release matrix (summary)

| Module | MVP | R2 | R3 | R4 |
|--------|:--:|:--:|:--:|:--:|
| 1. Asset register | ● | | | |
| 2. Work management | ● | ◐ | | |
| 3. Preventive maintenance | ● | ◐ | | ◐ |
| 4. Planning & scheduling | | ● | | |
| 5. Inspections & rounds | | ● | | |
| 6. Mobile experience | ◐ | ● | | |
| 7. Parts, inventory & tools | | ● | | |
| 8. Procurement & contracts | | | ● | |
| 9. Contractors & permits | | | ● | |
| 10. Notifications | ◐ | ◐ | ◐ | |
| 11. Reporting & dashboards | ◐ | | ● | ◐ |
| 12. Reliability & APM | | | | ● |
| 13. Integration & automation | ◐ | | ● | ◐ |
| 14. Administration & governance | ◐ | | ● | |

● first substantial delivery · ◐ partial / incremental
