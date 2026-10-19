# Builder brief — restyle 2: components and list screens

The second of four restyle briefs. Web app only. Restyle 1 (`8986ff8`, `b486d36`, `f93db71`) put the ZoBlocks palette, type, light/dark, logo, shell and auth frame in place. This brief ports the ZoBlocks console's components and applies them to the list screens and their dialogs. The editor is brief 3.

**First:**
- commit Dhawal's uncommitted `docs/BUILDER-CLEANUP-PLAN.md` on its own;
- save this brief as `docs/briefs/BUILDER-BRIEF-RESTYLE-2-COMPONENTS.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## The reference

ZoBlocks at `9aaefe0`, which is already cloned at `D:\ZoworkProjects\zoblocks`, in `apps/app/src/components/ui/`:
- `control.ts`
- `Button.tsx`
- `Field.tsx`
- `Select.tsx`, `Textarea.tsx`, `Checkbox.tsx`
- `StatusChip.tsx`
- `Callout.tsx`
- `EmptyState.tsx`
- `Panel.tsx`
- `Skeleton.tsx`
- `Toast.tsx`
- `ConfirmSubmit.tsx`
- `DataTable.tsx`, `TableTools.tsx`
- `CopyButton.tsx`, `DownloadButton.tsx`

Read the comments: each component states the rule it exists to enforce. Port the behaviour and the look, adapted to React 18 and this app's client-side data fetching (ZoBlocks uses server actions; the builder calls its API). Each ported file names its ZoBlocks source and commit in a header comment.

## Scope

**Components (in `apps/web/src/components/ui/`, or extend `packages/ui` if that's cleaner; propose in CP0)**
- **`controlClasses`, and `Input`, `Select`, `Textarea`, `Checkbox` built on it:** one focus treatment and one invalid state.
- **`Button` and `buttonClasses`:**
  - variants primary, secondary, ghost, danger;
  - sizes sm, md, icon;
  - a `reason` prop: a blocked action stays focusable (`aria-disabled`) and shows why;
  - `buttonClasses` lets links look like buttons and stay links.
  - Existing `.btn*` uses migrate on the screens in this brief. The `.btn*` classes stay in the preset until brief 3 moves the editor off them.
- **`Field`:**
  - label, hint and error bound with `aria-describedby`, plus `aria-invalid`;
  - the ZoBlocks rule of marking *optional* fields, not required ones.
- **`StatusChip`, `Callout`, `EmptyState`.**
- **`Skeleton`,** using the `shimmer` class, replacing `animate-pulse`.
- **`Toast` and `ToastProvider`,** mounted in the app shell and the auth layout.
- **Confirm:** a confirm pattern on the existing `Dialog`, with the danger variant. No filled red buttons.
- **Restyled to match: `Dialog`, `MenuButton` and the card menus.**
- **`Switch`: fix the off state,** which is 1.59:1 today against the 3:1 that WCAG 1.4.11 requires for a component boundary. Measure the result in both themes.

**Screens**
- **My forms: stays a card grid** (Dhawal's decision). Restyle the cards:
  - the ZoBlocks surface radius and rule border;
  - the icon tile in `accent-wash`;
  - a visible keyboard focus ring on the card, which today is an absolutely positioned link;
  - a hover that uses ZoBlocks' easing. The lift may stay, because the whole card *is* a link.

  Also:
  - search and sort use `controlClasses`;
  - loading uses `Skeleton`;
  - the API error uses `Callout`;
  - the two empty states (no forms, no match) use `EmptyState`;
  - delete uses the confirm pattern;
  - Duplicate, Download and Delete report their outcome with a toast. Today Duplicate and Download swallow errors (`/* ignore */`).
- **Templates:**
  - the same treatment;
  - fix the selected tab in dark mode (a pale fill with dark text);
  - check that its tabs have the right semantics (`tablist`/`tab`/`tabpanel` if they switch panels) and report what they are today.
- **Team:**
  - **proposed: a `DataTable`,** like ZoBlocks' Members screen, with columns name, email, role and actions;
  - invites the same way;
  - role changes and removal through the new controls and the confirm pattern.
- **Versions page:** the same components, where it uses any of them.
- **Dialogs used from these screens:** new form, save as template, option import, template picker and preview. Use the new controls and `Field`.

**Out of scope:** the editor (brief 3), and the visual and accessibility sweep (brief 4).

## Rules

- Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Keep every e2e selector working. Report any that must change, with the reason, rather than silently rewriting a test.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- **Components:** where the components will live, and for each one, what you'll port and what you'll adapt (server actions → client calls, React 19 → 18).
- **Each screen:** its current controls, states (loading, empty, error, success) and actions, and what each becomes.
- **Team:** the current layout and the proposed table, with its columns.
- **Templates:** the tabs' current semantics.
- **Toasts:** every place on these screens where an outcome is silent today.
- **The Switch:** the proposed off-state colours, with measured ratios in both themes.
- **e2e:** every selector these changes affect, and what you propose.

**CP1 — Components.**
- Port and adapt the components, with unit tests for the behaviour each one exists for:
  - Button's `reason`;
  - Field's bindings;
  - the confirm's focus and Escape handling;
  - toast announcements.
- Restyle `Dialog`, `MenuButton` and `Switch`.

**CP2 — Screens.**
- My forms, Templates, Team, Versions, and the dialogs.
- In a browser, check each screen in light and dark, at desktop and phone widths, using keyboard only: every action is reachable, focus is visible, and every outcome is announced.
- Run unit tests, the full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set (restore the external app's form files afterwards), and the web Playwright spec as CI runs it.
- Take screenshots of every changed screen in both themes, in `e2e/output/restyle-2/`.
