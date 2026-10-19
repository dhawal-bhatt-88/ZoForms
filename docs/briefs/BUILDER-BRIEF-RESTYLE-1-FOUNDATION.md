# Builder brief — restyle 1: ZoBlocks family foundation

The first of four restyle briefs. Builder repo, web app only (`apps/web`, `packages/ui`). The admin app is out of scope.

Save this brief as `docs/briefs/BUILDER-BRIEF-RESTYLE-1-FOUNDATION.md` and commit it on its own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

Zowork Forms stays a separate app with its own sign-in. People will reach it from zoblocks.design, so it must look like a member of the ZoBlocks family.

Today it doesn't:
- **Colour:** purple accent and a near-black primary button. ZoBlocks uses teal for both.
- **Type:** Hanken Grotesk, with no mono face. ZoBlocks uses Instrument Sans, with JetBrains Mono for values.
- **Identity:** a black "Z" tile in the sidebar, and a purple document icon on the auth pages.
- **Dark mode:** none.
- **Structure:** a different shell and a different "eyebrow".
- **Contrast:** two failures. `text-faint` `#9AA1AC` on white is 2.6:1, and red error text on `#FCECEC` is 3.57:1, both under 4.5:1.

## The reference

ZoBlocks' signed-in console, `apps/app` in `github.com/zoworkhq/zoblocks` (public). Clone it **at commit `9aaefe0`** outside the builder repo, and read:
- `apps/app/src/app/globals.css`: the palette (light and dark), type scale, surfaces, focus, scrollbars, autofill, motion. Read its comments; they state the rules, not just the values.
- `apps/app/src/app/layout.tsx`: fonts and the pre-paint theme script.
- `apps/app/src/lib/theme.ts` and `components/ThemeToggle.tsx`: the light/dark choice and its cookie.
- `apps/app/src/components/Rail.tsx`: the rail and the mark.
- `apps/app/src/app/(app)/layout.tsx`: the shell (rail, account bar, main).
- `apps/app/src/components/AccountMenu.tsx`
- `apps/app/src/components/ui/PageHeader.tsx`
- `apps/app/src/app/(auth)/layout.tsx`: the auth pages.

Port the look, not the code wholesale: the builder runs Next 15, React 18 and Tailwind 3; ZoBlocks runs Next 16, React 19 and Tailwind 4. Every file that ports values or patterns carries a header comment naming the ZoBlocks file and commit it came from, so the next sync knows what to compare.

## Decisions already made (Dhawal, 19 Oct 2026)

- **Name:** "Zowork Forms", unchanged.
- **Wordmark,** following the ZoBlocks pattern of mark + name + small mono label: the ZoBlocks mark, "Zowork" in the display face, and "Forms" as the eyebrow label. It reads "Zowork FORMS", the way the console reads "ZoBlocks APP". Page titles and metadata stay "Zowork Forms". **Reusing the ZoBlocks mark** is the strongest family signal; if Dhawal later wants a mark of its own, only the logo component changes.
- **My forms stays a card grid.** It's restyled in brief 2, not turned into a table.
- **Address undecided.** Copy ZoBlocks' theme cookie logic as it is, including the domain rule:
  - if the builder ever runs on a `zoblocks.design` subdomain, the light/dark choice is shared with zoblocks.design automatically;
  - anywhere else it's simply local.

## Scope of this brief

1. **Tokens.**
   - Port the ZoBlocks palette, light and dark, as CSS variables in `globals.css`.
   - Rewire the builder's Tailwind preset so its existing colour names resolve to them. Then every screen re-colours at once, without touching each class:

     | Builder token | ZoBlocks token |
     |---|---|
     | `bg` | `paper` |
     | `surface` | the `.surface` colour (white light, `#0e141b` dark) |
     | `surface-2` / `surface-3` | `paper-sunk` |
     | `ink` | `ink` |
     | `ink-2` | `graphite` |
     | `muted` | `graphite` |
     | `faint` | `graphite-soft` (this fixes the 2.6:1 failure) |
     | `line` | `rule` |
     | `line-2` | `rule-strong` |
     | `primary` | `cta` (a primary button turns teal) |
     | `accent` | `brand-deep` |
     | `accent-2` | `cta-hover` |
     | `accent-weak` | `accent-wash` |
     | `red` | `critical` / `fail` |
     | `amber` | `warn` |
     | `green` | `pass` |

   - Add the ZoBlocks names as well (`paper`, `rule`, `graphite`, `cta`, `fail-wash`, …), so later briefs can use them directly. Add `panel` and `trace` too, though they aren't used yet.
   - **Opacity modifiers.** Tailwind 3 needs a colour defined as channels to support modifiers like `bg-ink/40`. Define the variables as RGB channels and the colours as `rgb(var(--x) / <alpha-value>)`, so every existing `/NN` modifier keeps working.
   - **Hard-coded colours.** Replace each hard-coded hex (`#FCECEC`, `#FBF0D9`, `#F5C2C2`, `#E7F6ED`, `#EAD9AE`, `#e2c14d`), and each `bg-white`/`text-white` that means "surface" or "on accent", with tokens, so dark mode works everywhere. List them all in CP0.
2. **Type.**
   - Instrument Sans (400/500/600/700) and JetBrains Mono (400/500/600) via `next/font`, replacing Hanken Grotesk.
   - The ZoBlocks body size and letter-spacing, and the type-scale classes (`display-sm`, `eyebrow`, `body-sm`, `tabular`).
   - **The builder's `.eyebrow` pill is replaced by the ZoBlocks `.eyebrow`** (mono uppercase label). List every current use in CP0; any that relies on the pill look needs a new name or a different treatment.
3. **Base behaviour from ZoBlocks' `globals.css`:**
   - the `:focus-visible` floor in `@layer base`;
   - thin scrollbars;
   - autofill colours;
   - the reduced-motion rules;
   - the `shimmer` and `rise-in` classes;
   - the `.link` rule (underlined at rest).
4. **Light/dark.**
   - The pre-paint boot script, the cookie and storage logic (same cookie name, `zoblocks-theme`), and a ThemeToggle with Light and Dark.
   - No flash of the wrong theme on load.
5. **Identity.**
   - A `Logo` component with the ZoBlocks mark, "Zowork", and the "Forms" eyebrow.
   - It's used in the rail and on the auth pages.
   - Replace the favicon (`apps/web/public` has none yet) with the mark.
6. **Shell** (`app-shell.tsx`), following the ZoBlocks layout:
   - **Rail:** 240px, sticky on wide screens. A ZoBlocks-style overlay panel below `lg`, with focus moving in and out and Escape closing it. Navigation (My forms, Templates, Team) under a "Workspace" eyebrow heading. The current item marked with `aria-current` and the accent wash.
   - **Account bar:** thin, sticky, top-right. Holds ThemeToggle and an account menu (name, email, Log out). The account menu moves out of the rail.
   - **Main:** the page title moves out of the sticky header into a ZoBlocks-style `PageHeader` at the top of the content (eyebrow optional, title, optional one-line lede, actions on the right). `AppShell`'s `title`/`actions` props feed it, so pages don't change in this brief.
   - **The email-verification banner** stays, restyled with `warn` tokens.
   - **A link back to zoblocks.design** in the rail's footer.
7. **Auth pages** (sign-in, sign-up, forgot, reset, invite, verify): the ZoBlocks auth layout.
   - A single 26rem column.
   - The wordmark top-left of that column.
   - The faint accent wash at the top of the page.
   - A footer with a link to zoblocks.design.
   - The form itself keeps its fields and behaviour; only the frame and colours change.

**Out of scope:**
- components such as Button, Field, StatusChip, cards and tables (brief 2);
- the editor's internal layout (brief 3);
- the side-by-side visual and accessibility sweep (brief 4).

The editor must still work and look coherent after this brief, through the token mapping alone.

## Later briefs (for orientation)

2. **Components and list screens:**
   - port Button (with "blocked, with a reason"), Field, StatusChip, Callout, EmptyState, shimmer skeletons, toast and confirm;
   - restyle My forms (cards), Templates and Team.
3. **The editor:**
   - top bar, canvas, settings pane, option and grid editors;
   - codes, names and formulas in mono;
   - save state as a StatusChip.
4. **Verification:**
   - a side-by-side visual check against the ZoBlocks console in light and dark;
   - an axe sweep of every screen in both themes;
   - contrast checks of every token pair the builder uses.

## Rules

- Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Keep every e2e selector working. If a change breaks a selector that relies on a class name or text, report it rather than silently rewriting the test.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- **The reference:** confirm the ZoBlocks clone is at `9aaefe0`, and list the values you'll port (light and dark), with their source lines.
- **Colours:** every place the builder uses a colour outside its preset (hex, `white`, `black`, arbitrary values), grouped by meaning, with the token each becomes.
- **Eyebrow:** every use of the builder's `.eyebrow`, `.btn*` and `.input` classes. Which ones change appearance with the new tokens alone, and which need code changes.
- **The Tailwind 3 plan:** how the colour variables and opacity modifiers will work, with one example class traced end to end.
- **The shell:**
  - the new rail and account bar structure, and how `AppShell`'s props map to `PageHeader`;
  - what happens on the editor route, which doesn't use `AppShell` today.
- **e2e:** every selector that depends on a class name, colour or text this brief changes, and what you propose.
- **Contrast:** any token pair the builder uses that the ZoBlocks palette doesn't cover, with its measured ratio.

**CP1 — Tokens, type, base and theme.**
- Items 1–4.
- In a browser, check My forms, Templates, Team, the editor and an auth page in light and dark. There must be no unreadable text, no white boxes in dark mode, and no flash on load.
- Run unit tests and the full builder e2e.

**CP2 — Identity, shell and auth.**
- Items 5–7.
- In a browser, check the rail at desktop and phone widths: the overlay opens and closes; focus moves in and back; Escape closes it.
- Check the account menu and the theme toggle.
- Check all six auth pages in both themes.
- Run the full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set, and restore the external app's form files afterwards.
- Run the web Playwright spec as CI runs it.
- Take screenshots of My forms, the editor and sign-in, in light and dark, so Dhawal can compare them with the ZoBlocks console.
