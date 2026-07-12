# 01 — Vision & Scope

## Product vision

Plantree helps maintenance teams get work done. It keeps an accurate register of
the assets an organisation is responsible for, captures the maintenance strategy
for each of them, turns that strategy and any reported faults into work orders,
records the labour, parts and cost consumed against that work, and feeds the
result back into each asset's history so the next decision is better informed.

The measure of success is not feature count. It is whether a technician can
raise, action and close work quickly on a phone in a plant room, whether a
planner can build a PM programme without fighting the tool, and whether a
manager can trust the asset history and the numbers that come out of it.

## The strategic bet: CMMS first, EAM later

There is one defining product decision, and Plantree takes a clear side.

- **A straightforward, easy-to-adopt CMMS** focused on completing maintenance
  work — **this is what Plantree is.**
- A full enterprise EAM platform managing assets from design and procurement
  through operation, renewal and retirement — this is a *direction of travel*,
  reached incrementally, not the starting point.

Reproducing the entire complexity of Maximo in a first release would trade the
things that create real value (work-order speed, mobile usability, clean asset
hierarchies, painless PM) for breadth that most teams never adopt. Plantree
sequences the enterprise and reliability capabilities into later releases and
keeps the core deliberately sharp.

Mainstream systems — IBM Maximo, Fiix, UpKeep, Brightly — converge on the same
foundation: work management, asset records, preventive maintenance, inventory,
mobile access and reporting. That convergence is the map. Plantree starts there
and differentiates on *how good the core feels*, not on how much it does.

## Design principles

1. **The asset spine is sacred.** Asset → strategy → work order → cost →
   history is the backbone. Every module either enriches an asset, generates
   work, consumes resources against work, or reports on the result.
2. **Mobile is a primary interface, not a reduced desktop.** Offline-capable
   field work is a first-class requirement, not an afterthought (see
   [cross-cutting concerns](07-cross-cutting-concerns.md)).
3. **Configurable, with sensible defaults.** Workflows, forms, fields and
   numbering are configurable — but ship with defaults that a small team can
   adopt on day one without an implementation consultant.
4. **History is immutable and versioned.** You must be able to determine
   exactly which procedure, which asset attributes and which strategy applied
   *at the time* historical work was performed. Procedures and PM tasks are
   version-controlled.
5. **Integrate rather than absorb.** Plantree manages the maintenance
   requirement. It hands financial transactions to an ERP/accounting system
   rather than trying to become one. Same posture for identity, BMS/SCADA and
   analytics.
6. **Data quality is a feature.** Import validation, duplicate detection and
   data-quality visibility are part of the product, not operational hygiene
   left to the customer.

## Physical vs functional: a first-class requirement

A hard requirement drawn directly from the target domain (data centres and
similar critical facilities): **an asset can belong to two independent
hierarchies at once.**

- A **physical hierarchy** — Site → Building → Room → precise Location.
- A **functional / system hierarchy** — the service or system the asset
  supports.

> A UPS physically sits in *Electrical Room 2* but functionally supports
> *Power Train A*. Both are true simultaneously and both are needed — physical
> for "where do I go", functional for "what breaks if this fails".

This dual-hierarchy capability is not a later add-on; it shapes the core domain
model from the start (see [domain model](02-domain-model.md)).

## In scope for the product

Assets and hierarchy · work requests and work orders · preventive maintenance ·
job plans and task templates · planning and scheduling · inspections and rounds
· mobile field work with offline · parts, inventory and tools · procurement and
contracts (managed, ERP-integrated) · contractors and permits · notifications ·
reporting and dashboards · reliability and asset-performance management ·
integration and automation · administration and governance.

The [modules document](04-modules.md) breaks each of these into capabilities and
maps them to releases.

## Explicitly not in scope (or deferred)

- **Not a financial system.** No general ledger, no payroll, no AP/AR. Plantree
  captures maintenance cost and hands transactions to an ERP.
- **Not an HR system.** It models crews, skills and competencies for scheduling;
  it integrates with HR/identity for the people records themselves.
- **Not a full document management system.** It attaches and references
  documents and integrates with a DMS; it is not the system of record for
  documents.
- **Advanced reliability, predictive maintenance, GIS and capital planning** are
  in scope for the *product* but deferred to later releases — they move Plantree
  from CMMS toward EAM once the core is excellent.

## Primary user roles

| Role | What they need from Plantree |
|------|------------------------------|
| **Requester / operator** | Raise a request or defect in seconds; see it was received. |
| **Technician** | See assigned work, action it on a phone (often offline), record time/parts, close it out. |
| **Planner** | Build PM programmes and job plans; plan and estimate work. |
| **Scheduler / supervisor** | Schedule and dispatch, balance crews, review and close out. |
| **Storeperson** | Manage stock, issue and receive parts, run stocktakes. |
| **Reliability engineer** | Analyse failures, criticality and asset health (later releases). |
| **Administrator** | Configure the system, manage access, govern data quality. |
| **Contractor** | Accept and update work through a scoped portal. |
