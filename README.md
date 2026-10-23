# Zowork Forms

**Zowork Forms is a design-time form builder.** Authors build forms with groups, pages, conditional logic, scoring and coded options, save versions, and download each version as a JSON artifact. The `@zoworkhq/forms` renderer turns that artifact into a working form inside the client's own app, and the client's app receives the submissions.

> 🔒 **Private / confidential:** internal project. Don't distribute publicly.

## What it is, and what it isn't

It is:
- the **builder** (web app): forms, templates, versions, the artifact download, team and invites;
- the **API** that stores forms and applies every save rule;
- an **admin console** for operators: tenants, users, impersonation, the audit log and the forms list.

It isn't a form host. Nothing a respondent does reaches it:
- no public form pages and no embeds;
- no submissions, responses or analytics;
- no file uploads.

The client's app renders the form with `@zoworkhq/forms` and posts the answers to its own endpoint.

## The artifact

**Download** in the editor (`GET /v1/forms/:id/artifact`) gives the form's current saved version as JSON, named from the title and version: `phq-9-adult-v12.json`, or `form-v12.json` when the title gives nothing usable. Downloading the same version twice gives the same file.

What it holds is fixed by two contracts, shared word for word with the renderer's repo:
- [`docs/GROUPS-AND-PAGES-CONTRACT.md`](docs/GROUPS-AND-PAGES-CONTRACT.md): blocks, groups, pages, repeating groups, coded options, the grid, condition logic, scoring;
- [`docs/DRAFTS-CONTRACT.md`](docs/DRAFTS-CONTRACT.md): the Save progress (drafts) setting.

The artifact carries the form's id (`formId`) and the saved version's (`formVersionId`). Fields only the builder uses never leave it: template references, question names and formula text.

The builder offers only block types the renderer knows. [`e2e/verify-renderer-types.js`](e2e/verify-renderer-types.js) checks that against the renderer installed in the external test app, so the two stay in step.

## Stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces + [Turborepo](https://turbo.build) |
| Web app and admin console | [Next.js 15](https://nextjs.org) (App Router), React 18, TypeScript, Tailwind CSS, lucide-react |
| API | [NestJS 10](https://nestjs.com), [Prisma 5](https://prisma.io) |
| Database | PostgreSQL 16 (form content as JSONB) |
| Auth | Email and password (JWT, bcrypt), Google sign-in, email verification and password reset |
| Email | [Resend](https://resend.com) (optional; without a key, emails are logged) |
| Shared contract | `@formbuilder/form-schema` (Zod): what a form is, every save rule, the artifact |
| Tests | Vitest (unit), Playwright (web smoke spec and the builder e2e suites) |

## Repository layout

```
formbuilder/
├─ apps/
│  ├─ web/            # The builder (Next.js)                     → :3000
│  ├─ admin/          # Operators' admin console (Next.js)       → :3002
│  └─ api/            # REST API (NestJS + Prisma)                → :4000
│     └─ prisma/
│        ├─ schema.prisma
│        └─ templates/    # System templates, one JSON file each, loaded at startup
├─ packages/
│  ├─ form-schema/    # Schema, save rules, logic, scoring, templates, the artifact
│  └─ ui/             # Shared Button and Input, and the Tailwind preset
├─ e2e/               # Builder end-to-end suites (plain Node + Playwright)
├─ deploy/            # Production compose file and env example (see DEPLOY.md)
├─ docs/              # Contracts, the clean-up audit and plan, briefs
└─ docker-compose.yml # Local Postgres 16
```

## Local setup

**Requirements:**
- Node.js 20 or later (`.nvmrc` says 20);
- pnpm 9 (`corepack enable`, or `npm install -g pnpm@9`);
- Docker, for Postgres. Or point `DATABASE_URL` at any PostgreSQL 16.

```bash
# 1. Install (also generates the Prisma client)
pnpm install

# 2. Start Postgres
docker compose up -d db

# 3. Configure the environment (the defaults work locally)
cp apps/api/.env.example         apps/api/.env
cp apps/web/.env.local.example   apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local

# 4. Create the database schema
pnpm db:migrate

# 5. Run web, admin and API together (builds form-schema first)
pnpm dev
```

| App | URL |
| --- | --- |
| Builder | http://localhost:3000 |
| Admin console | http://localhost:3002 |
| API health | http://localhost:4000/health |

Sign up in the builder and you're in. The API loads the system templates from `apps/api/prisma/templates` every time it starts. `pnpm --filter api seed:templates` does the same without starting it.

**The web and API import `form-schema`'s `dist`**, not its source. `pnpm dev` keeps it built. When running an app on its own, build it after changing the package: `pnpm --filter @formbuilder/form-schema build`.

**Admin access.** The admin console lets in only users with `isAdmin` set. After signing up in the builder:

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'you@example.com';
```

Or use `pnpm db:studio`. Then sign in at http://localhost:3002 with the same email and password.

## Environment variables

**`apps/api/.env`** ([example](apps/api/.env.example))

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | | API port (default `4000`) |
| `NODE_ENV` | | `development` (default), `test` or `production`. Production refuses the dev `JWT_SECRET`. |
| `PUBLIC_API_URL` | | The API's public origin, allowed by CORS (default `http://localhost:4000`) |
| `PUBLIC_TENANT_URL` | | The builder's public origin: allowed by CORS, and used in invite, verification and password-reset links (default `http://localhost:3000`) |
| `CORS_ORIGINS` | | Extra origins allowed by CORS, comma-separated. Localhost, the API's own host and the two origins above are always allowed. |
| `JWT_SECRET` | ✅ in production | Signs auth tokens. Use a long random string. |
| `RESEND_API_KEY` | | Sends email through Resend. Without it, emails are logged and not sent. |
| `MAIL_FROM` | | The sender (default `Zowork Forms <onboarding@resend.dev>`) |
| `GOOGLE_CLIENT_ID` | | Turns on Google sign-in: the OAuth client id the API checks tokens against |

**`apps/web/.env.local`** ([example](apps/web/.env.local.example))

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API's origin (default `http://localhost:4000`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The same client id as the API's `GOOGLE_CLIENT_ID`; without it, the Google button is hidden |
| `NEXT_PUBLIC_WEB_URL` | The web app's own public origin, the base of the public pages' Open Graph and canonical URLs (default `http://localhost:3000`) |

**`apps/admin/.env.local`** ([example](apps/admin/.env.local.example))

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API's origin (default `http://localhost:4000`) |
| `NEXT_PUBLIC_TENANT_URL` | The builder's origin, used for impersonation (default `http://localhost:3000`) |

`NEXT_PUBLIC_*` values are built into the Next.js apps, so change them before building. Production uses [`deploy/.env.prod.example`](deploy/.env.prod.example): see [`DEPLOY.md`](DEPLOY.md).

## Scripts

From the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Web, admin and API in watch mode |
| `pnpm build` | Build every app and package |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Every unit test suite (Vitest) |
| `pnpm test:e2e` | The web smoke spec (Playwright) |
| `pnpm db:migrate` | Apply Prisma migrations and generate the client |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:studio` | Open Prisma Studio |

Run one workspace's script with `pnpm --filter <web|admin|api|@formbuilder/form-schema> <script>`.

There's no linter yet. Setting up ESLint is a follow-up in the [clean-up plan](docs/BUILDER-CLEANUP-PLAN.md).

## Tests

**Unit tests:** `pnpm test`. Most of them are in `packages/form-schema`, which holds the save rules, logic, scoring and the artifact. CI runs these, the typecheck and the build on every pull request and every push to `main`.

**Web smoke spec:** `pnpm test:e2e` (`apps/web/e2e`). It starts its own dev server on port 3100 and needs no API or database, which is how CI runs it.

**Builder end-to-end suites** (`e2e/`): plain Node scripts that drive the real API, the editor in a browser, and the database. They need:
- Postgres;
- the API on port 4000;
- for the browser suites, the web app on port 3100.

Each suite signs up its own throwaway account and deletes it afterwards.

```bash
node e2e/run-all.js                 # every suite, then a summary
node e2e/run-all.js grid scoring    # suites whose file name contains these words
node e2e/verify-versions.js         # one suite, with its full output
```

Some suites also check the artifact in the external test app that has `@zoworkhq/forms` installed:
- `E2E_EXTERNAL_APP_DIR` (default `D:/ZoworkProjects/external-test-app`): where `verify-renderer-types.js` and `verify-scoring-api.js` find the installed renderer. The app doesn't need to be running.
- `E2E_EXTERNAL_FORMS_DIR`: also copy each downloaded artifact into the test app's forms folder, e.g. `D:\ZoworkProjects\external-test-app\src\forms`.
- `E2E_EXTERNAL_APP_URL`: also render those downloads in the running test app and submit them, e.g. `http://localhost:5173/external-test-app/`. It needs `E2E_EXTERNAL_FORMS_DIR` as well.

A full run should set both of the last two, then put the test app's own form files back afterwards, because the suites overwrite some of them. [`e2e/README.md`](e2e/README.md) has the prerequisites, every suite and every setting.

## Further reading

- [`docs/GROUPS-AND-PAGES-CONTRACT.md`](docs/GROUPS-AND-PAGES-CONTRACT.md) and [`docs/DRAFTS-CONTRACT.md`](docs/DRAFTS-CONTRACT.md): the artifact's shape and rules, shared with the renderer
- [`docs/BUILDER-CLEANUP-PLAN.md`](docs/BUILDER-CLEANUP-PLAN.md): how the builder became a design-time tool, what's still to do before any deployment, and the follow-ups
- [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md): known limitations, and when to revisit them
- [`DEPLOY.md`](DEPLOY.md): the single-host deployment, and why the builder isn't deployed yet
