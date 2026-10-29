# Release-audit scripts

The scripts behind [docs/audits/RELEASE-AUDIT-BUILDER.md](../../docs/audits/RELEASE-AUDIT-BUILDER.md). Re-run them before a release, and after fixing a finding, to see it change from FAIL to PASS.

Each one:

- refuses to run unless the API (`AUDIT_API_URL`, default `http://localhost:4100`) and the database (`DATABASE_URL`, read from `apps/api/.env`) are on localhost or 127.0.0.1;
- makes only throwaway accounts, `audit-<run>-<who>@example.test`, and deletes them with their organisations, invites and admin audit rows when it ends, also when it fails;
- prints PASS, FAIL or NOTE per check. FAIL means the behaviour the check names didn't happen; for most findings in the report, that's the finding.

Run the API from its build, not `nest --watch` (a watch restart mid-run shows up as "fetch failed"):

```sh
pnpm --filter @formbuilder/form-schema build && pnpm --filter api build
cd apps/api && PORT=4100 node dist/main.js
```

| Script | What it checks |
|---|---|
| `permissions.js` | The role-by-route matrix; a lowered role, a removed member; a suspended user and organisation; the admin routes, their audit rows, and impersonation. |
| `sessions.js` | Tokens, email verification, password reset, sign-out, invites, a member of two organisations, the invite email's HTML, and Google sign-in merging into an existing account. The last two drive `apps/api/dist` in-process, with the mailer and Google's verifier replaced; nothing is sent. |
| `versions-and-inputs.js` | Ids; versions (each save, identical, simultaneous and stale saves, restore, download); body limits; deeply nested JSON. |
| `integrity-gate.mjs` | Every form version and template in the database, the system template files and the schema fixtures, through `buildArtifact` and the vendored renderer's mount checks; plus edge cases through the save pipeline. Read-only. `--all-versions` checks every version, not just the latest. |
| `public-pages.js` | The home page, docs, `.md` routes and `llms.txt` of a production web build (`AUDIT_WEB_URL`, default `http://127.0.0.1:3300`) in a browser, with and without a token: no API calls, no token sent. |
