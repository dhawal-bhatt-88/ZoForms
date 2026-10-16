# Clean-up audit

Audited 16 Oct 2026 on `formbuiler-service-dhawal` at `94b0bf6`. Report only: nothing was changed, deleted or installed.

**The architecture this audit tests against:** the builder is hosted by us. Forms are exported as JSON (the artifact download), rendered by `@zoworkhq/forms` inside the client's own app, and submissions go to the client's own endpoint. Nothing a respondent does ever reaches us. The renderer version checked is 0.25.0, as installed in `D:/ZoworkProjects/external-test-app` (`node_modules/@zoworkhq/forms`).

Line counts are from `wc -l` and are approximate where a feature is part of a larger file. "Dead" code is grouped with the dead feature it serves, so each row can be removed in one brief.

## Summary

| # | Feature | Bucket | Removal size (approx.) | Decision needed |
|---|---|---|---|---|
| A1 | Hosted form page `/r/[slug]`, public API, `embed.js`, public uploads, `Form.status` | **Dead** | ~1,400 lines in 6 files removed and 9 edited; `Form.status` and enum `FormStatus` dropped; 3 e2e scripts edited | Keep `Form.slug`? It still names the download (`<slug>-schema.json`). |
| A2 | Responses (incl. response search) | **Dead** | ~600 lines; `Response` table dropped; `MEILI_*` env | None |
| A3 | Analytics | **Dead** | ~370 lines; `Event` table dropped | None |
| A4 | Response retention, "Purge now" | **Dead** | ~110 lines; `Organization.retentionDays` dropped | None |
| A5 | Automations, webhooks, `/app/integrations` (live SSRF) | **Dead** | ~850 lines; `Automation` table dropped | None. Do this one first (see A5). |
| A6 | New-response emails (`settings.notifyEmails`) | **Dead** | ~70 lines; one schema field | None |
| A7 | Hosted-only form settings: spam protection (Turnstile), partial submissions, redirect URL | **Dead** | ~90 lines editor + schema fields; `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | None |
| A8 | Submit label and the Design panel (`settings.theme`) | **Unclear role** | ~280 lines editor + ~80 form-schema + theme in all 16 system templates | Will the renderer ever read `settings`? It reads none today. |
| A9 | AI: Generate, Ask AI, Suggest logic, Translate, plus the Settings key | **Out of scope by decision** | ~1,250 lines; `Organization.anthropicApiKey`, `aiModel`; `ANTHROPIC_*`; `@anthropic-ai/sdk` | Remove now, or keep disabled? Ask AI currently damages forms (see A9). |
| A10 | AI response summary and Q&A ("AI insights") | **Dead** | Part of A9's count, about 150 lines | None |
| A11 | Custom domains | **Dead** | ~480 lines; `Domain` table dropped; `CLOUDFLARE_*`, `DOMAIN_CNAME_TARGET` | None |
| A12 | White-label ("Made with Frame" footer) | **Dead** | ~25 lines; `Organization.brandingHidden` dropped | None |
| A13 | Data region setting | **Dead** (a label with no effect) | ~30 lines; `Organization.dataRegion` dropped | None |
| A14 | Billing leftovers | **Dead**, already almost gone | ~5 lines, plus marketing copy (A17) | None |
| A15 | Block types the renderer rejects: `file`, `embed` (in the menu), `signature`, `recaptcha` (schema only) | **Dead** for `signature`, `recaptcha`; **Unclear role** for `file`, `embed` | ~150 lines plus tests; 2 system templates edited | Add `file` and `embed` to the renderer, or remove them from the builder? Today a form using them can't be rendered at all. |
| A16 | Prototype and blueprint pages (`/mockup`, `/docs`, `mockup.html`, `frame-prototype.html`, `docs.html`, `blueprint.html`, `BLUEPRINT.md`) | **Dead** (research artefacts) | ~22,800 lines, all static HTML/Markdown | Archive outside the repo, or delete? |
| A17 | Marketing site `/` | **Unclear role** | ~900 lines (keep `Logo`, which 5 auth pages use) | What should `/` be? Its copy sells the hosted product. |
| A18 | Admin console: form moderation and response counts | **Dead** | ~80 lines across admin app and API | None |
| A19 | Admin console core: tenants, users, impersonation, audit | **In use** (operator tooling) | — | None |
| A20 | Builder preview `BlockPreview()` / `StaticCanvas` | **In use** | — | Replace the builder's own stand-ins with the renderer? That needs the private package installable in this repo. |
| A21 | Builder core: auth, team, forms, save, versions, download, templates, preferences | **In use** | — | None |
| A22 | Demo seed `deploy/seed-demo.mjs` | **Dead** | 81 lines | None |

**Suggested order.** Do A5 first, then A1 with its uploads, because both are reachable today (see the risk notes). Responses, Analytics, retention, notifications and white-label (A2–A4, A6, A10, A12) can then go in one brief, since they share the `Response` and `Event` tables and the submit path. One Prisma migration at the end of each brief drops what that brief removed.

---

# Part A — Features

## A1. Hosted form page, public API, `embed.js`, public uploads, `Form.status`

**Bucket: Dead.** Respondents use the client's app, never `/r/<slug>`.

**Where it lives**
- Web: `apps/web/src/app/r/[slug]/page.tsx` (728 lines); `apps/web/public/embed.js` (105). `embed.js` is the abandoned iframe design: it builds `iframe.src = base + "/r/" + slug + "?embed=1"` (`embed.js:23-25`).
- Web client: `apps/web/src/lib/api.ts:532-544` (`trackEvent`), `:595-644` (`PublicForm`, `getPublicForm`, `submitResponse`, `savePartial`, `uploadFile`), `:383-391` (`updateForm`, no caller: see Part B1).
- Editor: the Share/embed dialog and "View live" (`editor.tsx:2577-2600` embed snippets, `:2832-2848` buttons, `:4088-4122` dialog); `status` state (`:1589`, `:1654`).
- My forms: the Live/Drafts filter and status chips, "Copy link" and "View live" (`app/(app)/app/page.tsx:44`, `:101`, `:166-167`, `:208-216`, `:430`, `:466-491`).
- API: `apps/api/src/forms/public.controller.ts` (46 lines: `GET :slug`, `POST :slug/responses`, `POST :slug/partial`, `POST :slug/events`); `apps/api/src/forms/uploads.controller.ts` (82 lines, `POST /v1/public/uploads`); `forms.service.ts:377-546` (public section), `:558-577` (Turnstile), `:40-52` (`withoutProvenance`, `escapeHtml`); `forms.controller.ts:42-49` (`PATCH /v1/forms/:id`, whose only use is setting `status`); static `/uploads` serving `main.ts:89-99`.
- form-schema: `validateSubmission` (`index.ts:1532-1548`) has no other caller; `withoutBuilderFields` and `STATIC_TYPES` become test-only or internal-only.
- Prisma: `Form.status`, enum `FormStatus` (`schema.prisma:21-25`, `:150`).
- Env: `TURNSTILE_SECRET` (API), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (web, `r/[slug]/page.tsx:19`). `PUBLIC_API_URL` then serves only CORS (`main.ts:30`).
- Deploy: `uploads` volume (`deploy/docker-compose.prod.yml:55`, `:77`), `DEPLOY.md:17`, `:46`, `:122`, `:141`; `next.config.mjs` headers that leave everything except `/app/*` frameable so `/r/*` can be embedded.
- Tracked stray files: `uploads/mrf6ej6m-4bpy6j.png`, `uploads/mrf6ej6w-uinf1k.png`, committed in `da69891` with the uploads controller and referenced by nothing (`grep -rn mrf6ej6 .` finds nothing outside `.git`).

**What feeds it data:** nothing in the builder can publish. `updateForm` has no caller in `apps/web` (grep of every `api.ts` export), so `status` can be set to `PUBLISHED` only by the admin console's "Restore (publish)" (`apps/admin/src/app/forms/page.tsx:36`), by `deploy/seed-demo.mjs`, or by calling `PATCH /v1/forms/:id` directly. The e2e suite does the last of these.

**Depends on it:** Responses, Analytics, automations, notifications, white-label, uploads (A2–A7, A12) are all fed only by the submit and events endpoints here. Admin moderation (A18) reads `status`.

**Removal size:** ~1,400 lines: 6 files deleted (`r/[slug]/page.tsx`, `embed.js`, `public.controller.ts`, `uploads.controller.ts`, the two PNGs), 9 edited (`forms.service.ts`, `forms.controller.ts`, `forms.module.ts`, `main.ts`, `lib/api.ts`, `editor.tsx`, `app/page.tsx`, `next.config.mjs`, `index.ts` in form-schema). One migration drops `Form.status` and `FormStatus`.

**Risk**
- **Live today:** `POST /v1/public/uploads` accepts anonymous 10 MB files with no form, no published check and no throttle (`uploads.controller.ts:44-81`; the throttler guards only `auth.controller.ts:8`). Anyone can store files on the server's disk and have them served from our API origin.
- Three e2e scripts publish a form and read `/v1/public/forms/:slug` to check that builder-only fields never reach respondents: `verify-scoring-api.js:247-251`, `verify-templates-api.js:281-283`, `verify-versions.js:133-140`. Those checks go with the endpoint. The artifact download covers the same rule.
- `Form.slug` stays useful: it names the download file (`forms.service.ts:245`). Decide whether to keep it as a file-name stem or switch to the title.
- `KNOWN-ISSUES.md` entries 2 and 4 describe this page and say to "revisit when … `/r/<slug>` come back into scope". They go with it.

## A2. Responses (including response search)

**Bucket: Dead.** Submissions never reach us.

**Where it lives:** page `app/(app)/app/forms/[id]/responses/page.tsx` (316); `GET /v1/forms/:id/responses` (`forms.controller.ts:73-80`, `forms.service.ts:248-258`); `search/search.service.ts` (119, Meilisearch or Postgres `ILIKE`); `listResponses` in `lib/api.ts:508-513`; editor link `editor.tsx:2817`; response counts and "Most responses" sort on My forms (`app/page.tsx:64`, `:106-107`, `:230`, `:457`) and in `forms.service.ts:78`. Prisma `Response` (`schema.prisma:216-231`). Env `MEILI_HOST`, `MEILI_KEY`.

**What feeds it data:** only `submit` and `savePartial` in `forms.service.ts:424-520` (A1).

**Depends on it:** AI insights (A10), retention (A4), admin counts (A18), My forms counts.

**Removal size:** ~600 lines, 2 files deleted (the responses page, `search.service.ts`) and 6 edited. Migration drops `Response`.

**Risk:** the delete-form dialog copy says "removes the form and all its responses" (`app/page.tsx:392`). Change it with the removal.

## A3. Analytics

**Bucket: Dead.**

**Where it lives:** page `forms/[id]/analytics/page.tsx` (241); `GET /v1/forms/:id/analytics` (`forms.controller.ts:82-85`, `forms.service.ts:312-375`); `POST /v1/public/forms/:slug/events` (`forms.service.ts:379-399`); `getAnalytics`, `trackEvent`, type `Analytics` in `lib/api.ts:515-544`; editor link `editor.tsx:2820`. Prisma `Event` (`schema.prisma:153-163`, migration `20260709141812_add_events`).

**What feeds it data:** only `trackEvent` from `/r/[slug]` and `seed-demo.mjs`.

**Removal size:** ~370 lines, 1 file deleted, 4 edited. Migration drops `Event`.

## A4. Response retention and "Purge now"

**Bucket: Dead.** It deletes `Response` rows only (`retention.service.ts:5-16`).

**Where it lives:** `settings/retention.service.ts` (46, a `setInterval` job started in `onModuleInit`, `:29-31`); `purgeNow` (`settings.service.ts:95-103`); `POST /v1/settings/org/purge`; the retention field and button in Settings → Data & privacy (`settings/page.tsx` ~255-330); `purgeResponses` in `lib/api.ts:217-221`. Prisma `Organization.retentionDays`.

**Removal size:** ~110 lines, 1 file deleted. Migration drops one column.

## A5. Automations and webhooks

**Bucket: Dead.** The only trigger is a new response (`Automation.trigger` defaults to `"new_response"` and is never set).

**Where it lives:** `automations/automations.controller.ts` (59) and `automations.service.ts` (243); per-form page `forms/[id]/integrations/page.tsx` (360); catalog `app/(app)/app/integrations/page.tsx` (128); "Integrations" in the sidebar (`app-shell.tsx:23`); editor link `editor.tsx:2823`; `lib/api.ts:546-593`; the `dispatch` call in `forms.service.ts:503-512`. Prisma `Automation` (`schema.prisma:165-178`, migration `20260709102434_add_automations`).

**What feeds it data:** `submit` (A1), plus the user-triggered `POST /v1/automations/:id/test`.

**Removal size:** ~850 lines, 4 files deleted, 4 edited. Migration drops `Automation`.

**Risk: SSRF, live today.**
- `assertUrl` accepts any `http(s)://` URL (`automations.service.ts:222-226`). `deliver` then `fetch`es it with no host or IP check, following redirects by default (`:134-142`). Loopback, private ranges, the compose hostnames (`db`, `api`) and the EC2 metadata address `169.254.169.254` are all reachable from the API container. `DEPLOY.md` describes a single EC2 host.
- `test` returns the target's HTTP status to the caller (`:111-120`) and `lastStatus` stores it, so it works as a probe: status code, `timeout` or `error` per URL.
- It needs no published form and no response: any signed-in user can do it, and signup is open (`POST /v1/auth/signup`).
- No role check: `create`, `update`, `remove` and `test` check only that the form belongs to the org (`:46-120`), never `assertCanEdit`, so a VIEWER can add and fire webhooks.
- Removing the feature removes the issue. If automations were ever kept, they would need an allow-list or IP check after DNS resolution, `redirect: "manual"`, and no status echo.

## A6. New-response notification emails (`settings.notifyEmails`)

**Bucket: Dead.**

**Where it lives:** `forms.service.ts:514-546` (`notifyNewResponse`); the notify field in the editor (`editor.tsx:3633-3656`); `FormSettings.notifyEmails` (`form-schema/src/index.ts:801`); `TEMPLATE_STRIPPED_SETTINGS` lists it (`templates.ts:69`). `MailService` stays: invites, verification and password reset use it (`auth.service.ts:128`, `:236`, `team.service.ts:124`).

**Removal size:** ~70 lines and one schema field.

**Risk:** live only while a form can be published (A1). Then any editor can set arbitrary addresses and anonymous submissions send email from our Resend account with submitter-controlled content (values are HTML-escaped, `forms.service.ts:46-52`, but the content is still arbitrary).

## A7. Hosted-only form settings: spam protection, partial submissions, redirect URL

**Bucket: Dead.** The renderer reads no `settings` key at all: searching `settings`, `submitLabel`, `redirectUrl`, `spamProtection`, `partialSubmissions`, `notifyEmails`, `theme` in `@zoworkhq/forms/dist/{core,react}/index.js` and `chunk-A5NHVY2N.js` finds 0 matches for each. The renderer does read the artifact's top-level `navigation` and `drafts` (both appear in `chunk-A5NHVY2N.js` and `react/index.js`), which stay.

**Where it lives:** editor settings `editor.tsx:3585-3632` (redirect URL, spam protection, partial submissions); `FormSettings` fields (`index.ts:794-799`); Turnstile check `forms.service.ts:461-463`, `:558-577`; partials `:424-444`.

**Removal size:** ~90 lines plus schema fields. The fields are still exported in the artifact today (`FormArtifact` merges `FormSchema` with `settings`, `index.ts:994`), so dropping them changes the artifact. That's harmless to the renderer, which ignores them, but update the contract if it names them. It doesn't today: `grep settings docs/*.md` finds nothing.

**Risk:** saved forms and templates may contain these keys. Decide whether the schema should strip them on parse or reject them.

## A8. Submit label and the Design panel (`settings.theme`)

**Bucket: Unclear role.** Same evidence as A7: the renderer doesn't read `settings.submitLabel` or `settings.theme`. It themes through host attributes instead (`data-zf-theme`, `data-zf-density`, `data-zf-group-style`, `data-zf-progress-style` in its README).

**Where it lives:** submit label `editor.tsx:3576-3584`; Design panel with colours, font, corners, width, live preview, logo, cover image, input styling and custom CSS, `editor.tsx:3812-3990` (~180 lines); `FormTheme`, `ResolvedTheme`, `resolveTheme` (`index.ts:780-870`), used only by the editor's preview and `/r/[slug]`; `TEMPLATE_STRIPPED_THEME_SETTINGS` (`templates.ts:70`).

**Decision:** will the renderer ever read builder-authored theme and submit label, or does the client style the form in their app? If the latter, this is dead.

**Removal size:** ~280 editor lines, ~80 form-schema lines and their tests. All 16 system templates carry `theme`, and one carries `submitLabel` (counted from `apps/api/prisma/templates/*.json`).

## A9. AI: Generate, Ask AI, Suggest logic, Translate

**Bucket: Out of scope by decision.** `KNOWN-ISSUES.md` entries 1 and 3 call these "out-of-scope files" and say to "revisit when AI features come back into scope". They still run and are reachable from the UI.

**Where it lives**
- API: `ai/ai.controller.ts` (71: `generate-form`, `edit-form`, `suggest-logic`, `translate-form`, and two response routes, A10), `ai/ai.service.ts` (555), `settings.service.ts:19-48` and `:116-150` (key, model, test call), `settings.controller.ts:11-27`.
- Web: "Generate with AI" on My forms (`app/page.tsx:79`, `:151-160`, `:185`, `:279-365`); Ask AI drawer (`editor.tsx:2524-2546`, `:3990-4087`, the button at `:2830`); AI tools in form settings (`editor.tsx:3767-3811`, handlers `:1754-1780`); Settings → "AI form generation" (`settings/page.tsx` ~101-250); `lib/api.ts:280-308`, `:468-506`.
- Prisma `Organization.anthropicApiKey`, `aiModel`. Env `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Dependency `@anthropic-ai/sdk` (`apps/api/package.json`).

**What feeds it data:** the author's prompt and the current schema. It doesn't need responses, so it could work under the SDK architecture.

**Risk: these features are broken against the current schema.**
- **Ask AI damages forms.** With a key configured, `editViaClaude` rebuilds the form from the model's flat block list. Ids are renumbered `b_0, b_1, …` (`ai.service.ts:261`), and the result is `FormSchema.parse({ title, description, blocks, settings })` (`:262-267`), so `navigation`, `drafts` and `templateRef` are dropped. The tool schema has no `blocks`, `enableWhen`, `scores` or `name` (`:208-235`), so groups, pages, conditions and scores can't survive. The editor applies the result in place (`editor.tsx:2531-2532`). The heuristic fallback keeps the rest of the form (`:326`).
- **Generate and Ask AI can emit `file`**, which the renderer rejects (A15): it's in both tool enums (`ai.service.ts:68-71`, `:216-219`).
- **Viewers can set the organisation's Anthropic key.** `SettingsService.update` has no `assertManager` (`settings.service.ts:33-48`; compare `updateOrg` at `:68`). Any member can also read the key hint.
- `edit-form`, `suggest-logic` and `translate-form` send the whole schema, but they get the 100 KB body limit, not the 10 MB save limit (`common/body-parsing.ts:11-15`). Large forms get a 413.

**Decision:** remove now, or keep them hidden until they're rebuilt for groups, pages, logic and scores? Keeping them as they are leaves Ask AI able to wipe a form's structure on one click and a Save.

**Removal size:** ~1,250 lines across 2 deleted API files, 6 edited files, 2 columns and 1 dependency.

## A10. AI response summary and Q&A ("AI insights")

**Bucket: Dead.** It reads Responses (`ai.controller.ts:39-61`), `summarizeResponses` and `answerCopilot` plus their heuristics in `ai.service.ts:362-413` and `:471-555`, and the panel on the Responses page. Remove it with A2 even if the rest of A9 stays.

## A11. Custom domains

**Bucket: Dead.** There are no hosted form pages to serve on a domain. It never routed anything even before: the web app has no `middleware.ts` and no host-based routing (`ls apps/web/src/middleware.ts` fails; grep of `hostname` in `apps/web/src` finds only the domains page). A verified domain only pointed at the same app.

**Where it lives:** `apps/api/src/domains/` (3 files, 230 lines); page `app/(app)/app/domains/page.tsx` (209); sidebar entry `app-shell.tsx:24`; `lib/api.ts:223-254`; `DomainsModule` in `app.module.ts`. Prisma `Domain` (migration `20260709202445_add_domains`). Env `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `DOMAIN_CNAME_TARGET`.

**Removal size:** ~480 lines, 4 files deleted, 3 edited. Migration drops `Domain`.

## A12. White-label

**Bucket: Dead.** `brandingHidden` is read only by `getPublicBySlug` to hide the `/r/` footer (`forms.service.ts:406`, `:419`; `r/[slug]/page.tsx:256`). The renderer shows no branding.

**Where it lives:** the Settings toggle (`settings/page.tsx:336-342`), `settings.service.ts:50-88` (part), `OrgSettings` in `lib/api.ts:203-207`. Prisma `Organization.brandingHidden`.

**Removal size:** ~25 lines and one column.

## A13. Data region

**Bucket: Dead.** `Organization.dataRegion` is stored and shown but nothing acts on it. `grep -rn dataRegion apps packages` finds only the settings controller, service, page and API type.

**Removal size:** ~30 lines and one column. After A4, A12 and A13, the whole "Data & privacy" section of Settings and `GET/PUT /v1/settings/org` are empty.

## A14. Billing leftovers

**Bucket: Dead, almost all gone.** Migration `20261007120000_remove_billing` dropped `plan`, `stripeCustomerId`, `stripeSubId`. `grep -riE 'stripe|billing|pricing|plan'` over `apps/*/src`, `packages/*/src`, `deploy`, `.github` finds no billing code. The words `plan` and `plan.` in `save-template-dialog.tsx` and the templates page are an unrelated variable.

What's left:
- `e2e/verify-body-limits.js:55-58` asserts `/v1/billing` and `/v1/billing/webhook` return 404. Harmless; drop it when convenient.
- Marketing copy "Free forever · Unlimited forms & responses" (`(marketing)/page.tsx:26`, `:457`; `app/layout.tsx:19`, `:23`), under A17.
- `PROGRESS.md:70` records the removal. The prototype and blueprint (A16) have pricing screens.

Nothing is plan-gated any more, including custom domains and white-label.

## A15. Block types the renderer doesn't support

**Bucket: Dead** for `signature` and `recaptcha`; **Unclear role** for `file` and `embed`.

**Evidence.** Renderer 0.25.0 knows 29 types: 18 answerable, 9 presentational and 2 containers (`KNOWN_TYPES` in `@zoworkhq/forms/dist/chunk-A5NHVY2N.js:124-165`). Its schema check throws `Block "<id>" has unknown type "<type>".` for anything else (`:1150-1151`), so one such block stops the whole form rendering. The builder's `BlockType` has 33 (`form-schema/src/index.ts:28-64`). The four extras:

| Type | In the insert menu | Other ways in | In system templates |
|---|---|---|---|
| `file` | yes (`editor.tsx:239`) | AI generate and Ask AI enums (`ai.service.ts:68-71`, `:216-219`) | `form-bug.json:48`, `form-job.json:30` |
| `embed` | yes (`editor.tsx:268`) | — | — |
| `signature` | no | the save API accepts it | — |
| `recaptcha` | no | the save API accepts it | — |

Nothing in the editor, the save rules or `buildArtifact` (`index.ts:1066-1088`) warns about or refuses these types. **So today a form made from the "Bug report" or "Job application" system template downloads an artifact the renderer refuses to mount.**

**Where it lives:** the enum and `BLOCK_META`; `STATIC_TYPES` (`embed`, `recaptcha`, `index.ts:1310-1321`); canvas previews (`canvas-preview.tsx:78`, `:90`, `:161`, `:285`); `/r/[slug]` branches (`:413`, `:608`, removed with A1); embed URL handling in the inspector (`editor.tsx:3313-3340`) and `index.ts:1436`.

**Decision:** for `file` and `embed`, either add them to the renderer (file needs an upload story in the client's app, since uploads can't come to us) or remove them from the builder. Until then, at least a save or download rule that names the unsupported block. `signature` and `recaptcha` have no menu entry and can go.

**Removal size:** ~150 lines plus tests; 2 template JSONs edited.

## A16. Prototype and blueprint pages

**Bucket: Dead.** These are research artefacts, not the iframe design. That was `embed.js` (A1).

**Correction to the brief.** `apps/web/public/mockup.html` and `frame-prototype.html` are byte-identical copies (`cmp` reports no difference) of the original 15-screen clickable Frame prototype, added in `ac8ff0b` "Add Tally teardown blueprint, Markdown report, and Frame clickable prototype". The same is true of `apps/web/public/docs.html` and `blueprint.html`, the Tally teardown report, with `BLUEPRINT.md` as its Markdown version.

| File | Lines | Served at | Linked from |
|---|---|---|---|
| `apps/web/public/mockup.html` | 7,177 | `/mockup` via `app/mockup/page.tsx` + `components/embed-frame.tsx` | nothing (grep of `href` in `apps/web/src`) |
| `frame-prototype.html` (root) | 7,177 | — | `GETTING-STARTED.md:52`, `packages/ui/preset.ts:118` (comment) |
| `apps/web/public/docs.html` | 2,976 | `/docs` via `app/docs/page.tsx` | nothing |
| `blueprint.html` (root) | 2,976 | — | `PROGRESS.md:8`, `GETTING-STARTED.md:50` |
| `BLUEPRINT.md` | 2,397 | — | `README.md` |

**Removal size:** ~22,800 lines: 5 static files, 2 route pages and `embed-frame.tsx` (35 lines, used only by those two pages).

**Decision:** archive them outside the repo, or delete? They're history, but they describe the hosted product.

## A17. Marketing site

**Bucket: Unclear role.** It works, but its copy sells the hosted product: "publish, and collect answers", "Unlimited forms & responses", and integrations and security sections.

**Where it lives:** `app/(marketing)/page.tsx` (468), `(marketing)/layout.tsx` (16), `components/marketing/nav.tsx` (147), `footer.tsx` (125), `motion.tsx` (110), `faq.tsx` (36, imported by nothing: Part B1), `logo.tsx` (32); root metadata in `app/layout.tsx:19-23`; `apps/web/e2e/marketing.spec.ts` (22).

**Decision:** what should `/` be for a builder used by clients? A sign-in redirect, a short product page, or the client's docs?

**Risk:**
- `Logo` is imported by 5 auth pages (`auth-form.tsx:9`, `forgot-password`, `invite/[token]`, `reset-password/[token]`, `verify-email/[token]`). Move it, don't delete it.
- `marketing.spec.ts` is the only test the CI E2E job runs (`.github/workflows/ci.yml:77`, `pnpm --filter web test:e2e`). Removing the page leaves that job with nothing to run.

## A18. Admin console: form moderation and response counts

**Bucket: Dead.** "Take down" or "Restore (publish)" flips `status` between `CLOSED` and `PUBLISHED` (`apps/admin/src/app/forms/page.tsx:34-36`, `:101-127`; `admin.service.ts:265-276`; `PATCH /v1/admin/forms/:id`). With no hosted pages there's nothing to take down. The overview's "published" and "responses" totals (`admin.service.ts:19-25`) and the per-form and per-tenant response counts (`:115-139`, `:250-260`) read A1 and A2 data.

**Removal size:** ~80 lines. The admin forms list itself (search, delete) can stay.

## A19. Admin console core

**Bucket: In use**, for running the hosted builder: tenants (suspend), users (suspend, delete, impersonate via `/impersonate` in the web app), audit log. API `admin/*` (464 lines), app `apps/admin`.

## A20. Builder preview versus the renderer

**Bucket: In use.** The builder doesn't use the renderer. `@zoworkhq/forms` isn't a dependency of any workspace here (`apps/*/package.json`, `packages/*/package.json`). It's a private package (`"private": true`) that the test app installs from a tarball (`external-test-app/package.json:15`, `file:zoworkhq-forms-0.25.0.tgz`).

The canvas uses its own stand-ins: `BlockPreview` (`canvas-preview.tsx:94`), `GridPreview` and `GridCellPreview` (`:305-333`), and `StaticCanvas` (`:467`), which the template preview reuses (`templates/template-preview.tsx:6`). The comments state the intent to match the renderer: "These show what the renderer shows" (`canvas-preview.tsx:98`), and contract §9–§11 and §14.5 are cited at `:106`, `:138`, `:146`, `:304`, `:328`.

**Decision:** keep hand-made stand-ins (517 lines that must track every renderer change), or render the real form in the preview? The latter needs the package installable in this repo (a registry or a workspace link) and is new work, not removal.

## A21. Builder core

**Bucket: In use.** Auth (email and password, Google, email verification, password reset), team and invites, forms CRUD, schema save with all save rules, append-only versions and restore, artifact download, templates (system and organisation), the settings-pane width preference, health. `MailService` serves auth and invites. `Workspace` scopes forms (`Form.workspaceId`), though its `name` is never read (Part B3).

## A22. Demo seed

**Bucket: Dead.** `deploy/seed-demo.mjs` (81 lines) exists "so every dashboard, chart, search, and AI panel is populated for a demo" (`:1-2`). It publishes forms (`PATCH /v1/forms/:id`), posts events and submits responses through the public API. Nothing references it except its own usage comment (`grep -rn seed-demo`).

---

# Part B — Code

## B1. Unused files, exports and dependencies (knip)

**Method.** `npx --yes knip@5` was run with a config kept in the session scratchpad. No file was added to the repo and nothing was added to `package.json`. Entry points:

- `apps/web`, `apps/admin`: `src/app/**/{page,layout,error,global-error,not-found}.tsx`, `next.config.mjs`; plus Playwright specs and config and Vitest tests in `apps/web`.
- `apps/api`: `src/main.ts` (Nest bootstrap; modules, controllers and providers are reached through `app.module.ts` imports), `src/templates/seed-cli.ts` (`seed:templates` script).
- `packages/form-schema`, `packages/ui`: package entries plus `**/*.test.ts`.
- Root: `e2e/*.js`, `deploy/*.mjs`.

**The `dist` trap.** `@formbuilder/form-schema` has `"main": "dist/index.js"`, which the API and web resolve. Its `tsconfig.json` has `outDir: dist` and `rootDir: src`, and with the package's `src/index.ts` and `src/formula.ts` as entries, knip reported no form-schema source file as unused in any pass. So the false positive the brief warned about didn't appear. To check form-schema's exports as well, a third pass removed it as an entry, excluded tests, and used `--include-entry-exports`.

**Confirmed findings** (each checked with `grep -rlw <name>` over `apps packages e2e deploy`, excluding `node_modules`, `.next`, `dist`, `e2e/output`):

| Finding | Evidence | Feature |
|---|---|---|
| Unused file `apps/web/src/components/marketing/faq.tsx` (36) | no import anywhere | A17 |
| Unused function `updateForm` (`apps/web/src/lib/api.ts:383-391`) | no caller in `apps/web`; it's the only client for `PATCH /v1/forms/:id` | A1 |
| Unused types `DomainList`, `UploadedFile`, `FormDetail`, `User` (`lib/api.ts`) | no importer | A11, A1, — |
| Unused dependency `@dnd-kit/utilities` (`apps/web/package.json`) | no import in `apps/web/src`; `@dnd-kit/sortable` brings its own | — |
| Unused devDependency `@types/bcryptjs` (`apps/api/package.json`) | `bcryptjs` 3 ships its own types (`node_modules/bcryptjs/index.d.ts`, `umd/index.d.ts`) | — |
| Unused devDependency `prettier` (root `package.json:20`) | no script, CI step or config file runs it (`grep prettier package.json .github turbo.json`; no `.prettierrc*`). Editors may still use it, so check first. | — |
| Unused exports `DispatchField`, `DispatchPayload` (`automations.service.ts:18-28`) | only used in that file | A5 |
| Unused exports in `packages/ui`: `Badge` (`badge.tsx`, 18), `Card` (`card.tsx`, 17), `cn`, `buttonVariants` | the apps import only `Button`, `Input` and `@formbuilder/ui/preset` | — |
| Unused e2e helper export `code` (`e2e/_setup.js:74`) | no `verify-*.js` destructures it | — |

**Exported but used only in their own file.** Drop the `export`, keep the code:

- `apps/web`: `LogoMark` (`marketing/logo.tsx:3`), `FORMULA_HINT` (`scores-panel.tsx:19`), `TemplatePreview` (`template-preview.tsx:10`), `getToken`, `API_URL` (`lib/api.ts`); types `SettingsPane`, `Projection`, `Me`, `MeState`.
- `apps/admin`: `API_URL` (`lib/api.ts:1`).
- `apps/api`: types `Env`, `MailMessage`, `SkippedFile`, `TemplateScope`.
- `e2e/_setup.js`: `chromium`, used by `launchBrowser` in the same file.
- `packages/form-schema`, 36 names, all used inside their own file (each appears 2–16 times there and nowhere else): `index.ts` `PRESENTATIONAL_TYPES`, `QuestionType`, `FormTheme`, `ProgressStyle`, `Drafts`, `logicProblem`, `conditionIdProblems`, `DEFAULT_GROUP_LABEL`, `SOURCE_OPERATORS`, `optionLists` and types `PresentationalType`, `ChoiceGridColumn`, `BlockInput`, `ConditionIdFiller`, `NamedNode`, `RepeatSetting`; `formula.ts` `foldFormula`, `FormulaParse`; `preferences.ts` `SETTINGS_PANE_MIN_WIDTH`, `SETTINGS_PANE_MAX_SHARE`, `STORED_PANE_WIDTH_MIN`, `PreferencesPatch`; `scoring.ts` `SCORABLE_TYPES`, `canTypeBeScored`, `canBeScored`, `inScoreReach`, `scoreUses`, `ScoreUse`; `templates.ts` `TEMPLATE_STRIPPED_SETTINGS`, `TEMPLATE_STRIPPED_THEME_SETTINGS`, `OutsideCondition`, `RewrittenLogic`; `logic.ts` `NumberedNode`, `NumberedItem`, `LogicParse`, `ArtifactLogic`. Low value. Some may be meant as shared vocabulary with the renderer, so treat this as optional tidying.

**Rejected as false positives**

| Knip said | Why it's wrong |
|---|---|
| Unlisted dependency `postcss-load-config` in `apps/web/postcss.config.mjs` and `apps/admin/postcss.config.mjs` | only a JSDoc type, `/** @type {import('postcss-load-config').Config} */` (`postcss.config.mjs:6`); nothing is imported at runtime |
| `_BlockShapesMatch` (`form-schema/src/index.ts`) | a compile-time type assertion, used once by design |

**Becomes unused after Part A removals:** `validateSubmission` (A1, then test-only), `withoutBuilderFields` (A1, then used only by `scoring.test.ts`), `resolveTheme`, `ResolvedTheme`, `FormTheme` (A1 plus A8), `optionsFromLabels` (A9, then test-only), `@anthropic-ai/sdk` (A9), `multer`, `@types/multer` (A1).

## B2. API routes and their callers

74 routes. "Web" means `apps/web/src`, "Admin" means `apps/admin/src`, "e2e" means `e2e/*.js` and `apps/web/e2e`, "Ext." means outside callers (the hosted page's visitors, `embed.js` hosts, `seed-demo.mjs`). Every route has at least one caller. Routes whose only callers are dead features are marked.

| Route | Web | Admin | e2e | Ext. | Feature |
|---|---|---|---|---|---|
| `GET /health` | | | ✓ | Docker, deploy | A21 |
| `POST /v1/auth/signup`, `login` | ✓ | login | ✓ | seed-demo | A21 |
| `POST /v1/auth/google`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification` | ✓ | | | | A21 |
| `GET /v1/auth/me` | ✓ | | ✓ | | A21 |
| `PATCH /v1/auth/me/preferences` | ✓ | | ✓ | | A21 |
| `GET/POST /v1/forms` | ✓ | | ✓ | seed-demo | A21 |
| `GET/DELETE /v1/forms/:id` | ✓ | | ✓ | | A21 |
| `PATCH /v1/forms/:id` | — | | ✓ (status only) | seed-demo | **A1 only** |
| `PUT /v1/forms/:id/schema` | ✓ | | ✓ | seed-demo | A21 |
| `GET /v1/forms/:id/artifact` | ✓ | | ✓ | | A21 |
| `GET /v1/forms/:id/versions`, `POST …/versions/:versionId/restore` | ✓ | | ✓ | | A21 |
| `POST /v1/forms/:id/duplicate` | ✓ | | | | A21 |
| `GET /v1/forms/:id/responses` | ✓ | | | | **A2** |
| `GET /v1/forms/:id/analytics` | ✓ | | | | **A3** |
| `GET /v1/public/forms/:slug` | `/r` | | ✓ | visitors | **A1** |
| `POST /v1/public/forms/:slug/responses` | `/r` | | | visitors, seed-demo | **A1** |
| `POST /v1/public/forms/:slug/partial` | `/r` | | | visitors | **A1, A7** |
| `POST /v1/public/forms/:slug/events` | `/r` | | | visitors, seed-demo | **A3** |
| `POST /v1/public/uploads` | `/r` | | | anyone | **A1** |
| `GET/POST /v1/forms/:formId/automations`; `PATCH/DELETE /v1/automations/:id`; `POST /v1/automations/:id/test` | ✓ | | | | **A5** |
| `POST /v1/ai/generate-form`, `edit-form`, `suggest-logic`, `translate-form` | ✓ | | | | **A9** |
| `POST /v1/ai/summarize-responses`, `responses-copilot` | ✓ | | | | **A10** |
| `GET/PUT /v1/settings`, `POST /v1/settings/test-ai` | ✓ | | | | **A9** |
| `GET/PUT /v1/settings/org` | ✓ | | | | **A4, A12, A13** |
| `POST /v1/settings/org/purge` | ✓ | | | | **A4** |
| `GET/POST /v1/domains`, `POST /v1/domains/:id/verify`, `DELETE /v1/domains/:id` | ✓ | | | | **A11** |
| `GET/PATCH/DELETE /v1/team/members[/:userId]`, `GET/POST/DELETE /v1/team/invites[/:id]` | ✓ | | ✓ (POST invites) | | A21 |
| `GET /v1/invites/:token`, `POST …/accept` | ✓ | | ✓ (accept) | | A21 |
| `GET/POST /v1/templates`, `GET/PATCH/DELETE /v1/templates/:id`, `POST …/duplicate` | ✓ | | ✓ | | A21 |
| `GET /v1/admin/overview`, `orgs`, `orgs/:id`, `users`, `audit`; `PATCH orgs/:id`, `users/:id`; `DELETE users/:id`; `POST users/:id/impersonate` | | ✓ | | | A19 |
| `GET /v1/admin/forms`, `DELETE /v1/admin/forms/:id` | | ✓ | | | A19 |
| `PATCH /v1/admin/forms/:id` (status) | | ✓ | | | **A18** |

Searches: route decorators from `grep -nE "@(Controller|Get|Post|Put|Patch|Delete)\(" apps/api/src/*/*.controller.ts`; web callers by mapping each `apps/web/src/lib/api.ts` export to its importers; admin from `apps/admin/src/lib/api.ts`; e2e from `grep -rhoE '/v1/[^"\`]+' e2e/*.js` with methods.

## B3. Prisma models and columns

**Whole models fed only by dead features:** `Response` (A2), `Event` (A3), `Automation` (A5), `Domain` (A11).

**Columns fed only by dead features:** `Form.status` and enum `FormStatus` (A1); `Organization.retentionDays` (A4), `brandingHidden` (A12), `dataRegion` (A13), `anthropicApiKey`, `aiModel` (A9).

**Never read or written outside migrations, or written but never read** (grep of each column name over `apps/api/src`, `apps/web/src`, `apps/admin/src`, `e2e`, `deploy`):

| Column | Status | Evidence |
|---|---|---|
| `Response.meta` | never written or read (the `meta` matches are `AuditLog.meta`) | `admin.service.ts:297-307`, `audit/page.tsx:26` are AuditLog |
| `Response.completedAt` | written, never read | `forms.service.ts:483`, `:491` only |
| `Automation.trigger` | never written (default only); read only into a web type | `lib/api.ts:552`; the other matches are help text |
| `Invite.invitedById` | written, never read | `team.service.ts:114-115` only |
| `Template.createdBy` | written, read only by an e2e check | `templates.service.ts:107`, `:162`; `verify-templates-api.js:92` |
| `Workspace.name` | written once (`"My Workspace"`, `auth.service.ts:64`), never read | the sidebar shows the user's name instead (`app-shell.tsx:77-78`), on a switcher button with no handler (`:72`) |

The first four go with their models. `invitedById`, `createdBy` and `Workspace.name` are cheap to keep for audit or future use. Decide, but there's no urgency.

**Migrations.** The 15 existing migrations stay as history. Each Part A brief adds one forward migration that drops what it removed. No client data exists, so dropping loses only dev and demo rows.

## B4. Environment variables

**Read by nothing:** none. Every variable in `apps/api/.env.example`, `apps/web/.env.local.example`, `apps/admin/.env.local.example` and `deploy/.env.prod.example` has a reader (`grep -rnoE 'process\.env\.[A-Z_]+'` and `env\.[A-Z_]+` against `apps/api/src/config/env.ts`).

**Read only by dead features** (they go with them): `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (A1, A7); `MEILI_HOST`, `MEILI_KEY` (A2); `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `DOMAIN_CNAME_TARGET` (A11); `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (A9); `SEED_API`, `SEED_EMAIL`, `SEED_PASSWORD` (A22). `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was never passed to the web image either (`apps/web/Dockerfile:23-26`, `deploy.yml:55-58`), so the Turnstile widget never rendered in a deployed build.

**Read but missing from an `.env.example`:**

| Variable | Read at | Missing from | Survives clean-up? |
|---|---|---|---|
| `PUBLIC_TENANT_URL` | `env.ts`, invite/verify/reset links | `apps/api/.env.example` | yes |
| `GOOGLE_CLIENT_ID` | `auth.service.ts` | `apps/api/.env.example` | yes |
| `RESEND_API_KEY`, `MAIL_FROM` | `mail.service.ts` | `apps/api/.env.example` | yes |
| `CORS_ORIGINS` | `main.ts:31` | `apps/api/.env.example`, `deploy/.env.prod.example` (but `docker-compose.prod.yml:38` passes it) | yes |
| `NODE_ENV` | `env.ts` | `apps/api/.env.example` | yes (has a default) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `lib/api.ts:92` | `apps/web/.env.local.example` | yes |
| `TURNSTILE_SECRET`, `MEILI_*`, `CLOUDFLARE_*`, `DOMAIN_CNAME_TARGET` | see above | `apps/api/.env.example` | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `r/[slug]/page.tsx:19` | every example | no |

The e2e variables (`E2E_*`, `CI`) are documented in `e2e/README.md` and the Playwright config, not in `.env` files. That's fine.

## B5. Other leftovers

**`public/` assets:** `mockup.html`, `docs.html` (A16), `embed.js` (A1). Nothing else is in `apps/web/public`. `apps/admin/public` holds only `.gitkeep`.

**Tracked files that shouldn't be:**
- `uploads/*.png` (2 files, A1).
- `apps/web/tsconfig.tsbuildinfo`, `apps/admin/tsconfig.tsbuildinfo`: TypeScript incremental caches, tracked, not in `.gitignore`.

**npm scripts**
- Root `lint` and `pnpm --filter web|admin lint` run `next lint`, but no ESLint package or config exists (no `.eslintrc*` or `eslint.config.*`; no `eslint` in `node_modules/.pnpm`). The script can't work and CI doesn't run it (`ci.yml:35-47`). Remove it, or set up ESLint.
- Root `test:e2e` runs only `marketing.spec.ts` (A17). The real suite is `node e2e/run-all.js`, which has no npm script.
- `seed:templates` (`apps/api`) works, and the seeder also runs on boot (`templates.seeder.ts:16`).

**Docker:** the `redis` service in `docker-compose.yml:13-17` is read by nothing (`grep -rn redis apps packages` finds only `docs.html`). `README.md` and `GETTING-STARTED.md` say it's "provisioned for future use" ("future" meaning BullMQ, `PROGRESS.md:95`).

**e2e helpers and fixtures:** `run-all.js` discovers every `verify-*.js` by directory listing (`run-all.js:9`), and every script is in `e2e/README.md`. There are no orphan scripts and no fixture files. Edits needed with A1: the three publish checks (A1 risk). With A14: the billing 404 check. Unused helper export: `code` (B1).

**Unused UI:** the sidebar's workspace switcher is a button with no `onClick` (`app-shell.tsx:72-82`).

**Docs that describe the superseded hosted design**

No `CLAUDE.md` exists in the repo (`find . -name CLAUDE.md -not -path '*/node_modules/*'` finds nothing). The only agent file is `.claude/agents/form-block-builder.md`, which is gitignored and already describes the SDK architecture. No file mentions "Option 4" (`grep -rniE 'option 4|option four'`; the only hits are the e2e placeholder text "Option 4"), and `D:/ZoworkProjects/Architectural-Options.docx` describes Options 1 and 2 only, so this report can't tell which document Option 4 refers to. These docs describe the hosted product rather than the SDK architecture:

| Doc | What's out of date |
|---|---|
| `README.md` | the opening ("publish them, embed them anywhere, and collect and analyze responses"); "Public runtime", "Responses & analytics", embeds and webhooks; the `/r/:slug` URL; "The API owns … submissions, uploads, AI, webhooks, analytics"; no mention of `@zoworkhq/forms` or the artifact download |
| `PROGRESS.md` | last updated 2026-07-10; Phase 1–4 list the hosted features as the product; nothing on groups, pages, logic, scoring, templates or the renderer |
| `GETTING-STARTED.md` | the walking skeleton; next steps "Public runtime" and "Submit"; Redis |
| `DEPLOY.md` | "tenant app + public forms" (`:46`, `:122`); uploads volume (`:17`, `:141`) |
| `BLUEPRINT.md`, `blueprint.html`, `frame-prototype.html` | the Tally teardown and the prototype (A16) |
| `apps/api/prisma/schema.prisma:1-2` | "the six core tables for the walking skeleton … Grow this from tally-teardown.html §11", a file that doesn't exist |
| `KNOWN-ISSUES.md` entries 1–4 | frame the hosted page, Responses and AI as temporarily "out of scope", to "revisit"; they go with A1, A2, A9 |
| `apps/web/next.config.mjs:5-7`, `:25-26` | comments and headers built around embedding `/r/*` |

`docs/GROUPS-AND-PAGES-CONTRACT.md`, `docs/DRAFTS-CONTRACT.md` and `e2e/README.md` match the current architecture.

---

## Appendix: searches run

All searches excluded `.git`, `node_modules`, `.next`, `dist` and `e2e/output`.

- Routes: `grep -nE "@(Controller|Get|Post|Put|Patch|Delete)\(" apps/api/src/*/*.controller.ts`
- Web callers: for each `export` in `apps/web/src/lib/api.ts`, `grep -rlw <name> apps/web/src` without `lib/api.ts`
- e2e callers: `grep -rhoE 'call\("(GET|POST|PUT|PATCH|DELETE)", *[^,]+' e2e/*.js` and `grep -rhoE 'fetch\(…/v1/…' e2e/*.js`
- Status writers: `grep -rnE 'PUBLISHED|CLOSED|status' apps/api/src/forms apps/api/src/admin apps/admin/src deploy e2e`
- Renderer types: `KNOWN_TYPES` and the `unknown type` throw in `external-test-app/node_modules/@zoworkhq/forms/dist/chunk-A5NHVY2N.js`; `settings` and each settings key counted in `dist/core/index.js`, `dist/react/index.js`, the chunk
- Unsupported types in templates: `grep -lE '"type": *"(signature|recaptcha|embed|file)"' apps/api/prisma/templates/*.json`
- Duplicates: `cmp apps/web/public/mockup.html frame-prototype.html`; `cmp apps/web/public/docs.html blueprint.html`
- Billing: `grep -rniE 'stripe|billing|pricing|\bplans?\b|upgrade' apps/*/src packages/*/src e2e deploy .github`
- Env: `grep -rnoE 'process\.env(\.[A-Z_0-9]+|\[…\])'` and `grep -rnoE '\benv\.[A-Z_]+' apps/api/src`, compared with the four `.env` examples, `docker-compose*.yml`, Dockerfiles and workflows
- Columns: `grep -rnw <column> apps/*/src e2e deploy` for each column in B3
- knip: `npx --yes knip@5 --config <scratchpad>/knip.json --reporter compact`, then the same with form-schema as a non-entry and `--include-entry-exports --include exports,types`
