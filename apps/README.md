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
  runs the generation engine.
- **Assets** / **Job Plans** — the [job-plans app](job-plans/README.md): the
  asset register and the Class → Model → Instance template library.

The sidebar collapses to an icon rail (state persisted), and becomes a slide-over
drawer on narrow screens.

### How the shell talks to the modules

The shell hosts each module in a frame (they stay independently runnable) and
bridges them with `postMessage`. Each module hides its own top bar when embedded
(via `?embed=1`); the job-plans module also hides its in-rail Job Plans/Assets
toggle, since the sidebar owns that switch.

| Message (shell → module) | Effect |
|--------------------------|--------|
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

| File | What |
|------|------|
| `plantree.html` | The unified shell: sidebar nav, dashboard, top bar. |
| `job-plans/` | Job plans + asset register + class-family inheritance. |
| `work-orders/` | Work-order board/detail, lifecycle state machine, PM generation engine. |
