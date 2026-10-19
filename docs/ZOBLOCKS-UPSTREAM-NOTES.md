# ZoBlocks upstream notes

Defects found in the ZoBlocks console (`github.com/zoworkhq/zoblocks`, `apps/app`) while porting its components into Zowork Forms. All line numbers are at commit `9aaefe0`. Nothing here has been filed upstream.

Each port in this repo carries the fix and names its ZoBlocks source in a header comment.

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
