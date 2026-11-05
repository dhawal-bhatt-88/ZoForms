# Builder brief — manual-review fixes (docs, home page, ZoForms rename)

Builder repo, branch `formbuiler-service-dhawal`, web app (`apps/web`) plus any user-visible text elsewhere (emails, admin). Five items from Dhawal's manual review on 5 Nov 2026.

**Run after** the renderer has been renamed and packed (renderer brief RENDERER-BRIEF-RENAME-ZOFORMS.md, run in the renderer repo). Dhawal will hand you the new `.tgz` and the two amended contracts.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-REVIEW-FIXES-NOV.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## 1. Collapsible side navigation in the docs

- Each group in the docs side navigation gets a heading button that expands and collapses its pages (`aria-expanded`, `aria-controls`; Enter and Space toggle).
- Default: the group holding the current page is open; the others are closed.
- The reader's open/closed choices are remembered in the browser (`localStorage`, every read and write in try/catch; the page works without it).
- The current page's group can still be closed by the reader, but opens again on navigation to a page inside it.
- Same behaviour inside the mobile menu below 760px.

## 2. Remove "Applies to"

- Remove "Applies to" from the page header on every docs page.
- Also remove the `appliesTo` frontmatter field, its template and component code, its line in the `.md` output and llms.txt, and any test that checks it.
- Badges and "Last updated" stay.

## 3. Docs for signed-in users

- **Bug:** a signed-in user cannot see `/docs`. CP0 finds the cause (middleware, layout, redirect or routing) — report it before fixing.
- **Decided:** signed-in and signed-out visitors see the **same public docs layout**. Add a **Docs** link to the app rail that opens `/docs` in the same tab.
- The docs top bar shows **Open my forms** instead of **Sign in** when there is a session.
- `/docs`, its `.md` routes and llms.txt stay public; nothing else changes access.
- A web spec covers `/docs` signed out and signed in.

## 4. Rename "Zowork Forms" to "ZoForms"

- Every user-visible place: page titles, metadata, public header, app rail, auth pages, admin, emails, home page, docs pages, llms.txt and the docs content files.
- The renderer package is renamed to `@zoworkhq/zoforms` (exact name confirmed in the renderer's CP0): replace the vendored tarball with the new `.tgz`, update every import, and update every package name shown in docs code samples.
- Replace both contracts in `docs/` with Dhawal's amended copies; report their SHA-256s, which must match the renderer repo's.
- `zf-` classes, `data-zf-*` and `--zf-*` do not change.
- Old briefs and past release notes stay as written.
- If the name sits in code identifiers, CP0 lists them; rename only what a user can see unless Dhawal says otherwise.

## 5. A fuller home page

Keep the existing page and its wording rules (no HIPAA claim, no invented numbers, logos or quotes, only shipped features). Add:

**USPs** — a section right after the hero, four cards in this order:
1. **Clinical scoring built in** — option scores, formulas on groups, several scores per group, results shown after submit if the author allows, and the server always recalculates.
2. **Logic for real clinical forms** — show or hide questions with AND/OR logic, nested and repeating groups, pages and a wizard with a review page, drafts.
3. **Answers never touch our servers** — the form in your app posts straight to your own endpoint; ZoForms never receives or stores answers.
4. **Developer-friendly package** — an npm package; the same `/core` validation and scoring runs in the browser and on your Node server; your own validators; themeable through `--zf-*` properties.

Each card links to its docs page where one exists.

**Live examples** — a section "See it working", with three forms rendered by the real vendored renderer (reuse the docs' tabbed example component; tabs **Preview · What your server receives**, the second generated at runtime from a real `prepareSubmission` call, never hand-written JSON):
1. **Scored check-in** — five or so invented frequency questions (Not at all … Nearly every day) with option scores and a group total shown after submit. Do **not** reproduce a validated instrument's wording; label it as an example, not a clinical tool.
2. **Follow-up question** — reuse the docs example (therapist yes/no, follow-up shown only on Yes).
3. **Repeating group** — "Current medications": name and how often, add and remove entries.

Submitting runs in the browser only; nothing is sent anywhere. Examples load only on the home page, not on signed-in pages.

## Rules

- List matches before changing anything; no blind replace-all. Exclude `.git`, `node_modules`, `dist`, `.next`, `.vite`.
- Use existing ZoBlocks tokens and kit components; no new colours.
- Contrast gate and axe (`verify-a11y.js`) cover the changed docs pages and the home page in light and dark.
- Every unit test, web spec and e2e suite keeps passing.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- The cause of item 3.
- Every "Zowork Forms" and `@zoworkhq/forms` match, grouped by file, user-visible versus code identifiers.
- Where `appliesTo` is defined and used.
- How the side navigation is built today and your plan for item 1.
- The home page outline with the new sections in place, and the exact questions and options proposed for the three examples.

**CP1 — Docs fixes.** Items 1, 2 and 3.

**CP2 — Rename.** Item 4, with the new tarball and contracts.

**CP3 — Home page.** Item 5; screenshots at 375, 768 and 1440 wide, light and dark.
