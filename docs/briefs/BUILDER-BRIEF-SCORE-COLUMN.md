# Builder brief — option Score as a third column

Builder repo, branch `formbuiler-service-dhawal`, web app only (`apps/web`). No API, schema or contract change.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-SCORE-COLUMN.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## The problem

In the option editor, each option row shows `CODE` and `LABEL` as columns with headers, but the score is an inline "Score" text plus an input placed after the label. It looks inconsistent with the other two fields.

## The change

- **Score becomes a third column**, with a `SCORE` header styled exactly like the `CODE` and `LABEL` headers. Each row's score input sits in that column. The inline "Score" text on every row is removed.
- **When the column appears:** unchanged. It shows only for questions within reach of a group that has a score (GROUPS-AND-PAGES-CONTRACT §17.9). When the question isn't within reach, there is no `SCORE` header and no score inputs. Scores stored on options of a question that leaves reach are kept, not shown (unchanged).
- **Where:** everywhere the option editor shows scores today: options of `choice`, `dropdown`, `checkbox` and `multiselect`, and the `matrix` **columns** editor. Not matrix rows, not grid columns or their options (they are not scored).
- **Narrow settings pane:** the score column behaves exactly like the code and label columns do at narrow widths, using the same mechanism. Whatever code and label do today as the pane narrows (shrink, wrap, stack or anything else), score does the same, in the same way. This replaces the 15 Oct behaviour where Score sat on the label's line when there was room and wrapped below it otherwise.
- **The remove (×) button** keeps its place at the end of the row.
- **Nothing else changes:** what a score value may be, validation and its messages, when scores are saved, the Replace-all import rule, and the guards in §17.9.

## Accessibility

- Each score input keeps an accessible name. Removing the inline "Score" text must not leave it unnamed. Name it the same way the code and label inputs are named today (CP0 reports how), e.g. "Score, Option 1" if that is the existing pattern.
- The `SCORE` header is not focusable and is not announced twice.
- Tab order follows the visual order in every row: code, label, score, remove.
- The contrast gate and the axe suite (`verify-a11y.js`) must keep passing.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing unit test, web spec and e2e suite must keep passing. Update a test only where it locates the score input by the removed inline text, and say which ones.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- The component(s) that render the option editor and the matrix columns editor, and how the `CODE` and `LABEL` headers and columns are built (grid, flex, table or other).
- **Narrow behaviour today:** exactly what code and label do as the pane narrows from its widest to its 280px minimum, with the CSS that does it. Screenshots at 280px, about 400px and a wide pane, with a question in reach of a scored group.
- How the 15 Oct score layout (same line or wrapped below) is implemented, so it can be removed cleanly.
- How the code, label and score inputs are named for assistive technology today.
- Every test (unit, web spec, e2e) that locates the score field or depends on its position.
- The plan, and a before/after markup snippet for one row.

**CP1 — The column.**
- Score as a third column in both editors, header included, matching code and label at every width; the old inline layout removed.
- Unit tests and web spec pass.

**CP2 — Checks.**
- Full e2e, contrast gate and axe suite pass.
- Screenshots at 280px, about 400px and a wide pane, for a choice question and a matrix's columns, both in reach of a scored group; plus one question not in reach, showing no score column.
- Keyboard check: tab order code → label → score → remove in every row.
