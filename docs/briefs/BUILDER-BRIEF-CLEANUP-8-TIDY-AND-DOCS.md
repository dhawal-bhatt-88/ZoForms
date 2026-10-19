# Builder brief — clean-up 8: tidy-up and docs

The last of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, Part B. The plan's brief 8 section lists the items gathered during briefs 1–7.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-8-TIDY-AND-DOCS.md`, replace `docs/BUILDER-CLEANUP-PLAN.md` with the attached updated plan, and commit both on their own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

Briefs 1–7 removed the dead features. This brief:
- fixes two problems found along the way;
- removes the code those features left unused;
- rewrites the docs so they describe the builder as it now is: a design-time tool that exports JSON artifacts for `@zoworkhq/forms`, under the name Zowork Forms.

## Scope

**Fixes (CP1)**
- **Template seeder:** it compares *parsed* content, so a stored row that differs from its JSON file only by keys the schema now drops is never rewritten. All 16 system-template rows still hold the old `settings`. Compare the stored JSON with the file's JSON as written, then reseed. Afterwards no system-template row may contain `settings`.
- **Sign-in labels:** the sign-in form's labels aren't linked to their fields (no `htmlFor`/`id`), so screen readers don't announce field names. Link them. Check every auth form (sign-up, forgot, reset, invite, verify) and the admin login for the same fault. Then change the web smoke spec to find the fields by label.

**Code tidy-up (CP2)**
- **Unused code:** run knip again (`npx --yes knip@5`, with the config kept outside the repo, as in the audit). Verify every finding by hand, and remove what's confirmed, including:
  - `@dnd-kit/utilities`;
  - `@types/bcryptjs`;
  - unused `packages/ui` exports and files (`Badge`, `Card`, `cn`, `buttonVariants` if still unused);
  - the e2e helper export `code`;
  - `withoutBuilderFields` and `optionsFromLabels` if only tests use them (remove them with their tests);
  - the unused `isScoredGroup` import;
  - the `export` keyword on names only their own file uses, in web, admin and API.
- **Leave alone:**
  - form-schema's self-used exports (plan decision);
  - shared tenancy helpers, whatever knip says;
  - `prettier`, unless you've confirmed no editor setting or config uses it.
- **Broken or dead config:**
  - remove the `lint` scripts (root, web, admin). `next lint` is gone from Next.js 16, and there's no ESLint config; setting up ESLint is a separate follow-up.
  - Remove the `redis` service from `docker-compose.yml`.
  - Untrack `apps/web/tsconfig.tsbuildinfo` and `apps/admin/tsconfig.tsbuildinfo`, and add `*.tsbuildinfo` to `.gitignore`.
- **Dead UI:** the sidebar's workspace switcher button (no `onClick`). The `Workspace` model stays.
- **Tests:** the billing 404 check in `verify-body-limits.js`.
- **Env examples:** add the variables that code reads but no example lists: `PUBLIC_TENANT_URL`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM`, `CORS_ORIGINS`, `NODE_ENV`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Re-check the list against the code first; it may have changed.
- **Deploy names:** rename `frame` to `zowork-forms` in the deploy folder path, compose project name, `POSTGRES_USER` and the `deploy.yml` heading.
  - The builder has never been deployed, so there's no live host to migrate.
  - **The local dev compose file and your local database are different:** see CP0.

**Docs (CP3)**
- **`README.md`:** rewrite for the current builder. Cover:
  - what it is, and what it isn't (it doesn't host forms or receive submissions);
  - the artifact download, and how it relates to `@zoworkhq/forms`;
  - the stack and the repo layout;
  - local setup;
  - an env table matching the examples;
  - how to run the unit and e2e tests, including the external-app variables;
  - links to `docs/GROUPS-AND-PAGES-CONTRACT.md`, `docs/DRAFTS-CONTRACT.md`, `docs/BUILDER-CLEANUP-PLAN.md` and `KNOWN-ISSUES.md`.
  - Don't state the number of block types. Point to `verify-renderer-types`, which keeps the builder and the renderer in step.
- **`GETTING-STARTED.md`:** rewrite it, or fold it into the README and delete it if it would only duplicate the README. Propose which in CP0.
- **`DEPLOY.md`:** rewrite for what's deployed now: web, admin, API and Postgres. No public form pages, no uploads, no Redis.
  - Keep the hardening note: no signed-in route has a rate limit yet.
  - Say the builder must not be deployed before that is decided.
- **`PROGRESS.md`:** delete it.
- **Smaller fixes:**
  - the header comment in `schema.prisma`;
  - the `verify-renderer-types` row in `e2e/README.md`, if it's still missing;
  - any remaining doc that describes removed features.
- The contracts, the audit, the plan and `docs/briefs/` are the record of this work. Don't change them, except to mark brief 8 done in the plan's progress table.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Rebuild `packages/form-schema/dist` after every change to it.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- **The knip run:** every finding, confirmed or rejected, with evidence. Map each confirmed one to the removal it needs.
- **The seeder:** how it compares content today, and the exact change you propose.
- **The labels:** every form or field (auth pages, admin login) whose label isn't linked.
- **The local dev database:** whether the root `docker-compose.yml` and `apps/api/.env` also use the `frame` user or database name.
  - If they do, propose whether to rename them too: that means recreating the local Postgres volume, and losing local dev data.
  - Or leave the dev names and rename only the deploy files.
- **The env list:** checked against the code, as it is now.
- **The docs:** an outline for the new README and DEPLOY, and your proposal for GETTING-STARTED.

**CP1 — Fixes.**
- The seeder change and reseed, with a test that a row differing only by a dropped key gets rewritten.
- The linked labels, and the smoke spec finding fields by label.
- Check every auth page in a browser.

**CP2 — Code tidy-up.**
- Everything under "Code tidy-up".
- Typecheck, unit tests, and the web Playwright spec as CI runs it.

**CP3 — Docs.**
- The rewrites and deletions.
- Check every link in the new README and DEPLOY resolves to a file that exists.

**CP4 — Full run and final checks.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Run knip once more and report what's left (should be only the agreed exceptions).
- **Final searches** across code and docs:
  - for the removed features: `/r/`, `embed.js`, `responses`, `analytics`, `automation`, `webhook`, `anthropic`, `domain`, `turnstile`, `theme`, `Frame`;
  - report every remaining match with the reason it stays.
- In a browser, sign in to the admin app and check the sidebar shows "Zowork Forms".
- Mark brief 8 done in the plan's progress table, and commit.
