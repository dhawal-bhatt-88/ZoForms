# Builder brief — release fixes from the audit

Builder repo, branch `formbuiler-service-dhawal`. Follows `docs/audits/RELEASE-AUDIT-BUILDER.md` (`8e1813a`). Finding IDs below are that report's. Where this brief describes a finding differently from the report, the report and the code win; say so in CP0.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-RELEASE-FIXES.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## Decisions already made

- **Deployment is out of scope.** D1 (HTTPS), D2 and D3 (missing URLs falling back to localhost), D5 (Google Fonts at build time), proxy and trusted-IP settings, and anything else about how the product is hosted: mark them **on hold: deployment** in the report. Don't fix them here.
- **Rate limiting** and **Privacy and Terms pages:** on hold, as before.
- **Google sign-in:** fix S2 now.
- **Members of two organisations:** a user belongs to one organisation in version 1. Refuse the second, don't build a switcher.

## The fixes

**1. Reset and verify links are never returned in a response (S1, and the verify-link part of S6).**
- No API response contains a reset or verify link or token, in any environment, unless an explicit test-only setting is on. CP0 proposes its name and confirms it can't be on when `NODE_ENV=production` (the API refuses to start if it is).
- If email isn't configured, forgot-password still returns the same response and sends nothing; the server logs that email isn't configured, without the link.
- Forgot-password returns the same response whether or not the address has an account.
- CP0 lists every test and script that reads a link from a response today, and how each will get it instead.

**2. Every signed-in request checks the user, the membership and the organisation (I1, P1).**
- `AuthGuard` loads, in one query, the user, their membership in the token's `orgId`, and the organisation. It refuses with 401 when the user or organisation isn't active or the membership no longer exists.
- It puts the current role on the request, and `assertCanEdit`, `assertMember` and `assertManager` use it, so a role change takes effect on the next request.
- `AdminGuard` is unchanged, except for item 3.
- The web app, on a 401 from a signed-in call, clears its token and goes to sign-in with a plain message. CP0 proposes the wording.

**3. Tokens can be revoked (lead 3).**
- A per-user value (for example `sessionsValidFrom`) that the guard compares with the token's issue time. Password reset and password change set it, so every older token stops working.
- Applies to the web and admin tokens. CP0 says whether impersonation tokens follow the impersonated user's value.
- No sign-out-everywhere button in this brief.

**4. Google sign-in can't land in someone else's account (S2).**
- An unverified user can't send invites. The API refuses with a clear message, and the Team page says why and offers to resend the verification email.
- When Google sign-in matches an existing account whose email isn't verified: mark it verified, remove its password, revoke its sessions (item 3), then sign in. Whoever set the password loses access.
- An existing verified account: unchanged.
- CP0 reports any other way an unverified account can give someone else access (pending invites, API keys, anything else), so the rule above covers them all.

**5. One organisation per user (lead 6).**
- Creating an invite for an address that already has a membership in another organisation is refused, with a clear message for the inviter. Accepting such an invite (one created earlier) is refused the same way.
- The membership lookup at sign-in gets an `orderBy`, so the result is predictable.
- CP0 reports any user in the local database with more than one membership.

**6. Organisation name in emails (lead 5's finding).** Escape every value put into email HTML, in every email template, not only invites. Test with the hostile name from the audit.

**7. Admins can't impersonate admins (P2).** Impersonating a platform admin, or yourself, is refused with 403 and logged.

**8. Next.js security updates (DEP1).** Move the web app, and the admin console if it uses Next, to the latest 15.5.x patch, at least 15.5.28. That release and 15.5.24 fix remote code execution in the image optimiser (AVIF and SVG) and a denial of service in Server Actions. Keep matching versions of `eslint-config-next` and related packages. Re-run `pnpm audit` and report what's left.

**9. A stale tab can't overwrite newer work (V1).**
- Save sends the version it started from. If that isn't the latest, the API returns 409 and saves nothing.
- The editor tells the author and offers a choice. CP0 proposes the wording and options, at least: load the latest version (losing these edits), or save these edits as a new version anyway.
- Restore and duplicate keep working.

**10. Download checks the form first (V2).**
- Before returning the file, run the renderer's `assertSchemaIntegrity` (from `@zoworkhq/forms/core` 0.27.0) on the built artifact. If it fails, return a clear error naming the problem and download nothing.
- CP0 says how the API gets the package (it is vendored in `apps/web` today) and that the version stays the same as the web app's.

**11. Other should-fix items.** CP0 lists every remaining should-fix item from the report with its size and a recommendation: in this brief, later, or on hold (deployment). Nothing outside items 1–10 is changed without approval at CP0.

## Docs

Update any page under `/docs` that describes behavior these fixes change, such as team invites, version history, Download, or sign-in. Same accuracy rules as the docs briefs: from the code, messages quoted exactly.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing unit test, API test, web spec and e2e suite keeps passing, except tests that rely on links in responses (CP0 lists them).
- Every fix gets a test that fails before it and passes after. Re-run `scripts/audit/`: every finding it reproduced as a blocker must now fail to reproduce. Add the new cases (unverified invite refused, second organisation refused, stale save refused, Download refusing a broken form, admin impersonation refused).
- Run the API from `node dist/main.js`, not `nest --watch`, for the e2e and audit scripts.
- Throwaway data only; delete it before reporting. Stop every server you start, by process id. Don't push.
- Commit at each checkpoint once tests pass.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- For each fix: the files involved, the current behavior with its source, and the proposed change.
- Item 1: the test-only setting and every test that changes.
- Item 2: the guard's query, and the web app's 401 message.
- Item 3: the field, migration, and what impersonation tokens do.
- Item 4: every way an unverified account can give access.
- Item 5: the messages, and existing multi-membership users.
- Item 8: the target version and the advisories it closes.
- Item 9: the editor's message and options.
- Item 10: how the API gets the package.
- Item 11: the remaining should-fix list with recommendations.

**CP1 — Sign-in and access: items 1–5 and 7.** Migration, guards, web app 401 handling, tests, audit scripts re-run.

**CP2 — Items 6, 8, 9 and 10, and any item 11 work approved at CP0.**

**CP3 — Checks and report.**
- Full e2e, `verify-a11y`, `verify-docs`, contrast gate, web spec, typecheck, unit tests.
- Screenshots, light and dark, of each new message: the 401 sign-in message, the unverified Team page, the second-organisation refusal, the stale-save choice, and the Download error.
- Update `RELEASE-AUDIT-BUILDER.md`: a Status column (fixed in commit, later, on hold: deployment, on hold: decision) and a short decisions section.
