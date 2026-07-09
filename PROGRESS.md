# Frame — Project Progress

A living checklist of work on the Frame form-builder project. Updated as tasks complete.

_Last updated: 2026-07-09_

## ✅ Completed
- [x] Product teardown & build blueprint — 18 sections (`tally-teardown.html`, `TALLY-TEARDOWN.md`)
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

---

# Development Plan (phases)

Building the real Frame product. `[x]` = done, `[~]` = partial. Phase 1 is the launchable MVP.

## Phase 0 — Foundations  _(mostly done)_
- [x] Turborepo monorepo (web + api + form-schema)
- [x] Prisma schema — 6 core tables; local Postgres; walking skeleton verified
- [~] `packages/ui` — port design tokens + shadcn components from the mockup
- [ ] Auth: Auth.js (email magic-link + Google) + sessions
- [ ] Multi-tenancy: org / workspace / membership + org-scoped query guards
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
- [ ] Theme / design customization with live preview
- [ ] Analytics: views, starts, completion, drop-off, device & source
- [ ] Embeds (inline / popup / full-page) + tiny `embed.js` runtime bundle
- [ ] Integrations: Google Sheets, Slack, webhooks, Zapier / Make
- [ ] Templates gallery + duplication
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
- [ ] AI form generation from a prompt
- [ ] AI logic / branching suggestions
- [ ] Response summarization + analytics copilot
- [ ] Auto-translation
- [ ] Integration marketplace + visual workflow automation

_Cross-cutting every phase: tests, CI/CD, monitoring, accessibility, security, docs._
