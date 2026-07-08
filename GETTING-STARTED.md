# Getting started — building the app

This repo is a **Turborepo monorepo**. The scaffold gives you the walking
skeleton from the blueprint: create a form → it persists (Postgres via Prisma)
→ it shows up in the dashboard. Everything else layers on from here.

## Prerequisites

- **Node 20+** and **pnpm** (`corepack enable` gives you pnpm)
- **Docker** (for local Postgres + Redis)

## First run

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Start Postgres + Redis locally
docker compose up -d

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# 4. Create the database schema (also (re)generates the Prisma client)
pnpm db:migrate --name init

# 5. Run everything (web + api + shared packages in watch mode)
pnpm dev
```

- Web  → http://localhost:3000
- API  → http://localhost:4000/health  (forms at `/v1/forms`)

**Try the skeleton:** open the web app and click **New form**. It calls the API,
which writes a `Form` + `FormVersion` (with an empty JSONB schema) via Prisma,
then the form appears in the list. That's the full stack working end-to-end.

## Layout

```
apps/web              Next.js (App Router) + Tailwind — dashboard / builder UI
apps/api              NestJS REST API + Prisma — health + forms endpoints
packages/form-schema  Shared Zod form contract (the keystone; JSONB shape)
```

> Prisma currently lives in `apps/api` for simplicity. Extract it into
> `packages/db` (per the blueprint) once the web app needs direct DB access.

## Next steps (from `tally-teardown.html`)

1. **Builder** — port screens from `frame-prototype.html` into React components
   under `apps/web`; write the block list into `FormVersion.schema`.
2. **Public runtime** — add `apps/web/src/app/r/[slug]/page.tsx` that renders a
   published form from its JSONB schema.
3. **Submit** — add `POST /v1/forms/:id/responses` (unauthenticated, spam-guarded)
   that validates with `validateSubmission()` and inserts a `Response`.
4. **Auth + org scoping** — add Auth.js and scope every query by `orgId`.
5. **Responses view** — an authenticated table of submissions.

See the blueprint report for the full stack (§10), database (§11), API (§12),
DevOps (§13), security (§14), AWS cost (§16), and capacity (§17) detail.
