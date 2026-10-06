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

Accounts are on the free plan, which allows 3 forms at a time. The suites that need more forms delete each one when they're done with it.

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
| `verify-logic.js` | yes | Conditional logic in the editor: adding conditions, All/Any, the dependency guards, and conditions in the artifact. |
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
| `verify-groups-api.js` | no | Groups through the API: save, download, restore, no-change detection and every save rule's message. |
| `verify-pages-api.js` | no | Pages and navigation through the API: page shape, navigation defaults in the artifact, and every page rule's message. |
| `verify-versions.js` | no | Append-only versions and the read-only artifact endpoint, including another user's access. |

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `E2E_API_URL` | `http://localhost:4000` | The API. |
| `E2E_WEB_URL` | `http://localhost:3100` | The web app. |
| `E2E_BROWSER_CHANNEL` | `msedge` | Playwright channel; empty for its bundled Chromium. |
| `E2E_OUTPUT_DIR` | `e2e/output` | Where screenshots and downloaded artifacts go (git-ignored). |
| `E2E_EXTERNAL_FORMS_DIR` | not set | If set, e.g. `D:\ZoworkProjects\external-test-app\src\forms`, the artifacts the suites download are also copied there, ready to render. |
| `E2E_EXTERNAL_APP_URL` | not set | If set, e.g. `http://localhost:5173/external-test-app/`, `verify-repeats.js` renders its download in the external test app (`?form=builder-repeats`) and submits it. Needs `E2E_EXTERNAL_FORMS_DIR` as well, and the test app running there (`npm run dev:all`). When unset, that step is skipped. |

Screenshots and artifacts in `e2e/output/` are overwritten on each run.
