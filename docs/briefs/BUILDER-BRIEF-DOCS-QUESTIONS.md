# Builder brief — docs for every question type, display block and structure

Builder repo, branch `formbuiler-service-dhawal`, web app only (`apps/web`). Builds on the docs site from BUILDER-BRIEF-DOCS.md (commits `ac32ff3` to `0edd3df`).

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-DOCS-QUESTIONS.md` and commit it on its own.

**Stop after CP0 and wait for approval before writing any page.** Then stop after **each** checkpoint for review.

## Audience: form authors only

These pages are for the people who build forms in the builder: what each question does, when to use it, how to set it up, and what respondents see.

**Developer content is out of scope.** A separate renderer brief, aimed at developers, will cover it. On the pages in this brief:
- **Leave out the written "For developers" section** (value shapes, `prepareSubmission` output, condition operators in code terms, validator examples). Make that section optional in template A, as "Related examples" already is, so the developer docs can add it later with no template change.
- **Keep the live example's four generated tabs** (Preview · Schema · Payload · Server output). They cost no writing and keep every question page consistent with Dropdown.
- **Don't change the existing Dropdown page or `FormRenderer` page.** The developer brief will decide what happens to their developer sections.
- **Don't add pages under "Integrate forms".**

## Scope

1. **Every answerable question type the builder offers** that has no page yet: one template A page each.
2. **Display blocks:** one shared page with a section per block, except image, video and audio, which have source rules and get a short page each.
3. **Structure:** groups, repeating groups, and pages with the wizard options (progress and review page).

Out of scope here: scoring, templates, AND/OR logic, and the styling page. They are later briefs.

## Accuracy rules (unchanged from the docs brief)

- Every fact comes from the contracts (`docs/GROUPS-AND-PAGES-CONTRACT.md`, `docs/DRAFTS-CONTRACT.md`), the renderer's README and source, or the builder's code. Nothing from memory, including this brief: where this brief and the code disagree, **follow the code** and say so in the checkpoint report.
- **Use the builder's own names** for every type and setting, exactly as the insert menu and inspector show them.
- Error messages are quoted from the renderer.
- Each live example is a real form, generated through the example script, which deletes its throwaway account afterwards.
- Anything you can't source: `[TODO: …]` in the page, listed in the checkpoint report.

## Example content

- Realistic behavioral health intake and admin questions.
- **No clinical risk logic as an example:** no screening or safety question shown or skipped on a score or cut-off. Use neutral thresholds (age, number of visits, dates).
- No copyrighted instruments. Freely reproducible ones (PHQ-2, PHQ-9, GAD-7) only if the page needs one, credited.
- A dropdown-length list belongs only on list-type questions; examples must follow each page's own "when to use" advice.
- List every example's question, options and settings in the checkpoint report for review.

## Checkpoints

**CP0 — Inventory. Report only. Stop and wait.**

A table from the code, one row per block type the builder can insert:

| Column | What |
|---|---|
| Type | schema `type` |
| Builder name | as in the insert menu |
| Kind | answerable / display / structure |
| Settings | inspector fields, mapped to schema properties, with defaults |
| Built-in checks | each check and its exact message |
| Can drive conditions? | and which comparisons |
| Scorable? | |
| Proposed page | own page, section of the display-blocks page, or structure page |

Also report:
- which types the builder **can't** insert any more but the renderer still renders, and whether they should be documented at all;
- what `hidden` actually does today (how a value gets into it, whether it is validated or submitted), since that decides whether authors should be told to use it;
- the proposed batch for each page, and its example form.

**CP1 — Simple inputs.** Proposed: short answer, long answer, number, email, phone, link, date, time (CP0 confirms names and list).

**CP2 — Choice types.** Multiple choice, checkboxes, multi-select, respondent's country.

**CP3 — Scales and ranking.** Linear scale, rating, ranking.

**CP4 — Tables.** Matrix and grid. Grid's narrow-width card layout and per-column required rules need their own sections.

**CP5 — Display blocks.** The shared page (heading, title, label, text, divider, hidden if CP0 says to document it) and the image, video and audio pages: accepted sources, what renders nothing, captions and transcripts for authors.

**CP6 — Structure.** Groups, repeating groups (minimum and maximum, the singular name, what respondents see when adding and removing), pages and wizard (progress caption or bar, review page). Use template B (how-to) where it reads better than template A; say which in CP0.

**At every checkpoint**
- Template tests, unit tests, web specs and the contrast gate pass.
- `verify-a11y` covers each new page in light and dark, including the example's error state.
- No sideways scroll at 320px.
- Screenshots of each new page at 375 and 1440 wide, light and dark.
- Commit once checks pass. Don't push.
- The report lists: pages added, every `[TODO]`, every place the code disagreed with this brief, and the example content for review.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- No change to signed-in pages, the home page, or the shared docs framework beyond making "For developers" optional.
