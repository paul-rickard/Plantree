# Plantree

Plantree is an open-source CMMS (Computerised Maintenance Management System) for
managing equipment, maintenance strategies, job plans, work orders and asset
history.

Everything in Plantree hangs off one relationship:

```
Asset → maintenance strategy → work order → labour / parts / costs → asset history & performance
```

The goal is to be **an unusually good CMMS first** — fast work orders, great
mobile, clean asset hierarchies and painless preventive maintenance — rather
than a cut-down enterprise EAM. The path toward full EAM (reliability,
prediction, lifecycle) is a deliberate later-release direction.

## Architecture

The product and technical architecture lives in
[`docs/architecture/`](docs/architecture/README.md). Start there for the domain
model, module breakdown, work-order lifecycle, API surface and release roadmap.

| Document | Covers |
|----------|--------|
| [Vision & scope](docs/architecture/01-vision-and-scope.md) | Positioning, the CMMS-first bet, what's in and out of scope |
| [Domain model](docs/architecture/02-domain-model.md) | Core entities, ERD, bounded contexts |
| [Data dictionary](docs/architecture/03-data-dictionary.md) | Attributes and semantics for the core entities |
| [Modules & capabilities](docs/architecture/04-modules.md) | The 14 functional modules, mapped to releases |
| [Work management lifecycle](docs/architecture/05-work-management-lifecycle.md) | The work-order state machine |
| [API surface](docs/architecture/06-api-surface.md) | Resource-oriented API design and core resource map |
| [Cross-cutting concerns](docs/architecture/07-cross-cutting-concerns.md) | Multi-tenancy, security, mobile/offline, integration, governance |
| [Release roadmap](docs/architecture/08-roadmap.md) | MVP → Release 4 sequencing |
| [Glossary](docs/architecture/09-glossary.md) | Domain vocabulary |

## Status

Early architecture stage. No implementation stack has been chosen yet — the
architecture is deliberately stack-agnostic so that decision can be made
independently. See the [roadmap](docs/architecture/08-roadmap.md) for the
intended build sequence.
