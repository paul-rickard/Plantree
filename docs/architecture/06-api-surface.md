# 06 — API Surface

Plantree exposes a documented API as a first-class product surface — the mobile
app, integrations and any future UI are all clients of it. This document sets
the design principles and maps the core resources. The concrete contract
(paths, payloads, versioning scheme) firms up when implementation begins; the
*shape* below is the commitment.

## Principles

1. **Resource-oriented and predictable.** Resources mirror the
   [domain model](02-domain-model.md). If you know the entities, you can guess
   the endpoints.
2. **The API is the product boundary.** Every capability available in the UI is
   available through the API. No privileged back channels.
3. **Documented and discoverable.** A machine-readable spec (OpenAPI for REST;
   schema introspection if GraphQL) is generated from the implementation, not
   maintained by hand.
4. **Stable and versioned.** Breaking changes are versioned; additive changes
   are not. Clients — especially the offline mobile client — must not break on a
   deploy.
5. **Tenant- and permission-scoped by default.** Every request is scoped to the
   caller's organisation and filtered by their role and site/asset access. The
   API can never return records the caller may not see.
6. **Events, not just polling.** State changes emit **webhooks**; bulk data
   moves through **import/export**; neither requires clients to poll.

## REST vs GraphQL

A decision deferred to implementation, but the leanings are recorded so it is
made deliberately:

- **REST + OpenAPI** is the default leaning — simplest to document, cache,
  secure and consume from an offline mobile client; the resource model is
  naturally RESTful.
- **GraphQL** is attractive for the deeply nested asset/work read side (fetching
  an asset with history, costs and open work in one round trip).
- A viable hybrid: **REST for commands and the write model; a read/query
  endpoint (GraphQL or rich REST filtering) for composite reads.** The resource
  map below is expressed REST-style and translates cleanly either way.

## Core resource map

Standard collection/item semantics apply throughout: `GET` list (filter, sort,
paginate), `POST` create, `GET`/`PATCH`/`DELETE` on an item. Only noteworthy or
non-CRUD endpoints are called out.

### Assets
```
GET/POST   /assets
GET/PATCH  /assets/{id}
GET        /assets/{id}/history            # unified work + failure + inspection + cost history
GET        /assets/{id}/work-orders
GET        /assets/{id}/meters
POST       /assets/{id}/meters/{mid}/readings
GET        /assets/lookup?tag={qr|barcode|nfc|rfid}   # scan-to-find
GET/POST   /asset-types
GET/POST   /locations                      # physical hierarchy (tree query supported)
GET/POST   /functional-locations           # functional/system hierarchy
```

### Maintenance strategy & PM
```
GET/POST   /maintenance-strategies
GET/POST   /job-plans
GET        /job-plans/{id}/versions        # versioned; a version is immutable once published
POST       /job-plans/{id}/versions        # publish a new version
GET/POST   /pm-schedules
GET        /pm-schedules/{id}/forecast      # upcoming due dates/meters
POST       /pm-schedules/{id}/generate      # force generation of due work (also runs on a timer)
```

### Work management
```
GET/POST   /work-requests
POST       /work-requests/{id}/convert     # → work order (returns the new work order)
GET/POST   /work-orders
GET/PATCH  /work-orders/{id}
POST       /work-orders/{id}/transitions   # {to, reason} — drives the state machine (doc 05)
GET        /work-orders/{id}/tasks
PATCH      /work-orders/{id}/tasks/{tid}   # record response / completion
POST       /work-orders/{id}/labour        # LabourEntry
POST       /work-orders/{id}/parts         # PartsUsage reserve/consume
PUT        /work-orders/{id}/failure       # FailureReport (failure/cause/remedy)
POST       /work-orders/{id}/attachments
POST       /work-orders/{id}/comments      # supports @mentions → notifications
```
Transitions are a dedicated endpoint (not a raw `status` PATCH) so that guards,
effects and audit are enforced server-side and consistently.

### Inspections & rounds
```
GET/POST   /form-templates                 # versioned
GET/POST   /inspections
POST       /inspections/{id}/submit        # sign-off; may spawn work-requests on failed items
```

### Inventory & procurement
```
GET/POST   /parts
GET        /parts/{id}/stock?store={id}     # on-hand/available/reserved/on-order (derived)
GET/POST   /stores  ·  /stores/{id}/bins
POST       /inventory/transactions          # issue/return/transfer/adjust/receipt/count
GET/POST   /suppliers  ·  /contracts
GET/POST   /purchase-orders
POST       /purchase-orders/{id}/receive    # goods receipt → inventory receipt txns
```

### People, contractors, permits
```
GET/POST   /users  ·  /roles  ·  /crews  ·  /skills
GET/POST   /contractors
GET/POST   /permits
POST       /permits/{id}/issue  ·  /permits/{id}/return
```

### Platform
```
GET/POST   /notifications  ·  POST /notifications/{id}/acknowledge
GET        /reports/{key}                   # parameterised; every KPI drills to records
GET        /reports/{key}/records           # the underlying rows behind a KPI
POST       /imports        ·  GET /imports/{id}   # bulk CSV/Excel with validation results
GET        /exports/{resource}              # bulk export
GET/POST   /webhooks                        # subscribe to domain events
GET        /audit-events                    # immutable governance log (read-only)
GET        /openapi.json                    # generated spec
```

## Cross-cutting API conventions

- **Filtering, sorting, pagination** are uniform across all collections
  (`?filter[...]`, `?sort=`, cursor pagination). The same query power the UI
  uses is available to API clients.
- **Idempotency** on writes via an idempotency key — essential for the offline
  mobile client replaying a queued mutation after reconnect without
  double-posting labour, parts or transitions.
- **Optimistic concurrency** via entity version/ETag so concurrent edits (e.g.
  two people updating a work order) conflict loudly instead of silently
  overwriting.
- **Webhooks** carry a signed payload of `{event, entity, id, changes}` for
  every significant domain event (work-order transitions, PM generation, stock
  below reorder, contract expiry) so integrations react without polling.
- **Bulk import** returns per-row validation and duplicate-detection results
  rather than failing the whole file — data quality is a product feature, not an
  afterthought.

See [cross-cutting concerns](07-cross-cutting-concerns.md) for authentication,
tenancy enforcement and the offline-sync contract that this API must satisfy.
