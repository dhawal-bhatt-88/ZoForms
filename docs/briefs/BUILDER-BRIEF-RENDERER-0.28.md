# Builder brief — adopt renderer 0.28.0

Builder repo, branch `formbuiler-service-dhawal`. Follows the renderer's release fixes (renderer commits up to `217b1f5`, 30 Oct 2026). The renderer's own hand-over is `D:\ZoworkProjects\RenderingEngine\docs\briefs\BUILDER-HANDOVER-0.28.0.md`: read it in full before CP0. This brief carries it out; where they disagree, say so in CP0.

**First:**
1. Save this brief as `docs/briefs/BUILDER-BRIEF-RENDERER-0.28.md` and commit it on its own.
2. Copy both contracts byte for byte from `D:\ZoworkProjects\RenderingEngine\docs\`, each committed on its own:
   - `GROUPS-AND-PAGES-CONTRACT.md`, SHA-256 (LF) `efe27e5e96e3299fec78ab79b8a1837411dd5f6aee38d3ed210d47c75e3bcbda`;
   - `DRAFTS-CONTRACT.md`, SHA-256 (LF) `9b7b378840207a3bec1cf191a052d8797c44f3b93866aeae5135406317da2ff3`.

   If either hash differs, stop and say so.

**Then stop after CP0 and wait for approval before changing any code or page.**

## The tarball

0.28.0 is packed in the renderer repo, but it will be packed once more when the licence's copyright holder and repository URL are filled in. That re-pack changes only `package.json` and `LICENSE`, not `dist`. So:
- CP1 to CP2 use the current 0.28.0 tarball.
- CP3 swaps in the final one and confirms its `dist` is byte-identical to the one tested (compare the files' hashes).

## What 0.28.0 changes that the builder must handle

From the renderer's release note and hand-over; verify each against the package.
- **Stricter integrity check:** every printed text value must be a string, `blocks` and `options` must be arrays, nesting is limited to under 100 groups, and repeating groups without `maxOccurs` allow at most 1,000 entries.
- **`prepareSubmission`:**
  - rejects a body without a valid `idempotencyKey` and `submittedAt`;
  - rebuilds every answer and applies new number, date and time formats;
  - returns `result.submission`.
- **Errors at mount** show a message inside the form and call `onRenderError`; they no longer throw to the host.
- **Element ids and radio `name`s** carry a per-form prefix (for example `zf-r0-`).
- **Drafts:**
  - session mode no longer restores silently, except after a reload of the same address;
  - new `drafts={{ mode: 'off' }}`;
  - `scope` and `owner` now work in session mode.
- **Submit** is `aria-disabled` while sending, and the questions sit in a new `zf-fields` fieldset.
- **`react` and `react-dom` peers** are `^18.0.0 || ^19.0.0`.

## Scope

1. **Package:** the web app and the API both move to 0.28.0 from the vendored tarball, as today. The spec-match test passes, and `form-renderer.props.json` is regenerated (new props: `onRenderError`, `drafts.mode`, `scope` and `owner` in session mode).
2. **Integrity gate:** re-run `scripts/audit/integrity-gate.mjs` with 0.28.0 on every form version, template, system template file and test fixture. Any item 0.28.0 refuses means the builder can save something the renderer won't mount. Report each one, and propose either a builder save rule (in the existing save-check style, API 400 and inline) or a fix to the content.
3. **Save rules versus the new ceilings:**
   - Can an author save `maxOccurs` above 1,000, or nesting the renderer now refuses? The builder's 20 is below the renderer's 100.
   - Can any text field the renderer prints be saved as a non-string?
   - Report each, and propose builder rules where there's a gap.
4. **Where the builder mounts the renderer:**
   - the editor preview;
   - the docs live examples;
   - the home page's hero, if it renders live;
   - anything else.

   Each one that remounts must not show the drafts prompt or keep answers in tab storage. Expected: `drafts={{ mode: 'off' }}`. Each also passes `onRenderError` where the builder can show something useful.
5. **The docs examples' Server output tab:** the fetch shim runs `prepareSubmission` on the browser's real body. Confirm it still passes with the key and time required, and that the tab shows `result.submission`, or say what it should show.
6. **Tests:** every builder e2e, `verify-*` script, web spec and audit script that finds renderer elements by raw block id or radio `name` breaks with the prefix. List them, and move them to a helper (for example by `data-` attribute or label) rather than hard-coding the prefix.
7. **Author docs:** every page that this release makes wrong. At least:
   - anything saying the renderer throws or shows a blank page;
   - repeating groups (the 1,000-entry default when no maximum is set);
   - Number, Date and Time (the value formats);
   - the groups page's nesting note;
   - anything about drafts or what respondents see after a refresh.

   Same accuracy rules as before: from the contracts, the renderer's README and source (0.28.0), or the builder's code; messages quoted exactly; `[TODO: …]` for anything unsourced.

**Out of scope:**
- Developer docs (the next brief).
- Deployment.
- Anything in the renderer.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing test keeps passing, except assertions CP0 lists as encoding 0.27.0 behavior.
- Run the API from `node dist/main.js`, not `nest --watch`, for e2e and audit scripts.
- Stop only processes you launched, recorded by PID and start time when you launch them. Never use parent-PID lookups or name patterns.
- Throwaway data only; delete it before reporting.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Both contract hashes after the copy.
- The current 0.28.0 tarball's location and SHA-256.
- Every place that names 0.27.0 or depends on it.
- **Item 2:** the integrity-gate results with 0.28.0.
- **Item 3:** the save-rule gaps, and the proposed rules.
- **Item 4:** every place the renderer is mounted, and the props each will get.
- **Item 5:** the shim result.
- **Item 6:** every test that breaks, and the helper.
- **Item 7:** every docs page and line that changes, with the new text.
- Anything in the renderer's hand-over that this brief doesn't cover.

**CP1 — Package, mounts and tests.** Items 1, 4, 5 and 6, and any item 2 content fixes approved at CP0. All checks pass.

**CP2 — Save rules and docs.** Items 3 and 7. If a new save rule needs a contract line, draft it, commit it on its own, and report its SHA-256 so it can be copied to the renderer.

**CP3 — Final tarball and checks.**
- Swap in the final tarball and confirm `dist` is byte-identical.
- Run everything: full e2e, `verify-a11y`, `verify-docs`, the contrast gate, the web spec, the integrity gate, the audit scripts, typecheck and unit tests.
- Build the three Docker images and repeat the CP3 production-image checks from the release fixes: Download valid and refused, the stale save, no links in responses. Then remove the containers and images.
- Screenshots, light and dark, of each changed docs page and of the editor preview.
