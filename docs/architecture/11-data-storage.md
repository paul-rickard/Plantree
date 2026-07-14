# 11 — Data Storage (JSON-backed)

This document records Plantree's data-storage decision and the design that
follows from it. It is effectively an architecture decision record: the *why*,
the *shape*, the *trade-offs*, and the *evolution path*.

## Decision

**JSON documents are Plantree's canonical representation and system of record.**
Every record is a human- and machine-readable JSON document that conforms to a
published JSON Schema. The physical persistence layer is *pluggable*, but it must
always round-trip losslessly to and from plain JSON documents.

## Why

Two goals drive this, both stated as product priorities:

1. **AI-parseable.** An LLM (or any tool) can read a Plantree dataset directly —
   self-describing field names, string enums, ISO-8601 timestamps, explicit
   units, and documents that carry the context needed to reason about them (a
   work order embeds the exact procedure snapshot it was executed against). No
   proprietary binary format, no ORM indirection, no join-graph to reconstruct.
2. **Portable / no lock-in.** If the application ever needs to be ported, rebuilt
   or handed to another team, the data is *already* in the most universal format
   there is. "Bulk export" is not a feature to build — the on-disk form **is**
   the export. Migrating stores means moving JSON, not reverse-engineering a
   schema.

A third benefit falls out for free: this fits the domain model we already have.
Cost and stock balances are [derived from immutable records](02-domain-model.md#notes-on-key-relationships),
versioning and the [work-order snapshot](10-maintenance-strategy-application.md#the-work-order-snapshot)
are frozen JSON objects, and audit is an append-only log. The model was already
document- and event-oriented; JSON storage reinforces it rather than fighting it.

## Documents and aggregates

Without joins, you design around **aggregates** — consistency boundaries that are
read and written as a unit. The core modelling decision is *what is a top-level
document* versus *what is embedded inside one*.

| Aggregate root (one document) | Embeds | References (by id) |
|-------------------------------|--------|--------------------|
| `Asset` | identifiers, custom attributes, current status | assetType, location, functionalLocation, parent |
| `Location` / `FunctionalLocation` node | — | parent |
| `AssetType` | default attribute schema | parent type, compatible parts |
| `JobPlan` | **all versions** (array of immutable version objects), each with its tasks | — |
| `MaintenanceStrategy` | its schedules, its applicability rules | job plans (by id+version) |
| `AssetException` | the deviation detail | asset, strategy |
| `WorkOrderType` | presentation & default flags | — (small reference catalogue) |
| `WorkRequest` | — | asset/location, resulting work order |
| `WorkOrder` | **content snapshot**, tasks, labour entries, parts usage, failure report, comments | asset, work-order type (by code), schedule/request, permits, attachments |
| `Part` | per-store stock policy (min/max/reorder) | compatible asset types |
| `Store` | its bins | — |
| `Supplier` / `Contract` / `PurchaseOrder` | PO lines | supplier, parts |
| `Contractor` / `Permit` | compliance records | work order |
| `User` / `Role` / `Crew` / `Skill` | — | crew members, held skills |
| `FormTemplate` | all versions + questions | — |
| `Inspection` | answers, signature | form template (id+version), asset |

### Two document flavours

1. **Entity documents** — mutable aggregate roots. Each carries an optimistic
   `rev` (revision) integer for concurrency control.
2. **Append-only logs** — immutable event records that are never updated:
   - `InventoryTransaction` — every stock movement.
   - `AuditEvent` — every change, for governance.
   - `LabourEntry` and `PartsUsage` are embedded in their work order but are
     themselves append-only within it.

   Derived state — **stock balances, cost roll-ups, actual hours** — is *computed
   by folding the log*, never stored as an authoritative figure. This is exactly
   the [reserve-then-consume](05-work-management-lifecycle.md) and
   ["cost is derived"](02-domain-model.md#notes-on-key-relationships) behaviour
   the domain model already specifies. Materialised balances, if needed for
   performance, are a cache keyed by the last event applied — never the source of
   truth.

## Example documents

A work order, self-contained — note the embedded `snapshot` that freezes the
procedure actually performed, so history stays truthful after the live job plan
changes:

```json
{
  "id": "wo_01HB2K...",
  "type": "workOrder",
  "rev": 7,
  "organizationId": "org_plantree",
  "workOrderNumber": "WO-2026-004182",
  "assetId": "ast_ups_a2",
  "workOrderTypeCode": "PM",
  "status": "completed",
  "priority": 3,
  "provenance": { "scheduleId": "sch_ups_qtr_inspection" },
  "snapshot": {
    "jobPlanId": "jp_ups_quarterly_inspection",
    "jobPlanVersion": 4,
    "parameters": { "batteryStringCount": 3, "acceptableImpedanceMilliOhm": 4.5 },
    "tasks": [
      { "seq": 1, "instruction": "Record input/output voltage", "responseType": "numeric", "unit": "V" },
      { "seq": 2, "instruction": "Battery impedance per string", "responseType": "numeric", "acceptableRange": [0, 4.5] }
    ]
  },
  "labour": [
    { "id": "lab_1", "userId": "usr_jsmith", "hours": 1.5, "date": "2026-07-10" }
  ],
  "parts": [
    { "partId": "prt_air_filter_g4", "plannedQty": 1, "reservedQty": 1, "consumedQty": 1 }
  ],
  "failure": null,
  "createdAt": "2026-07-08T02:11:00Z",
  "updatedAt": "2026-07-10T05:42:00Z"
}
```

An inventory transaction — one immutable line in an append-only log; the current
on-hand for a part/bin is the sum of these:

```json
{ "id": "itx_9f3", "type": "inventoryTransaction", "partId": "prt_air_filter_g4",
  "binId": "bin_syd1_a_03", "txnType": "issue", "quantity": -1,
  "workOrderId": "wo_01HB2K...", "at": "2026-07-10T05:40:00Z", "by": "usr_jsmith" }
```

## Schemas as the contract

Each document type has a **JSON Schema** in a `schemas/` set. Schemas serve three
audiences at once: humans reading the model, the application validating writes,
and an AI reasoning about or generating records. A fragment:

```json
{
  "$id": "https://plantree/schemas/asset.json",
  "title": "Asset",
  "type": "object",
  "required": ["id", "type", "organizationId", "assetNumber", "locationId", "status"],
  "properties": {
    "id":            { "type": "string" },
    "type":          { "const": "asset" },
    "assetNumber":   { "type": "string" },
    "locationId":    { "type": "string", "description": "physical placement — required" },
    "functionalLocationId": { "type": ["string", "null"], "description": "service/system placement — optional" },
    "status":        { "enum": ["proposed", "operating", "isolated", "failed", "retired"] },
    "criticality":   { "type": "integer", "minimum": 1, "maximum": 5 }
  }
}
```

The schema set *is* the data dictionary made executable; the prose in
[doc 03](03-data-dictionary.md) and these schemas are two views of one model.

## Referential integrity, without a foreign-key engine

There is no database enforcing references, so integrity is upheld deliberately —
which the product already treats as [a feature, not hygiene](07-cross-cutting-concerns.md#administration--governance):

- **Convention.** References are `…Id` fields holding opaque string ids.
- **Validation on write.** Every write passes schema validation *and* a
  referential check (do the referenced documents exist, in this tenant?). This is
  the same layer that does import validation and duplicate detection.
- **Integrity checker.** A standalone pass can validate an entire dataset
  (dangling references, orphans, broken version pins) — trivial precisely because
  everything is readable JSON. This doubles as the data-quality dashboard's
  source.

## Concurrency & consistency

- **Optimistic concurrency** via the `rev` field, surfaced as the API's
  [ETag/version](06-api-surface.md#cross-cutting-api-conventions). A write with a
  stale `rev` is rejected, not silently merged — this is what makes the
  [offline mobile sync](07-cross-cutting-concerns.md#mobile--offline) safe.
- **Single-document writes are atomic.** Aggregate boundaries are chosen so the
  common operations (update a work order, add a labour entry) touch exactly one
  document. Cross-aggregate consistency (e.g. issuing stock when a work order
  completes) is achieved through the **append-only log + idempotent operations**
  already in the API design, not multi-document transactions.
- Append-only logs are contention-free for writers (append, don't update).

## Physical layout — pick per deployment, contract unchanged

The canonical JSON is fixed; *where the bytes live* is a deployment choice. All
three options store the same documents and export the same JSON.

| Option | What it is | Best for |
|--------|-----------|----------|
| **1. Flat files (default)** | One `.json` file per document, append-only logs as `.jsonl`, laid out per tenant/collection (below). Git-diffable, zero infra, copy-to-backup. | Small/single-site, dev, demos, edge/plant-room appliances, and anyone who wants to read or port the data by hand. **Recommended default given the goals.** |
| **2. Embedded doc store** | Same JSON in SQLite (JSON1) or a file-based document DB — adds indexing, transactions and safe concurrency while staying single-file and JSON-exportable. | Single-server production with real concurrency, without standing up a database server. |
| **3. Postgres JSONB / document DB** | Documents as JSONB rows with GIN indexes (or MongoDB), full transactions and indexed queries. | Large fleets, multi-tenant SaaS, heavy reporting. |

Recommended default filesystem layout (option 1):

```
data/
  <organizationId>/
    assets/            ast_ups_a2.json ...
    asset-types/
    locations/         functional-locations/
    job-plans/         strategies/   asset-exceptions/
    work-requests/     work-orders/
    parts/  stores/    form-templates/  inspections/
    suppliers/  purchase-orders/  contracts/
    users/  roles/  crews/  contractors/  permits/
    logs/
      inventory.jsonl        # append-only stock movements
      audit.jsonl            # append-only change log
schemas/                      # JSON Schema per document type (tenant-independent)
```

Tenancy falls out naturally: **each `organizationId` is a top-level directory**,
which also settles the [previously-deferred isolation question](07-cross-cutting-concerns.md#multi-tenancy)
— tenants are physically separated by default and nothing reads across the
boundary.

**Target deployment.** In Plantree's [serverless, file-based deployment](12-deployment.md),
option 1 is realised as a **SharePoint document library** synced with OneDrive —
the folder tree above becomes library folders, SharePoint's per-file version
history provides [versioning](#versioning) and its ETags provide the `rev` for
concurrency. One difference: the append-only logs are written as **one file per
event** (`logs/inventory/itx_….json`, `logs/audit/….json`) rather than single
`.jsonl` files, because concurrent appends from synced clients would collide —
the fold-to-derive semantics are unchanged. See [deployment](12-deployment.md).

**Evolution path:** start at option 1 or 2; move to option 3 when scale or
concurrency demands it. Because the document schemas never change, this is a data
copy, not a rewrite — which is the entire point of choosing JSON.

## Querying & reporting

- **Indexed stores (2, 3)** query natively.
- **Flat files (1)** build in-memory indexes on load and/or maintain sidecar
  index files; reporting reads documents and folds the logs. Every KPI still
  [drills to the underlying records](04-modules.md) — the records are right there
  as JSON.

This is the honest scale limitation: flat-file reporting is fine at modest
volumes and gets slow as collections reach the hundreds-of-thousands. That is the
signal to move to option 2/3 — not to change the model.

## Trade-offs (stated plainly)

**Gains:** portability and zero lock-in; human/AI readability; git-friendly diffs
and history; backup by copy; no schema-migration ceremony (documents are additive
and self-describing); a natural fit for versioning, snapshots and audit.

**Costs, and how they're mitigated:**

| Cost | Mitigation |
|------|-----------|
| No engine-enforced referential integrity | Schema + referential validation on write; standalone integrity checker; data-quality dashboard. |
| Weaker ad-hoc/relational queries at scale | Indexes / sidecar indexes / materialised balances; move to JSONB (option 3) when needed. |
| Cross-aggregate transactions | Aggregate design keeps writes single-document; append-only log + idempotent ops for the rest. |
| Very large collections strain flat files | Partition by tenant/time; or adopt option 2/3 — same schemas. |
| Full-text search | Sidecar search index, or an external search engine later. |

## What this changes elsewhere

- The [data dictionary](03-data-dictionary.md) field semantics become concrete
  JSON Schemas; its "types firm up when a database is chosen" caveat is now
  resolved — the types are JSON.
- The [API](06-api-surface.md) already returns/accepts JSON; bulk export is the
  on-disk format, and OpenAPI request/response schemas are generated from the
  same document schemas.
- [Multi-tenancy isolation](07-cross-cutting-concerns.md#multi-tenancy) is settled
  as per-tenant document partitions.
- The broader application stack (language, runtime, UI framework) remains open —
  only the **data representation and system of record** are decided here.
