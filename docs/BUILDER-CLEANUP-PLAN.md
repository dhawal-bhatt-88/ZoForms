# Builder clean-up plan

Agreed 16 Oct 2026 · @Dhawal. Based on `docs/CLEANUP-AUDIT.md` (`d7aadaa`); the IDs A1–A22 and B1–B5 refer to that report.

## Why

The builder was a hosted form product: it published forms, collected responses and acted on them. Under the SDK architecture it is a design-time tool. Authors build a form, save versions and download the JSON artifact; `@zoworkhq/forms` renders it in the client's app, and submissions go to the client's own endpoint. Nothing a respondent does ever reaches us.

So everything that serves respondents, or that only respondents' data feeds, has no role. Some of it is also exploitable today (A1, A5).

## Security note

The builder isn't deployed anywhere (confirmed 16 Oct 2026), so these two holes are local only. They are why briefs 1 and 2 come first, and why the builder must not be deployed before both are done:
- **Webhook SSRF (A5):** any signed-in user, viewers included, can make the API request any URL, including internal hosts and the cloud metadata address, and read back the status code.
- **Anonymous uploads (A1):** `POST /v1/public/uploads` accepts 10 MB files from anyone.

## Progress

| Brief | Status | Commits |
|---|---|---|
| 1. Automations and webhooks | Done 16 Oct 2026 | `a2cfd32`, `ab19ce2`, `65ef734` |
| 2. Hosted publish path | Done 16 Oct 2026 | `f8a6f4f`, `ea6a077`, `18c4331` |
| 3. Response data and org settings | Done 16 Oct 2026 | `2706c2f`, `08ea1d1`, `ac4fad3` |
| 4. AI | Done 16 Oct 2026 | `69b2379`, `bb4e5d4` |
| 5. Custom domains | Done 16 Oct 2026 | `ab802d4`, `cf6c30f` |
| 6. Block types and form design | Done 19 Oct 2026 | `a028089`, `bb5e336`, `1641af1`, `237b389` |
| 7. Static pages and homepage | Next | |

## Before any deployment

Hardening items found during the clean-up. None of them belong to a removal brief, but all must be done before the builder is deployed anywhere:
- Briefs 1 and 2 must be done. Both are, so the SSRF and the anonymous uploads are closed.
- **No signed-in route has a rate limit.** Only the eight credential routes are throttled (brief 3). Decide a default limit for the rest of the API.

## Decisions

| Topic | Decision |
|---|---|
| AI features (A9, A10) | Remove all of them: Generate, Ask AI, Suggest logic, Translate, response summary and Q&A, and the org's AI key and model. They are out of scope, Ask AI destroys groups, pages, logic and scores, and viewers can change the key. A rebuild would need a new design against the contract. |
| `file`, `embed`, `signature`, `recaptcha` (A15) | Remove from the builder. `file` needs an upload design in the client's app first, and comes back later as a contract feature. Remove the `file` blocks from the "Bug report" and "Job application" system templates. |
| Design panel, theme and submit label (A8) | Remove. Styling belongs to the host, through the renderer's `data-zf-*` hooks. The renderer reads no form settings. |
| Homepage (A17) | `/` redirects to sign-in, or to `/app` when signed in. Keep `Logo`. Replace `marketing.spec.ts` with a sign-in smoke test so the CI job still runs. |
| Prototype and blueprint pages (A16) | Delete. Git history is the archive. |
| Builder preview (A20) | Keep the stand-ins. Switching to the real renderer is new work, not clean-up. |
| `Form.slug` | Drop. The download is named from the title and version, e.g. `phq-9-v12.json`, falling back to `form-v12.json` when the title gives nothing usable. |
| Workspace switcher (B5) | Remove the button, which does nothing. The `Workspace` model stays; several workspaces per organisation would be built when needed. |
| Unused but cheap columns (B3) | Keep `Invite.invitedById`, `Template.createdBy` and `Workspace.name`. |
| `Organization.slug` (brief 5) | Keep. It's a random label set at signup that operators search and see in the admin console. No tenant URL or route uses it. |
| form-schema's self-used exports (B1) | Leave them. Some may be shared vocabulary with the renderer. |

## The briefs

Run one at a time, in this order. Each ends with one forward Prisma migration that drops what it removed.

### 1. Automations and webhooks (A5)

- Automations, webhooks, the per-form integrations page, the `/app/integrations` catalogue and its sidebar entry, the editor link.
- The `dispatch` call in the submit path.
- `Automation` table.

### 2. Hosted publish path (A1, A6, A7, A18, A22, `Form.slug`)

- The public page `/r/<slug>`, the public API (view, submit, partial save, events), `embed.js`, anonymous uploads and the static `/uploads` serving, `multer`, the `uploads` volume in production compose.
- Publishing: `Form.status`, `FormStatus`, `PATCH /v1/forms/:id` and `updateForm`; the Share dialog, "View live", "Copy link", and the Live/Drafts filter on My forms.
- Hosted-only settings: spam protection (Turnstile), partial submissions, redirect URL.
- New-response emails (`settings.notifyEmails`). `MailService` stays, because auth and invites use it.
- Admin moderation (take down, restore) and the published counts. The admin forms list stays.
- `deploy/seed-demo.mjs` and its `SEED_*` variables.
- `Form.slug`, with the download renamed as decided above.
- The two stray PNGs in `uploads/`. Add `uploads/` to `.gitignore`.
- `next.config.mjs`: with `/r/*` gone, no page needs to be frameable, so deny framing everywhere.
- The three e2e publish checks (`verify-scoring-api`, `verify-templates-api`, `verify-versions`): move their "builder-only fields never leave the builder" assertions to the artifact download. Don't just delete them.
- `KNOWN-ISSUES.md` entries 2 and 4.

### 3. Response data and org settings (A2, A3, A4, A10, A12, A13)

- Responses and response search, Meilisearch (`MEILI_*`), response counts and the "Most responses" sort.
- Analytics.
- Retention and "Purge now", and the background job.
- AI response summary and Q&A.
- White-label and the data region setting.
- `Response`, `Event` tables; `Organization.retentionDays`, `brandingHidden`, `dataRegion`.
- The Settings "Data & privacy" section and `/v1/settings/org`, **after confirming nothing else lives there**, such as renaming the organisation.
- The delete-form dialog's "and all its responses" wording.

### 4. AI (A9)

- Generate with AI, Ask AI, Suggest logic, Translate; Settings' AI section and test call.
- `Organization.anthropicApiKey`, `aiModel`; `ANTHROPIC_*`; `@anthropic-ai/sdk`.
- `KNOWN-ISSUES.md` entries 1 and 3.
- If the Settings page is now empty, remove it and its navigation entry.

### 5. Custom domains (A11)

- The domains module, page and sidebar entry; `Domain` table; `CLOUDFLARE_*`, `DOMAIN_CNAME_TARGET`.

### 6. Block types and form design (A15, A8)

- `file`, `embed`, `signature`, `recaptcha` from the block enum, menu, previews, inspector and save rules.
- The Design panel, `FormTheme`, `resolveTheme`, the submit label.
- All 16 system templates: remove `theme` and `submitLabel`; remove the `file` blocks from "Bug report" and "Job application".
- Remove `settings` from the schema and the artifact; it's empty once theme and submit label go (decided at CP0).
- Saved data: none needs handling. The dev database has no affected versions or organisation templates, and the system templates are reseeded from their JSON files. A stray version elsewhere with a removed type gives a 400 on save and a 500 on download or restore; with no client data, that's accepted rather than adding permanent read-time tolerance.

### 7. Static pages and homepage (A16, A17)

- `/mockup`, `/docs`, `mockup.html`, `docs.html`, `frame-prototype.html`, `blueprint.html`, `BLUEPRINT.md`, `embed-frame.tsx`.
- The marketing page, nav, footer, motion and FAQ; `/` redirects as decided. Keep `Logo`.
- Replace `marketing.spec.ts` with the sign-in smoke test.

### 8. Tidy-up and docs (B1–B5)

- knip's confirmed findings (B1): unused files, dependencies and exports, including what the earlier briefs left unused (`validateSubmission`, `withoutBuilderFields`, `optionsFromLabels`). Check `prettier` isn't used by editors before removing it.
- **The template seeder:** it compares parsed content, so a stored row that differs from its JSON file only by keys the schema now drops is never rewritten (since brief 6, all 16 system-template rows still hold old `settings`). Compare the stored JSON with the file's JSON as written, then reseed.
- The unused `isScoredGroup` import in the editor; `README.md`'s "33 block types"; the `e2e/README.md` row for `verify-renderer-types`.
- The `redis` service; the broken `lint` script (set up ESLint or remove the script); tracked `tsbuildinfo` files (untrack them and add them to `.gitignore`); the workspace switcher button; the billing 404 check in `verify-body-limits.js`.
- Add the missing variables to the `.env` examples: `PUBLIC_TENANT_URL`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM`, `CORS_ORIGINS`, `NODE_ENV`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- **Docs, last, so they describe what's left:**
  - rewrite README, GETTING-STARTED and DEPLOY for the SDK architecture;
  - delete PROGRESS.md;
  - fix the `schema.prisma` header comment.

## What stays

- Auth: email and password, Google, verification, password reset.
- Multitenancy:
  - organisations, members, roles, team and invites;
  - workspaces;
  - org-scoped queries and role checks.
- Forms, schema save with every save rule, append-only versions and restore, artifact download.
- Templates (system and organisation), the settings-pane width preference.
- The builder preview.
- The admin console's tenant tools: tenants, users, impersonation, audit, and the forms list.

No deleted code provides tenant isolation. Tenants come from the signed-in user, never from a domain, so removing custom domains doesn't change how a tenant is resolved.

## Rules for every brief

- **Tenancy:**
  - Never delete shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks), even if knip calls them unused after a removal.
  - Brief 1 first confirms e2e checks exist that one organisation can't see or download another's forms or templates, and adds them if not.
  - Every brief keeps those checks passing.
- **Searches:**
  - Exclude `.git`, `node_modules`, `.next`, `dist` and `e2e/output`.
  - List matches before changing anything; no blind replace-all.
- **Tests:**
  - Rebuild `packages/form-schema/dist` after changing the package.
  - Run the full builder e2e with the external-app variables, and restore the external app's form files afterwards.
- **Commits:** commit at each checkpoint once tests pass. Don't push.

## Unblocked afterwards

- **Final gate:** once every builder block type is a renderer type, the builder can check each download against the renderer's `/core`. That needs the renderer installable in the builder repo.
- **Real preview:** the same requirement, if the stand-ins are ever replaced.