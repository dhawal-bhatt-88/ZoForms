# Builder brief — clean-up 3: response data and org settings

The third of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, sections A2, A3, A4, A10, A12, A13 and the response counts in A18.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-3-RESPONSE-DATA.md` and commit it on its own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

Since brief 2, nothing can create a response or an event. Everything that reads them, or exists only to manage them, has no data and never will. The same goes for org settings that only affected the hosted page (white-label) or affected nothing at all (data region).

## Scope

**Throttling fix (its own checkpoint, before the removal)**
- The strict auth throttle (30 requests a minute per IP) applies to the whole auth controller, including `GET /v1/auth/me` and `PATCH /v1/auth/me/preferences`.
- Apply it only to the credential routes: signup, login, Google sign-in, forgot password, reset password, verify email, resend verification.
- `/me` and `/me/preferences` fall back to the app's default limit. If no default exists, report that in CP0 instead of inventing one.

**Responses and search (A2)**
- the Responses page and its editor link
- `GET /v1/forms/:id/responses` and `listResponses`
- `search/search.service.ts` (Meilisearch and Postgres `ILIKE`), its module registration, and `MEILI_HOST`, `MEILI_KEY`
- response counts and the "Most responses" sort on My forms, and the count in `forms.service.ts`
- the delete-form dialog's "and all its responses" wording
- a Meilisearch service in any compose file, if there is one

**Analytics (A3)**
- the Analytics page and its editor link
- `GET /v1/forms/:id/analytics`, `getAnalytics`, `Analytics`

**Retention (A4)**
- `retention.service.ts` and its interval job
- `purgeNow`, `POST /v1/settings/org/purge`, `purgeResponses`
- the retention field and "Purge now" button in Settings

**AI insights (A10)**
- `POST /v1/ai/summarize-responses` and `responses-copilot`
- `summarizeResponses`, `answerCopilot` and their heuristic fallbacks in `ai.service.ts`
- the panel on the Responses page
- **Leave the rest of the AI module.** Brief 4 removes it.

**White-label and data region (A12, A13)**
- the "Hide branding" toggle and the data region setting

**Admin response counts (A18, remainder)**
- the overview's response total and the per-form and per-tenant response counts

**Org settings endpoint**
- `GET/PUT /v1/settings/org`, `updateOrg`, `OrgSettings` and the Settings "Data & privacy" section.
- **Only if nothing else lives there.** If the endpoint or section also handles anything that stays, such as the organisation's name, keep it with just those fields, and say so in CP0.

**Prisma**
- one forward migration drops `Response`, `Event`, `Organization.retentionDays`, `brandingHidden` and `dataRegion`, and any relations to them

**Housekeeping**
- `KNOWN-ISSUES.md` entries about Responses or Analytics
- `.env` examples and the deploy compose lines for `MEILI_*`

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Rebuild `packages/form-schema/dist` if it changes.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit lists. Report any differences.
- **Org settings:** exactly which fields `GET/PUT /v1/settings/org` reads and writes, and what the Settings page shows. Is anything there that stays? Does the Settings page still have content after this brief, other than the AI section brief 4 removes?
- **Throttling:** how the throttler is configured today: the global default, the auth controller's limit, and which routes it covers.
- Every e2e step that touches responses, analytics, retention, org settings or response counts, and what replaces it or why it goes.
- Whether anything outside these features uses `SearchService` or the `Event` or `Response` models.

**CP1 — Throttling.**
- Apply the throttle change.
- Add an e2e check:
  - more than 30 `/me` calls in a minute succeed;
  - a 31st login attempt in a minute is still refused with 429.
- Commit on its own.

**CP2 — Remove.**
- Apply the removal and the migration.
- Searches for `response`, `analytics`, `event`, `retention`, `purge`, `branding`, `dataRegion`, `meili`, `search`, `summar` and `copilot`: report every remaining match with the reason it stays.
- Check that every removed route returns 404, and that the Settings page and My forms still load.

**CP3 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
