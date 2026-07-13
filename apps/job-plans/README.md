# Job Plans — first module

The first working slice of Plantree: authoring **job plans** as versioned JSON
documents, standalone. A job plan is the *what* of maintenance work — tasks,
readings, labour, parts, safety — and it is the one core entity that depends on
nothing else, so it can be built and used before assets, work orders or PM
schedules exist.

## What's here

| File | Purpose |
|------|---------|
| `apps/job-plans/app.html` | **The app** — gallery + editor in one, no server, no build step. Open it in a browser. |
| `apps/job-plans/inheritance-demo.html` | Working demo of **Class → Model → Instance** template inheritance with attribute-level locks (see below). |
| `apps/job-plans/matrix-demo.html` | Working demo of the **task × frequency matrix** — one plan, every cadence (see below). |
| `apps/job-plans/pm-model-demo.html` | **Combined** demo: inheritance + matrix + work-order nesting in one view (see below). |
| `schemas/job-plan.schema.json` | The job-plan document contract (JSON Schema, draft 2020-12). This is the architecture, made executable. |
| `samples/job-plans/jp_ups_quarterly_inspection.json` | Worked example (Quarterly UPS Inspection) — also a schema fixture. |
| `samples/job-plans/jp_generator_maintenance.json` | Worked example with a full frequency matrix (generator programme). |

## The app (`app.html`)

A single self-contained app — no server, no build — with two modes, switched
from the toggle at the top of the rail:

- **Asset classes** — the **template library**: the Class → Model → Instance
  tree with inheritance and locking (the AVEVA-style model).
- **Assets** — the **asset library**: a location hierarchy of folders and
  sites, with real assets living in sites, each taking its parameters from a
  class and able to add its own.

Ships pre-seeded with samples; loads files with `"type": "assetClassPlan"`.

### Asset classes (template library)

The left **rail is the Class → Model → Instance tree**; the right **detail**
shows the selected node's *resolved* plan, with every field carrying its
inheritance state.

**Rail (left)** — the asset tree:

- **Class** (e.g. Standby Generator) → **Model** (Caterpillar 3512) → **Instance**
  (GEN-1 @ SYD1). Expand/collapse, search, live selection. **+ New class**,
  **+ Model** / **+ Instance** (in the header), and Open folder / Files / Samples
  to load. One JSON file per class family.

**Detail (right)** — the selected node's resolved plan, across three tabs:

- **Tasks** — the effective task list. A **class** defines tasks (and can
  **Enforce** one so descendants can't change/remove it); a **model/instance**
  can **Exclude** an inherited task or **Add** its own. Each row shows its state:
  *Inherited / Overridden / Enforced / Added*.
- **Schedule** — frequencies + the **matrix grid** (ticking a cell at a
  model/instance auto-creates a local override), a **what-generates** card per
  frequency, and the **nested 12-month schedule** (coincident drops collapse into
  one work order — the cannibalism model).
- **Details** — node identity; **Attributes** (labour, safety) and
  **Parameters** each shown as **Inherited / Overridden / Enforced**:
  - at a **class**, edit the value and toggle **🔒 Enforce** (locks it for all
    models/instances; enforcing clears any existing overrides below);
  - at a **model/instance**, **Override** an unlocked value or **Revert** to
    inherited; enforced fields are **locked**.

**Responsive / mobile:** on a phone the layout collapses to a single column — the
tree is the list screen, tapping a node slides to a full-screen detail with a
**‹ Tree** back button, and the header, tabs and attribute/parameter rows reflow.
Wide content (the matrix, timeline) scrolls within its own container, so the page
never scrolls sideways.

**Effective plan { }** (header) shows the resolved snapshot a work order would
freeze for that node — inherited values, applied overrides, enforced locks, the
merged task list. Instances *derive* from their parents at read time, so a class
change flows down automatically except where a descendant has overridden it.

### Assets (asset library)

The second mode is the real-world register: **locations** and **assets**.

**Rail** — the location hierarchy, viewable **By location** or **By class**:

- **Folders** (regions, countries — e.g. APAC → Australia) nest to any depth,
  and **sites** (Sydney DC1) can sit at any level. Add a **+ Folder** or
  **+ Site** from any folder.
- **By class** flips the same assets into a class-grouped list, so you can see
  every Generator across every site at once.

**Detail** — depends on what's selected:

- a **folder** shows its identity and its contents (sub-folders / sites);
- a **site** shows its assets in a table (Code / Name / Class / Model /
  Location / Plans), with **+ Add asset** (pick a class and optional model);
- an **asset** shows its identity, its **Class parameters** (inherited from its
  class, each **Inherited / Overridden / Enforced** — override an unlocked value
  or **Reset** it to inherited after a warning), its own **asset-specific
  parameters**, and the **job plans applied** to it.

**Class list is shared.** Classes and models are the *same list* the template
library edits — creating a class in either place adds it to the one register.
Assets and job plans live in parallel but share the class names.

**Job plans are applied explicitly** — from the asset (Applied job plans →
*Apply job plan…*) or in **bulk**: tick assets in a site or class table and
**Apply to selected**. Nothing is auto-assigned by class; application is always
a deliberate act, individually or in bulk.

**Effective { }** (asset header) resolves the asset's parameters (class
inheritance + its own) and lists the plans applied to it — the snapshot a work
order would freeze.

> This app models the **class-family inheritance** (`assetClassPlan`), which
> extends the single-plan `job-plan.schema.json`. Formalising the family schema
> (and folding version lifecycle back in on top of inheritance) is the next
> architecture step.

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

Open `apps/job-plans/app.html` in **Microsoft Edge** or **Google Chrome** on
desktop. It opens on the **Asset classes** template library (seeded with
samples); the rail toggle switches to the **Assets** library. **Open folder…**
loads a library of class-plan JSON, and clicking a node opens it in the detail
pane. **Save** writes the `.json` back to disk (ideally a OneDrive-synced
SharePoint library folder).

Other browsers (Firefox/Safari) and mobile fall back to **download mode**: Save
downloads a file you re-upload to SharePoint, and folder-open becomes choose-files
/ drag-drop. The app detects this and says so. (See
[`docs/architecture/12-deployment.md`](../../docs/architecture/12-deployment.md)
— the in-place file access uses the Chromium-only File System Access API.)

If the picker is blocked when opening as `file://`, serve the folder instead:
from the repo root, `python3 -m http.server 8000`, then open
`http://localhost:8000/apps/job-plans/`.

## Editor capabilities

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
