# Builder brief — remove impersonation, add undo, download earlier versions

Builder repo (ZoForms), branch `main`. Web app, API and admin console. The renderer is not touched.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-UNDO-VERSIONS-IMPERSONATION.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.** Then stop after each checkpoint.

Three independent pieces of work, done in this order: impersonation removal (smallest, subtraction), version downloads, then undo (largest).

---

## 1. Remove impersonation completely

Platform admins can currently sign in to the builder as a client user from the admin console. The feature is removed, not hidden.

**Remove:**
- The admin console's impersonate action, its UI, and any route or page for it.
- The API endpoint(s) that start impersonation and the code that mints impersonation tokens.
- Any impersonation banner, "stop impersonating" control or similar in the web app.
- Guard and token code that exists only for impersonation (`impersonatedBy` handling, the rule refusing impersonation tokens on the admin console, the self/admin/suspended-user refusals).
- Impersonation checks in the e2e suites (`verify-access-api.js` and any other) and the release-audit script, their README rows, and any docs or help text that mention it.
- **Past audit log entries.** A forward Prisma migration deletes every `AuditLog` row with action `user.impersonated` or `user.impersonation_refused`. Their wording and icon come off the admin console's audit page; no wording is added for `user.impersonation_refused`.
- `NEXT_PUBLIC_TENANT_URL` everywhere: the admin console's code, Dockerfile and env example, `deploy.yml`, README and DEPLOY.

**Keep:**
- Every other admin console tenant tool: tenants, users, audit, forms list.
- Every tenancy check and its e2e coverage.
- Dated audit reports, the cleanup docs and past briefs, as written.

**Tokens already issued:** no check is kept for them. There is no `impersonatedBy` handling anywhere, no guard rule and no test for it; a token minted before the change expires within its hour.

**At CP1, report** a case-insensitive repo-wide search for `impersonat`, excluding `.git`, `node_modules`, `dist`, `.next`, past briefs, dated audit reports and the cleanup docs. It must return nothing.

---

## 2. Download any of the 10 most recent versions

Today the editor and dashboard download only the latest saved version. Authors also need earlier ones.

- **Where:** the form's versions page. Each of the **10 most recent versions** gets a **Download** action (decision 2 confirms whether "10" includes the latest). Older versions show no Download, and the page says in one line that only the 10 most recent versions can be downloaded.
- **API:** `GET /v1/forms/:id/versions/:versionId/artifact`, authenticated and org-scoped, with the same role rules as today's download. A version outside the 10 most recent is refused by the API too, not only hidden in the UI.
- **The file:** built exactly as today's download, with `formVersionId` set to that version's id, the score formula tree derived from `formulaText`, the existing file naming with that version's number (e.g. `phq-9-v12.json`), and the same integrity check before anything is returned.
- **An old version that fails the integrity check** (for example one saved before a later format change): return the clear error naming the problem and download nothing. Don't patch old versions.
- Downloading writes nothing and never creates or changes a version, same as today.
- The current editor and dashboard Download stay as they are.
- Update the docs page that covers versions and downloading.

---

## 3. Undo and redo in the form editor

Today the only ways back are Cancel (discard everything since the last save) and restoring a saved version. Authors need step-by-step undo.

**Behaviour (CP0 confirms or proposes changes):**
- **What it covers:** every change to the form's content in the editor: adding, deleting, moving and duplicating questions, groups and pages; every setting in the settings pane; options, codes, scores, import; conditions and logic text; scores and formulas; form title and description.
- **One step per action.** Typing in one text field counts as one step, ending when the author leaves the field. Codes or names generated as a result of an action (for example on leaving an edited label) belong to that same step.
- **Redo**, cleared by any new change after an undo.
- **Controls:** Undo and Redo buttons in the editor toolbar, disabled when there is nothing to undo or redo, with accessible names. Keyboard: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y (Cmd on Mac).
- **Text fields keep the browser's own undo.** While focus is in a text input or textarea, the keyboard shortcuts belong to the browser; the builder's undo applies outside text fields and through the buttons.
- **Feedback:** after an undo or redo, the affected question is selected and scrolled into view, and a polite live region announces what happened (e.g. "Undone: delete question 'Address'"). CP0 proposes the wording.
- **History limit:** the last 100 steps.
- **Save** keeps the history; undoing after a save makes the form unsaved again (Save enabled).
- **Cancel** and **Restore** clear the history. A page reload loses it (in memory only).
- **Viewers** (read-only editor) get no undo or redo.
- **Undo can't produce a broken form.** It returns the editor to an earlier state that already passed the editor's guards, so the guards needn't run again. CP0 proposes the approach (whole-content snapshots versus recorded commands) based on how the editor state is held today, and says why.
- Add a "Save, undo and versions" page under Build forms in the docs, with a short Undo section.

---

## Decisions (made after CP0)

1. **Impersonation history:** no column exists only for impersonation. The audit rows are deleted by migration, and no check for old tokens is kept.
2. **"10 versions":** the latest plus the 9 before it. A version outside them is refused with 422 `VERSION_TOO_OLD`, and the versions list says which rows are `downloadable`.
3. **Undo approach:** whole-content snapshots. Typing is grouped per field, including the field's leave handlers. Announcements read "Undone: *action*." and "Redone: *action*."; the buttons are named Undo and Redo, with the next step as their tooltip.
4. **Stray file:** the untracked `s -- e2e` file in the repo root is deleted.

## Rules

- List matches before changing anything; no blind replace-all. Exclude `.git`, `node_modules`, `dist`, `.next`, `.vite`.
- Use existing ZoBlocks tokens and kit components; no new colours.
- Each piece adds its own unit tests and e2e coverage; contrast gate and axe cover the changed screens in light and dark.
- Every unit test, web spec and e2e suite keeps passing. After e2e runs, restore the external test app's form files (`git checkout -- src/forms` there) unless told otherwise.
- One forward Prisma migration per piece if the schema changes.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Impersonation: every file, endpoint, column, test and doc involved, and what happens to tokens already issued.
- Versions: how versions and today's download are built, the proposed endpoint, and what the versions page looks like now.
- Undo: how the editor holds form state today, the proposed approach, how typing will be grouped into steps, and the announcement wording.
- The three decisions with your recommendations.

**CP1 — Impersonation removed.**

**CP2 — Version downloads.**

**CP3 — Undo and redo.** Report the full test and e2e results, and screenshots of the toolbar and versions page in light and dark.
