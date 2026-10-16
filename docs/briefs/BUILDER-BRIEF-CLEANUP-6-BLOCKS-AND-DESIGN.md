# Builder brief — clean-up 6: block types and form design

The sixth of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, sections A15 and A8.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-6-BLOCKS-AND-DESIGN.md`, replace `docs/BUILDER-CLEANUP-PLAN.md` with the attached updated plan, and commit both on their own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

**Unrenderable blocks.** Renderer 0.25.0 knows 29 block types; the builder offers 33. The renderer refuses to mount a form containing any of the other four (`file`, `embed`, `signature`, `recaptcha`), so a form made from the "Bug report" or "Job application" system template downloads an artifact that can't be rendered.

**Ignored design settings.** The renderer reads no form `settings` at all. The Design panel, theme and submit label have no effect on the rendered form; styling belongs to the host through the renderer's `data-zf-*` hooks.

Unlike briefs 1–5, this one changes the form schema, so saved data matters even though no client data exists.

## Scope

**Block types (A15)**
- Remove `file`, `embed`, `signature` and `recaptcha` from:
  - `BlockType`, `BLOCK_META` and `STATIC_TYPES` (remove the entries only; `STATIC_TYPES` stays for `isAnswerable`);
  - the insert menu;
  - canvas previews, including the "reCAPTCHA badge (added on publish)" label;
  - the inspector, including the embed-URL handling;
  - save rules and tests.
- **Keep** video embed URLs. They belong to the `video` block, not the `embed` block.
- System templates "Bug report" (`form-bug.json`) and "Job application" (`form-job.json`): remove their `file` blocks, and anything in those templates that refers to them (conditions, scores, logic text).

**Design and submit label (A8)**
- the Design panel (colours, font, corners, width, live preview, logo, cover image, input styling, custom CSS)
- `FormTheme`, `ResolvedTheme`, `resolveTheme`, `TEMPLATE_STRIPPED_THEME_SETTINGS` and the logo and cover stripping
- the submit label field and `settings.submitLabel`
- `theme` and `submitLabel` in all 16 system templates
- the canvas and template previews keep working with the builder's default look

**Housekeeping**
- `KNOWN-ISSUES.md` entries and comments about these blocks or the theme

## Saved data

Saved forms, versions and templates in a development database, and the system template JSON files, may still contain the removed types or settings.
- **Removed settings keys:** `FormSettings` isn't strict, so they're dropped on parse, as in brief 2.
- **Removed block types:** after this brief, the schema rejects them. CP0 counts where they occur, and we decide the handling from the numbers.

## Renderer compatibility check (new)

Add an e2e check that builds a form with **one block of every type the builder offers** and runs the downloaded artifact through the renderer's own `/core` integrity check. Use the `@zoworkhq/forms` installed in the external test app, as `verify-scoring-api` already does. It must pass after this brief. From then on, adding a builder block type the renderer doesn't know fails the run.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Rebuild `packages/form-schema/dist` after every change to it.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit's A15 and A8 lists. Report any differences.
- **Saved data:** count the forms, versions and templates (system and organisation) in the dev database that contain `file`, `embed`, `signature` or `recaptcha`, or a `theme` or `submitLabel` setting. Also check the system template JSON files. Propose the handling, e.g. delete dev rows, or rewrite them without the blocks.
- **The two templates:** whether anything in them refers to their `file` blocks.
- **What's left of form settings:** the fields `FormSettings` keeps after this brief, and what the editor's form settings panel still shows. If nothing is left, say so and propose whether `settings` should leave the schema and the artifact.
- **Canvas look:** what the canvas and template previews use from the theme today, and what they'll fall back to.
- Every e2e step that uses these block types, the Design panel, theme or submit label, and what replaces it.
- **The compatibility check:** how you'll call the renderer's integrity check from e2e, and which renderer export it uses.

**CP1 — Block types and templates.**
- Remove the four block types and fix the two templates.
- Apply the agreed saved-data handling.
- Add the compatibility check; it must pass.
- Searches for `file`, `embed`, `signature`, `recaptcha`, `captcha` and `upload` (as block types or block-related code): report every remaining match with the reason it stays.

**CP2 — Design and submit label.**
- Remove the Design panel, theme and submit label, and update the 16 system templates.
- Searches for `theme`, `submitLabel`, `logo`, `cover`, `customCss` and `resolveTheme`: report every remaining match with the reason it stays.
- In a browser, check that the editor, the canvas, the form settings panel and the template preview load without page errors.

**CP3 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
