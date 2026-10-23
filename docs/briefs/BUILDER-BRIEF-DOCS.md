# Builder brief — Zowork Forms documentation site

Builder repo, branch `formbuiler-service-dhawal`, web app only (`apps/web`). Run **after** BUILDER-BRIEF-HOME.md: this reuses its public header and public routing.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-DOCS.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## Goal

A public documentation site at `/docs` in the builder app. This brief builds the **framework**: shared layout, four page templates, Markdown and llms.txt output, and **one real page per template**. Writing the rest of the content is later work.

## Structure (agreed 23 Oct 2026)

1. **Build forms** — for form authors, task-based.
2. **Integrate forms** — for developers: quickstart, tutorial, how-to guides, reference, concepts.
3. **Examples** — a gallery of live forms.
4. **Compliance and security**.
5. **Release notes** — site-wide only. Pages do **not** carry their own "Recent changes" section.
6. **llms.txt** and a Markdown version of every page.

## Common layout — every page

Desktop, three columns:

| Region | Content | Width |
|---|---|---|
| Top bar (shared, from the home-page brief) | Logo + "Zowork Forms" + "Docs" · search box · package version · Release notes · theme toggle · Sign in | full |
| Side navigation | Grouped list of all pages; current page highlighted (`aria-current="page"`) | 248px |
| Main column | Page header · page body · page end | fluid, max 920px |
| On this page | Links to the page's `h2` sections | 220px; hidden below 1180px |

- Below 760px: one column; the side navigation becomes a collapsible menu (not a 1,000px list above the content).
- **Page header** (same pattern on every page): breadcrumb · `h1` title · page actions (Copy page, View as Markdown) · one-line summary · badges · "Applies to" (builder and/or package version) · "Last updated".
- **Page end** (shared): "Was this page helpful?" Yes / No; on No, reason chips (Clear instructions, Example helped, Missing information, Didn't match the product); then previous and next page. Feedback is **not stored** in this brief — the UI only (decision 3).
- Callouts: **Note** (limitation), **Tip**, **Warning**. Not colour alone: each has its word label.
- Look: the builder's existing ZoBlocks tokens and kit (`apps/web/src/components/ui/`), light and dark via the `zoblocks-theme` cookie. No new colours. Code in JetBrains Mono.

## Page templates

**A. Question type** (one page per block type) — modelled on GOV.UK and USWDS component pages.
1. Live example with tabs: **Preview · Schema · Payload · Server output · Copy form · Guidance**, plus a density switch on Preview.
2. When to use / use something else.
3. Add it in the builder: prerequisite line, numbered steps, GIF placeholders, Notes for limits.
4. Settings table: builder setting → schema property → default.
5. Validation and error messages: situation → exact message text.
6. Accessibility: how it is announced; check status table (automated, contrast, screen reader).
7. For developers: payload value shape, `prepareSubmission` value, condition operators, scoring, validator example.
8. Troubleshooting.

**B. How-to guide** (builder tasks) — modelled on Tally, Microsoft and Tripetto help articles.
When you'd use this (2–3 example cards) · Before you start · numbered steps with GIF placeholders and Notes · what happens behind the scenes (e.g. hidden answers) · rules the builder enforces · Troubleshooting · "More about …" series list with the current page marked.

**C. API reference** (e.g. `FormRenderer`, `prepareSubmission`) — modelled on React Hook Form.
Import line · props-at-a-glance table (name, type, default, required) · one entry per prop: name, type, default, required pill, description, example, **Rules** callout · related links.

**D. Example** — modelled on JSON Forms and Form.io.
Live form with tabs **Preview · Schema · React code · Payload · Server output** · "Try this" checklist · How it works · related examples.

## First pages (one per template)

| Template | Page | Must show |
|---|---|---|
| A | Dropdown | Everything in template A |
| B | Show a question only when it applies | Source must be above; matrix, grid and layout blocks can't be sources; numeric comparisons need a number; All / Any / custom logic like `1 OR (2 AND 3)`; hidden answers kept while filling, never submitted, stripped by `prepareSubmission`; the four refusals (delete a source, move below a dependent, rename/remove an option used as an answer, remove a condition used in logic) |
| C | `FormRenderer` | Every prop the package exports, from its TypeScript types — not from this brief |
| D | Follow-up question | A choice "Does the client currently see a therapist?" and a required short text shown only on Yes; Payload shows the hidden answer left out when No |

Plus `/docs` (docs home: two doors, "I build forms" and "I integrate forms", and the architecture diagram: builder → JSON file → `@zoworkhq/forms` in your app → your API).

## Known content for later pages (not built in this brief)

Record each of these in the navigation config as a planned page, so it isn't lost:

- **Styling: your app's CSS and the form.** The renderer's default stylesheet has zero specificity by design, so a host page's own element rules win. Found on 23 Oct 2026: the external test app's `h1, h2` colour rule hid the form's group headings in dark mode. Changing `--zf-*` properties does not help here, because the host's rule beats the renderer's rule whatever value it reads. The page must explain this and show the two real fixes: give the host's headings a colour that works in both themes, or scope the host rule so it doesn't reach inside `.zf-form`. Check the class names against the renderer's README before writing.

A visual reference for the layout and templates A and B exists as a Claude design canvas ("Zowork Forms docs – layout and page templates"). Dhawal will share screenshots if needed; this brief is the specification.

## Accuracy rules (most important)

- **Nothing written from memory.** Every fact comes from: `docs/GROUPS-AND-PAGES-CONTRACT.md`, `docs/DRAFTS-CONTRACT.md`, the renderer's README and TypeScript types, or the builder's code.
- **Live examples render with the real `@zoworkhq/forms`.** The Schema, Payload and Server output tabs are **generated at runtime** from the actual schema, the actual submit payload and a real `prepareSubmission` call — never hand-written JSON.
- **Error message text is taken from the renderer**, not paraphrased.
- Anything you cannot source: write `[TODO: …]` in the page and list it in the checkpoint report. Never guess.
- Reference tables (props, types, defaults) are generated from or checked against the package's `.d.ts` by a test that fails when they drift.

## Content format

- One MDX (or Markdown + frontmatter) file per page under `apps/web` (CP0 proposes the folder). Frontmatter: `title`, `summary`, `template`, `badges`, `appliesTo`, `updated`, `prev`, `next`.
- Side navigation built from one ordered config file, not from folder order.
- Each page also served as plain Markdown at `<page>.md`; `/docs/llms.txt` lists every page with its one-line summary.
- Search: CP0 proposes the simplest option that works without a server-side search service.

## Decisions for Dhawal (CP0 lists them again with what the code shows)

1. **How `apps/web` gets `@zoworkhq/forms`** (it is not on a registry): workspace link to the renderer repo, a committed `.tgz`, or a private registry. Needed for live examples.
2. **MDX library** and whether it adds weight to signed-in pages (it must not).
3. **Feedback storage:** none for now (recommended), or a small table later.
4. **Docs in the builder app vs a separate site later:** this brief assumes `/docs` in the builder; keep the content files portable either way.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- `/docs` and its `.md` and `llms.txt` routes are public; nothing else changes access.
- Contrast gate and axe suite cover the docs home and the four pages, light and dark.
- Every existing unit test, web spec and e2e suite keeps passing.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Where the public header and public routing from the home-page brief live, and how `/docs` will reuse them.
- Proposed folder layout, MDX setup, navigation config and search approach.
- How the renderer package would reach `apps/web` (decision 1), and whether it renders inside the builder's styles without conflict (`zf-` classes, `--zf-*` properties).
- For each of the four pages: the sources you will use, and every fact you cannot source yet.
- The four decisions with your proposal for each.

**CP1 — Framework.**
- Layout (top bar, side nav, on-this-page, page header, page end), callouts, code block with copy, tabbed example block, the four template components, Markdown and llms.txt routes, navigation config.
- Docs home with placeholder links.
- Unit tests and web spec pass.

**CP2 — The four pages.**
- Dropdown, Show a question only when it applies, `FormRenderer`, Follow-up question — with generated example tabs and the drift test for reference tables.
- Report every `[TODO]` left.

**CP3 — Checks.**
- Full e2e, contrast gate and axe on all docs pages, light and dark.
- Keyboard: tabs in the example block work with arrow keys; skip link to main content.
- Screenshots of each page at 375 and 1440 wide, light and dark.
