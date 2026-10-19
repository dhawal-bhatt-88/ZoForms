# Builder brief — restyle 4: verification

The last of four restyle briefs. Web app only. Restyles 1–3 moved Zowork Forms onto the ZoBlocks tokens, type, shell, component kit and editor (last commits `f6a712f`, `ffe5161`). This brief checks the result against the ZoBlocks console. It also settles two open layout decisions, fixes the editor's top bar at 768px, and leaves checks behind that keep contrast and accessibility from slipping.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-RESTYLE-4-VERIFY.md` and commit it on its own.

**This brief stops twice:** after CP0, and after CP1, because Dhawal decides the width and the surface from CP1's screenshots. Don't change any app code before CP2.

## The reference

- **ZoBlocks at `9aaefe0`,** cloned at `D:\ZoworkProjects\zoblocks`:
  - the console, `apps/app`;
  - its contrast gate (wherever its build runs it);
  - `DESIGN.md`.
- **`docs/ZOBLOCKS-UPSTREAM-NOTES.md`:** the six defects and the local additions. Known differences in it aren't findings.

## Scope

**1. Side-by-side comparison**
- **The screens:** compare each pair in light and dark, at 1440px:

  | Zowork Forms | ZoBlocks |
  |---|---|
  | My forms | the console's closest list screen |
  | Team | Members |
  | Templates | a tabbed screen |
  | A dialog and a confirm | theirs |
  | An empty state | theirs |
  | A toast | theirs |
  | Sign-in | their auth page |
  | The rail and the account bar | theirs |

- **Per pair, compare:**
  - spacing and type sizes;
  - radii, borders and shadows;
  - colours of text, fills and focus;
  - icon sizes;
  - motion.
- **Running the console** needs MongoDB and its own sign-in. In CP0, report what it takes to run locally. If that's unreasonable, propose the next best reference (its component source plus zoblocks.design), and say what that can't show.
- **Each difference** gets one of three verdicts:
  - **fix:** a slip in the port;
  - **keep:** a deliberate builder choice, with the reason (for example `--zb-nest`, the 900px width, white surfaces);
  - **upstream:** ZoBlocks is wrong, so add it to the notes.

**2. Two layout decisions (Dhawal decides at CP1)**
- **Content width:** the list screens are 900px wide; the ZoBlocks console uses 1,200px. Screenshot My forms, Templates and Team at both widths, at 1440px and 1920px. Report how many card columns My forms gets at each.
- **Card and panel surface:** the builder's light `surface` is white; ZoBlocks' is `paper` (`#f7f9f8`). Screenshot both on the same screens, plus the editor.
  - Measure what changes: card against page, input against card, and `--zb-nest` against `surface` (it was tuned against white, so it may need retuning).
  - Say which screens rely on card and page fills differing.
- The editor canvas width (680px) isn't part of this decision.

**3. The editor at 768px**
- Today the top bar runs 74px past the right edge, and Save is off-screen.
- **At 768–1023px:**
  - Save, Cancel and the save state stay visible;
  - Download, the ThemeToggle and the form-actions items move into the ⋯ menu;
  - the title field shrinks first.
- Nothing may sit off-screen at 768px.
- The editor below 768px stays out of scope.

**4. Contrast gate**
- **Port ZoBlocks' contrast gate** into the builder: the script, the way it reads the token pairs, and how a failure stops the build.
- **The pair list covers every pair the builder uses,** in both themes, including:
  - `--zb-nest`;
  - the selected segment's border;
  - the Checkbox and Switch boundaries;
  - the Callout tones;
  - the StatusChip tones.
- Text pairs need 4.5:1 (3:1 for large text), and component boundaries and states 3:1.
- **Run it in CI** (`.github/workflows/ci.yml`). It needs no API.

**5. Accessibility sweep**
- **Add `@axe-core/playwright`** and a new builder e2e suite (`verify-a11y.js`) that runs axe (WCAG 2.2 A and AA rules) on every screen and state below, in both themes:
  - **Auth:** all six pages, plus an error state.
  - **My forms:** with forms, empty, no match, an API error, a card menu open, the delete confirm, a toast.
  - **Templates:** both tabs, the preview and the picker.
  - **Team:** as a manager and as a viewer.
  - **Versions,** and the restore confirm.
  - **The editor:**
    - a form with pages, groups, scores, a grid and conditions;
    - a group template;
    - a read-only system template;
    - as a viewer;
    - the block menu open;
    - each editor dialog;
    - a refusal Callout.
- **Add an axe check of the sign-in page** to the web Playwright spec, so CI covers at least one page. CI starts no API.
- **Structure,** on each screen:
  - one `h1`;
  - headings in order;
  - `banner`, `navigation` and `main` landmarks;
  - every dialog named.
- **Forced colours** (Playwright `forcedColors: "active"`), on My forms, Team, the editor and sign-in:
  - focus rings, the selected segment, Switch and Checkbox states, the selected block and dialog edges stay visible.
- **Zoom:** the list and auth screens at 320px wide (WCAG 1.4.10), with no sideways scroll except inside tables and the Versions table's own scroller.

**6. Wrap-up**
- **`docs/ZOBLOCKS-UPSTREAM-NOTES.md`:** bring it up to date with anything new from item 1, ready for Dhawal to send to the ZoBlocks team. Don't file anything.
- **`docs/BUILDER-CLEANUP-PLAN.md`:**
  - record the restyle as done (briefs 1–4 with their commits);
  - add whatever this brief leaves as follow-ups.

**Out of scope:**
- the admin app;
- the editor below 768px;
- the read-only editor for viewers (an existing follow-up);
- behaviour changes. A finding that needs one is reported, not fixed.

## Rules

- Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Keep every e2e selector working. Report any that must change, with the reason, rather than silently rewriting a test.
- **Fixes in CP2:** fix every serious or critical axe violation, and every gate failure. Report moderate and minor ones with a proposal; fix them only if the fix is styling, a name or a role.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- **The ZoBlocks console:** what it takes to run it locally, or the reference you propose instead.
- **ZoBlocks' contrast gate:** where it lives, how it gets its pairs, and how it fails a build. Then your plan for porting it, with the builder's pair list.
- **The axe setup:** how the suite signs in, seeds each state and switches theme, and roughly how long it will add to the e2e run.
- **The width and the surface:** where each is set today, and every screen each would change.
- **768px:** the top bar's current layout at 768px and 1023px, and the proposed one.

**CP1 — Tooling and findings. Stop and wait.**
- Add the contrast gate (CI included), the axe suite, the sign-in axe check, and the structure, forced-colours and zoom checks.
- **Report, without fixing:**
  - every gate failure;
  - every axe violation by screen, state and theme, grouped by rule;
  - the structure, forced-colours and zoom results.
- **Side-by-side:**
  - the screenshot pairs for item 1, in `e2e/output/restyle-4/compare/`;
  - a table of differences, each with its verdict.
- **The two decisions:** the screenshots for item 2, in `e2e/output/restyle-4/width/` and `e2e/output/restyle-4/surface/`, with the measurements and your recommendation.
- Commit the tooling. It may be red at this checkpoint; say so in the commit message and the report.

**CP2 — Fixes.**
- Dhawal's width and surface decisions, the 768px top bar, the "fix" verdicts, and the violations under the fix rule.
- **The checks must all pass:**
  - the contrast gate;
  - the axe suite (no serious or critical violations);
  - structure, forced colours and zoom.
- **Run:**
  - every unit suite (report each count);
  - the full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set (restore the external app's form files afterwards);
  - the web Playwright spec as CI runs it.
- **Screenshots:**
  - every changed screen in both themes, in `e2e/output/restyle-4/`;
  - the editor at 768px and 1023px.
- Do item 6 last.
