# 12 — Deployment: Serverless, File-Based on SharePoint

Plantree's target deployment is **serverless and file-based**: the application is
a self-contained client that reads and writes plain
[JSON documents](11-data-storage.md), and those documents live as files in a
**SharePoint document library**, shared and version-tracked by SharePoint itself.
There is no application server and no database server.

This is the deliberate simple end of the spectrum. It trades away background
processing and enforced server-side logic for near-zero operational footprint,
and it leans on tools a Microsoft 365 tenant already has. This document is honest
about both sides of that trade.

## Decision

- **No server.** The app is client-side only; SharePoint is the file store and
  sharing surface.
- **Manual file workflow.** People obtain the app and data from a SharePoint
  library, work with them, and the results flow back through SharePoint —
  version history is the sync and the audit trail.
- **Lazy automation.** Scheduled behaviour (PM work-order generation, overdue and
  expiry checks) runs **when a user opens the app**, not on a timer. Nothing
  happens overnight or while no one is signed in.

## What gets packaged

Two things, both just files:

1. **The app** — a self-contained client (a single HTML/JS bundle, of which the
   [dashboard mockup](11-data-storage.md) is the visual shell). No build server,
   no backend calls.
2. **The data** — one JSON file per [aggregate](11-data-storage.md#documents-and-aggregates)
   (`assets/ast_ups_a2.json`, `work-orders/wo_….json`, …), plus per-event files
   for logs (below), laid out in the library exactly as the
   [storage layout](11-data-storage.md#physical-layout--pick-per-deployment-contract-unchanged)
   describes — a document library folder *is* that layout.

## How the app reads and writes data

Two mechanisms, offered together — the app detects what the browser allows:

| Mechanism | How it works | Trade-off |
|-----------|-------------|-----------|
| **File picker + download (baseline)** | Load JSON via `<input type="file">` / drag-and-drop; save via a generated download. Works from a plain downloaded HTML file (`file://`) in any browser. | Fully manual: you pick files to open and re-upload saved files to the library. Fine for focused work on a few records; tedious for bulk. |
| **Folder access (upgrade)** | The **File System Access API** opens the OneDrive-synced library folder and reads/writes the JSON files *in place*; OneDrive syncs changes back to SharePoint. | Much smoother — feels like a real app over the library. Requires a Chromium browser (Edge/Chrome) **and** the app served from an `https` origin, not opened as a local `file://` file. |

The practical recommendation: **sync the library with OneDrive** and serve the app
from an `https` location (a static host, the tenant's app catalog, or any HTTPS
URL the org already has) so the folder-access path is available. If keeping the
app itself as a downloaded file is important, the picker/download baseline still
works — just more manually. Either way there is no server that Plantree operates.

### Browser support & compatibility

The in-place path depends on the **File System Access API**, which is
Chromium-only — and, importantly, is **not exposed on mobile browsers at all**:

| Browser / platform | In-place file access | Notes |
|--------------------|:--------------------:|-------|
| Edge · Chrome · Brave · Opera (desktop) | ✅ full | `showOpenFilePicker` / `showSaveFilePicker` / `showDirectoryPicker`. The intended experience. |
| Firefox (desktop) | ❌ none | No user-file picker; fallback path only. |
| Safari (desktop) | ❌ none for user files | Implements only the private OPFS, not user-visible pickers. |
| Any mobile browser (iOS / Android) | ❌ none | Picker methods aren't exposed; the folder-in-place model does not work on a phone. |

Two implementation requirements follow:

1. **Recommend a compatible browser — but don't hard-block.** On an unsupported
   *desktop* browser, show a clear, non-blocking message ("Open Plantree in
   Microsoft Edge or Google Chrome to edit files in place") while still offering
   the load/download fallback, so no one is ever fully stuck. Detect the
   capability (`'showOpenFilePicker' in window`); never sniff the user-agent
   string.
2. **Mobile needs a different answer.** Because no mobile browser exposes the
   picker, the pure file model cannot deliver rich in-app editing on a phone —
   in tension with the [mobile-first principle](07-cross-cutting-concerns.md#mobile--offline).
   Here mobile field use falls back to the OneDrive mobile app (open/share the
   JSON) or the download path, both clunky. **This is the constraint most likely
   to justify the [Graph/SPFx evolution step](#evolution-path)** — a
   Graph-integrated client works on any browser, desktop *or* mobile, because it
   reaches SharePoint over HTTPS rather than the local filesystem.

## Sharing, sync and history

- The **document library** is the share surface: SharePoint permissions decide
  who sees which data (see [security](#security--permissions)).
- **OneDrive sync** gives local, offline-capable file access — the offline
  requirement in [cross-cutting concerns](07-cross-cutting-concerns.md#mobile--offline)
  is largely met by the sync client, with the app working against the local copy.
- **Per-file version history** in SharePoint is, for free, the
  [immutable-history guarantee](11-data-storage.md#versioning): every save is a
  new file version, nothing is silently overwritten, and any file can be rolled
  back.

## Concurrency & conflicts (the main risk)

There is no live lock. Two people editing the **same** record file on synced
copies will produce a OneDrive **conflict copy**. This is the model's sharpest
edge and is handled by containment, not prevention:

- **Per-aggregate files** keep the collision surface tiny — editing *different*
  work orders never conflicts. Most real concurrency disappears at this
  granularity.
- **Optimistic `rev` check on save.** Before writing, the app re-reads the file
  and compares its `rev`/version; a mismatch warns the user instead of blindly
  overwriting.
- **SharePoint check-out** is available for exclusive editing of a specific file
  when someone needs a guaranteed lock.
- **Version history is the safety net.** A bad overwrite or a conflict copy is
  always recoverable by restoring a prior file version.
- **Honest limit:** the effective default is *last-write-wins with a warning and
  full version history to recover*. That is acceptable for an internal tool with
  modest concurrency; it is not a substitute for a transactional database under
  heavy multi-user load. When that load arrives, see [evolution](#evolution-path).

### Append-only logs become one file per event

The [append-only logs](11-data-storage.md#two-document-flavours) (inventory
transactions, audit events) must **not** be single growing `.jsonl` files here —
concurrent appends from synced clients would collide constantly. Instead each
event is its **own write-once file** (`logs/inventory/itx_….json`,
`logs/audit/….json`) with a unique id. No two clients ever touch the same file,
and derived state (stock balance, cost) is still computed by folding the folder.
The fold-to-derive semantics are unchanged; only the file granularity differs.

## Lazy PM generation

With no timer, the app generates due preventive work **on open**:

- On load it evaluates each [maintenance schedule](10-maintenance-strategy-application.md),
  compares triggers against *now* (and, for meter/runtime triggers, against the
  latest reading a user has entered), and creates the due work-order files.
- **Idempotency is essential.** Each schedule records a `lastGeneratedThrough`
  high-water mark (date or meter value); generation is deterministic, so opening
  the app repeatedly never double-creates work. Reopening after someone else
  already generated is a no-op because the high-water mark moved.
- **Consequence:** PM only appears when *someone opens the app*. A site no one
  logs into for a week has no freshly generated PM until the next visit. Teams
  need a habit of opening Plantree, or this becomes the trigger to add a
  [timer flow](#evolution-path) later.

## Notifications, degraded

Push notifications need something running server-side, which this model does not
have. They degrade to **pull**:

- On open, the app computes the **attention worklist** — overdue work, PM due,
  contracts/warranties expiring, parts below reorder — and surfaces it on the
  dashboard (the [mockup's](11-data-storage.md) KPI and queue panels).
- Optionally the app can export a **digest file** (e.g. a daily summary JSON/CSV)
  into the library for someone to circulate.
- **Email / SMS / Teams push is out of scope** in the pure file model. It is the
  first thing a small [Power Automate flow](#evolution-path) would add.

## Security & permissions

- **Authentication is SharePoint's.** Users reach the library through their
  Microsoft 365 / **Entra ID** sign-in — the SSO posture in
  [doc 07](07-cross-cutting-concerns.md#security--access-control) is provided by
  the platform, not built.
- **Authorisation is library/folder permissions.** Site-, library- and
  folder-level permissions implement the
  [tenant/site/asset scoping](07-cross-cutting-concerns.md#multi-tenancy): a site
  is a SharePoint site or library; a contractor gets a folder; access is
  Microsoft 365 group membership.
- **Validation is advisory, not enforced.** With no server, schema and
  referential [validation](11-data-storage.md#referential-integrity-without-a-foreign-key-engine)
  run in the client and can be bypassed by someone editing a JSON file by hand.
  For a trusted internal team this is acceptable; SharePoint column/content-type
  validation can backstop a little. State this plainly to stakeholders — it is a
  real difference from a server-enforced system.

## Reporting

- **In-app dashboards** compute from the loaded JSON, as the mockup shows.
- **Power BI** connects natively to a SharePoint folder of JSON for richer
  reporting; **Excel** can pull the same files. This satisfies the
  [Power BI / analytics integration](04-modules.md) without any Plantree server.

## What you give up versus a server — at a glance

| Capability | File-based answer |
|-----------|-------------------|
| Background/scheduled jobs | Lazy: run on app open. None while no one is signed in. |
| Push notifications (email/SMS/Teams) | Not available; degrade to an in-app worklist + optional digest file. |
| Enforced validation / business rules | Client-side only; advisory. Recoverable via version history, not prevented. |
| Cross-file transactions | None; single-file writes + [append-only event files](#append-only-logs-become-one-file-per-event) + idempotent operations. |
| Live multi-user locking | None; per-file granularity + `rev` warning + check-out + version rollback. |
| Query/reporting at scale | Client-side load/index; mind the 5,000-item library view threshold and Graph throttling. Large fleets → evolve. |
| Webhooks, email-to-request, live integrations | Need a server; out of scope in the pure file model. |

## Evolution path

Nothing here is a dead end, because the data never changes shape:

- **Add unattended automation** without leaving serverless: a **Power Automate
  flow** or **Azure Function on a timer** that generates PMs and fires
  notifications against the same library.
- **Add live, integrated access:** an **SPFx web part** or a static SPA using
  **Microsoft Graph** to read/write the library directly (removes the manual
  file step and enables real concurrency handling).
- **Add a real backend at scale:** stand up an HTTP API over the
  [same JSON documents](06-api-surface.md) with Postgres **JSONB**
  ([storage option 3](11-data-storage.md#physical-layout--pick-per-deployment-contract-unchanged)).
  Because the canonical form is JSON, this is a data copy, not a rewrite — the
  whole point of the storage decision.

The file-based deployment is the smallest possible starting point that is still
genuinely Plantree; each step above is additive when a real need appears.
