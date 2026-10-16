# Builder brief — clean-up 4: AI

The fourth of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, section A9.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-4-AI.md`, replace `docs/BUILDER-CLEANUP-PLAN.md` with the attached updated plan, and commit both on their own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

The AI features are out of scope by decision, and they are broken against the current schema:
- **Ask AI** rebuilds the form from a flat block list, dropping groups, pages, conditions, scores and navigation.
- **Generate and Ask AI** can emit `file` blocks, which the renderer rejects.
- **Any member, viewers included, can set the organisation's Anthropic key**, because `SettingsService.update` has no manager check.

A future AI feature would need a new design against the contract, so none of this code is kept. Since brief 3, the Settings page holds only the AI section, so the whole page and module go too.

## Scope

**API**
- the AI module: `ai.controller.ts` (`generate-form`, `edit-form`, `suggest-logic`, `translate-form`), `ai.service.ts`, and its registration
- the settings module: `GET/PUT /v1/settings`, `POST /v1/settings/test-ai`, `SettingsService` including its private `assertManager`, and its registration
  - **Only if nothing outside AI lives there.** Confirm in CP0.
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` in `env.ts`
- `@anthropic-ai/sdk` in `apps/api/package.json`, which also drops `standardwebhooks` from the lockfile
- any body-limit rule or other config that exists only for the AI routes

**Web**
- "Generate with AI" on My forms and its dialog
- the Ask AI drawer and its button
- the AI tools in form settings (Suggest logic, Translate) and their handlers
- the Settings page and its navigation entry
- the AI and settings functions and types in `lib/api.ts`
- comments naming AI, e.g. the template-mode comment ("Download and AI" becomes "Download")

**Prisma**
- one forward migration drops `Organization.anthropicApiKey` and `aiModel`

**Housekeeping**
- `KNOWN-ISSUES.md` entries 1 and 3
- the `ANTHROPIC_*` lines in the `.env` examples and the deploy compose file
- **Out of scope:**
  - `optionsFromLabels` in form-schema, which becomes test-only: leave it for brief 8;
  - marketing copy that mentions AI: brief 7.

## Tests that change

- `verify-templates.js` checks that template mode hides Ask AI. With Ask AI gone, reduce that check to what remains: the Download button, or whatever template mode still hides.
- Any other e2e step that calls `/v1/ai/*` or `/v1/settings`, or clicks an AI or Settings control: list it in CP0 with what replaces it or why it goes.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager` in shared code, org-ownership checks). The private copy in `SettingsService` goes with the service.
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Rebuild `packages/form-schema/dist` if it changes.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit's A9 list. Report any differences.
- **Settings module:** confirm that every route, service method and Settings page section is AI-only. If anything else lives there, list it and propose where it moves.
- **Navigation:** the app's navigation after the Settings entry goes. Does anything else link to `/app/settings`, e.g. the account menu, onboarding or emails?
- Every e2e step that touches AI or Settings, and what replaces it.
- Anything outside AI that uses `@anthropic-ai/sdk`, the AI service, or the two columns.

**CP1 — Remove.**
- Apply the removal and the migration.
- Searches for `ai`, `anthropic`, `claude`, `generate`, `translate`, `suggest`, `copilot` and `settings` (whole words where possible): report every remaining match with the reason it stays.
- Check that every removed route returns 404, `/app/settings` returns 404 or redirects, and My forms and the editor load in a browser without page errors.

**CP2 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
