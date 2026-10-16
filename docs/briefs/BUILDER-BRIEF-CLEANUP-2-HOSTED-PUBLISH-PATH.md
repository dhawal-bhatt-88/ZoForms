# Builder brief — clean-up 2: hosted publish path

The second of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, sections A1, A6, A7, A18 and A22.

**Stop after CP0 and wait for approval before changing any code.**

## Housekeeping first

Move `docs/BUILDER-BRIEF-CLEANUP-1-AUTOMATIONS.md` and this brief into `docs/briefs/`, and commit them on their own. Future briefs go there too.

## Why

Under the SDK architecture no respondent ever opens a form on our site, so the builder has nothing to publish and nothing to receive. This path also holds the second live hole: `POST /v1/public/uploads` accepts 10 MB files from anyone. Once publishing is gone, nothing can create responses, which makes brief 3 safe.

## Scope

**Public runtime**
- `apps/web/src/app/r/[slug]/page.tsx`
- `apps/web/public/embed.js`
- `public.controller.ts` (view, submit, partial save, events)
- `uploads.controller.ts`, the static `/uploads` serving in `main.ts`, `multer` and `@types/multer` (if nothing else uses them), and the `uploads` volume in `deploy/docker-compose.prod.yml`
- the public section of `forms.service.ts`: submit, partials, Turnstile, `getPublicBySlug`, and the label-resolving `fields` code and any helpers (such as `escapeHtml`) that only the removed code used
- the web client functions `getPublicForm`, `submitResponse`, `savePartial`, `uploadFile`, `trackEvent` and the `PublicForm` type
- `validateSubmission` in form-schema, if nothing outside its tests uses it

**Publishing**
- `Form.status`, enum `FormStatus`, `PATCH /v1/forms/:id`, `updateForm`
- the Share/embed dialog, "View live", "Copy link", and the Live/Drafts filter and status chips on My forms

**Hosted-only settings and email**
- the spam protection (Turnstile), partial submissions and redirect URL settings, and their `FormSettings` fields
- `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- new-response emails (`notifyNewResponse`, `settings.notifyEmails`, the editor field). `MailService` stays, because auth and invites use it.

**Admin and seed**
- admin moderation: "Take down", "Restore (publish)", `PATCH /v1/admin/forms/:id`, and the published counts. The admin forms list (search, delete) stays; remove only its status column and filter.
- `deploy/seed-demo.mjs` and `SEED_API`, `SEED_EMAIL`, `SEED_PASSWORD`

**`Form.slug`**
- Drop the column, its unique index and slug generation on create and duplicate.
- Name the download from the title and the version number: lower case; runs of anything other than `a–z` and `0–9` become `-`; trimmed of `-`; then `-v<version>.json`. For example, `PHQ-9 (adult)` version 12 becomes `phq-9-adult-v12.json`. If nothing usable is left, use `form-v<version>.json`.
- Set it in the download response's `Content-Disposition`, and wherever the web app names the file.

**Framing**
- `apps/web/next.config.mjs`: no page needs to be embeddable now, so deny framing on every route (`X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`). Remove the comments about embedding `/r/*`.

**Housekeeping**
- the two PNGs in the repo-root `uploads/`; add `uploads/` to `.gitignore`
- `KNOWN-ISSUES.md` entries 2 and 4
- `DEPLOY.md` lines about the uploads volume and public forms. The full rewrite is brief 8.

**Out of scope:** the `Response` and `Event` tables, Responses, Analytics and retention (brief 3). They'll have no new data once submit is gone. Leave their pages and routes working until brief 3 removes them.

## Tests that must move, not disappear

- **Builder-only fields:** `verify-scoring-api.js`, `verify-templates-api.js` and `verify-versions.js` publish a form and read `/v1/public/forms/:slug` to check that builder-only fields never reach respondents. Move each assertion to the artifact download (`GET /v1/forms/:id/artifact`), so the same rule is still tested.
- **Rename isolation:** `verify-tenant-isolation.js` checks renaming through `PATCH /v1/forms/:id`. Find out how the editor actually renames a form. If it's through the schema save, the title, or another route, point the isolation check at that route. If `PATCH` is the only rename path and the UI uses it, report it in CP0: then the route isn't dead, and the plan changes.
- Any other e2e step that publishes a form or uses a slug: list it in CP0 with what replaces it.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Rebuild `packages/form-schema/dist` after changing it.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit lists. Report any differences.
- How the editor renames a form, and the route the rename isolation check will use.
- Every e2e step that publishes, uses `status` or uses a slug, and what replaces it.
- Whether anything outside the public path uses `multer`, `escapeHtml`, `validateSubmission` or the `fields` code.

**CP1 — Move the tests.**
- Move the builder-only field assertions and the rename isolation check to their new routes.
- Run them against the current code; they must pass before anything is removed.
- Commit on their own.

**CP2 — Remove.**
- Apply the removal, the download naming and the framing headers.
- One forward migration drops `Form.status`, `FormStatus` and `Form.slug`.
- Searches for `slug`, `status`, `public`, `embed`, `upload`, `turnstile`, `notify`, `partial` and `publish`: report every remaining match with the reason it stays.
- Check that every former public route returns 404, and that a page from the web app sends both framing headers.

**CP3 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
