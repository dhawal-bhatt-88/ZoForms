# Builder brief — adopt renderer 0.28.1, finish the developer docs, remove Multi-select

Builder repo, branch `formbuiler-service-dhawal`. Follows the developer docs (`078aced`) and renderer 0.28.1 (renderer `8e513a8`, 4 Nov 2026).

The renderer's hand-over is `D:\ZoworkProjects\RenderingEngine\docs\briefs\BUILDER-HANDOVER-0.28.1.md`. **Read it in full before CP0.** This brief carries it out; where they disagree, say so in CP0.

**First:**
1. Save this brief as `docs/briefs/BUILDER-BRIEF-RENDERER-0.28.1.md` and commit it on its own.
2. Copy both contracts byte for byte from `D:\ZoworkProjects\RenderingEngine\docs\`, each committed on its own. If either hash differs, stop and say so.
   - `GROUPS-AND-PAGES-CONTRACT.md`, SHA-256 (LF) `a7a48db098499eb17502e510de6b78a612911928b35d74ef7b3e5c4508a9329a`;
   - `DRAFTS-CONTRACT.md`, SHA-256 (LF) `a7964ebf287e7537f1af0aa00910e9d0a75922aeedeff58ff93f9122ce476a9c`.

**Then stop after CP0 and wait for approval before changing any code or page.**

## Scope

**1. Package.**
- Move the web app and the API to 0.28.1, from the renderer's pack: SHA-256 `30c1540d5b2b66be339cc8ca011840de1446001b57a0328de6722c260395e57e`. CP0 reports its path.
- Replace the vendored tarball and update the lockfile. Confirm the installed package really is 0.28.1 in both apps; last time pnpm kept the old one.
- The spec-match test, the `/core` loader test and the `form-renderer.props.json` drift test pass.
- Re-run the integrity gate, and the Download check, on every version, template and fixture.

**2. The docs' `[TODO: changing in 0.28.1]` sentences.** The CP6 report of the developer docs lists every one. Handle them by behavior:
- **The version filled in** (3 sentences): rewrite them for `submission.answeredFormVersionId`, using the hand-over's rules.
- **Server rendering** (4 sentences, plus the tutorial's step 5): rewrite them for 0.28.1. A refused form file shows the message on the server and in the browser, the page returns 200, `onRenderError(error, {})` is called once in the browser, the error is logged, and no new `key` is needed. Update the real-app check's Next.js section to assert the new outcomes: static, dynamic and `<Suspense>` all 200, with the message.
- **`onError` without the response** (4 sentences): **this isn't changing.** Remove the tag and keep the text. Link to the README's Known limits only if the docs already link to the README elsewhere.

**3. Everything else in the hand-over that changes what the docs say.** At least:
- **The corrected cast rule.** Conditions, pages, a drafts setting or a progress style need `as FormSchema`. The docs currently say only conditions need it.
- **The renamed "Files served by your app" anchor,** wherever the docs link to it.
- **The README-sync test's pinned hash and comparisons.**
- **The "What a server stores" paragraph** (G&P §5) on the validate-and-store and `prepareSubmission` pages.
- **The `clearDrafts` rejection wording.**
- **The tab-copy version sweep:** the "What is stored in the browser" page states it from the contract now, not from the code.
- **The `formVersionId` now required in the body,** on the posted-body page.

**4. The `getKey` `[TODO]`** on the drafts page. Replace it with one sentence saying how the host creates and keeps each user's key is the host's own decision. Keep the facts the page already states from the contract: an AES-GCM 256 key per user, supplied after sign-in, and a draft that can't be decrypted is deleted with the "couldn't be opened" message.

**5. Remove Multi-select from the insert menu** (decided by Dhawal, 4 Nov 2026). Follow the Hidden field precedent.
- Remove it from the insert menu and its search keywords.
- Existing `multiselect` blocks still open, can be selected, edited and deleted, still save, and still render and submit for respondents. No schema or contract change.
- CP0 proposes:
  - whether the inspector or canvas says anything about it being no longer offered (for example a pointer to Checkboxes);
  - whether the builder should offer to convert a Multi-select into Checkboxes. Recommended: no conversion in this brief.
- Report every system template, fixture, example form and test that uses `multiselect`. Propose what changes: system templates should move to Checkboxes; test fixtures may keep it, to prove old forms still work.
- **Docs:**
  - the form file page's `multiselect` `[TODO]` becomes a short statement: no longer offered in the builder; files that have it still render and submit;
  - remove any author page's mention of Multi-select as an option;
  - the "For developers" data file and its test record the gap as intentional.

**Out of scope:**
- The three `[TODO: legal review]` sentences (Dhawal).
- Deployment.
- Any renderer change.
- The external test app.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing test keeps passing, except assertions CP0 lists as encoding 0.28.0 behavior or Multi-select in the menu.
- Every changed docs page keeps passing the code-example test, `verify-docs`, `verify-a11y` (light and dark) and the 320px check.
- Run the API from `node dist/main.js` for e2e and audit scripts.
- Stop only processes you launched, recorded by PID and start time when you launch them. Never use parent-PID lookups or name patterns.
- Throwaway data only; delete it before reporting.
- Commit at each checkpoint once checks pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Both contract hashes after the copy.
- The tarball's path and SHA-256.
- Every place that names 0.28.0.
- **Item 2:** every tagged sentence, with its new text.
- **Item 3:** every other docs change from the hand-over, with its new text.
- **Item 4:** the new sentence.
- **Item 5:** the menu change, the inspector and canvas proposal, and every use of `multiselect` with what happens to it.
- Anything in the hand-over this brief doesn't cover.

**CP1 — Package and Multi-select.**
- Item 1.
- Item 5's code and tests: the insert menu, an e2e that an existing Multi-select block still opens, saves, renders and submits, and any approved system-template changes.
- All checks pass.

**CP2 — Docs and final checks.**
- Items 2, 3 and 4, and item 5's docs.
- Full e2e, `verify-docs`, `verify-a11y`, the contrast gate, the web spec, the code-example test, the real-app check, the integrity gate, the audit scripts, typecheck and unit tests.
- Build the three Docker images; repeat the production-image checks (Download valid and refused, the stale save, no links in responses); then remove the containers and images.
- Screenshots of each changed page at 375 and 1440, light and dark.
- The report lists every `[TODO]` left in the docs.
