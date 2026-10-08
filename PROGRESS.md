# Frame — Project Progress

A living checklist of work on the Frame form-builder project. Updated as tasks complete.

_Last updated: 2026-07-10_

## ✅ Completed
- [x] Product & engineering blueprint — 18 sections (`blueprint.html`, `BLUEPRINT.md`)
- [x] AWS infrastructure cost analysis section added to the report
- [x] Capacity planning & scaling-design section added to the report
- [x] Clickable prototype — 15 screens (`frame-prototype.html`)
- [x] Monorepo scaffold: Next.js `web` + NestJS `api` + `form-schema` (walking skeleton verified end-to-end)
- [x] Marketing site — landing page; dashboard moved to `/app`
- [x] Docs & mockup embedded in the app — `/docs`, `/mockup`
- [x] Mockup typography upgrade — Hanken Grotesk across all 15 screens
- [x] Deep-polished the form builder — cover-gradient depth + firmer title weight
- [x] Polished data screens — removed the perpetual card-thumbnail **shimmer** on the dashboard (was reading as "stuck loading"); responses & analytics verified clean and lifted by the type upgrade

## 🚧 In progress
- _(nothing in flight)_

## 🚀 CI/CD & deployment (single-EC2, dev)
- [x] **CI** (`.github/workflows/ci.yml`) — pnpm install (cached) → `prisma validate` → `turbo typecheck` → `turbo build`, on PR + push to main
- [x] `typecheck` scripts across web/admin/api/form-schema + Turbo task; Next `output: "standalone"` on web & admin
- [x] **Dockerfiles** — multi-stage, pnpm-monorepo-aware images for web/admin (Next standalone) + api (NestJS + Prisma); `.dockerignore`. All three build clean.
- [x] **CD** (`.github/workflows/deploy.yml`) — build 3 images → push GHCR (tagged `latest` + SHA) → scp compose + SSH `docker compose up -d` to EC2
- [x] **Single-box compose** (`deploy/docker-compose.prod.yml`) — Postgres + api + web + admin, persistent `pgdata`/`uploads` volumes, DB healthcheck gate, `prisma migrate deploy` on api boot
- [x] **Runbook** (`DEPLOY.md`) + `deploy/.env.prod.example` — EC2/security-group/GHCR/secrets setup
- [x] Verified locally: full stack up → 5 migrations applied on boot → API `/health` ok, web + admin HTTP 200
- [x] **Automated tests in CI** — `Unit tests` step (Vitest) in the build job + a separate **E2E (Playwright)** job (installs chromium, boots web, runs smoke specs)
- [ ] Follow-ups: swap local-disk uploads → S3; optional Caddy + domain/HTTPS

## 🛡️ Admin console (`apps/admin`, port 3002)
- [x] Platform data model — User.isAdmin/status, Organization.status, AuditLog
- [x] AdminModule (API) — AdminGuard (isAdmin), overview, tenants (list/detail/suspend), users (list/suspend/impersonate/delete), cross-tenant form moderation (take-down/delete), audit log; every mutation audited
- [x] Impersonation — admin issues a 1h token → tenant app /impersonate stores it and enters the app as that user (support login-as)
- [x] Admin app — separate Next.js app: login (admin-only gate), Overview (metrics/signup-trend), Tenants + tenant detail, Users, Forms, Audit log; shares the Frame design system

## 🎨 Design system / app shell
- [x] Enterprise app shell — persistent sidebar (workspace switcher, nav with active states, user menu) + topbar; applied to dashboard / templates / integrations / settings (editor stays full-screen)
- [x] Dashboard redesign — search + status filter + sort, refined form cards (status dot, responses, edited-time), hover micro-interactions, kebab menu (edit / copy link / duplicate / delete), skeleton loading, delete-confirm dialog (DELETE /v1/forms/:id)

---

# Development Plan (phases)

Building the real Frame product. `[x]` = done, `[~]` = partial. Phase 1 is the launchable MVP.

## Phase 0 — Foundations  _(mostly done)_
- [x] Turborepo monorepo (web + api + form-schema)
- [x] Prisma schema — 6 core tables; local Postgres; walking skeleton verified
- [x] `packages/ui` — shared design system: Tailwind **preset** (tokens: colors/radii/shadows/font) + component-class **plugin** (`.btn`/`.input`/`.eyebrow`/`.card-mkt`) + shadcn-style React components (`Button`/`Input`/`Badge`/`Card` via `cva` + `cn`); web & admin both consume it (tokens no longer duplicated); auth form migrated onto `<Button>`/`<Input>`
- [x] Auth: email + password — JWT + bcrypt in the API; login/signup/logout + auth-gate in web _(SSO/magic-link later)_
- [x] Multi-tenancy: org / workspace / membership + org-scoped queries on every form route (tenant isolation verified)
- [x] Baseline: **env/secrets** (zod-validated `env`, fail-fast at boot, prod placeholder-secret guard) · **error handling** (Nest `AllExceptionsFilter` → consistent JSON; web+admin `error`/`not-found`/`global-error` boundaries) · **logging** (Nest `LoggingInterceptor`, one line per request) · **CI test step** · **Vitest** (form-schema + ui, 19 tests) + **Playwright** (web smoke)
- [x] Align marketing site typography to Hanken — web already on Hanken; admin brought onto the same next/font setup and the family centralized in the shared preset (`font-sans`), so web ↔ admin ↔ mockup now match

## Phase 1 — MVP (the core loop, launchable)
Critical path: **Editor → Runtime → Submit → Responses.**
- [x] Form editor (React): palette, canvas, reorder (▲▼; drag next), inspector → writes blocks to `FormVersion.schema`
- [x] Core blocks: short/long, choice, checkbox, dropdown, number, email, phone, date, rating, file
- [x] Autosave (debounced) + schema persisted to the latest version
- [x] Publish flow: status, slug, share link (copy-link + view-live)
- [x] Public runtime `/r/[slug]`: render from JSONB, client validation, mobile, thank-you
- [x] Submit endpoint: unauth → validate (required) → store Response  _(files = filename for now)_
- [x] Dashboard on real data: create → opens editor; status + live link
- [x] Drag-drop reorder (dnd-kit) · file uploads _(local-disk driver; S3/R2 swap seam)_ · redirect-on-completion + custom submit label
- [x] Responses dashboard: table (labels as columns) + detail drawer + CSV export
- [x] Email notification on new response (Resend) — shared `MailService` (graceful no-op without key) powering per-form notify list, plus invite & email-verification emails; per-form notification emails configured in the editor
- Billing — removed (7 Oct 2026): the product doesn't charge. No Stripe, no plans and no plan gating; every organisation has unlimited forms, custom domains and white-label.
- [ ] Deploy MVP: Vercel (web) + API host (Fly/Render) + Neon Postgres + staging

## Phase 2 — V2 (usability & collaboration)
- [ ] Conditional logic engine (show / hide / jump) + calculations
- [ ] Advanced blocks: signature, matrix, ranking, hidden fields, answer piping, URL pre-fill
- [x] Theme / design customization with live preview
- [x] Customize panel — accent/background/text/button-text colors (swatch + picker), font (sans/serif/mono/rounded), corners (none→pill), width; luminance-aware runtime (adaptive dark surface, capped card radius)
- [x] Workspace Settings + Claude API key (real AI generation; per-workspace key, Test connection); AI generate falls back to heuristic without a key
- [x] Conversational "Ask AI" editor — in-editor chat drawer that edits the live form (POST /v1/ai/edit-form: Claude when keyed, heuristic add/remove/required otherwise); applies + autosaves
- [x] Notion-style slash (/) block inserter replacing the left palette — searchable, grouped catalog (Questions/Layout/Embed/Advanced), 33 block types; inserts after the selected block
- [x] Expanded block catalog: multi-select, link, time, linear scale, ranking, matrix, headings H1–H3, text, divider, title, label, image/video/audio/embed, country + signature/hidden/reCAPTCHA (basic); runtime + validation + inspector controls for all
- [x] Analytics: views, starts, completion rate, funnel (views→starts→submissions), 14-day daily trend, device & source breakdown (Event model + public /events tracking on the runtime + /forms/:id/analytics + dashboard page)
- [x] Advanced customization: logo, cover image, per-input styling (bg/border), custom CSS injection (scoped .frame-form)
- [x] Embeds (inline / popup / full-page) + `embed.js` (auto-resize) + editor Embed modal
- [x] Integrations: webhooks + **Slack** (formatted message), **Google Sheets** (Apps Script row), **Zapier / Make** (catch hooks) — per-destination delivery formatting on the Automation model; destination picker + per-type setup help on the Connect page; verified end-to-end
- [x] Templates gallery — redesigned to match the prototype: featured banner (faux NPS preview), search + sort (popular/newest/rated/A–Z), 12 category chips, 16 templates with per-card mini form-previews (rendered from each real schema) + rating/uses, a working **Preview modal** (read-only form render), a **Community templates** section, empty-search state; one-click use + form duplication
- [x] Team roles / permissions + invites — Invite model + accept flow (`/invite/[token]`); OWNER/ADMIN/EDITOR/VIEWER with member management UI (`/app/team`); role-gated endpoints + VIEWER read-only enforcement on form mutations; last-owner protection
- [x] Custom domains (Cloudflare SSL-for-SaaS) — Domain model + add/verify/delete (`/app/domains`); CF custom-hostname when configured, DNS (CNAME) verification fallback otherwise; manager-gated
- [x] Partial submissions (session-keyed capture, completed in place on submit, hidden from responses/analytics), Turnstile spam protection (per-form toggle + server-side siteverify, graceful without secret), email verification (token flow + `/verify-email/[token]` + resend banner), version history (immutable publish snapshots + `/app/forms/[id]/versions` list & restore)

## Phase 3 — V3 (enterprise & scale)
- [ ] SSO / SAML + SCIM (WorkOS); granular RBAC + audit logs
- [x] Data residency + retention controls; white-label — org-level data region (us/eu), response retention with a daily in-process purge (+ "Purge now"), and white-label (hide "Made with Frame") for every org; all in Settings → Data & privacy
- [x] Response search (Typesense / Meilisearch) — full-text search on the responses page; indexes to Meilisearch when configured, with a Postgres `ILIKE` fallback that works out of the box
- [ ] Async fabric: BullMQ workers (webhooks, exports, emails, integrations)
- [ ] Scale: read replicas, response-table partitioning, edge-cached form delivery
- [ ] Observability (Sentry, OpenTelemetry, PostHog), rate limiting, security hardening, SOC 2 / GDPR posture

## Phase 4 — Future (AI & automation)
- [x] AI form generation from a prompt (POST /v1/ai/generate-form — Claude when ANTHROPIC_API_KEY set, heuristic fallback; "Generate with AI" on dashboard)
- [x] AI logic / branching suggestions — `POST /v1/ai/suggest-logic` proposes conditional rules (Claude when keyed, heuristic on choice questions otherwise); surfaced in the editor's AI tools
- [x] Response summarization + analytics copilot — `summarize-responses` (themes/sentiment) + `responses-copilot` (Q&A over responses) with real heuristic stats as fallback; "AI insights" panel on the responses page
- [x] Auto-translation — `translate-form` translates all form copy into a target language via Claude; editor "Translate" control applies it (graceful note without a key)
- [x] Integration marketplace + visual workflow automation (Automation model; per-form webhooks fire on new response; /app/integrations catalog + per-form Connect page with add/toggle/test/delete)

_Cross-cutting every phase: tests, CI/CD, monitoring, accessibility, security, docs._
