# Plantree apps

Self-contained, no-build browser apps. Open [`plantree.html`](plantree.html) for
the unified shell, or run either module on its own.

## `plantree.html` — the unified shell

One app with a shared top bar and two sections:

- **Job Plans & Assets** — the [job-plans app](job-plans/README.md): the
  Class → Model → Instance template library and the asset register.
- **Work** — the [work-orders app](work-orders/README.md): the board + detail
  with the lifecycle state machine, plus **Generate PM work** (in the shell top
  bar) which runs the generation engine.

The shell hosts each module in a frame (they stay independently runnable) and
bridges them:

- From an **asset** (Job Plans & Assets → Assets → an asset), **Work orders ›**
  jumps to the Work section filtered to that asset's orders.
- **Generate PM work** in the shell drives the Work section's engine.

Each module hides its own top bar when embedded (via `?embed=1`), so the shell's
is the only one shown. Opening `job-plans/app.html` or `work-orders/app.html`
directly still works exactly as before.

| File | What |
|------|------|
| `plantree.html` | The unified shell (this page). |
| `job-plans/` | Job plans + asset register + class-family inheritance. |
| `work-orders/` | Work-order board/detail, lifecycle state machine, PM generation engine. |
