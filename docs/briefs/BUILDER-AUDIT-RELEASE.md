# Builder brief — release audit (report only)

Builder repo, branch `formbuiler-service-dhawal`.

**First:** save this brief as `docs/briefs/BUILDER-AUDIT-RELEASE.md` and commit it on its own.

**This brief changes no product code.** It finds what would block the first release, with evidence, so Dhawal can choose what to fix. Fixes come in later briefs.

**Stop after CP0 and wait for approval before starting CP1.**

## What counts as what

| Severity | Test |
|---|---|
| **Blocker** | Can expose or corrupt data, or let one organisation reach another's; can break a client's live form (blank page, lost answers, a bad answer accepted); or stops the product being deployed or installed. |
| **Should fix** | Real defect or risk, but none of the above. |
| **Later** | Improvement, polish, or a feature. |

Every finding says whether it was **reproduced** (with the steps and result) or is **suspected** from reading code (with file and line). Don't rate a suspicion as a blocker without saying what would confirm it.

## Already known — record, don't re-investigate

- **Rate limiting on signed-in routes:** on hold by decision. List it once as known.
- **Privacy and Terms pages:** on hold by decision.
- **The renderer package:** audited separately in its own repo.

## Areas

**1. Permissions.**
- Every API route: who may call it, and what the code checks. List the role model as it exists (owner, admin, editor, viewer, or whatever the code has).
- In particular: can a viewer save, delete, download, restore a version, change templates, or invite people, by calling the API directly? The UI hiding a button proves nothing.
- The admin console's routes: who can reach them.

**2. Organisation isolation.**
- Every database query that reads or writes organisation data: is it scoped to the caller's organisation?
- Reproduce with two throwaway accounts in two organisations: try to read, save, download, list versions of, and use templates belonging to the other, by id.
- Are ids guessable?

**3. Sign-in and sessions.**
- Token storage, expiry, sign-out, password reset, email verification, invitations.
- Secrets: how the signing secret is set, any default or committed secret, `.env` files in the repo or its history.
- CORS and cookie settings in production configuration.

**4. Input handling.**
- Anywhere text from authors is rendered as HTML (`dangerouslySetInnerHTML` or similar) in the web app or admin console.
- Body size limits, deeply nested JSON (Prisma refuses JSON deeper than 128 levels), option import files.
- Whether any API accepts URLs or makes outbound requests (the webhook SSRF was removed; confirm nothing similar remains).

**5. Form data integrity.**
- Versions: every save inserts one; concurrent saves from two tabs; restore; Download always gives the latest saved version and writes nothing.
- **Final gate:** run the renderer's own integrity check (from the vendored `@zoworkhq/forms` 0.27.0 `/core`) on every form and template in the local database and every test fixture. Report any that the builder saves but the renderer would refuse at mount. Then report whether Download checks this today (expected: no).

**6. Build and deploy.**
- Nothing has been pushed, so CI has never run. Check the workflow files for errors without running them on GitHub.
- A full production build of every app. The Windows standalone step fails locally; run the build in Docker (Linux) so it completes.
- Build every Dockerfile.
- Migrations on an empty database, from zero to the latest.
- Required environment variables: listed, documented, and failing loudly when missing.

**7. Dependencies.** `pnpm audit`; report high and critical findings and whether the vulnerable code is actually reachable.

**8. Public pages.** The home page, `/docs`, `.md` routes and `llms.txt`: confirm nothing signed-in or organisation-specific is reachable, and nothing in them calls the API.

**9. Test reliability.** Four recurring patterns in recent reports:
- the API's `nest --watch` restarting during e2e runs ("fetch failed");
- `docs.spec.ts` failing on `toHaveURL(/\/docs$/)` after a client-side click, passing on retry;
- a leftover Vite holding port 5173;
- timeouts when many tests run at once against `next dev`.

Confirm each cause with evidence (for example: which file changes trigger the restart) and propose a fix. These are **should fix**, not blockers.

## Rules

- No product code changes. Scripts written only to investigate stay out of the product code (a scratch folder, or `scripts/audit/` committed with the report if they are worth keeping).
- Throwaway accounts and data only; delete every one before reporting.
- Only test against your own local servers and containers. Never send requests to anything outside this machine.
- No destructive database operations beyond throwaway data.
- Stop every server you start. Don't push.

## Checkpoints

**CP0 — Inventory. Stop and wait.**
- Every API route with its method, path, and the permission check it applies today.
- The role model and where it is enforced.
- The list of database models holding organisation data.
- The plan for each area above, including what you'll reproduce and how.

**CP1 — Findings.**
- Write `docs/audits/RELEASE-AUDIT-BUILDER.md`, and commit it.
- One table per area: ID, finding, severity, reproduced or suspected, evidence (steps and result, or file and line), suggested fix, rough size (small / medium / large).
- A summary at the top: blockers first, then should-fix, then later.
- Report anything you couldn't check, and why.
