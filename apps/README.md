# Plantree apps

Self-contained, no-build browser apps. Open [`plantree.html`](plantree.html) for
the unified shell, or run either module on its own.

## `plantree.html` — the unified shell

A CMMS app frame built around the conventions of tools like MaintainX, Fiix and
Limble: a **persistent left sidebar** for navigation, a **top bar** with global
search and a contextual action, and a **dashboard** landing.

- **Dashboard** — a shell-rendered overview with live KPI tiles (open / in-progress
  / overdue work orders, open requests, assets, job plans), a *Work by status*
  breakdown, recent work orders and quick actions. Every number is pulled live
  from the modules — nothing is hard-coded.
- **Work Orders** / **Requests** — the [work-orders app](work-orders/README.md):
  the board + detail with the lifecycle state machine. **Generate PM** (top bar)
  runs the generation engine; **+ New work order** raises one directly.
- **Assets** / **Job Plans** — the [job-plans app](job-plans/README.md): the
  asset register and the Class → Model → Instance template library.
- **Settings** — configurable system features (see below). Saved locally.

### Configurable features

Some capabilities aren't wanted at every site, so they're **feature-toggled**
(canonical shape: [`schemas/system-settings.schema.json`](../schemas/system-settings.schema.json)),
defaulting off. Toggle them under **Settings**; the choice persists locally and
the shell broadcasts it to the modules.

| Feature | Default | Off means |
|---------|---------|-----------|
| **Work requests** | off | No separate request intake — work orders are raised directly (**+ New work order**), and PM/scheduled work is unaffected. Turning it on adds the Requests nav item, dashboard KPI and the request → work-order conversion flow. Existing request records are retained either way. |

The sidebar collapses to an icon rail (state persisted), and becomes a slide-over
drawer on narrow screens.

### How the shell talks to the modules

The shell hosts each module in a frame (they stay independently runnable) and
bridges them with `postMessage`. Each module hides its own top bar when embedded
(via `?embed=1`); the job-plans module also hides its in-rail Job Plans/Assets
toggle, since the sidebar owns that switch.

| Message (shell → module) | Effect |
|--------------------------|--------|
| `plantree:workspace` `{dir}` | Both modules: a folder handle to load from and autosave to (see Persistence). |
| `plantree:wsRequest` → `plantree:workspace` | A module (re)booted and asks the shell to resend the connected workspace handle. |
| `plantree:saveState` `{state}` | Module → shell: save progress (`saving`/`saved`/`error`) for the top-bar indicator. |
| `plantree:config` `{features}` | Work-orders: apply feature toggles (e.g. show/hide Work Requests). |
| `plantree:pmRequest` → `plantree:pmPlans` `{plans}` | Generate PM: work-orders asks Job Plans to resolve every asset's applied plans (through Class → Model → Instance inheritance, with each asset's overrides); the shell relays the resolved plans back and work-orders generates from them. |
| `plantree:statsRequest` | Module replies with `plantree:stats` (counts for the dashboard). |
| `plantree:setMode` `{mode}` | Job-plans: switch between `classes` and `assets`. |
| `plantree:board` / `plantree:requests` | Work-orders: show the board / focus the request queue. |
| `plantree:search` `{q}` | Forward the top-bar search to the active module. |
| `plantree:generate` | Work-orders: run the PM generation engine. |
| `plantree:filterAsset` `{assetId}` | Work-orders: filter to one asset's orders. |

Modules report a compact summary up via `plantree:stats` on every render, so the
dashboard stays current (e.g. after generating PM work). From an **asset**, the
**Work orders ›** button posts `plantree:openWork`, and the shell jumps to Work
filtered to that asset.

Opening `job-plans/app.html` or `work-orders/app.html` directly still works
exactly as before — all of the shell wiring is gated on `?embed=1`.

### Persistence (File System Access)

**Settings → Workspace → Connect folder** picks a directory (ideally
OneDrive/SharePoint-synced) via the [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API);
the shell keeps the folder handle in **IndexedDB** (so it offers *Reconnect* after
a reload, on a fresh permission grant) and shares it with both module frames. Each
aggregate is a JSON document written on change (debounced) — the store from
[doc 11](../docs/architecture/11-data-storage.md) on the file-based deployment of
[doc 12](../docs/architecture/12-deployment.md):

| File | Written by |
|------|-----------|
| `work-orders.json`, `maintenance-schedules.json`, `work-requests.json`, `workflow-profile.json`, `board-segments.json` | Work Orders |
| `asset-class-plans.json`, `assets.json`, `locations.json` | Job Plans |
| `system-settings.json` | Shell |

Reopen the same folder to restore everything. A top-bar pill shows *Saving… /
Saved*. Chromium-only (Chrome/Edge); other browsers keep the in-memory/localStorage
behaviour and the job-plans per-class Save/Open-folder fallback.

| File | What |
|------|------|
| `plantree.html` | The unified shell: sidebar nav, dashboard, top bar. |
| `job-plans/` | Job plans + asset register + class-family inheritance. |
| `work-orders/` | Work-order board/detail, lifecycle state machine, PM generation engine. |
