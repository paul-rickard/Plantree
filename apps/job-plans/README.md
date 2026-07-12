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
| `schemas/job-plan.schema.json` | The job-plan document contract (JSON Schema, draft 2020-12). This is the architecture, made executable. |
| `samples/job-plans/jp_ups_quarterly_inspection.json` | A worked example (the Quarterly UPS Inspection) — also a schema fixture. |

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
