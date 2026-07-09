# Frame — Project Progress

A living checklist of work on the Frame form-builder project. Updated as tasks complete.

_Last updated: 2026-07-09_

## ✅ Completed
- [x] Product & engineering blueprint — 18 sections (`blueprint.html`, `BLUEPRINT.md`)
- [x] AWS infrastructure cost analysis section added to the report
- [x] Capacity planning & scaling-design section added to the report
- [x] Clickable prototype — 15 screens (`frame-prototype.html`)
- [x] Monorepo scaffold: Next.js `web` + NestJS `api` + `form-schema` (walking skeleton verified end-to-end)
- [x] Marketing site — landing + `/pricing`; dashboard moved to `/app`
- [x] Docs & mockup embedded in the app — `/docs`, `/mockup`
- [x] Mockup typography upgrade — Hanken Grotesk across all 15 screens
- [x] Deep-polished the form builder — cover-gradient depth + firmer title weight
- [x] Polished data screens — removed the perpetual card-thumbnail **shimmer** on the dashboard (was reading as "stuck loading"); responses & analytics verified clean and lifted by the type upgrade

## 🚧 In progress
- _(nothing in flight)_

## 🛡️ Admin console (`apps/admin`, port 3002)
- [x] Platform data model — User.isAdmin/status, Organization.plan/status, AuditLog
- [x] AdminModule (API) — AdminGuard (isAdmin), overview, tenants (list/detail/plan/suspend), users (list/suspend/impersonate/delete), cross-tenant form moderation (take-down/delete), audit log; every mutation audited
- [x] Impersonation — admin issues a 1h token → tenant app /impersonate stores it and enters the app as that user (support login-as)
- [x] Admin app — separate Next.js app: login (admin-only gate), Overview (metrics/signup-trend/plan mix), Tenants + tenant detail, Users, Forms, Audit log; shares the Frame design system

## 🎨 Design system / app shell
- [x] Enterprise app shell — persistent sidebar (workspace switcher, nav with active states, user menu) + topbar; applied to dashboard / templates / integrations / settings (editor stays full-screen)
- [x] Dashboard redesign — search + status filter + sort, refined form cards (status dot, responses, edited-time), hover micro-interactions, kebab menu (edit / copy link / duplicate / delete), skeleton loading, delete-confirm dialog (DELETE /v1/forms/:id)

---

# Development Plan (phases)

Building the real Frame product. `[x]` = done, `[~]` = partial. Phase 1 is the launchable MVP.

## Phase 0 — Foundations  _(mostly done)_
- [x] Turborepo monorepo (web + api + form-schema)
- [x] Prisma schema — 6 core tables; local Postgres; walking skeleton verified
- [~] `packages/ui` — port design tokens + shadcn components from the mockup
- [x] Auth: email + password — JWT + bcrypt in the API; login/signup/logout + auth-gate in web _(SSO/magic-link later)_
- [x] Multi-tenancy: org / workspace / membership + org-scoped queries on every form route (tenant isolation verified)
- [ ] Baseline: env/secrets, error handling, logging, CI (lint · typecheck · test · build), Vitest + Playwright
- [ ] Align marketing site typography to Hanken (web ↔ mockup consistency)

## Phase 1 — MVP (the core loop, launchable)
Critical path: **Editor → Runtime → Submit → Responses → Billing.**
- [x] Form editor (React): palette, canvas, reorder (▲▼; drag next), inspector → writes blocks to `FormVersion.schema`
- [x] Core blocks: short/long, choice, checkbox, dropdown, number, email, phone, date, rating, file
- [x] Autosave (debounced) + schema persisted to the latest version
- [x] Publish flow: status, slug, share link (copy-link + view-live)
- [x] Public runtime `/r/[slug]`: render from JSONB, client validation, mobile, thank-you
- [x] Submit endpoint: unauth → validate (required) → store Response  _(files = filename for now)_
- [x] Dashboard on real data: create → opens editor; status + live link
- [x] Drag-drop reorder (dnd-kit) · file uploads _(local-disk driver; S3/R2 swap seam)_ · redirect-on-completion + custom submit label
- [x] Responses dashboard: table (labels as columns) + detail drawer + CSV export
- [ ] Email notification on new response (Resend)
- [ ] Billing: Stripe subscriptions (Free / Pro / Business) + plan gating
- [ ] Deploy MVP: Vercel (web) + API host (Fly/Render) + Neon Postgres + staging

## Phase 2 — V2 (usability & collaboration)
- [ ] Conditional logic engine (show / hide / jump) + calculations
- [ ] Advanced blocks: payment (Stripe Connect), signature, matrix, ranking, hidden fields, answer piping, URL pre-fill
- [x] Theme / design customization with live preview
- [x] Customize panel — accent/background/text/button-text colors (swatch + picker), font (sans/serif/mono/rounded), corners (none→pill), width; luminance-aware runtime (adaptive dark surface, capped card radius)
- [x] Workspace Settings + Claude API key (real AI generation; per-workspace key, Test connection); AI generate falls back to heuristic without a key
- [x] Conversational "Ask AI" editor — in-editor chat drawer that edits the live form (POST /v1/ai/edit-form: Claude when keyed, heuristic add/remove/required otherwise); applies + autosaves
- [x] Notion-style slash (/) block inserter replacing the left palette — searchable, grouped catalog (Questions/Layout/Embed/Advanced), 33 block types; inserts after the selected block
- [x] Expanded block catalog: multi-select, link, time, linear scale, ranking, matrix, headings H1–H3, text, divider, title, label, image/video/audio/embed, country + payment/signature/hidden/reCAPTCHA (basic); runtime + validation + inspector controls for all
- [x] Analytics: views, starts, completion rate, funnel (views→starts→submissions), 14-day daily trend, device & source breakdown (Event model + public /events tracking on the runtime + /forms/:id/analytics + dashboard page)
- [x] Advanced customization: logo, cover image, per-input styling (bg/border), custom CSS injection (scoped .frame-form)
- [x] Embeds (inline / popup / full-page) + `embed.js` (auto-resize) + editor Embed modal
- [ ] Integrations: Google Sheets, Slack, webhooks, Zapier / Make
- [x] Templates gallery (6 templates + categories) + one-click use + form duplication
- [ ] Team roles / permissions + invites
- [ ] Custom domains (Cloudflare SSL-for-SaaS)
- [ ] Partial submissions, Turnstile spam protection, email verification, version history

## Phase 3 — V3 (enterprise & scale)
- [ ] SSO / SAML + SCIM (WorkOS); granular RBAC + audit logs
- [ ] Data residency + retention controls; white-label
- [ ] Response search (Typesense / Meilisearch)
- [ ] Async fabric: BullMQ workers (webhooks, exports, emails, integrations)
- [ ] Scale: read replicas, response-table partitioning, edge-cached form delivery
- [ ] Observability (Sentry, OpenTelemetry, PostHog), rate limiting, security hardening, SOC 2 / GDPR posture

## Phase 4 — Future (AI & automation)
- [x] AI form generation from a prompt (POST /v1/ai/generate-form — Claude when ANTHROPIC_API_KEY set, heuristic fallback; "Generate with AI" on dashboard)
- [ ] AI logic / branching suggestions
- [ ] Response summarization + analytics copilot
- [ ] Auto-translation
- [x] Integration marketplace + visual workflow automation (Automation model; per-form webhooks fire on new response; /app/integrations catalog + per-form Connect page with add/toggle/test/delete)

_Cross-cutting every phase: tests, CI/CD, monitoring, accessibility, security, docs._
