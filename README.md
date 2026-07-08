# Formbuilder — Product & Engineering Blueprint

Research, strategy, and a clickable prototype for building a **Tally.so-inspired form builder**. This repository is the working reference for product planning, technical architecture, and implementation.

> ⚠️ **Confidential** — internal product-strategy material. Not for public distribution.

## Contents

| File | What it is |
| --- | --- |
| [`tally-teardown.html`](tally-teardown.html) | **The teardown & build blueprint** — an 18-section report covering product, design, business, architecture, database, API, DevOps, security, scalability, **AWS cost analysis**, **capacity planning**, and roadmap. Open in a browser. |
| [`TALLY-TEARDOWN.md`](TALLY-TEARDOWN.md) | The same report as Markdown (for diffing, search, and inline reference during implementation). |
| [`frame-prototype.html`](frame-prototype.html) | **Clickable HTML prototype** of the product ("Frame") — 15 screens: landing, auth, onboarding, form builder (drag-and-drop, logic, theming, publish/embed/custom-domain), dashboard, responses + detail drawer, analytics, integrations, team, billing, notifications, and a "ship to production" guide. Open in a browser and click through. |

## How to view

Both HTML files are self-contained (no build step, no external dependencies) — just open them in any modern browser:

```bash
open tally-teardown.html
open frame-prototype.html
```

Or serve the folder locally:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899/frame-prototype.html
```

## What's inside the blueprint

The report analyzes Tally as it exists (product, features, UX, design system, business model) and lays out a full plan to build a better one:

- **Recommended stack** — Next.js + TypeScript + Tailwind/shadcn on the front end; NestJS + Prisma + PostgreSQL (JSONB) + Redis + BullMQ + S3/CloudFront + Typesense on the back end.
- **Database schema** (DDL), **REST API** design, **DevOps/CI-CD**, **security & compliance** (OWASP, GDPR).
- **AWS cost analysis** — per-phase estimates for vanilla EC2 vs. managed services, with cost-effective and performance recommendations.
- **Capacity planning** — how many users/responses each tier carries, and the scale-out design (100 → 1M users).
- **Phased roadmap** — MVP → V2 → V3 (enterprise) → AI-native future.

Claims are labeled **Verified** (grounded in public facts about Tally) vs **Assumption** (informed inference). The prototype uses an original placeholder brand ("Frame") — no Tally branding or assets are reproduced.

## From prototype to production

The prototype's "Ship to production" screen maps each screen/flow onto the real codebase: a Turborepo monorepo with `apps/web` (Next.js), `apps/api` (NestJS), `apps/workers` (BullMQ), and shared `packages/*` (ui, form-schema, form-runtime, db). See that screen and the report's architecture sections for the full path.

## Building the app (monorepo)

The scaffold for that app now lives in this repo:

- **`apps/web`** — Next.js (App Router) + Tailwind — the dashboard / builder UI
- **`apps/api`** — NestJS REST API + Prisma — health + forms endpoints
- **`packages/form-schema`** — the shared Zod form contract (the JSONB keystone)

It boots the **walking skeleton**: create a form → it persists to Postgres via Prisma → it appears in the dashboard.

**→ See [`GETTING-STARTED.md`](GETTING-STARTED.md) for prerequisites and first-run commands.**
