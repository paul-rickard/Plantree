# 09 — Glossary

Domain vocabulary used throughout the Plantree architecture. Where a term maps
to an entity, the entity name is given in `code font`.

| Term | Meaning |
|------|---------|
| **Asset** (`Asset`) | Any maintainable thing Plantree tracks — equipment, plant, a component. The most-referenced record in the system. |
| **Asset criticality** | A rating of how important an asset is / how severe its failure would be; drives prioritisation, scheduling and risk. |
| **Asset hierarchy (physical)** | Site → Building → Room → precise Location; *where an asset physically is* (`Location`). |
| **Asset hierarchy (functional)** | The service/system an asset supports, independent of where it physically sits (`FunctionalLocation`). A UPS in Electrical Room 2 supporting Power Train A. |
| **Asset status** | proposed · operating · isolated · failed · retired — governs what work is permitted. |
| **Backlog** | Approved/planned work not yet completed; measured by age and labour-weeks. |
| **Bad actor / chronic fault** | An asset (or failure mode) responsible for disproportionate failures or cost; a reliability focus. |
| **Bounded context** | A coherent area of the domain with clear ownership — the seam for modules, API grouping and future services. |
| **CBM (condition-based maintenance)** | Maintenance triggered by measured condition rather than a fixed schedule. |
| **CMMS** | Computerised Maintenance Management System — software to manage maintenance work, assets, PM, inventory and history. What Plantree *is*. |
| **Criticality matrix** | A grid of likelihood × consequence used to rank asset risk. |
| **EAM** | Enterprise Asset Management — the broader discipline of managing assets across their whole lifecycle (design → retirement). Where Plantree heads *after* the CMMS core is excellent. |
| **Failure code** | Coding of an event as failure / cause / remedy (`FailureReport`); the raw material for reliability analysis. |
| **FMEA** | Failure Mode and Effects Analysis — a structured method for identifying how assets fail and the consequences. |
| **Functional location** (`FunctionalLocation`) | A node in the functional/system hierarchy — a position defined by the service it delivers, not its physical place. |
| **Grace period / tolerance** | The window around a PM due date/meter within which completion still counts as on-time. |
| **Job plan** (`JobPlan`) | A reusable, versioned template of tasks, estimated labour, planned parts and safety for a piece of work. |
| **Labour entry** (`LabourEntry`) | Time booked against a work order; the basis of labour cost and utilisation. |
| **LOTO** | Lockout/Tagout — isolation records ensuring energy sources are made safe before work. |
| **Meter** (`Meter`) | A counter/measurement on an asset (run hours, cycles, throughput) used for meter-based PM and condition. |
| **MTBF** | Mean Time Between Failures — average operating time between failures; a reliability KPI. |
| **MTTR** | Mean Time To Repair — average time to restore an asset after failure; a maintainability KPI. |
| **PM (preventive maintenance)** | Scheduled maintenance intended to prevent failure, triggered by time, meter, event or condition. |
| **PM schedule** (`PMSchedule`) | The *trigger* that generates work orders from a job plan at the right time. |
| **Permit-to-work** (`Permit`) | Authorisation controlling when/how hazardous work may proceed; may gate the start of a work order. |
| **Predictive maintenance** | Using condition trends/models to act before failure; forecasts remaining useful life. |
| **Preventive vs reactive** | Planned PM work vs unplanned corrective work; their ratio is a core maintenance-maturity KPI. |
| **RCA (root-cause analysis)** | Structured investigation to find the underlying cause of a failure, not just the symptom. |
| **RCM (reliability-centred maintenance)** | A method for choosing the right maintenance strategy per failure mode and consequence. |
| **Remaining useful life (RUL)** | Estimated time/usage an asset can operate before it needs intervention. |
| **Reserve-then-consume** | Parts are *reserved* when work is scheduled and *deducted* only when issued/consumed — keeping available stock honest. |
| **Route-based maintenance** | One work order covering many assets visited in sequence (e.g. a lubrication round). |
| **Schedule compliance** | The share of scheduled work completed within its window; a planning-quality KPI. |
| **SLA** | Service Level Agreement — response/resolution target driving due dates and escalation. |
| **SWMS / JHA** | Safe Work Method Statement / Job Hazard Analysis — documented hazard controls for a task. |
| **Work order** (`WorkOrder`) | The unit of executable, costable work; the operational heart of the system. |
| **Work request** (`WorkRequest`) | Reported demand for work, before it is committed to (or rejected as) a work order. |
| **Versioning** | Job plans, tasks and forms are version-controlled; historical work pins the version used, so the *exact* instructions that applied are always recoverable. |
