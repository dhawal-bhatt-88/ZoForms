# Builder brief — authoring fixes found while writing the docs

Builder repo, branch `formbuiler-service-dhawal`. Run **after** BUILDER-BRIEF-DOCS-QUESTIONS.md is complete, because some fixes change pages it writes.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-AUTHORING-FIXES.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## Why

The docs inventory (CP0 of BUILDER-BRIEF-DOCS-QUESTIONS.md, 25 Oct 2026) found places where the builder misleads authors or lets them save a broken question. Each fix is small. Nothing is released, so there is no backward-compatibility constraint, but forms already saved in local databases must still open.

## The fixes

**1. Hidden field does nothing.**
The renderer draws nothing for `hidden`, never collects a value, and never submits it; host-supplied values aren't built. Yet the insert menu offers "Hidden field" and matches the keyword "prefill".
- Remove it from the insert menu and its search keywords.
- Existing `hidden` blocks still open, can be selected and deleted, and still save (the renderer accepts the type).
- Their canvas text says plainly that the block isn't shown, collected or submitted yet.
- No schema or contract change.

**2. Respondent's country claims auto-detection.**
The canvas says "Auto-detected country" and the menu matches "geo location", but respondents pick from a list.
- Replace the canvas text with what respondents actually see (a select of the renderer's countries plus "Other").
- Remove keywords that imply detection.
- Check the builder's country list against the renderer's (`COUNTRY_OPTIONS` is copied by hand). Report any difference; don't change the renderer.

**3. Linear scale saves broken.**
Today a scale saves with Min greater than Max (respondents see no points) or with more points than the renderer shows (at most 20).
- CP0: confirm from the renderer source exactly what it does with each bad range, and whether Min and Max must be whole numbers.
- Refuse at save (API 400 naming the block) and show the problem inline in the inspector, in the existing save-check style, for: Min or Max not a whole number, Min greater than Max, and more points than the renderer shows.
- This is a builder save rule. Contract §6 lists what the builder rejects at save, so CP0 drafts the line to add; the contract change is applied in both repos separately, before CP1 commits.

**4. Title and Label blocks show two text fields.**
Respondents see Content; Label shows only when Content is empty. The inspector shows both, so authors edit the wrong one.
- CP0 proposes one of: show a single text field that writes `content` (and keeps `label` usable as the block's name on the canvas), or keep both with labels and help text that say which one respondents see.
- No schema change.

**5. Display blocks are called "Question".**
The inspector heading reads "Question" for Heading, Text, Divider, Title, Label and Hidden field, and their logic panel says "Show this question only when…". Use wording that fits a block that isn't a question; CP0 proposes the exact text. Questions keep "Question".

**6. Number has no Minimum or Maximum.**
The renderer validates `min` and `max` on Number (`Must be at least N.`), but authors can't set them.
- Add optional Minimum and Maximum to the Number inspector, written to `min` and `max`.
- Refuse at save when Minimum is greater than Maximum, as in fix 3.
- CP0: confirm whether decimals are allowed, the renderer's exact messages, and whether `min`/`max` on Number need a contract line.

**7. A new Matrix starts its rows as "Option 1–3".**
Grid starts its rows as "Row 1–3"; Matrix reuses the options placeholder. Start Matrix rows as "Row 1", "Row 2", "Row 3" (codes still empty until a label is edited, per contract §13.3). Columns keep their current placeholders.

**8. "Split into pages" names both pages "Untitled page".**
The canvas numbers them Page 1 and Page 2, but their titles are identical, so the progress caption, the review page and the condition-source picker can't tell them apart.
- New pages get distinct default titles. CP0 proposes the wording (for example "Page 1", "Page 2", or the next free number when adding a page).
- The contract's "Untitled page" default (§2.5) changes with it: CP0 drafts the line; the contract change is applied in both repos before CP1 commits.

**9. Form settings are hard to find.**
Form settings (Show progress, progress style, Review page before submit, and the rest) appear only when the author selects the form's title or description on the canvas; clicking empty space does nothing.
- CP0 reports every way Form settings can be reached today and proposes a visible way in (for example a "Form settings" control in the editor's toolbar, and/or selecting the form when empty canvas space is clicked).
- Keyboard users must be able to reach it; it gets an accessible name.

**Out of scope:** Multi-select versus Checkboxes. That is a product decision still open; don't change either.

## Docs follow the fixes

In the same checkpoint as each fix, update the docs pages that describe that behavior (Hidden field is undocumented; Respondent's country, Linear scale, the layout blocks page, Number, Matrix, and Pages, progress and review). Remove the Warning and Troubleshooting entries that describe problems these fixes remove. Same accuracy rules as the docs briefs: from the code, renderer messages quoted exactly.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing unit test, API test, web spec and e2e suite keeps passing; add tests for every new save rule (API and editor) and for the menu changes.
- `verify-a11y` and the contrast gate pass, light and dark.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- For each fix: the files involved, the current behavior with its source, and the proposed change.
- Fix 3 and 6: the renderer's exact behavior and messages, and the contract lines to add.
- Fix 4 and 5: the proposed inspector layout and wording.
- Fix 8: the proposed default page titles and the contract line.
- Fix 9: every current way into Form settings and the proposed visible way in.
- Any saved form in the local database that would fail the new save rules, and what an author sees when opening it.

**CP1 — Fixes 1, 2, 5, 7 and 8** (menu, canvas, wording and default labels; no save rules). Docs pages updated.

**CP2 — Fixes 3 and 6** (save rules, inspector inline errors, Number settings). Docs pages updated.

**CP3 — Fixes 4 and 9, and checks.** Title and Label inspector; the visible way into Form settings; full e2e, `verify-a11y`, contrast gate; screenshots of each changed inspector and canvas state, light and dark.
