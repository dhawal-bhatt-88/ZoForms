# Builder end-to-end suites

Plain Node scripts that drive the real builder: the API over HTTP, the editor in a real browser (Playwright), and the Postgres database directly (Prisma) to check what was stored. Each prints one `PASS`/`FAIL` line per check and `N/M passed`, and exits non-zero if anything failed.

These are separate from `apps/web/e2e` (the Playwright marketing-page spec).

## Prerequisites

1. **Postgres in Docker.** Start Docker Desktop, then from the repo root:
   ```sh
   docker compose up -d db
   pnpm --filter api exec prisma migrate deploy
   ```
2. **Dependencies installed** (`pnpm install`) and the schema package built: `pnpm --filter @formbuilder/form-schema build`. The API and web app import its `dist`.
3. **The API on port 4000:** `pnpm --filter api dev`. Every suite needs it.
4. **The web app**, for the browser suites. The suites expect it on **port 3100**:
   ```sh
   cd apps/web && pnpm exec next dev --port 3100
   ```
   Or point them at a web app you already have running: `E2E_WEB_URL=http://localhost:3000`. Don't run two `next dev` servers for `apps/web` at the same time. They share `apps/web/.next`, and a second one can corrupt the first one's cache, which shows up as an unstyled UI. If that happens, stop both servers, delete `apps/web/.next` and start again.
5. **A browser.** The suites use the installed **Microsoft Edge** (`channel: "msedge"`). To use Playwright's own Chromium instead, run `pnpm --filter web exec playwright install chromium` and set `E2E_BROWSER_CHANNEL=""`. You can also set it to `chrome`.

The suites read `apps/api/.env` for `DATABASE_URL`, so they check the same database the API writes to.

## Test accounts

Each suite signs up its **own** throwaway account, e.g. `verify-pages-ui-1727…@example.test`, and works only inside it. In a `finally` block it then deletes the account and its organisation, which removes the account's forms, versions and everything else with them. This happens even when checks fail. Nothing else in the database is touched.

To confirm nothing was left behind after a run:

```sh
cd apps/api && node -e "require('dotenv').config();const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{email:{endsWith:'@example.test'}}}).then(n=>{console.log(n);return p.\$disconnect()})"
```

## Running

From the repo root:

```sh
node e2e/run-all.js                    # every suite, one after another, then a summary
node e2e/run-all.js pages-ui drafts    # only suites whose file name contains these words
node e2e/verify-pages-ui.js            # one suite, with its full output
```

Run suites one at a time, not in parallel. They share the dev server and the database.

## The suites

| File | Needs web? | What it checks |
|---|---|---|
| `verify-editor.js` | yes | Explicit Save / Cancel / Download: dirty state, one version per Save, Cancel's confirm, Download returns the saved version, 409 handling. |
| `verify-logic.js` | yes | Conditional logic in the editor (contract §15): sources and operators; the Logic field a second condition brings (`1 AND 2`), gone again at one condition; every §15.7 message word for word, checked after a pause in typing; an empty field and save refused with the same message; the delete guard (focus kept, also for text with errors) and renumbering; the text saved and reloaded exactly; each §15.4 download shape with ids and never the text; `aria-invalid`, `aria-describedby` and the live region; content created through the API or stored before logic text opening clean; the delete dialogs' wording for mixed logic; the delete, move and option guards; every invalid condition through the API. With `E2E_EXTERNAL_APP_URL` set, it checks the test app has `@yourco/forms` 0.20.0 or later, restarts the test app's API (by touching `server/index.mjs`, which `node --watch` restarts on), renders the download (`?form=builder-logic`) and checks `1 OR (2 AND 3)` shows and hides as it should and the hidden answer isn't submitted. |
| `verify-country-numeric.js` | yes | Numeric condition answers (`>` `<` … need numbers) and country conditions as a fixed list; editor and API give the same message. |
| `verify-groups-ui.js` | yes | Groups in the editor: building nested groups, numbering, conditional groups, collapse, refused moves, drag and keyboard moves, both delete choices. |
| `verify-boxes.js` | yes | Group boxes on the canvas: shading, collapse, empty group, the drop highlight while dragging, deep nesting and narrow widths. |
| `verify-pages-ui.js` | yes | Pages in the editor: page containers, converting to pages, conditions on pages, "Move to…", deleting pages, Remove pages, navigation settings. |
| `verify-progress-style.js` | yes | The Progress style setting: default, disabled while progress is off, defaults not stored, saved and exported as `progressStyle`. |
| `verify-drafts-builder.js` | yes | The Save progress (drafts) setting: API rules and artifact for each mode, the settings UI, the switch back when pages are removed. |
| `verify-display-blocks.js` | yes | `text` and `image`: the image-source and blank-text save rules (the editor's inline message matches the API's and is shown once), the inspector's heading, previews, Help text visibility, trimming, no `description: ""`. |
| `verify-video.js` | yes | `video`: the recognised-source save rule (the editor's inline message matches the API's and is shown once), the inspector's heading, previews for YouTube, Vimeo and files with nothing loaded from either site, no Help text or Required, not a condition source, trimming, the artifact. |
| `verify-audio.js` | yes | `audio`: the recognised-source save rule (the editor's inline message matches the API's and is shown once), the inspector's heading and hints, a preview that loads nothing, no Help text or Required, not a condition source, trimming, the artifact. |
| `verify-repeats.js` | yes | Repeating groups: every save rule's message through the API (repeat settings, pages, the prefix rule), stripping and no-change detection; in the editor the Repeats switch, its defaults, preview, inline errors and badge, the source picker inside nested repeats, the turn-on and move guards (Move to, Move down, drag) with jump links, and the artifact. With `E2E_EXTERNAL_APP_URL` set, it also renders the download in the external test app: adds and removes entries, submits, and checks the payload. |
| `verify-options.js` | yes | Coded options and import: every save rule through the API (codes filled at save, HTML labels kept as data); in the editor every coded type built (matrix rows and columns included), codes generated on leaving a label, a code change carrying its condition, the refused removal, imports of a `.csv` with codes, a `.txt` and files with errors (Add, Replace, a refused Replace), "Answer every row" / "Rank every option", and the artifact. With `E2E_EXTERNAL_APP_URL` set, it renders the download in the external test app, submits it, and checks the stored record holds `{ code, label }` values. |
| `verify-groups-api.js` | no | Groups through the API: save, download, restore, no-change detection and every save rule's message. |
| `verify-pages-api.js` | no | Pages and navigation through the API: page shape, navigation defaults in the artifact, and every page rule's message. |
| `verify-grid.js` | yes | The grid block in the editor: "grid" + Enter inserts a Grid and "matrix" + Enter still a Matrix; the canvas table; after every column edit (code, label, a code generated on leaving an edited label, add, remove, move, Required, each type change) every column's type, options and required read back from the inspector; the type-change confirmation (exact text, Cancel changes nothing, focus returns); row and column-option import (Add, Replace); accessible names; not a condition source but can have its own condition; HTML labels shown as text; a wide grid scrolling inside its card; the saved schema; the code note shown once per grid (still once per list on other blocks); editing rows; every save rejection the editor can produce (the inline message is the API's text); a grid inside a repeating group; the downloaded artifact's exact §14.1 shape. With `E2E_EXTERNAL_APP_URL` set, it renders the download in the test app (`?form=builder-grid`, `@yourco/forms` 0.21.2) and checks the §14.5 layout: the table in its own region named by the grid's label, focusable, a size container; a table at the app's default width that scrolls inside that region; the table in a 640px panel and a card per row, each answer labelled with its column, in a 600px panel (either side of 34rem, the viewport unchanged); then that a required column blocks submit, a filled grid submits, and the stored record's shape (§14.2). |
| `verify-grid-api.js` | no | The grid block through the API: codes generated at save in rows, columns and column options (collisions suffixed, a column's option codes may repeat a row code), the stored and exported §14.1 shape (no grid-level `required`, no options on text columns), no-change detection, a grid inside a repeating group, and every save rule's message, naming the column (unknown or missing column type, missing options, every coded-list rule in each list, a grid as a condition source). |
| `verify-logic-api.js` | no | Custom condition logic (contract §15) through the API: logic text stored exactly, condition ids filled at save and kept when re-sent without them (re-sending is no change), the exported shape for every §15.7 row with no `enableLogicText`, text generated for content saved before logic text (flat AND, flat OR, a tree), ids `c1`, `c2`, … in the download of content never re-saved, restore, an item down to one condition, and every rejection with its message — on a question, a group, a page and inside a repeating group, with the ordering, source-type and prefix rules still applied under mixed logic. |
| `verify-scoring-api.js` | no | Scoring (contract §17) through the API: the formula text stored exactly and only the text (no `formula` key in any stored version, template or save response), the tree derived and checked at save and carried by the download, a tree sent with text ignored, text generated for a tree sent without text (`(0 - 2)` for a negative), score ids filled and kept when re-sent, question names generated at save from labels (`q{n}` for an unusable label, `_2` on a clash), the 300-term limit as text and as a tree (299 and 300 save, 301 is refused), every §17.6/§17.7/§17.8 rejection word for word (naming the group and the score, or the question), a referenced question saved as short text refused, option scores in the download (none on a matrix's rows or a ranking), no names or formula text in the download or the published form, group templates and restore. It also downloads a 300-term formula nested 5 groups deep and checks it with the external test app's installed `@yourco/forms` (0.23.0): `assertSchemaIntegrity` passes and `calculateScores` gives the expected total. That needs the test app at `D:/ZoworkProjects/external-test-app` (or `E2E_EXTERNAL_APP_DIR`), but not running. |
| `verify-versions.js` | no | Append-only versions and the read-only artifact endpoint, including another user's access. |
| `verify-body-limits.js` | no | Request body limits: 100 KB on every route, 10 MB only for a signed-in author saving a form, 413 with the limit named; the old billing routes are gone. (The 10 MB limit for saving a template is checked in `verify-templates-api.js`.) |
| `verify-templates.js` | yes | Templates in the UI: Save as template from a group's ⋯ menu, with the confirmation listing each condition that refers outside the group (word for word) and the logic text regenerated, the template without them and the form unchanged; "Insert as page" unavailable in a form without pages, with its reason; a group template inserted twice as a group (fresh ids, each copy's conditions on its own questions, `templateRef` on each), as a page in a paged form and in an empty one; editing an organisation template in template mode leaves forms alone; duplicating a system template and editing the copy; no edit controls on system templates, and one opened by its address is read-only; a form from a form template (fresh ids, `templateRef`, kept on save); no `templateRef` in any download; another organisation sees none of them; a viewer sees no write actions (Use, Edit, Rename, Duplicate, Delete, New form, Save as template, Save in template mode). With `E2E_EXTERNAL_APP_URL` set, it renders the form with the template inserted twice (`?form=builder-templates`, which the test app must register in its `src/App.tsx`) and checks each copy's conditions act on their own answers, and the payload. |
| `verify-templates-api.js` | no | Templates through the API: create, list, get, edit, delete and duplicate for form and group templates; `version` up on content saves only, with a stale save refused (409); 403 on writes to system templates, 404 for another organisation's, viewers read-only; every save rule applied to templates (a group template checked as a one-group form), word for word, and the self-contained rule; the settings a template never keeps; a form from a form template (fresh ids, `templateRef`); a group template inserted twice and as a page; no `templateRef` in a download or the published form; editing or deleting a template leaves forms alone; the system-template seed run twice, and run on a copy of the files with bad ones added: a bad file skipped and named while the rest load, a template whose file goes bad kept as it was, nothing deleted while a file can't be read (it runs `apps/api/dist/templates/seed-cli.js`, so the API must have been built or be running under `pnpm --filter api dev`); the 10 MB limit for saving a template. |

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `E2E_API_URL` | `http://localhost:4000` | The API. |
| `E2E_WEB_URL` | `http://localhost:3100` | The web app. |
| `E2E_BROWSER_CHANNEL` | `msedge` | Playwright channel; empty for its bundled Chromium. |
| `E2E_OUTPUT_DIR` | `e2e/output` | Where screenshots and downloaded artifacts go (git-ignored). |
| `E2E_EXTERNAL_FORMS_DIR` | not set | If set, e.g. `D:\ZoworkProjects\external-test-app\src\forms`, the artifacts the suites download are also copied there, ready to render. |
| `E2E_EXTERNAL_APP_URL` | not set | If set, e.g. `http://localhost:5173/external-test-app/`, `verify-repeats.js`, `verify-options.js`, `verify-grid.js` and `verify-logic.js` render their downloads in the external test app (`?form=builder-repeats`, `?form=builder-options`, `?form=builder-grid`, `?form=builder-logic`) and submit them. Needs `E2E_EXTERNAL_FORMS_DIR` as well, and the test app running there (`npm run dev:all`). When unset, that step is skipped. |
| `E2E_EXTERNAL_APP_DIR` | `D:/ZoworkProjects/external-test-app` | Where `verify-scoring-api.js` finds the test app's installed `@yourco/forms`, to check a downloaded artifact in Node. The app doesn't need to be running. |

Screenshots and artifacts in `e2e/output/` are overwritten on each run.
