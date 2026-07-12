# 07 — Cross-Cutting Concerns

Concerns that touch every module: tenancy, security, the mobile/offline
contract, integration posture, administration/governance, and the
non-functional targets the product holds itself to. These are architectural
constraints, not features — they shape how every other part is built.

## Multi-tenancy

Plantree supports multi-company, multi-site and multi-tenant structures.

- **`Organization` is the tenant boundary.** Every business record carries
  `organizationId`; no query ever crosses it implicitly.
- **Sites within a tenant** are the next scoping level: users and roles can be
  restricted to specific sites, and much reporting rolls up per site.
- **Isolation model:** with [JSON-backed storage](11-data-storage.md), each
  `organizationId` is a top-level document partition (a directory in the
  flat-file layout, a scoping key in a JSONB/document store), so tenants are
  physically separated by default. Nothing reads across the boundary regardless
  of which physical store is used.

## Security & access control

- **Authentication via an external IdP.** SSO with Microsoft Entra ID or another
  OIDC/SAML provider is the intended path; Plantree does not aim to be an
  identity system. Local accounts exist for small deployments and service
  clients.
- **Role-based access control**, refined by **site- and asset-level
  restrictions**. A contractor sees only their assigned work; a site technician
  sees only their site's assets; an admin sees the tenant.
- **Least privilege at the API.** Authorisation is enforced server-side on every
  request (see [API surface](06-api-surface.md#principles)); the UI hides what
  the API also refuses.
- **Approval limits & delegation.** Roles carry approval limits (e.g. cost
  thresholds for work-order approval or POs); delegation covers absence.
- **Electronic signatures** on close-out, inspections and permits, tied to the
  authenticated identity and timestamped.
- **Audit everything.** Every mutation writes an immutable `AuditEvent`
  (who/what/when/before/after). The audit log is queryable but never editable.

## Mobile & offline

Mobile is a **primary interface**, not a reduced desktop — a defining product
principle. The architecture must make this true, not aspirational.

- **Offline-first field work.** A technician in a plant room or remote facility
  can view assigned work, asset history, drawings and manuals, complete
  checklists and readings, record time and parts, capture photos/video/voice and
  signatures, and raise follow-up defects **with no connectivity**, then sync on
  reconnect.
- **Sync contract.** The client queues mutations locally and replays them via
  **idempotent, keyed** API writes (see
  [API conventions](06-api-surface.md#cross-cutting-api-conventions)) so a
  reconnect never double-books labour, double-consumes parts, or re-fires a
  transition.
- **Conflict handling.** Optimistic concurrency (entity versions/ETags) surfaces
  genuine conflicts to the user rather than silently overwriting; the common
  append-only cases (adding a labour entry, a comment, a reading) merge cleanly.
- **Scan-to-context.** QR/barcode/NFC/RFID scanning resolves straight to the
  asset and its open work (`/assets/lookup`), which is the fastest real-world
  entry point into the system.
- **Push notifications** for assignment, escalation and parts availability.

## Attachments & documents

- Assets, work orders, inspections, permits and contractors carry
  **attachments** — documents, drawings, manuals, photos, video, voice notes.
- Binary content lives in object storage, referenced by the domain records;
  Plantree is **not** a document management system and integrates with a DMS as
  the system of record where one exists.
- Attachments captured in the field are queued and synced like any other offline
  mutation.

## Integration & automation posture

Plantree **integrates rather than absorbs** (see
[vision](01-vision-and-scope.md#design-principles)). The integration surface:

- **API + webhooks + bulk import/export** as the universal spine (doc 06).
- **ERP / finance** — Plantree manages the maintenance requirement and hands the
  financial transaction (PO, invoice, cost) to the ERP; it is not a ledger.
- **HR / identity** — people and access come from the IdP/HR system.
- **BMS / SCADA / IoT** — meter and condition data ingestion, and **automatic
  work orders from alarms** (later releases). Ingested readings drive
  meter-based and condition-based PM.
- **GIS / floorplan, DMS, analytics (Power BI)** — read integrations over the
  same API/export surface.
- **Email-to-work-request** — a low-friction capture channel feeding
  `WorkRequest` with `source = email`.
- **No-code automation & configurable workflow engine** — rules ("when a
  critical asset's work order is overdue, escalate to the site manager") are
  configuration, executed by the platform, not bespoke code.

## Administration & governance

- **Configuration as data:** fields, forms, statuses, workflows, numbering rules
  and criticality scales are configurable per organisation with sensible
  shipped defaults.
- **Data quality is a feature:** import validation, duplicate detection and
  data-quality dashboards ship as product capability — not left to the customer.
- **Record numbering** rules per record type (assets, work orders, requests, POs)
  with configurable formats and sequences.
- **Retention & archival** policies, backup and recovery, and API/integration
  monitoring are first-class admin surfaces.
- **Localisation** — time zones, units (metric/imperial), languages — and
  **accessibility** are baseline expectations, not add-ons.

## Non-functional targets

These are the standards the implementation is held to. Concrete numbers firm up
with the stack, but the intent is fixed.

| Concern | Target / intent |
|---------|-----------------|
| **Work-order speed** | Raising and actioning work is fast enough to use one-handed on a phone; this is the product's core promise. |
| **Availability** | The field and requester paths degrade gracefully; offline keeps technicians productive through outages. |
| **Scale** | Asset registers and work history grow large; list/query/reporting stay responsive via proper indexing and pagination, never full scans. |
| **Auditability** | Every change reconstructable; historical work always shows the exact procedure version that applied. |
| **Security** | Least privilege, tenant isolation, signed webhooks, encrypted transport and at-rest storage. |
| **Extensibility** | Custom attributes, configurable workflows and the open API let customers adapt without forking. |
| **Data integrity** | Stock balances, costs and actual hours are derived from immutable transactions/entries, so the numbers always reconcile. |

Where a target implies a design constraint elsewhere (e.g. idempotent writes for
offline, derived balances for integrity), that constraint is stated in the
relevant document rather than duplicated here.
