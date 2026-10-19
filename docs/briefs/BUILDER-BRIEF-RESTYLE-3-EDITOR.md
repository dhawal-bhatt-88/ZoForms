# Builder brief — restyle 3: the editor

The third of four restyle briefs. Web app only. Restyle 1 (`b486d36`, `f93db71`) put the ZoBlocks tokens, type, light/dark, shell and auth frame in place. Restyle 2 (`c1ddf86`, `19cefe5`) ported the component kit in `apps/web/src/components/ui/` and moved the list screens onto it. This brief moves the form and template editor onto the same kit and look. Brief 4 is the side-by-side visual and accessibility sweep.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-RESTYLE-3-EDITOR.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## Why

The editor is where authors spend their time, and today it only looks related to the family through the token remap. It still has:
- its own buttons (`.btn*`), field classes (`fieldCls`, `logicField`, `field` in `option-list-editor.tsx`) and hand-built section headings (`text-[11px] font-bold uppercase tracking-wider`);
- three hand-built dialogs (delete group, delete page, split into pages) and three native `confirm()` calls (leaving with unsaved changes, Cancel, changing a grid column's type);
- a notice banner whose "info" tone uses warning colours;
- save state as loose text with a coloured dot;
- no theme toggle, because the editor route sits outside `AppShell`.

These references come from a reading of the editor before restyle 1, so line numbers and some colours will have moved. CP0 confirms what's there now.

## The reference

- **The kit:** `apps/web/src/components/ui/` (restyle 2): `Button`/`buttonClasses` (with `reason` and `pending`), `controlClasses`, `Input`, `Select`, `Textarea`, `Checkbox`, `Field`, `StatusChip`, `Callout`, `EmptyState`, `Skeleton`, `Toast`, `ConfirmDialog`, and the restyled `Dialog`, `MenuButton`, `Switch`.
- **ZoBlocks at `9aaefe0`** (`D:\ZoworkProjects\zoblocks`), for patterns the kit doesn't cover yet: the `.eyebrow` heading, `Panel`, and how the console lays out a dense settings column.
- **`docs/ZOBLOCKS-UPSTREAM-NOTES.md`:** don't reintroduce any defect listed there.

## Scope

Files: `components/form-editor/editor.tsx`, `canvas-preview.tsx` and `settings-pane.tsx`; `option-list-editor.tsx`, `grid-columns-editor.tsx` and `scores-panel.tsx`; and anything else the editor renders that CP0 finds.

**0. Segmented control (upstream note 6), first**

The selected segment's fill misses 3:1 against its track in both themes: 1.23:1 dark and 1.01:1 light for the Templates tabs, and 1.05:1 for the theme toggle. Restyle 2's accent wash didn't fix it. This brief adds a third segmented control (heading level), so fix it once, in the kit, before anything uses it again:
- add `segmentClasses` to `components/ui/` (a class helper like `buttonClasses`, not a component, because the uses have different semantics: tabs, toggle buttons, a radio group);
- the selected segment gets a 1px `border-brand-deep` (measured 4.96:1 light and 12.46:1 dark against the track);
- apply it to the Templates tabs and the ThemeToggle now, and to the heading level in item 4;
- update note 6 in `docs/ZOBLOCKS-UPSTREAM-NOTES.md` with the fix used, and remove it from brief 4's list.

**1. Top bar**
- **Buttons:** Back, Download, the form-actions menu, Cancel and Save on the kit's `Button`.
  - Save and Cancel when there's nothing to save: blocked with a `reason` ("No changes to save"), not `disabled`.
  - Download: `pending` while it runs.
- **Save state as a `StatusChip`,** always with a word: Saving, Unsaved changes, Saved. Announce a save's outcome once. Typing must not announce anything.
- **ThemeToggle** in the top bar, the same component and cookie as the account bar.
- **Template mode:** the "Group"/"Form" pill becomes a `StatusChip`.
- **Viewers:** report what a viewer sees in the *form* editor today. Restyle 2 labelled the card menu item "Open" for viewers on the understanding that the editor hides its write controls. If Save and Cancel are still offered, block them with a reason ("Viewers can't save changes") instead.

**2. Messages**
- **The notice banner moves onto `Callout`,** with tones by meaning:
  - a refused edit (with its "jump to" links) is a warning: nothing is broken, the edit just didn't happen;
  - a failed save or download is critical;
  - a neutral note (system template read-only, drafts mode switched for the author) is info.
- **Confirmations of the author's own action** ("Inserted a copy of…", "Saved … to your organisation's templates") become toasts. Anything with jump links, or that must stay on screen, stays a `Callout`.
- **Loading** becomes a `Skeleton` of the top bar, canvas and pane, in place of the full-screen spinner. **A load error** becomes a critical `Callout` with a link back to My forms or Templates.

**3. Dialogs**
- **Delete group, delete page and split into pages** move onto `Dialog` (focus trap, Escape from anywhere, focus returned to the opener).
  - The two-choice delete dialogs keep their choice cards. "… and its questions" is the danger choice: danger text and border, no filled red.
  - Their condition notes (today a hard-coded amber wash) become warning `Callout`s.
- **Replace the three native `confirm()` calls with `ConfirmDialog`:** leaving with unsaved changes (Back link), Cancel ("Discard unsaved changes?"), and a grid column's type change.
  - The `beforeunload` warning stays native; browsers allow nothing else there.

**4. Settings pane**
- **Every field on `Field`:** label, hint and error bound with `aria-describedby`, plus `aria-invalid`.
  - **Fix, while moving:** "Help text", "Content", "Min" and "Max" have `<label>`s with no `htmlFor`, so their fields have no accessible name. List any others CP0 finds.
  - The ZoBlocks rule of marking *optional* fields applies here too. "Help text" is the only optional one today, and it says "Optional" in its placeholder; make that the `Field` marker.
- **Section headings** ("Position", "Logic", the pane heading, the option list's Code/Label header) use the ZoBlocks `.eyebrow`.
- **Mono** (JetBrains Mono) for values the author types as identifiers: option, row and column codes; question names; logic text; score formulas; media URLs. Labels and help text stay sans.
- **Heading level (H1/H2/H3)** uses `segmentClasses` (item 0), as a radio group. Today the selected level is shown by colour alone, with no `aria-pressed` or radio semantics.
- **Navigation and Save progress:**
  - checkboxes use the kit's `Checkbox` (its first use);
  - radios keep native inputs with the token accent colour. Today they're hard-coded purple (`accent-[#6D5EFA]`), unless restyle 1 already changed that.
- **Position:**
  - Move up/down on `Button` (sm, secondary), blocked with a reason at the ends;
  - "Move to…" on `Select`;
  - **fix the wrapping:** no button label may wrap at the pane's minimum width.
- **Delete page… and Delete group…:** `Button` danger variant.
- **Option, grid-column and score editors:** move onto `controlClasses`. The resizable-pane behaviour (the score field sharing the label's line while there's room) must still work at every width from the pane's minimum to its maximum.
- **The empty state** at the bottom of Form settings ("Select a question to edit it…") uses `EmptyState`'s look.

**5. Canvas**
- **Page box, group box and question card:** ZoBlocks surface radius, rule borders and accent selection.
  - Remove the remaining hard-coded colours (`bg-white`, `#FCECEC`, `#e2c14d`, `bg-black/30`), if restyle 1 left any.
- **Group boxes in dark mode** (noted after restyle 1): nested levels are hard to tell apart. Measure the fills and borders of adjacent levels in both themes. Propose a treatment where nesting is clear without relying on the fill difference alone. Indentation already helps.
- **Chips:**
  - "Conditional", "Level N" and the repeat badge become `StatusChip`s.
  - **The required asterisk:** keep the asterisk, because it previews what respondents see. But make it graphite, not red (red is only for critical), and give it a screen-reader text of "required". Today it's read as "star".
- **Card controls** (drag handle, move, delete): kit icon buttons with the ZoBlocks hover easing. Delete uses danger-ghost.
- **Keyboard selection:** as far as the pre-restyle code shows, a question card is a `div` with `onClick` and no `tabIndex`, so a keyboard user can't select a block to open its settings; only a page's title field selects on focus. Confirm this in CP0. If it's true, propose a fix: the card's focus ring follows the My forms card pattern from restyle 2.
- **The block menu:**
  - restyle it as a ZoBlocks popover, with eyebrow group headings;
  - report its keyboard behaviour today. As far as the code shows, the arrow keys do nothing and Enter picks the first match. Propose, but don't build until approved.
- **The insert row, "Add page", the empty canvas and the drag ghost:** the same treatment.
- **`StaticCanvas`** (the template preview) shares `GroupBox` and the page header, so check it stays consistent with the canvas.

**6. Leftovers**
- Once nothing uses them, remove `.btn*` and `.input` from `packages/ui/preset-zoblocks.ts`'s plugin, and anything else of the old `framePlugin` the web app no longer uses. The admin app's preset is unchanged.

**Out of scope:**
- the editor on phone widths (report what happens at 768px; don't fix it);
- arrow-key navigation in the block menu, unless approved at CP0;
- any change to editing behaviour or save rules;
- the visual and accessibility sweep (brief 4).

## Rules

- Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- **Keep every e2e selector working.** The editor suites are the largest. Report any selector that must change, with the reason, rather than silently rewriting a test. This includes tests that accept native `confirm()` dialogs, which will stop firing.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- **Inventory,** file by file:
  - every button, field, heading, chip, dialog, `confirm()` and hard-coded colour in the editor files;
  - what each becomes.
- **The notice banner:** every `setNotice` call, grouped by the tone and the destination (warning, critical or info `Callout`, or toast) you propose.
- **Labels:** every field without a linked label.
- **Viewers:** what a viewer sees in the form editor.
- **Keyboard:** how a keyboard user selects a block today, and how the block menu behaves. Propose fixes.
- **Group boxes:** the measured fills and borders of nested levels in both themes, and the proposed treatment.
- **Pane width:** the pane's minimum and maximum, and what wraps at the minimum today.
- **e2e:** every selector, and every native-dialog handler, these changes affect, and what you propose.

**CP1 — Segments, chrome, messages, dialogs and pane.**
- Items 0–4.
- Measure the selected segment against its track, in both themes, on the Templates tabs, the ThemeToggle and the heading level.
- Unit tests for:
  - the save chip's announcements (a save's outcome announced once, typing silent);
  - the leave-with-unsaved-changes confirm (Cancel stays, confirm navigates);
  - the newly linked fields.

**CP2 — Canvas and leftovers.**
- Items 5–6.
- **In a browser, light and dark, at 1440px and 1024px, and at the pane's minimum and maximum widths:**
  - a form with pages, nested groups three deep, a repeating group, a scored group, a grid, a matrix and conditions;
  - a group template;
  - a system template opened read-only;
  - and the form editor as a viewer.
- **Keyboard only:**
  - select a block, edit it, move it, delete it, and add one through the block menu;
  - focus is visible at every stop, dialogs trap and return focus, and every outcome is announced.
- **Run:**
  - unit tests;
  - the full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set (restore the external app's form files afterwards);
  - the web Playwright spec as CI runs it.
- Take screenshots of each case above in both themes, in `e2e/output/restyle-3/`.
