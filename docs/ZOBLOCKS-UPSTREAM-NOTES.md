# ZoBlocks upstream notes

Defects found in the ZoBlocks console (`github.com/zoworkhq/zoblocks`, `apps/app`) while porting its components into Zowork Forms. All line numbers are at commit `9aaefe0`. Nothing here has been filed upstream.

Each port in this repo names its ZoBlocks source in a header comment. Notes 1–7 are fixed in the ports. Note 8 needs no fix here, because the ports' shared classes are layered, but it changes what the console renders. Local additions, after the notes, are not defects: they are tokens the builder needs that ZoBlocks doesn't have. Contrast ratios are WCAG 2.2 relative-luminance ratios, measured from the hex values in `apps/app/src/app/globals.css`.

## 1. Callout's info tone draws no accent edge

- **File:** `apps/app/src/components/ui/Callout.tsx`, line 49.
- **What's wrong:** the info tone uses `border-l-zoblocks`, but no `--color-zoblocks` is defined: not in `apps/app/src/app/globals.css` (its `@theme inline` block) and not anywhere else in the repo. Tailwind 4 generates no class for an undefined colour, so the 3px left border takes the plain `border-rule` colour. Info callouts lose the accent edge that the fail, warn and pass tones have.
- **Fix used here:** `border-l-brand` (`apps/web/src/components/ui/callout.tsx`). Upstream, `border-l-brand` would match the other tones' pattern, since `--color-brand` is defined at globals.css line 42.

## 2. Button's reason id collides between buttons

- **File:** `apps/app/src/components/ui/Button.tsx`, line 102.
- **What's wrong:** the reason's id is `` `${props.id ?? "action"}-reason` ``. Two blocked buttons without an `id` both get `action-reason`, so the page has duplicate ids. Each button's `aria-describedby` then resolves to the first reason on the page, and a screen reader reads the wrong sentence for every button after the first.
- **Fix used here:** the id comes from React's `useId()` (`apps/web/src/components/ui/button.tsx`). The test "gives every blocked button its own reason" in `button.test.tsx` fails with the upstream scheme.

## 3. The account menu doesn't return focus after Escape

- **File:** `apps/app/src/components/AccountMenu.tsx`, lines 61 and 75.
- **What's wrong:** Escape only calls `setOpen(false)` (line 61). Focus is meant to return in the effect's cleanup (line 75), but only if focus is still inside the wrapper. By the time the cleanup runs, React has already removed the menu from the DOM, and the focused item with it, so `document.activeElement` is `<body>`. The check fails and focus is left on the body. A keyboard user who presses Escape has to Tab from the top of the page.
- **Fix used here:** the Escape handler moves focus back to the trigger itself before closing (`apps/web/src/components/account-menu.tsx`). Focus is still returned only when the menu closes by keyboard; a click elsewhere leaves it where the click put it.

## 4. Checkbox's unchecked ring is under 3:1

- **File:** `apps/app/src/components/ui/Checkbox.tsx`, line 71.
- **What's wrong:** the unchecked box is drawn only by its ring, `border-rule-strong`. That is 1.50:1 against `paper` in light mode, and 1.53:1 against the `.surface` colour in dark mode (1.63:1 against dark `paper`). WCAG 1.4.11 (non-text contrast) asks 3:1 for the visual information that identifies a control, so an unchecked checkbox is hard to find on either ground.
- **Fix used here:** the ring is `border-graphite-soft` (`apps/web/src/components/ui/checkbox.tsx`): 5.47:1 on white `surface` in light mode and 5.84:1 on `surface` in dark. The builder's Switch had the same fault (`rule-strong`, 1.59:1) and now uses a `graphite-soft` outline too.

## 5. Field's aria-describedby points at a hidden hint

- **File:** `apps/app/src/components/ui/Field.tsx`, lines 56, 58 and 93.
- **What's wrong:** the hint's id is put into the control's `aria-describedby` whenever a hint is given (lines 56 and 58), but the hint is only rendered when there is no error (`hint && !error`, line 93). With an error showing, `aria-describedby` names an id that isn't in the page. Screen readers skip the missing id, so the hint is lost exactly when the reader is trying to fix the field.
- **Fix used here:** the hint stays rendered beside the error, so every id in `aria-describedby` resolves (`apps/web/src/components/ui/field.tsx`). The test "an error describes the control and marks it invalid" in `field.test.tsx` checks that both ids resolve, to the hint and to the error.

## 6. The segmented toggle's selected state is under 3:1 in dark mode

- **File:** `apps/app/src/components/ThemeToggle.tsx`, lines 55 and 68.
- **What's wrong:** the selected segment is marked by a `paper` fill on the `paper-sunk` track (line 68 on line 55's track), plus a change of icon colour from `graphite-soft` to `ink`. In dark mode the fill is 1.05:1 against the track (`#080b10` on `#0d1219`) and the icon colour change is 2.81:1 (`#edf2f7` against `#8592a1`); neither reaches the 3:1 WCAG 1.4.11 asks of a state indicator, so which theme is chosen is hard to see. In light mode the fill is 1.06:1, but the icon colour change is 3.50:1, so the state is perceivable there. `aria-checked` gives the state to assistive technology in both themes.
- **Fix used here:** the selected segment gets a 1px `border-brand-deep`: 4.96:1 against the `paper-sunk` track in light mode and 12.46:1 in dark, so the state clears 3:1 in both themes. Every segment carries a border, transparent until selected, so choosing one moves nothing. It lives in one class helper, `segmentClasses` (`apps/web/src/components/ui/segment.ts`), not a component, because the builder's segmented controls have different semantics: the ThemeToggle and a heading's level are radio groups, the Templates screen's are tabs. All three use it. Before this, the builder's Templates tabs marked the selected tab with `accent-wash` and `brand-deep` text, which was still under 3:1 (1.23:1 against the track in dark mode, 1.01:1 in light). Upstream, the same border would apply to every segmented control built this way.

## 7. Field borders are under 3:1, and the console's palette is outside the contrast gate

- **Files:** `apps/app/src/components/ui/control.ts`, line 31 (`border-rule-strong`), with the colour at `apps/app/src/app/globals.css` lines 89 (light, `#c3d0cc`) and 148 (dark, `#2c3744`).
- **What's wrong:** a text field, select or textarea is drawn by its border alone, and the border is `rule-strong`: 1.50:1 against `paper` in light mode, and 1.53:1 against the `.surface` colour in dark mode (1.63:1 against dark `paper`). WCAG 1.4.11 asks 3:1 for the visual information needed to identify a control, so an empty field is hard to find, especially in dark mode. The same colour draws the Checkbox's ring (note 4) and the colour fields' swatches and inputs (`ColorField.tsx`, `ColorPicker.tsx`).
- **Why nothing caught it:** ZoBlocks' contrast gate (`packages/tokens/src/validate/`, run by `pnpm gen --strict` in `verify.yml`) checks the component library's tokens, not the console's own palette. The library already has the right answer: `--zb-field-border` is `border-strong`, which the gate holds to 3:1 (4.76:1 in light, 3.26:1 in dark, `packages/tokens/src/contrast.json`). The console's `--site-*` colours in `globals.css` are checked only by the axe sweep (`e2e/app-a11y.spec.ts`), and axe measures text contrast, not the 3:1 for controls. So any console colour that draws a control, rather than text, is checked by nothing.
- **Fix used here:** a field-border colour of its own, `--zb-field-border` (see "Local additions"), used by `controlClasses` (`apps/web/src/components/ui/control.ts`) and by the editor's drawings of fields, radios and checkboxes. `rule-strong` is unchanged and still draws a card's hover, group and page boxes and dashed empty boxes, where nothing is a control. The builder's contrast gate (`apps/web/scripts/contrast.mjs`) reads the ported palette and holds every control boundary to 3:1, which is how this was found. Upstream, two changes would close it: a field-border colour in the console's palette that clears 3:1 on `paper` and `.surface` in both themes, used by `control.ts` and the colour fields; and the library gate's pair list run over `apps/app/src/app/globals.css` too, so the console's colours are held to the bar the library's are.

## 8. Unlayered `.eyebrow` and `.surface` silently override utilities

- **Files:** `apps/app/src/app/globals.css`, `.eyebrow` (line 240) and `.surface` (line 284), both outside any `@layer`; the call sites below.
- **What's wrong:** Tailwind 4 puts every utility in `@layer utilities`, and unlayered CSS beats layered CSS whatever the specificity. So a utility on an element that also has `.eyebrow` or `.surface` loses to it whenever the two set the same property, and the class it was written for has no effect:
  - **Eyebrow sizes:** 18 eyebrows ask for a smaller size (16 `text-[0.5625rem]`, 9px, and 2 `text-[0.625rem]`, 10px) and all render at `.eyebrow`'s 0.6875rem (11px). They are in `Rail.tsx`, `AccountMenu.tsx`, `Failure.tsx`, `ui/ColorPicker.tsx`, `ui/Toolbar.tsx`, `(auth)/layout.tsx`, `(auth)/SocialSignIn.tsx`, `pending/page.tsx` and eight `(app)` screens (account, market and market item, not-found, playground, theme screens, token editor, transfer).
  - **The account menu's shadow:** `AccountMenu.tsx` line 117 gives the open menu `shadow-[0_18px_44px_-18px_rgb(2_20_17/0.28)]`, but `.surface`'s `box-shadow: 0 1px 2px -1px` wins, so the menu floats over the page with almost no shadow.
- **Measured** in the running console at `9aaefe0` (restyle 4): the rail's eyebrows compute to 11px, and the open account menu's shadow to `rgba(2, 20, 17, 0.04) 0px 1px 2px -1px`.
- **Here:** the ports put the shared classes in `@layer components` (`apps/web/src/app/globals.css` and `packages/ui/frame-components.ts`), so a utility beside them wins, as it does in Tailwind 3. To render as the console does, the ports left the eyebrow size utilities out. The account menu keeps its shadow, so the builder's menu shows the shadow the console's source asks for.
- **Upstream:** put `.eyebrow`, `.surface` and the other shared classes in `@layer components`, then decide for each call site whether its utility should apply (the 9px eyebrows are under the 11px floor the eyebrow was set at, so most likely the utilities should go).

## Local additions

Not defects, and nothing to file upstream: tokens the builder defines for itself. Each is marked builder-only where it is defined.

### `--zb-nest`: the editor's nested group boxes

- **Where:** `apps/web/src/app/globals.css` (`:root` and `.dark`), exposed as the colour `nest` in `packages/ui/preset-zoblocks.ts`. Used only by the editor's `GroupBox` (`apps/web/src/components/form-editor/canvas-preview.tsx`), which alternates nested groups between `nest` and `surface`.
- **Why:** nested group boxes need adjacent levels to differ in fill as well as by indentation. The builder used `paper-sunk` against `surface`, which is 1.12:1 in light but 1.02:1 in dark, so in dark mode nested levels were the same colour. No ZoBlocks token sits near 1.12:1 from dark `surface` with a meaning that fits: `panel` (1.06:1) belongs to the instrument panel, and `shimmer` (1.18:1) to the skeleton's sweep.
- **Values:** `#eef3f1` in light (the same as `paper-sunk`, so light mode is unchanged) and `#17202a` in dark.
- **Measured** in the browser against `surface`, restyle 3: 1.121:1 in light and 1.125:1 in dark.

### `--zb-field-border`: a field's border

- **Where:** `apps/web/src/app/globals.css` (`:root` and `.dark`), exposed as the colour `field-border` in `packages/ui/preset-zoblocks.ts`. Used by `controlClasses` (every Input, Select and Textarea) and the editor's drawings of fields, radios and checkboxes (`apps/web/src/components/form-editor/canvas-preview.tsx`).
- **Why:** the console draws fields with `rule-strong`, under 3:1 (note 7). The name follows the ZoBlocks library's own `--zb-field-border`, which its gate holds to 3:1; the console's palette has no such colour.
- **Values:** `#798984` in light and `#636f7e` in dark, on the `rule-strong`–`graphite-soft` line, so a field reads as the same grey-green, only firmer.
- **Measured** by the contrast gate (`apps/web/contrast.json`): 3.67:1 on `surface`, 3.47:1 on `paper` and 3.27:1 on `nest` and `paper-sunk` in light; 3.62:1, 3.85:1, 3.22:1 and 3.67:1 in dark.
