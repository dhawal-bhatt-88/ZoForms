# Frame

**Frame is a modern form builder.** Create forms with a block-based editor, style and publish them, embed them anywhere, and collect and analyze responses. It's a production-shaped monorepo with a tenant app, a public form runtime, a REST API, and a multi-tenant **admin console**.

![Node](https://img.shields.io/badge/node-%E2%89%A520-3c873a)
![pnpm](https://img.shields.io/badge/pnpm-9-f69220)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e)
![Prisma](https://img.shields.io/badge/Prisma-5-2d3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

> 🔒 **Private / confidential** — internal project. Don't distribute publicly.

---

## What's inside

Frame is a working product, not a mockup. It has:

- **Form editor** — a Notion-style `/` block inserter with 33 block types (short/long text, choice, checkbox, multi-select, dropdown, number, email, phone, link, file upload, date, time, linear scale, matrix, rating, ranking, headings, dividers, image/video/audio/embed, and more), drag-to-reorder, autosave, and a live inspector.
- **Ask AI** — a conversational assistant that edits the live form ("add a phone field and a rating"), plus one-shot **generate-from-a-prompt**. Uses Claude when an API key is configured, with a heuristic fallback otherwise.
- **Theming & customization** — colors, fonts, corners, width, logo, cover image, per-input styling, and custom CSS — with a luminance-aware runtime that adapts to dark themes.
- **Public runtime** — themed, mobile-friendly form pages at `/r/:slug` with validation, file uploads, and a thank-you screen.
- **Responses & analytics** — a responses table with CSV export, plus per-form analytics (views, starts, completion rate, funnel, 14-day trend, device & source).
- **Templates, embeds & integrations** — a template gallery, inline/popup/full-page embeds via `embed.js`, and per-form webhook automations that fire on new responses.
- **Auth & multi-tenancy** — email/password (JWT), org / workspace / membership, and org-scoped queries on every route.
- **Admin console** — a separate app to manage the platform: tenants (suspend), users (suspend, **impersonate**, delete), cross-tenant form moderation, and an audit log.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| **Monorepo** | pnpm workspaces + [Turborepo](https://turbo.build) |
| **Tenant app & admin app** | [Next.js 15](https://nextjs.org) (App Router), React 18, TypeScript, [Tailwind CSS](https://tailwindcss.com), [lucide-react](https://lucide.dev) |
| **API** | [NestJS 10](https://nestjs.com), [Prisma 5](https://prisma.io) |
| **Database** | PostgreSQL 16 (JSONB for form schema & responses) |
| **Auth** | JWT (`@nestjs/jwt`) + bcrypt |
| **Shared contract** | `@formbuilder/form-schema` (Zod) — the single source of truth for what a form _is_ |
| **AI (optional)** | Anthropic Claude via `@anthropic-ai/sdk` |
| **Uploads** | Local-disk driver (swappable seam for S3 / R2) |

---

## Repository layout

```
formbuilder/
├─ apps/
│  ├─ web/           # Tenant app + public form runtime (Next.js) → :3000
│  ├─ admin/         # Platform admin console (Next.js)          → :3002
│  └─ api/           # REST API (NestJS + Prisma)                → :4000
├─ packages/
│  └─ form-schema/   # Shared Zod schema, block catalog, theme resolver
├─ docker-compose.yml   # Postgres 16 (+ Redis, provisioned for future use)
├─ BLUEPRINT.md         # Product & engineering blueprint (research/strategy)
└─ PROGRESS.md          # Living build log — what's done, what's next
```

---

## Requirements

- **Node.js ≥ 20** (22 works too)
- **pnpm 9** — `npm install -g pnpm@9`
- **PostgreSQL 16** — easiest via Docker (`docker compose up`), or a local install
- _(optional)_ An **Anthropic API key** to enable real AI generation

---

## Quick start

```bash
# 1. Clone & install
git clone https://github.com/zoworkhq/formbuilder.git
cd formbuilder
pnpm install

# 2. Start Postgres (Docker)
docker compose up -d db

# 3. Configure environment
cp apps/api/.env.example         apps/api/.env
cp apps/web/.env.local.example   apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local

# 4. Create the database schema
pnpm db:migrate      # runs prisma migrate + generates the client

# 5. Run everything (web + admin + api together)
pnpm dev
```

Then open:

| App | URL |
| --- | --- |
| **Tenant app** (dashboard, editor, forms) | http://localhost:3000 |
| **Admin console** | http://localhost:3002 |
| **API** | http://localhost:4000 |
| Public form runtime | `http://localhost:3000/r/<slug>` |

Create an account from the tenant app's **Sign up** page and you're in.

> Not using Docker? Point `DATABASE_URL` in `apps/api/.env` at any PostgreSQL 16 instance and run `pnpm db:migrate`.

---

## Environment variables

**`apps/api/.env`**

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | — | API port (default `4000`) |
| `PUBLIC_API_URL` | — | Base URL used to build public file-upload links |
| `JWT_SECRET` | ✅ (prod) | Secret for signing auth tokens — use a long random string |
| `ANTHROPIC_API_KEY` | — | Enables real AI generation (heuristic fallback if unset) |
| `ANTHROPIC_MODEL` | — | Override the Claude model (default `claude-haiku-4-5-20251001`) |

**`apps/web/.env.local`**

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL (default `http://localhost:4000`) |

**`apps/admin/.env.local`**

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_TENANT_URL` | Tenant app URL, used for impersonation (default `http://localhost:3000`) |

---

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start web + admin + api in watch mode (Turborepo) |
| `pnpm build` | Build all apps & packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm db:migrate` | Apply Prisma migrations (+ generate client) |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:studio` | Open Prisma Studio to browse the database |

Target a single workspace with `pnpm --filter <web|admin|api> <script>`.

---

## Admin access

The admin console (`:3002`) only lets in users with the platform-admin flag. To promote an account after signing up in the tenant app, flip `isAdmin` on their `User` row:

```bash
pnpm db:studio        # open Prisma Studio → User → set isAdmin = true
```

or with SQL:

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'you@example.com';
```

Then sign in at `http://localhost:3002` with the same credentials.

---

## How it fits together

- **`packages/form-schema`** is the keystone: it defines `FormSchema`, the block catalog, validation, and `resolveTheme()`. The editor writes it, the runtime reads it, and the API validates it — stored as JSONB in `FormVersion.schema`.
- The **API** owns auth (JWT), tenancy scoping, submissions, uploads, AI, webhooks, analytics, and the admin surface.
- The **web app** is both the authenticated builder (`/app/*`) and the unauthenticated public runtime (`/r/:slug`).
- The **admin app** talks to the same API through admin-guarded endpoints.

For the product research, architecture rationale, AWS cost/capacity analysis, and roadmap, see **[`BLUEPRINT.md`](BLUEPRINT.md)**. For the running build log, see **[`PROGRESS.md`](PROGRESS.md)**.

---

## Notes for contributors

- This is a **local-first dev setup**. Secrets in the `.env.example` files are development defaults — replace them before deploying anywhere.
- File uploads use a local-disk driver; the storage layer is written as a seam so it can be swapped for S3 / R2.
- Some advanced blocks (payment, signature, matrix, reCAPTCHA) are wired into the editor and runtime as clearly-labeled basics — the deep integrations are follow-ups tracked in `PROGRESS.md`.
