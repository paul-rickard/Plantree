# Plantree Architecture

This directory is the product and technical architecture for **Plantree**, an
open-source CMMS (Computerised Maintenance Management System) for managing
equipment, maintenance strategies, job plans, work orders and asset history.

These documents describe *what* the product is and *how it is structured* — the
domain model, the module boundaries, the core workflows and the release
sequence. Two foundations are decided: storage is [JSON-backed](11-data-storage.md)
(for AI-parseability and portability), and the target deployment is
[serverless and file-based on SharePoint](12-deployment.md). The remaining
application-stack choices (language, UI framework) are deliberately left open so
they can be made independently later.

## The central idea

Everything in Plantree hangs off one relationship:

```
Asset → maintenance strategy → work order → labour / parts / costs → asset history & performance
```

Get that spine right — clean asset hierarchies, fast work orders, painless PM
creation, good mobile — and the product is valuable before any of the advanced
reliability or predictive features exist. Plantree aims to be **an unusually
good CMMS first**, not a cut-down Maximo. The path from CMMS toward full EAM is
explicitly a later-release concern (see the [roadmap](08-roadmap.md)).

## Reading order

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [Vision & scope](01-vision-and-scope.md) | Product positioning, the CMMS-first bet, in/out of scope |
| 02 | [Domain model](02-domain-model.md) | Core entities, the entity-relationship diagram, bounded contexts |
| 03 | [Data dictionary](03-data-dictionary.md) | Attributes and semantics for the core entities |
| 04 | [Modules & capabilities](04-modules.md) | The 14 functional modules mapped to bounded contexts and releases |
| 05 | [Work management lifecycle](05-work-management-lifecycle.md) | The work-order state machine and its rules |
| 06 | [API surface](06-api-surface.md) | Resource-oriented API design principles and the core resource map |
| 07 | [Cross-cutting concerns](07-cross-cutting-concerns.md) | Multi-tenancy, security, mobile/offline, integration, admin, NFRs |
| 08 | [Release roadmap](08-roadmap.md) | MVP → Release 4 sequencing and rationale |
| 09 | [Glossary](09-glossary.md) | Domain vocabulary |
| 10 | [Maintenance strategy application](10-maintenance-strategy-application.md) | How plans reach assets: class/model application, applicability rules, exceptions, routes, snapshots |
| 11 | [Data storage](11-data-storage.md) | JSON-backed storage: canonical documents, aggregates, schemas, physical layouts, trade-offs |
| 12 | [Deployment](12-deployment.md) | Serverless, file-based on SharePoint: file workflow, lazy automation, concurrency, trade-offs, evolution path |
| 13 | [Workflow configuration](13-workflow-configuration.md) | The lifecycle as data: configurable states, first-class transitions, triggers, the guard expression language, lazy automatic firing |

## Status

These are living design documents. They capture intent and structure, not
commitments to a schema or an API contract — those firm up when implementation
begins. Where a decision is deliberately deferred, the document says so.
