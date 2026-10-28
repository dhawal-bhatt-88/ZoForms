# Builder brief — adopt renderer 0.27.0

Builder repo, branch `formbuiler-service-dhawal`. Follows RENDERER-BRIEF-FIXES-0.27.md (renderer `94f47cb`, released locally 28 Oct 2026). This brief carries out that brief's builder hand-over list.

**First:**
1. Save this brief as `docs/briefs/BUILDER-BRIEF-RENDERER-0.27.md` and commit it on its own.
2. Copy `D:\ZoworkProjects\RenderingEngine\docs\GROUPS-AND-PAGES-CONTRACT.md` byte for byte over `docs/GROUPS-AND-PAGES-CONTRACT.md`. Check SHA-256 (LF) is `c50e8b05a95bb90e398afeaa8f3f40d61f200d975faadf038d21cae6495bbb3e`. Commit it on its own ("docs: contract copied from renderer 0.27.0"). If the hash differs, stop and say so.

**Then stop after CP0 and wait for approval before changing any code or page.**

## What 0.27.0 changed (from the renderer's release)

- **Empty answers** (§5): an empty array, empty object, or empty or whitespace-only string is no answer, for every type. A hand-made `[]` or `{}` no longer satisfies a required question in `prepareSubmission`.
- **Link answers** (§5): only `https:` or `http:` addresses with a host and no `user@` credentials. `javascript:`, `data:`, `mailto:`, `tel:` and the rest are rejected with the existing message.
- **Error summary** (§12.5): every line names its question. A message that doesn't already name it gets `"<label>": ` in front, after any repeat prefix: `Child 1: "Age": Must be at most 17.` Host validator messages too. Messages beside the field and `ValidationError.message` are unchanged.
- **Clearing answers** (§7, §14.5): choosing the selected value again clears Rating and Matrix rows (Multiple choice and Grid radio cells already did). A visible **Clear selection** button appears on Multiple choice, and on a Matrix with neither Required nor Answer every row on, while it has an answer; Grid radio cells in an optional column get a per-cell **Clear**. New class `zf-clear-selection`.
- **Rating** buttons are named "1 star", "2 stars" … "5 stars".
- **Video captions** (§10): an optional `captions` field on video files: a `.vtt` address under the §9 source rules. Off until the respondent turns them on. Ignored for YouTube and Vimeo.
- **Form title** (§7): the renderer never shows the form's `title` or `description`; the host does. Type-only addition of `description`.

## Scope

1. **Package:** move the builder to 0.27.0.
2. **Docs:** update every page the release makes wrong.
3. **Captions setting:** let authors set captions on a video file.

Out of scope: developer docs (a separate brief), signed-in pages other than the Video inspector, flaky-test work.

## Accuracy rules (unchanged)

Every fact from the contract, the renderer's README and source (0.27.0), or the builder's code. Messages quoted exactly from the renderer. Nothing from this brief's summary above without checking it. Use the builder's own names. Anything you can't source: `[TODO: …]`, listed in the report.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- The contract hash after the copy.
- Where the 0.27.0 `.tgz` is (renderer repo or external test app), and its SHA-256.
- Every place in the builder repo that names 0.26.0 or depends on it: `apps/web/package.json`, the lockfile, `vendor/`, Dockerfiles, `form-renderer.props.json`, `e2e/docs.spec.ts`, `hero-visual.tsx` and its screenshots, and anything else.
- Whether the docs example forms need regenerating (the schema export hasn't changed) or only the runtime tabs change.
- Whether the builder or its API checks link answers, or any answer, itself anywhere. Expected: no.
- **Docs:** every page and line the release makes wrong, with the proposed new text. At least:
  - the shared sentence about where messages show (on every question-type page that has it), adding that a summary line starts with the question's label when the message doesn't already name it;
  - the message tables on Email, Link, Phone number, Number and Dropdown, showing the summary form;
  - `integrate/reference/form-renderer.mdx`: the validators prop's summary form, including the fail-closed message;
  - Link: the new rule; remove the troubleshooting entry about non-web addresses and the `[TODO]` about tightening the check (keep the screen-reader `[TODO]`);
  - Rating: choosing the same star clears it; "1 star"; remove the "can't take their rating back" entry;
  - Matrix, Multiple choice, Grid: the clear behaviors and buttons, and when they show;
  - Repeating groups: optionally a format example such as `Medication 2: "Dose": Must be at most 10.`
- Every `verify-docs`, `verify-a11y` and web-spec assertion that encodes 0.26.0 behavior (for example a rating that stays selected, the Link check, summary text) and how it changes.
- **Captions setting design:**
  - where the field goes in the Video inspector, and that it shows only when the source is a video file, not YouTube or Vimeo;
  - what happens to a stored `captions` when the source changes to YouTube or Vimeo (recommended: keep it, hide the field, the renderer ignores it);
  - the save check (refuse an unrecognised captions address, using the contract's test table), its inline message and API 400;
  - the §10 contract change: today it says the builder can't set captions; draft the replacement. It is applied in the builder first, and its SHA reported, so the identical file can be copied into the renderer repo.

**CP1 — Package.**
- Replace the vendored tarball with 0.27.0; update `apps/web/package.json` and the lockfile; remove the 0.26.0 tarball.
- Update the version strings and regenerate `form-renderer.props.json` with its command; the drift test passes.
- Retake the hero screenshots from the external test app on 0.27.0, light and dark; update the hero comment.
- Change only the docs content that tests force; everything else waits for CP2.
- All checks pass.

**CP2 — Docs.**
- Every page change from CP0, as approved.
- Update the `verify-docs` claim checks to the new behavior and add checks for: a summary line with the label in front, choosing a selected star clears it, the Clear selection button on an optional Multiple choice (and absent on a required one), and an unsafe link rejected.
- Screenshots of each changed page at 375 and 1440, light and dark.

**CP3 — Captions setting.**
- The contract §10 change, committed on its own, with its SHA-256 reported.
- The inspector field, the save check (inline and API 400), unit, API and e2e tests.
- The Video page: the new setting, the CORS and `media-src` notes from the contract, and the transcript guidance kept for videos with speech that have no captions file.
- Full e2e, `verify-a11y`, `verify-docs`, contrast gate, web spec; screenshots of the Video inspector light and dark.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing test keeps passing, except assertions CP0 lists as encoding 0.26.0 behavior.
- Commit at each checkpoint once tests pass. Don't push.
- Stop every server you start before reporting.
