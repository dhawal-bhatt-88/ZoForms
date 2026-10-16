# Builder brief — clean-up 1: automations and webhooks

The first of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, section A5. Save the plan into `docs/` and commit it on its own before starting.

## Why

Automations fire only on a new response, and responses never reach us under the SDK architecture. The feature also carries an SSRF: `assertUrl` accepts any `http(s)` URL, `deliver` fetches it with no host check and follows redirects, `test` echoes the status code back, and no role check stops a viewer. Removing the feature removes the hole.

## Scope

Remove:
- `apps/api/src/automations/` (controller, service, module), and its registration in `app.module.ts`;
- the `dispatch` call in `forms.service.ts` (`:503-512` in the audit);
- the per-form page `app/(app)/app/forms/[id]/integrations/page.tsx`;
- the catalogue page `app/(app)/app/integrations/page.tsx`;
- "Integrations" in the sidebar (`app-shell.tsx`) and the editor's link;
- the automation functions and types in `apps/web/src/lib/api.ts`;
- the Prisma `Automation` model, with one forward migration that drops it.

Out of scope: everything else in the submit path. Responses, notifications and the public API go in briefs 2 and 3, so leave `submit` working apart from the removed `dispatch` call.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks), even if nothing else calls them once automations are gone.
- Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only, no code.**
- Every file and line to change. Compare against the audit's A5 list and report any differences.
- **Tenant isolation coverage:** list the e2e checks proving that one organisation can't see, change or download another organisation's forms, versions, artifacts or templates. Say which of these are missing.

**CP1 — Isolation tests first.**
- Add the missing cross-org checks from CP0.
- Run them against the current code, before anything is removed, so they show isolation holds today.
- Commit them on their own.

**CP2 — Remove automations.**
- Apply the removal and the migration.
- Rebuild `packages/form-schema/dist` if it changed.
- Search for `automation`, `webhook`, `integrations` and `dispatch`, and report every remaining match with the reason it stays.

**CP3 — Full run.**
- Full builder e2e with the external-app variables (`E2E_EXTERNAL_APP_URL`, `E2E_EXTERNAL_FORMS_DIR`); restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
