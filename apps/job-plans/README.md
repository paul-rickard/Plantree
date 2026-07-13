# Job Plans — first module

The first working slice of Plantree: authoring **job plans** as versioned JSON
documents, standalone. A job plan is the *what* of maintenance work — tasks,
readings, labour, parts, safety — and it is the one core entity that depends on
nothing else, so it can be built and used before assets, work orders or PM
schedules exist.

## What's here

| File | Purpose |
|------|---------|
| `apps/job-plans/index.html` | Self-contained authoring app — no server, no build step. Open it in a browser. |
| `apps/job-plans/gallery.html` | Browse all job plans as cards — opens a folder (or files) of plan JSON (see below). |
| `apps/job-plans/inheritance-demo.html` | Working demo of **Class → Model → Instance** template inheritance with attribute-level locks (see below). |
| `apps/job-plans/matrix-demo.html` | Working demo of the **task × frequency matrix** — one plan, every cadence (see below). |
| `apps/job-plans/pm-model-demo.html` | **Combined** demo: inheritance + matrix + work-order nesting in one view (see below). |
| `schemas/job-plan.schema.json` | The job-plan document contract (JSON Schema, draft 2020-12). This is the architecture, made executable. |
| `samples/job-plans/jp_ups_quarterly_inspection.json` | Worked example (Quarterly UPS Inspection) — also a schema fixture. |
| `samples/job-plans/jp_generator_maintenance.json` | Worked example with a full frequency matrix (generator programme). |

## Gallery (`gallery.html`)

Displays every job plan as a card grid. In the file-based deployment this is
"read all the plan JSON in a folder and show them":

- **Open folder…** (Edge/Chrome) recurses a directory — point it at the
  OneDrive-synced `job-plans/` library and every plan appears. **Choose files…**
  and **drag-and-drop** work everywhere as the fallback.
- Each card shows the active version's **state**, version count, **task count**,
  **frequency chips** and estimated labour; **search**, **state filter** and
  **sort** across the set.
- Click a card for a detail view (per-version tasks with their frequency tags,
  and a **Download JSON**).
- Ships pre-seeded with sample plans so it's populated on first open; loading a
  folder/files replaces them. Only files with `"type": "jobPlan"` are shown.

## Template inheritance (`inheritance-demo.html`)

An interactive prototype of how a job plan is maintained once and scoped
downward — modelled on AVEVA System Platform's template/instance locks.

Three levels: **Asset class** (UPS) → **Model** (Vertiv EXL-S1, brand folds in
here) → **Instance** (UPS-A1 @ SYD1 — site is a property of the instance).
Every attribute (frequency, labour, thresholds, safety, and each task) resolves
by walking the tree, in one of three states:

- **Inherited** — follows the parent; a class change flows down automatically
  (instances *derive* from the class at read time, so there is no batch "push"
  and no drift).
- **Overridden** — a model or instance has taken local ownership; it is now
  frozen and ignores parent changes.
- **Enforced** — the class has locked the attribute so descendants *cannot*
  override it (for safety-critical items). Enforcing clears any existing
  overrides below.

The side panel shows each node's **effective plan** — the resolved snapshot a
work order would freeze at creation, so upstream edits never rewrite history.
This model is a candidate to formalise in
[`docs/architecture/10-maintenance-strategy-application.md`](../../docs/architecture/10-maintenance-strategy-application.md)
once it's settled; it is not yet in the architecture docs.

## Maintenance matrix (`matrix-demo.html`)

A single job plan holds **every generation frequency**, and a task × frequency
matrix decides when each task drops. Frequencies are `unit × interval` — daily
(`day/1`), weekly (`week/1`), monthly (`month/1`), n-monthly (`month/n`), yearly
(`year/1`), n-yearly (`year/n`) — so any cadence is expressible.

- **Rows = tasks, columns = frequencies, checkbox = "drops here."** A task can
  belong to several frequencies (e.g. *check levels* both weekly and monthly).
- **What generates** cards show the work order each frequency produces when it
  falls due — its ticked tasks, nothing else.
- **Drop timeline** shows which frequencies fire across the next 12 months.

This is captured in the schema: each version gains a `frequencies` array
(`$defs/frequency`) and each task gains `frequencyIds` (its ticked cells). Note
this deliberately folds *when* into the plan — a small, intentional departure
from the strict plan/schedule separation in
[doc 10](../../docs/architecture/10-maintenance-strategy-application.md); the
matrix is a widely-used PM pattern and matches how programmes are built in
practice. Site-specific timing (anchor dates, calendars) remains an
instance/schedule concern for later.

## Combined model + work-order nesting (`pm-model-demo.html`)

Brings the two demos together and adds **work-order nesting** ("cannibalism").
Class → Model → Instance (a generator: GEN → CAT 3512 → GEN-1 @ SYD1), each level
resolving its **effective matrix** by inheritance (inherited / overridden /
enforced / added — now applied per task-row's frequency mapping as well as to
attributes), then a **resolved 12-month schedule** with nesting applied.

Nesting rule: within a *nesting group*, when several frequencies fall due in the
same period the **longest wins and absorbs the shorter ones**, generating **one**
work order whose task list is the **de-duplicated union** of their tasks
(attributed to the longest, e.g. "Annual — absorbs 6-Monthly, Monthly, Weekly").
So month 12 yields a single Annual work order, not four overlapping ones — the
seeded generator collapses **27 naive → 12 nested** work orders a year. Click any
month to see its merged work order and each task's source cadence(s).

Design notes (for when this is formalised): nesting is a **generation-time** rule
— no change to the stored matrix; the only additions are a `nestingGroup` (+
anchor) per frequency and a merge-window setting. The demo resolves at
month granularity; a real engine keeps a day-level merge window and separate
meter/runtime streams. See the reasoning captured with this build.

## Run it

Open `apps/job-plans/index.html` in **Microsoft Edge** or **Google Chrome** on
desktop. Create a plan, then **Save** — it writes a `.json` file straight to disk
(ideally into a OneDrive-synced SharePoint library folder). **Open…** loads an
existing plan file back in.

Other browsers (Firefox/Safari) and mobile fall back to **download mode**: Save
downloads a file you re-upload to SharePoint. The app detects this and says so.
(See [`docs/architecture/12-deployment.md`](../../docs/architecture/12-deployment.md)
for why — the in-place save uses the Chromium-only File System Access API.)

If the picker is blocked when opening the file as `file://`, serve the folder
instead: from the repo root, `python3 -m http.server 8000`, then open
`http://localhost:8000/apps/job-plans/`.

## What it does

- **One JSON document per job plan**, embedding **all versions** — matching the
  [storage aggregate model](../../docs/architecture/11-data-storage.md#documents-and-aggregates).
- **Version lifecycle** `draft → approved → active → superseded → retired`:
  approved history is locked; to change a non-draft version you fork a **new
  version** (the model never rewrites history in place).
- **Tasks** with response types (`none / passfail / numeric / text / choice`),
  acceptable ranges for readings, per-task required skills; reorder and edit.
- **Planned parts**, **required skills / tools / permits**, and
  **parameters** (values like operating voltage that will resolve from an
  asset/model template once those modules exist).
- **Live JSON preview** and **validation** against the schema, in the side panel.

## Scope boundaries (deliberately standalone)

Everything that would reference another module is held as **free text or keys**
for now, so no other module is required:

- Parts are free-text descriptions (no `Part` catalogue yet).
- Skills, tools and permits are text lists (no `Skill`/`Permit` records yet).
- Parameters carry a `source` (`asset`/`model`/`manual`) but resolve manually
  until assets exist.

When those modules arrive, these become real references — the document shape
already leaves room (`partRef`, parameter `source`), so nothing here is thrown
away.

## How it maps to the architecture

- Model & semantics: [data dictionary §Maintenance strategy](../../docs/architecture/03-data-dictionary.md)
  and [maintenance strategy application](../../docs/architecture/10-maintenance-strategy-application.md).
- Storage & versioning: [data storage](../../docs/architecture/11-data-storage.md).
- File workflow & browser support: [deployment](../../docs/architecture/12-deployment.md).
