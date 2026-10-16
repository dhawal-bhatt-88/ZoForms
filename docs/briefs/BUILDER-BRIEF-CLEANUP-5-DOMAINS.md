# Builder brief — clean-up 5: custom domains

The fifth of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, section A11.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-5-DOMAINS.md`, replace `docs/BUILDER-CLEANUP-PLAN.md` with the attached updated plan, and commit both on their own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

A custom domain served hosted form pages, and there are none now. It never routed anything even before: the web app has no middleware and no host-based routing, so a verified domain only pointed at the same app. Tenants are always resolved from the signed-in user, so removing domains doesn't change tenancy.

## Scope

**API**
- `apps/api/src/domains/` (controller, service, module) and `DomainsModule` in `app.module.ts`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `DOMAIN_CNAME_TARGET` in `env.ts`

**Web**
- the Domains page and its sidebar entry
- the domain functions and types in `lib/api.ts` (including `DomainList`)

**Admin console**
- anything that shows or counts an organisation's domains
- the audit page's labels for domain actions, if any. Old dev rows then show the raw action name, as agreed in brief 2.

**Prisma**
- one forward migration drops `Domain` and its relation on `Organization`

**Housekeeping**
- the `CLOUDFLARE_*` and `DOMAIN_CNAME_TARGET` lines in the `.env` examples and the deploy compose file
- any `KNOWN-ISSUES.md` entry or comment about domains

**Out of scope:** `PUBLIC_TENANT_URL`, which builds invite, verification and reset links, and stays.

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit's A11 list. Report any differences.
- **`Organization.slug`:** what reads it, and whether anything still needs it once domains are gone, e.g. tenant URLs, subdomains or the admin console. Report only; don't remove it in this brief.
- **CORS and hosts:** anything in CORS settings, `next.config.mjs` or deploy config that exists to allow tenant domains.
- Every e2e step that touches domains, and what replaces it.
- The number of rows in `Domain` in the dev database.

**CP1 — Remove.**
- Apply the removal and the migration.
- Searches for `domain`, `cloudflare`, `cname` and `hostname`: report every remaining match with the reason it stays.
- Check that the removed routes and `/app/domains` return 404. In a browser, check:
  - the sidebar reads My forms, Templates, Team;
  - the web app's My forms page loads without page errors;
  - the admin console's overview and a tenant detail page load without page errors.

**CP2 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Report the suite count and results, and anything not done.
