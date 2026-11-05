# Builder hand-over — `@zoworkhq/zoforms` 0.29.0

The product is now called **ZoForms** (5 Nov 2026), and the renderer package is renamed with it: **`@zoworkhq/forms` is now `@zoworkhq/zoforms`.** This release is only the rename. Behaviour, schemas, payloads and the API are unchanged from 0.28.1. Nothing has been published under either name, so there is no alias or re-export under the old one. Remove the old package; don't keep both.

**Take the tarball:** `zoworkhq-zoforms-0.29.0.tgz`, SHA-256 `3f3751d1334a4101e269a4606196efe012d00ff7510633ba70b89ec0b3afb070`. The licence (MIT, Zowork) and repository values are unchanged from 0.28.1.

## 1. Replace the vendored tarball

In both the web app and the API:

1. `npm uninstall @zoworkhq/forms`, and delete the old `zoworkhq-forms-*.tgz` if nothing else uses it.
2. `npm install ./zoworkhq-zoforms-0.29.0.tgz`. Check that `node_modules/@zoworkhq/zoforms/package.json` says `0.29.0` and that `node_modules/@zoworkhq/forms` is gone.
3. Clear the bundler cache (for Vite, delete `node_modules/.vite`), then restart the dev server and the API.

## 2. Update every import

There is still no bare `@zoworkhq/zoforms` import: use the three entry points.

| Old | New |
|---|---|
| `@zoworkhq/forms/react` | `@zoworkhq/zoforms/react` |
| `@zoworkhq/forms/core` | `@zoworkhq/zoforms/core` |
| `@zoworkhq/forms/styles.css` | `@zoworkhq/zoforms/styles.css` |

This includes `require('@zoworkhq/zoforms/core')` in CommonJS servers, `import type` lines, `.d.ts` / `.d.mts` files, and any path into `node_modules/@zoworkhq/forms/…`. Anything that finds the package by name also needs updating, such as a test that looks for the stylesheet by its Vite dev id.

**Unchanged:** every exported name (`FormRenderer`, `prepareSubmission`, `clearDrafts`, `ClearDraftsError`, `calculateScores`, the types and so on), the `zf-` class prefix, the `data-zf-*` attributes, the `--zf-*` custom properties, the schema format, the posted body and `result.submission`.

## 3. Copy the contracts

Both have changed. Check each file's SHA-256 with line endings as LF:

| File | SHA-256 (LF) | Changes |
|---|---|---|
| `docs/GROUPS-AND-PAGES-CONTRACT.md` | `190056d911d4312962c02cd5b8a90e96dccb855a4228be818264e84101a54fd7` | Status line only: the 5 Nov 2026 amendment, and "Shared by the builder repo and the `@zoworkhq/zoforms` renderer repo". |
| `docs/DRAFTS-CONTRACT.md` | `821ba48e059e100b13beba8b6400ae031ffa07273c9acc5977c5443d75e57167` | §3 and §8: `clearDrafts` and `ClearDraftsError` come from `@zoworkhq/zoforms/react`. §5: the new storage names (section 4 below). Status line: the 5 Nov 2026 amendment and the package name. |

The earlier "amended 15 Oct 2026 for the package rename (`@zoworkhq/forms` …)" entry in the G&P status line is kept as history.

## 4. Storage names in the browser

| What | Old | New |
|---|---|---|
| The tab's `sessionStorage` key prefix | `@zoworkhq/forms:` | `@zoworkhq/zoforms:` |
| Device drafts' IndexedDB database | `zoworkhq-forms-drafts` | `zoworkhq-zoforms-drafts` |

The rest of the key is unchanged: `@zoworkhq/zoforms:{formId}:{formVersionId}`, followed by `:{scopeHash}` whenever the host gave a `scope`. The database's records, indexes and encryption are unchanged.

**Progress saved by an earlier version is not carried over.** The renderer doesn't read, migrate or delete the old entries or the old `zoworkhq-forms-drafts` database; a leftover one in a test browser is harmless. Server-mode drafts the host has stored are unaffected; only their tab copy's key changes. Any test or tool that reads these keys or the database by name needs the new names.

## 5. Console messages and errors

Every console warning and error the renderer logs now starts with **`@zoworkhq/zoforms:`** (formerly `@zoworkhq/forms:`). The text after the prefix is unchanged. For example:

- `console.error("@zoworkhq/zoforms: this form can't be shown.", error)` for a refused form, in the browser and during server rendering.
- `@zoworkhq/zoforms: onRenderError threw.`
- `@zoworkhq/zoforms: form "{formId}" is mounted more than once on this page. …`
- `@zoworkhq/zoforms: the validator for field "{blockId}" … threw or returned a value that is not a message, null or undefined.`

The unsupported-`schemaVersion` error (thrown by `/core`; in the browser it's the error logged and passed to `onRenderError` when the form is refused) now reads: *"This form uses schemaVersion {n}, which this version of @zoworkhq/zoforms does not support (it supports 1 and 2). Upgrade @zoworkhq/zoforms to render it."*

Update any docs, tests or log filters that quote these.

## 6. What the docs should now say

- **The package name** is `@zoworkhq/zoforms`, with the install command `npm install @zoworkhq/zoforms` and the import paths in section 2.
- **The product name** is ZoForms. The package README's intro now reads: "Renders a form schema exported from the ZoForms builder in a React app, validates it, and posts it to your API."
- **Storage names** are as in section 4, with the note that earlier progress isn't carried over.
- **Console messages** start with `@zoworkhq/zoforms:`, as in section 5.
- **README anchors** are unchanged. The README's new release note is "0.29.0: the package is now `@zoworkhq/zoforms`".

## Checked

- Renderer: all 57 test files (2,098 tests) pass; the package type-checks; `npm pack` reproduces the SHA-256 above from a clean checkout.
- External test app, installed from this tarball: all 20 form routes render, fill and submit to the local API (HTTP 201) in Chrome 157. The custom-properties page renders and its check passes against the 0.27.0 baseline. Demo mode (in-browser API) stores the submission. The page loads the package only from `node_modules/@zoworkhq/zoforms`. A device-drafts form keeps its tab copy under `@zoworkhq/zoforms:` and creates `zoworkhq-zoforms-drafts`.

## Still pending

- **npm scope ownership:** `@zoworkhq/zoforms` is free on the public registry (404), and the `@zoworkhq` scope exists with no packages, but who controls it hasn't been confirmed. Dhawal is checking it before the first publish. Nothing has been published.
- From 0.28.0: the reopened-closed-tab prompt check (by hand), and Safari, which hasn't been tested.
