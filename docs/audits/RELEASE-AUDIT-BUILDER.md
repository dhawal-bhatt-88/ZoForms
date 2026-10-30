# Release audit — builder

Brief: [BUILDER-AUDIT-RELEASE.md](../briefs/BUILDER-AUDIT-RELEASE.md). Branch `formbuiler-service-dhawal`, 29 October 2026. Report only: no product code was changed.

Severity is the brief's: **Blocker** can expose or corrupt data, let one organisation reach another's, break a client's live form, or stop deployment; **Should fix** is a real defect or risk short of that; **Later** is improvement. Every finding is **reproduced** (steps and result) or **suspected** (file and line, and what would confirm it).

The scripts that reproduce most findings are in [scripts/audit/](../../scripts/audit/README.md). They run only against localhost, make only throwaway accounts, and delete them when they end. Every throwaway account, organisation, invite and audit row was deleted; afterwards the local database had none left.

## After the release fixes

Brief: [BUILDER-BRIEF-RELEASE-FIXES.md](../briefs/BUILDER-BRIEF-RELEASE-FIXES.md). Commits `3540fc6` (sign-in and access), `bdead6a` (contract: group depth) and `0b81b34` (email, Next.js, stale saves, Download, group depth); the checks and this update are the commit after them. The summary tables now carry a **Status** for each finding: fixed in a commit, later, on hold: deployment, on hold: decision, or accepted. Their audit-time column, reproduced or suspected, is now **Evidence**.

Re-running [scripts/audit/](../../scripts/audit/README.md) against the fixed build: no check fails. Every blocker the scripts reproduced (S1, I1, P1, S2) no longer reproduces, nor does any should-fix in CP1 or CP2.

**Production images, rebuilt after the fixes (Linux, Docker).** All three built on the first attempt: API 1.59 GB, web 446 MB, admin 430 MB, with Next.js 15.5.28; the web image has sharp 0.35.5. The API image, against a throwaway Postgres 16, applied all 21 migrations and started, which means it loaded the renderer's `/core` (0.27.0, from the vendored tarball): the API doesn't start without it. Checked against it, 17 of 17:

- a sign-up response carries no verification link;
- a stale save is refused with 409 `VERSION_CONFLICT` and `latestVersion`;
- Download returns the form file, which passes the renderer's mount checks;
- Download of a stored version the renderer would refuse is 422 `FORM_INVALID`, naming the problem, with no file;
- forgot-password answers only `{"ok":true}`;
- the web and admin images serve their pages, and the web image's client code calls the API it was built for.

The image also refuses to start in production with a missing, short (`a`) or example `JWT_SECRET`, and with `RETURN_EMAIL_LINKS_FOR_TESTS=true`, each with its message. `public-pages.js` passes on the web image. The containers, network, images and the database's volume were removed.

### Decisions

- **Deployment is out of scope:** D1 (HTTPS), D2 and D3 (missing URLs falling back to localhost), D5 (Google Fonts at build time), proxy and trusted-IP settings, and DEP3 (Nest 11): on hold: deployment. DEP3 is there because proxy-addr's advisory becomes reachable once `trust proxy` is set behind a load balancer, and fixing it, with multer, qs and the SSE advisory, needs Nest 11.
- **Rate limiting** and **Privacy and Terms pages:** on hold: decision, as before.
- **Reset and verification links** are never in a response, except with the test-only `RETURN_EMAIL_LINKS_FOR_TESTS`, which the API refuses in production. Forgot-password gives the same answer for every address.
- **Every signed-in request** checks the membership, the user and the organisation (401 otherwise), and the role is read fresh. Sign-in refuses a suspended user or organisation, and an account in no organisation, with a message.
- **Revocation:** `User.sessionsValidFrom`. A password reset and a Google claim revoke every older token: web, admin and impersonation. There is no sign-out-everywhere.
- **Verification now unlocks inviting:** an unverified account can't invite. Without email configured, an account made with a password can't verify, invite or reset (DEPLOY.md says so). With email configured, invite links go only by email, and accepting one verifies the account.
- **Google sign-in into an unverified account:** the account becomes the Google user's: verified, no password, older tokens revoked, memberships that came from an invite to the address removed, and a new organisation if none is left. "Came from an invite" is worked out, not stored: a membership in an organisation that has an Invite row for the address, in any status. The organisation made at sign-up never has one. **Accepted:** an account removed from its own team and later invited back loses that team on a Google claim, and gets a new organisation instead.
- **One organisation per account (version 1):** inviting or accepting while in another team is refused; there's no switcher.
- **Impersonation:** never yourself, another platform admin or a suspended user or team. The admin console refuses impersonation tokens.
- **Stale saves:** `baseVersion` is optional for scripts at the API; the editor always sends it, and asks when a save is refused.
- **Download** runs the renderer's `assertSchemaIntegrity`, `resolveNavigation` and `resolveDrafts` from `@zoworkhq/forms/core`, installed from the web app's own vendored tarball. Mount also runs `assertFormIdentity`, which `/core` doesn't export: it checks that `formId` and `formVersionId` are non-blank strings. Download stamps both from database UUIDs, after the stored content, so no file the builder can produce fails it. **No renderer hand-over needed.**
- **Groups nest at most 20 deep** in the builder (contract §2.1 and §6, `bdead6a`; the renderer has no limit).
- **Dependencies:** next 15.5.28 and sharp 0.35.5; body-parser 1.20.9. `pnpm audit`: 102 findings before, 83 after, none reachable but zod's (later, L11).
- **Later:** L10 (the editor's hydration warning) and L11 (zod 4), with T5 (`home.spec.ts`).

## Summary

### Blockers (6)

| ID | Finding | Evidence | Size | Status |
|---|---|---|---|---|
| [S1](#3-sign-in-and-sessions) | Without email configured (`RESEND_API_KEY` is documented as optional), `forgot-password` returns the reset link to whoever asks: anyone can take over any account by its address. | Reproduced, on the production image | Small | Fixed in `3540fc6` |
| [I1](#2-organisation-isolation) | A removed member keeps reading the organisation's forms, versions, downloads and templates for up to 30 days with their old token. | Reproduced | Small | Fixed in `3540fc6` |
| [P1](#1-permissions) | Suspending a user or an organisation does nothing outside the admin console: they still sign in, read, save and download. | Reproduced | Small (with I1) | Fixed in `3540fc6` |
| [S2](#3-sign-in-and-sessions) | Google sign-in merges into an existing, unverified password account with the same address, so whoever registered the address first keeps access to the real owner's account. Applies once Google sign-in is configured. | Reproduced (Google's verifier stubbed) | Small | Fixed in `3540fc6` |
| [DEP1](#7-dependencies) | Next.js 15.5.20 has critical advisories, including unauthenticated remote code execution in the image optimiser; the web app serves `/_next/image`. | Suspected: reachability not confirmed | Small | Fixed in `0b81b34` |
| [D1](#6-build-and-deploy) | The documented deployment serves passwords and 30-day tokens over plain HTTP on ports open to the internet; HTTPS is "optional". | Suspected (from the deploy docs) | Medium | On hold: deployment |

I1 and P1 share one fix: the auth guard checks, on every request, that the membership still exists and that the user and organisation are active.

### Should fix (21)

| ID | Finding | Evidence | Size | Status |
|---|---|---|---|---|
| V1 | A save from a tab that is behind silently replaces the newer version; nobody is told. | Reproduced | Medium | Fixed in `0b81b34` |
| S3 | Tokens can't be revoked: sign-out only clears the browser, and a password reset leaves old tokens working. | Reproduced | Medium | Fixed in `3540fc6` (a password reset and a Google claim revoke; no sign-out-everywhere, by decision) |
| S4 | Lead 6: a user who belongs to organisation A and accepts an invite to B can never reach B. | Reproduced | Medium | Fixed in `3540fc6`: a second organisation is refused (one per account) |
| S5 | Sign-in returns a 500 for a user with no organisation, such as a removed member. | Reproduced | Small | Fixed in `3540fc6` |
| S6 | Email verification proves nothing (sign-up returns the link) and unlocks nothing. | Reproduced | Small | Fixed in `3540fc6` |
| S7 | The organisation name goes unescaped into the invite email's HTML and subject. | Reproduced | Small | Fixed in `0b81b34` |
| S8 | A user who signed up with Google can't accept an invite: accepting needs a password. | Suspected | Small | Later |
| P2 | A platform admin can impersonate another platform admin; what they then do is logged as the other admin. | Reproduced | Small | Fixed in `3540fc6` |
| N1 | Groups nested 60 or more deep pass every check, then fail with a 500 when stored. | Reproduced | Small | Fixed in `0b81b34` (contract `bdead6a`) |
| V2 | Download doesn't run the renderer's integrity check. Nothing found today would fail it. | Confirmed from code | Medium | Fixed in `0b81b34`, at Download; at save time: later |
| D2 | Production builds silently fall back to `http://localhost:4000` when `NEXT_PUBLIC_API_URL` is missing. | Reproduced | Small | On hold: deployment |
| D3 | The API boots in production with `PUBLIC_TENANT_URL` unset, so its emails link to `http://localhost:3000`. | Reproduced | Small | On hold: deployment |
| D4 | Any `JWT_SECRET` is accepted in production except the dev default, even one character. | Reproduced | Small | Fixed in `3540fc6` |
| D5 | The web and admin builds download Google Fonts at build time; the admin Docker build failed on it once. | Reproduced | Small | On hold: deployment |
| DEP2 | Denial-of-service advisories in code that is reachable: body-parser (compressed bodies) and zod (large collections). | Suspected | Small | body-parser: fixed in `0b81b34`. zod: later (L11) |
| DEP3 | Advisories that only Nest 11 fixes: proxy-addr (critical, IP spoofing through a trust subnet), multer (DoS), qs (DoS) and @nestjs/core (SSE injection). `@nestjs/platform-express` 10.4.22, the newest 10.x, pins them. None is reachable today, but proxy-addr becomes reachable once `trust proxy` is set behind a load balancer. | Found during the release fixes (CP2) | Medium | On hold: deployment |
| T1 | e2e "fetch failed": `nest --watch` restarts whenever `apps/api/src` or form-schema's built `.d.ts` changes, and the API is down for about a second each time. | Reproduced | Small | Later |
| T2 | `docs.spec.ts` flakes on steps that wait for client-side JavaScript, under parallel `next dev`. | Reproduced (sibling steps) | Small | Later |
| T3 | A leftover Vite holds port 5173; nothing in the repo starts or checks it. | Suspected | Small | Later |
| T4 | Eight parallel workers against one `next dev` produce timeouts; one worker doesn't. | Reproduced | Small | Later |
| D6 | CI's e2e job runs the Playwright suite against `next dev`, the setup T2 and T4 make flaky. | Suspected | Small | Later |

One observation isn't a defect: the local database holds a single form, so the integrity gate's database pass checked little. Re-run it against real data before release (V3).

### Later (13)

L1 any `localhost` origin is allowed by CORS in production · L2 the impersonation token travels in the URL · L3 tokens in `localStorage` with no `script-src` CSP · L4 `GET /v1/invites/:token` isn't throttled · L5 the option import file has no size cap · L6 the API image is 1.58 GB with dev dependencies and runs as root · L7 critical advisories in dev-only tools (vitest, tinypool) · L8 the admin console is open to the internet (its data is behind `AdminGuard`) · L9 the minimum password is 6 characters · T5 `home.spec.ts` flakes on a click before hydration, as T2 · L10 the editor's loading skeleton renders the settings pane 280px wide on the server and 300px in the browser, a hydration warning in development · L11 zod 4 (DEP2's zod advisory), reachable only by a signed-in author · L12 the typecheck doesn't cover `apps/web/e2e/`, so a mistake in a spec shows only when the spec runs. T5, L10 and L11 were found during the release fixes, L12 adopting renderer 0.28.0.

Status: all later.

### Already known (recorded, not re-investigated)

- **Rate limiting on signed-in routes:** on hold: decision. Only the credential routes are throttled: sign-up, login, Google, reset and verification at 30 a minute per IP, forgot-password at 5, and invite accept. That includes the login throttle of 30 a minute per IP.
- **Privacy and Terms pages:** on hold: decision.
- **The renderer package:** audited in its own repo. Here it's used only as the integrity check in area 5.

### What passed

- **Roles:** the role matrix is exactly as intended for all 23 routes × 4 roles. A viewer can't save, delete, restore, change templates or invite.
- **Membership changes:** a role lowered after sign-in is enforced at once.
- **Cross-organisation:** the cross-organisation suite passes 34 of 34, and every organisation-data query is scoped.
- **Ids:** they're random v4 UUIDs.
- **Admin console:**
  - Its routes refuse non-admins.
  - Suspensions, impersonation and admin deletes are all audited with the admin's id and email.
- **Versions:** each save inserts one; simultaneous saves never collide; restore appends; Download is a pure read.
- **Body limits:** they hold.
- **Integrity gate:** everything the builder has saved, or would save, mounts in the renderer.
- **Migrations:** they apply from zero with no drift.
- **Docker:** all three Dockerfiles build.
- **Checks:** typecheck, 1,109 unit tests, the contrast gate and `actionlint` pass.
- **Public pages:** they call no API and send no token.
- **History:** no secret is committed anywhere in it.

---

## 1. Permissions

**Role model.**

- **Roles in an organisation:** `Membership.role` is `OWNER | ADMIN | EDITOR | VIEWER`.
- **Platform admin:** `User.isAdmin` is the only check for the admin console.
- **Writes:** form and template writes call `assertCanEdit` ([can-edit.ts](../../apps/api/src/auth/can-edit.ts)), which looks the membership up and refuses `VIEWER`.
- **Team management:** calls `assertManager` (`OWNER` or `ADMIN`), plus owner-only rules ([team.service.ts:225-241](../../apps/api/src/team/team.service.ts#L225-L241)).
- **Reads:** check only the `orgId` inside the token ([auth.guard.ts:20](../../apps/api/src/auth/auth.guard.ts#L20)).

**Role matrix** (`permissions.js`). Each role called each route directly, on targets the owner made:

| Route | OWNER | ADMIN | EDITOR | VIEWER |
|---|---|---|---|---|
| list / get form, versions, download, templates, members | 200 | 200 | 200 | 200 |
| create form, from template, save, restore, duplicate, delete | 2xx | 2xx | 2xx | 403 |
| create, rename, delete, duplicate template | 2xx | 2xx | 2xx | 403 |
| list, create, revoke invites; change role; remove member | 2xx | 2xx | 403 | 403 |
| invite an OWNER | 201 | 403 | 403 | 403 |
| any of the 11 admin routes | 403 | 403 | 403 | 403 |

The anonymous call to the admin routes returned 401.

**Admin console.**

- Its pages are static and client-side.
- Every piece of data comes through `/v1/admin/*` behind `AdminGuard`, which requires `isAdmin`, checked in the database, and `status = active`.
- The routes, as an organisation owner who isn't a platform admin: all 11 returned 403. Called anonymously, they returned 401.

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| P1 | **Suspension isn't enforced.** Suspending a user or an organisation is checked only by `AdminGuard`. Login, Google sign-in, invite accept, reset and `AuthGuard` never read `User.status` or `Organization.status`. It meets the blocker test because the suspended person keeps the data access the platform meant to remove, such as a compromised account an admin has cut off. | Blocker | Reproduced | `permissions.js`, with an admin suspending them through `PATCH /v1/admin/users/:id`: the suspended user signs in (201), reads a form (200) and **saves a new version** (200). After `PATCH /v1/admin/orgs/:id {status:"suspended"}`, a member signs in (201), saves (200) and downloads (200). | One check in `AuthGuard`: load the membership, user and organisation per request, and refuse unless all are active. Refuse in `issue()` too. Shares the fix with I1. | Small |
| P2 | **Impersonation reaches other platform admins, and the audit names the wrong person.** `impersonate` accepts any user. A token for another admin passes `AdminGuard`, which records the impersonated admin as the actor and ignores the `impersonatedBy` claim. A suspended user can also be impersonated. | Should fix | Reproduced | Admin 1 impersonated admin 2 (201), opened `/v1/admin/overview` with that token (200) and deleted a form (200). The `form.deleted` row names **admin 2**. [admin.service.ts:198-218](../../apps/api/src/admin/admin.service.ts#L198-L218), [admin.guard.ts:36](../../apps/api/src/admin/admin.guard.ts#L36). | Refuse to impersonate a platform admin. Have `AdminGuard` refuse tokens that carry `impersonatedBy`. Put `impersonatedBy` into audit rows and into any log written while impersonating. | Small |

Audit rows checked: `user.suspended`, `org.suspended`, `org.reactivated`, `user.impersonated`, `form.deleted` and `user.deleted`. Every one had the acting admin's `actorId` and `actorEmail`, the target, and useful meta: the target's email, or the form's title.

## 2. Organisation isolation

**Queries.** Every Prisma call on organisation data outside the admin module was classified:

- **Reads** are filtered by the token's `orgId` (`workspace: { orgId }` for forms, `OR [orgId null, orgId]` for templates).
- **Writes by bare id** (`form.delete`, `template.delete`, `template.updateMany`, `invite.update`) always follow a scoped lookup of the same id in the same request.
- **The one unscoped `deleteMany`** (system-templates.ts:153) is limited to `orgId: null`.
- **Admin queries** are cross-organisation by design.

**Cross-organisation by id.** [e2e/verify-tenant-isolation.js](../../e2e/verify-tenant-isolation.js) was run against the built API and passed 34 of 34. Organisation B can't read, save, rename, duplicate, delete, list versions of, restore into, or download organisation A's forms, and can't see, use, change or copy A's templates. Each refusal is the same 404 as for an id that doesn't exist, and A's rows are byte-for-byte unchanged afterwards.

**Ids.** Forms, workspaces, versions and users have random v4 UUIDs (`versions-and-inputs.js`). Invite, verification and reset tokens are 24 random bytes. System template ids (`sys_form_bug`) are predictable but public to every organisation by design.

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| I1 | **A removed member keeps reading the organisation.** Reads trust the token's `orgId` and never check membership. Writes do check it (`assertCanEdit`), and so does the team list. A removed member keeps read access to everything else for the rest of the token's 30 days. | Blocker | Reproduced | `permissions.js`: the owner removes an editor (200). With the editor's old token, list forms, get a form *with its content*, list versions, **download the artifact *with its content***, and list templates all return 200. Saving (403) and the team list (403) are refused. [forms.service.ts:49-70](../../apps/api/src/forms/forms.service.ts#L49-L70), [forms.service.ts:263-269](../../apps/api/src/forms/forms.service.ts#L263-L269), [auth.guard.ts:20](../../apps/api/src/auth/auth.guard.ts#L20). | Check membership in `AuthGuard` on every request, as P1. Put the role on `req.user` so services stop looking it up separately. | Small |

## 3. Sign-in and sessions

**As built.**

- **Token:** an HS256 JWT, `{sub, email, orgId, workspaceId}`, lasting 30 days ([auth.module.ts:12](../../apps/api/src/auth/auth.module.ts#L12)). It's kept in `localStorage` (`frame_token`; `frame_admin_token` for the admin console) and sent as a bearer header, never as a cookie.
- **Links:** verification links last 3 days, reset links 1 hour, invites 7 days. Inviting the same address again replaces the token.
- **Invites:** a used, expired or revoked invite is refused (`sessions.js`).
- **Secrets:** `JWT_SECRET` defaults to `dev-secret-change-me`. Boot refuses that default in production, whether the variable is unset or empty ([env.ts:50](../../apps/api/src/config/env.ts#L50)).
- **Committed history:** only `.example` env files have ever been committed. A scan of every commit for key and secret patterns found only placeholders, dev defaults, and one made-up `whsec_…` value shown on a removed HTML prototype.
- **CORS:** see L1.
- **Headers:** helmet sets HSTS, `nosniff` and `X-Frame-Options`. The web app and admin console deny framing.

**What email verification unlocks today: nothing.**

- `emailVerified` is read only by the web app's banner ([app-shell.tsx:81](../../apps/web/src/components/app-shell.tsx#L81)).
- No route checks it.
- Google sign-in (S2) merges without regard to it.

That is why S6 is a should-fix, not a blocker.

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| S1 | **Anyone can reset any account's password when email isn't configured.** `forgot-password` returns `resetUrl` in the response whenever `RESEND_API_KEY` is unset ([auth.service.ts:246](../../apps/api/src/auth/auth.service.ts#L246)). That's meant for development, but nothing stops it in production, and DEPLOY.md and `.env.prod.example` call the key optional ("every feature works without them"). | Blocker | Reproduced | Locally: `POST /v1/auth/forgot-password {email: <someone else>}` returns `resetUrl`; `POST /reset-password` with it gives 201; signing in with the new password gives 201. On the **production image** (`NODE_ENV=production`, no Resend key), the response was `{"ok":true,"resetUrl":"http://localhost:3000/reset-password/…"}`. | Return `resetUrl` only when `NODE_ENV !== "production"`. Better, refuse to boot in production without `RESEND_API_KEY`: invites, verification and reset all depend on it. | Small |
| S2 | **Google sign-in merges into a pre-registered account.** If an unverified password account already has the address, Google sign-in signs in to *that* account and marks it verified, but leaves the password ([auth.service.ts:208-218](../../apps/api/src/auth/auth.service.ts#L208-L218)). Whoever registered the address first, with a password they chose, keeps access to everything the real owner later builds. A blocker once Google sign-in is configured (`GOOGLE_CLIENT_ID`). | Blocker | Reproduced, with Google's verifier stubbed in-process (no product code changed) | `sessions.js`: an "attacker" signs up `victim@` with their own password and never verifies. The real owner signs in with Google (stubbed `email_verified: true`) and gets **the same user id**, then creates a form. The attacker signs in with their password (201) and **downloads that form with its content** (200). | When Google signs in to an existing account that isn't verified, clear its password (and its tokens, after S3), or refuse and ask the owner to reset. | Small |
| S3 | **Tokens can't be revoked.** There's no sign-out route: the web app's `logout()` only removes the token from `localStorage`. A password reset doesn't invalidate tokens issued before it, and tokens last 30 days. | Should fix | Reproduced | `sessions.js`: after a password reset, the token issued before it still lists forms (200). After "sign-out", the token still works (200). | Add a `tokenVersion` (or `passwordChangedAt`) to `User`, put it in the token, and check it in `AuthGuard` (which reads the user anyway after I1/P1). Bump it on sign-out, password reset and removal. Consider a shorter lifetime. | Medium |
| S4 | **Lead 6: a user in two organisations can't reach the second.** `issue()` signs a token for `memberships[0]` ([auth.service.ts:268-269](../../apps/api/src/auth/auth.service.ts#L268-L269)). The queries that load memberships have **no `orderBy`** ([auth.service.ts:81](../../apps/api/src/auth/auth.service.ts#L81), [:178](../../apps/api/src/auth/auth.service.ts#L178), [:211](../../apps/api/src/auth/auth.service.ts#L211)), so the choice is whatever order Postgres returns. There's no organisation switcher. | Should fix | Reproduced | `sessions.js`: U owns organisation A and accepts B's invite. U then has memberships `A:OWNER, B:EDITOR`, but the accept response's token is for **A**, and so is signing in again. B's form is 404 on every token U can get. Twenty identical reads returned A first every time, but nothing guarantees that. | Order memberships deterministically. Make the accept response's token be for the organisation just joined, and add an organisation switcher (a token per organisation). | Medium |
| S5 | **Sign-in returns a 500 for a user with no organisation.** `issue()` reads `memberships[0].org` without a check. A member removed from their only organisation can't sign in, and gets a 500 instead of a message. | Should fix | Reproduced | `permissions.js`: the removed member's sign-in returned 500. The log shows `TypeError: Cannot read properties of undefined (reading 'org') at AuthService.issue`. | When there's no membership, return a clear 403 ("You're not in an organisation"), or create a personal organisation. | Small |
| S6 | **Email verification proves nothing.** Sign-up returns `emailVerifyUrl`, and `resend-verification` returns `verifyUrl`, **even when email is configured** ([auth.service.ts:45](../../apps/api/src/auth/auth.service.ts#L45), [:161](../../apps/api/src/auth/auth.service.ts#L161)). Anyone can verify an address they don't own. It unlocks nothing today (see above), so it's a defect rather than a hole. It would become one the moment something checks `emailVerified`. | Should fix | Reproduced | `sessions.js`: the link from the API's own response verifies the account; `/me` then shows `emailVerified: true`. | Return the link only outside production, as for S1. | Small |
| S7 | **Lead 5: HTML injection in the invite email.** The organisation name comes from the sign-up `name` (`"<name>'s team"`) and is put into the invite email's `<h1>` and subject unescaped ([team.service.ts:126-130](../../apps/api/src/team/team.service.ts#L126-L130), [mail.service.ts:57](../../apps/api/src/mail/mail.service.ts#L57)). Anyone can sign up with a crafted name and send a phishing link to any address from our sending domain. Mail clients strip scripts but render links and images. | Should fix | Reproduced (the email rendered in-process; nothing sent) | `sessions.js`, with the sign-up name `<img src=x onerror=alert(1)><a href="https://evil.example">Click here to keep your account</a>`. The rendered email is below. | Escape every interpolated value in `layout()` and in the bodies passed to it (`heading`, `role`, the org name). Better, give `layout` text, not HTML. | Small |
| S8 | **A Google-only user can't accept an invite.** Accepting as an existing user requires a password check against `passwordHash`, which is null for Google accounts ([team.service.ts:171-174](../../apps/api/src/team/team.service.ts#L171-L174)). | Should fix | Suspected. Confirm by inviting a Google-created account and accepting. | — | Let a signed-in user accept with their token instead of a password. | Small |

**The invite email with a hostile organisation name (S7)**, as `TeamService.createInvite` built it:

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px">
      <div style="font-size:18px;font-weight:800;letter-spacing:-.02em;color:#18181B">Zowork Forms</div>
      <div style="margin-top:20px;padding:24px;border:1px solid #ECEDF0;border-radius:16px;background:#fff">
        <h1 style="margin:0 0 8px;font-size:19px;color:#1B1D22">Join <img src=x onerror=alert(1)><a href="https://evil.example">Click here to keep your account</a>'s team on Zowork Forms</h1>
        <div style="font-size:14px;line-height:1.6;color:#3B3F47">You've been invited as <strong>Editor</strong>. Accept to get started.</div>
        <a href="http://localhost:3000/invite/<token>" style="display:inline-block;margin-top:20px;padding:11px 22px;background:#18181B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accept invite</a>
      </div>
    </div>
```

Subject: `You're invited to <img src=x onerror=alert(1)><a href="https://evil.example">Click here to keep your account</a>'s team on Zowork Forms`.

**Where else the organisation name appears:**

- **Web app:** the invite page, `Join {info.orgName}` ([invite/[token]/page.tsx:61](../../apps/web/src/app/(auth)/invite/[token]/page.tsx#L61)).
- **Admin console:** the tenant and user lists.

Both render it through React text, which escapes it. There's no `dangerouslySetInnerHTML` on author or organisation text in either app (area 4). The other emails (verification, reset) don't include it. **The invite email is the only unescaped place.**

## 4. Input handling

- **Author text as HTML:** none. The only `dangerouslySetInnerHTML` in the web app and admin console are two constant boot scripts in [layout.tsx:58-60](../../apps/web/src/app/layout.tsx#L58-L60). How the renderer treats author text belongs to its own audit.
- **Body limits** (`versions-and-inputs.js`):
  - 150 KB on an ordinary route returned 413.
  - A 1 MB save without sign-in returned 413; only signed-in saves get 10 MB.
  - An 11 MB signed-in save returned 413.
  - Malformed JSON returned 400.
- **Unknown keys:** stripped by the schema, so a 300-deep object under an unknown key is never stored. Form save, form template and preferences each returned below 500.
- **Outbound requests:** only `https://api.resend.com/emails` (a fixed URL) and Google's ID-token verification (`google-auth-library`). Nothing takes a URL from input, and the webhook SSRF is gone.
- **Option import:** the file is read and parsed in the author's browser and never uploaded. There's no size cap (L5).

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| N1 | **Deep groups pass every check, then fail with a 500.** Groups nested 60 or more deep pass the schema and the save rules, then Prisma refuses the JSON (more than 128 levels) at `formVersion.create`. The author sees "Couldn't save: Internal server error" and nothing names the cause. The same happens for a group template. Nothing is stored or corrupted, so it's not a blocker. In practice it's reached by calling the API; nobody builds 60 levels in the editor by hand. | Should fix | Reproduced | Saving groups nested *n* deep: 20–58 returned 200; 60, 62 and 64 returned 500 (`Invalid this.prisma.formVersion.create() invocation`). A group template nested 200 deep also returned 500. | Add a nesting limit to `formProblems` (for example 20 levels; the renderer mounts 58), with a message naming the group. Apply it to both form saves and templates. | Small |

## 5. Form data integrity

**Versions** (`versions-and-inputs.js`):

- **A save** inserts exactly one row. An identical save returns 409 `NO_CHANGES` and adds no row.
- **Eight simultaneous saves** produced no 500, and the version numbers stayed unique and gapless. The unique index turns a lost race into 409 `VERSION_CONFLICT`.
- **Restore** appends a new version labelled `Restored from vN` and leaves old rows untouched.
- **Download** twice gives the latest version's id and identical bytes, and writes nothing.

**Final gate** (`integrity-gate.mjs`, renderer 0.27.0 `/core`). For each item, the script built the artifact as Download does, then ran what `@zoworkhq/forms/react` runs at mount: `assertSchemaIntegrity`, `resolveNavigation` and `resolveDrafts`. It covered:

- every form version and every template in the local database;
- the 16 system template files;
- the 26 committed fixtures (docs examples and the home page's PHQ-2);
- the 15 artifacts the e2e suites had downloaded locally.

Then 8 edge cases went through the server's own save pipeline: an empty form, presentational blocks only, 58-deep groups, a repeat inside a repeat, a 5,000-option dropdown, emoji, RTL and markup in labels, a page holding only a heading, and a condition. **82 of 82 mount; none is refused, and none has a renderer warning.** The builder's 27 block types plus `group` and `page` match the renderer's `KNOWN_TYPES` exactly.

**Does Download check this today? No.** `getArtifact` ([forms.service.ts:203](../../apps/api/src/forms/forms.service.ts#L203)) builds the artifact and returns it. The API doesn't depend on `@zoworkhq/forms` at all.

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| V1 | **A tab that is behind silently replaces the newer version.** The save sends only the schema, not the version it started from ([api.ts:270-275](../../apps/web/src/lib/api.ts#L270-L275)). The server compares only with the latest content, so the later save wins. The other tab's work survives only in history, and nobody is told. Download then gives the older content. It's not a blocker because nothing is destroyed: restore recovers it. But an author can ship a form missing a colleague's questions without knowing. Templates already guard against this with `version`. | Should fix | Reproduced | Tab 2 opens at v4. Tab 1 saves v5, adding a question. Tab 2 then saves its own edit and gets 200 v6. The download now has one question, and tab 1's question is gone from the latest version. | Send the base version with the save, and refuse with 409 `VERSION_CONFLICT` when it isn't the latest, as `PATCH /v1/templates/:id` does. The editor offers a reload. | Medium |
| V2 | **Download doesn't run the renderer's integrity check.** The gate found no current content that fails, so this is protection against future drift between builder and renderer, not a live defect. | Should fix | Confirmed from code | Above. | Run the integrity check at save time (better: refuse what wouldn't mount) and at Download. Either vendor `/core` into the API or share the check through form-schema. Keep `integrity-gate.mjs` as a release check. | Medium |
| V3 | **The gate's database pass checked little.** The local database holds one form, because the e2e suites delete theirs. Re-run `integrity-gate.mjs --all-versions` against a copy of production data before release. | — | Observation | — | — | — |

## 6. Build and deploy

- **Workflows:** `actionlint` 1.7.7 (with shellcheck) on `ci.yml` and `deploy.yml` reports nothing. `deploy.yml` is manual only, as DEPLOY.md requires.
- **CI steps run locally:**
  - `prisma validate` passes.
  - `contrast:check` passes 110/110.
  - `turbo typecheck --force` passes 6/6 uncached.
  - `pnpm test` passes 1,109 tests in 41 files.
  - The web Playwright suite (CI's e2e job) passes 35/35.
- **Production builds in Docker (Linux):** all three Dockerfiles build.
  - The API built in 335 s and the image is 1.58 GB.
  - Web built in 273 s and the image is 440 MB.
  - Admin built on the second attempt (D5).
  - This is also the full `next build` of web and admin that fails locally on Windows.
- **Migrations:** all 20 applied with `prisma migrate deploy` on an empty Postgres 16. `prisma migrate diff` from that database to `schema.prisma` reports "No difference detected".
- **Production boot:** the API image ran its compose command (`migrate deploy` then start) and seeded the 16 system templates.
- **Environment variables:** listed in `env.ts`, the Dockerfiles, `docker-compose.prod.yml` and DEPLOY.md, and each documented in DEPLOY.md, README.md or an `.example` file.
  - A missing `DATABASE_URL` fails loudly.
  - A production `JWT_SECRET` that is unset, empty or the default fails loudly.
  - The rest don't fail (D2–D4).

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| D1 | **The documented deployment has no HTTPS.** DEPLOY.md opens 3000, 3002 and 4000 to 0.0.0.0/0 on the instance's IP over HTTP, and calls HTTPS "Optional" (§6). Passwords, reset tokens and 30-day bearer tokens would cross the internet in the clear. | Blocker | Suspected (deploy docs; nothing has been deployed). Confirm by deploying as documented. | [DEPLOY.md:44-51](../../DEPLOY.md), [DEPLOY.md:136](../../DEPLOY.md) | Make §6 required: put Caddy in `docker-compose.prod.yml`, publish only 443 and 80, and bind 3000, 3002 and 4000 to the Docker network. | Medium |
| D2 | **A missing `NEXT_PUBLIC_API_URL` silently falls back to localhost.** It's built into the web image at build time. If the build argument is missing, the Dockerfile's default `http://localhost:4000` is built in. If `deploy.yml` passes an unset repo variable (an empty string), `api.ts`'s `\|\| "http://localhost:4000"` does the same. Every visitor's browser would then call *their own* localhost, and the build succeeds. The admin image does the same with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_TENANT_URL`. | Should fix | Reproduced | The web image built without the argument has `"http://localhost:4000"` in 8 client chunks. In a browser, the app called `http://localhost:4000/v1/auth/me` and `/v1/forms`. The admin image has `localhost:4000` and `localhost:3000`. | Fail `next build` when `NODE_ENV=production` and the variable is missing or empty. Drop the Dockerfile defaults. | Small |
| D3 | **The API boots in production with `PUBLIC_TENANT_URL` unset.** `docker-compose.prod.yml` passes `${PUBLIC_TENANT_URL:-}`, `env.ts` treats an empty value as unset, and the default `http://localhost:3000` applies. Invite, verification and reset links then point at localhost. `PUBLIC_API_URL` behaves the same. | Should fix | Reproduced | Production image, `PUBLIC_TENANT_URL=` → `resetUrl: "http://localhost:3000/reset-password/…"`. | Make both required in production. | Small |
| D4 | **A weak `JWT_SECRET` is accepted.** Production refuses only the dev default. | Should fix | Reproduced | Production image with `JWT_SECRET=a`: "API running". | Require at least 32 characters in production. | Small |
| D5 | **The builds need Google Fonts.** `next/font/google` downloads fonts during `next build` in both apps. The first admin Docker build failed at `ECONNREFUSED 142.250.x.x:443` after 3 retries; the second passed. A network blip on the build runner fails a deploy. | Should fix | Reproduced | Admin build log, attempt 1: exit 1, `connect ECONNREFUSED` while fetching fonts. Attempt 2: exit 0. | Self-host the font files with `next/font/local`. | Small |
| D6 | **CI's e2e job runs Playwright against `next dev`** with `retries: 1`, the setup that T2 and T4 make flaky. CI uses fewer cores, so it may flake less, but it's untested on GitHub. | Should fix | Suspected | [playwright.config.ts](../../apps/web/playwright.config.ts) | See T2. | Small |

## 7. Dependencies

`pnpm audit` reported 102 findings: 8 critical, 45 high, 40 moderate and 9 low. The high and critical ones, by reachability:

| Package (version) | Advisories | Where | Reachable? |
|---|---|---|---|
| `next` 15.5.20 | **Critical:** unauthenticated RCE in the image optimiser with AVIF, and again with SVG; RCE on Windows-hosted servers. **High:** Server Actions DoS (×2), SSRF in Server Actions on custom servers, SSRF in rewrites via an attacker-controlled destination. | web, admin | **Image optimiser: possibly.** The web app uses `next/image` ([hero-visual.tsx](../../apps/web/src/components/home/hero-visual.tsx)), so `/_next/image` is served unauthenticated. No `images.remotePatterns` is set, so only local files are optimised; whether the RCE needs an attacker-supplied image is in the advisory, not checked (DEP1). Windows-hosted: not applicable (Linux containers). Server Actions: none in the code (`"use server"` absent). Rewrites: destinations are fixed paths. |
| `sharp` 0.34.5 | High: libvips, libheif and librsvg CVEs | via `next` | Only through the image optimiser, so the same as above. |
| `body-parser` 1.20.4 | High: DoS through trailing bytes after a compressed body | api | **Yes.** The API parses every request with body-parser, and inflate is on by default (DEP2). |
| `zod` 3.25.76 | High: memory exhaustion validating oversized constrained collections | api, form-schema | **Likely.** Every save is parsed with zod; the 10 MB limit is for signed-in authors only (DEP2). |
| `proxy-addr` 2.0.7 | Critical: IP spoofing through a trust subnet | api (express) | No. `trust proxy` isn't set. |
| `multer` 2.0.2 | High: DoS (×7) | api (platform-express) | No. No route takes file uploads (no `FileInterceptor`). |
| `vitest` 2.1.9, `tinypool` 1.1.1, `vite` 5.4.21 | Critical and high | dev, all packages | No. Test tooling, not in any running service (L7). |
| `@nestjs/cli` chain (`glob`, `picomatch`, `tmp`, `brace-expansion`, `fast-uri`, `js-yaml`, `browserslist`) | High | api dev | No. Build tooling. It ships in the API image (L6) but never runs there. |
| `postcss`, `nanoid`, `source-map-js` | High | web and admin build | No. Build time only, over our own CSS. |

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| DEP1 | **Next.js 15.5.20 has unauthenticated RCE advisories in a route the web app serves.** Rated a blocker because the impact is remote code execution on the public web server and the fix is a patch bump. Confirm by reading the advisories' preconditions: whether an attacker must supply the image (they can't here: no remote patterns, no uploads) or whether local images suffice. | Blocker | Suspected | `pnpm audit`; `next/image` in use; no `images` config in [next.config.mjs](../../apps/web/next.config.mjs). | Upgrade `next` to 15.5.28 or later in web and admin (pin the version, not `^15.0.0`). Rebuild and re-run the web suite. | Small |
| DEP2 | **Reachable denial of service:** body-parser (unauthenticated, every route) and zod (signed-in saves). It doesn't meet the blocker test. | Should fix | Suspected (reachability from code; not exploited) | Above. | Bump `body-parser` (it's pinned at `1.20.4` in api) and `@nestjs/platform-express`. Track zod's fix: it's patched only in 4.6.6, so moving from zod 3 is a larger change; meanwhile, cap collection sizes in the schema. | Small |

## 8. Public pages

The public routes are prerendered at build time:

- `/` and `/docs` are static;
- `/docs/[...slug]` and `/docs-md/[[...slug]]` are generated ahead (SSG);
- `/docs/llms.txt` and `/docs/search-index.json` are static.

No server-side code on them reads a session or calls the API. `/app` is a static shell that fetches in the browser. (There's no root `/llms.txt`; it lives at `/docs/llms.txt`.)

`public-pages.js` loaded all 29 docs and home pages from the **production web image** in a real browser, plus their 28 `.md` versions, `/docs.md` and `/docs/llms.txt`:

- **With no session:** zero API calls, zero requests to any other origin, and no redirects.
- **With a token in `localStorage`:** zero API calls and the token never sent. The only change is that `/` sends a signed-in visitor on to `/app`, as designed (`HOME_REDIRECT_SCRIPT`).
- **Text routes:** every one is 200 and contains neither this API's origin nor a token key. The `/v1/intake` and `Bearer` mentions in the FormRenderer reference are examples for an integrator's own endpoint.

**Nothing signed-in or organisation-specific is reachable from them, and none of them calls the API.** No findings.

## 9. Test reliability

| ID | Finding | Severity | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|---|
| T1 | **e2e "fetch failed" is `nest --watch` restarting mid-run.** A watch API on port 4101 was given one-line content changes, each reverted. | Should fix | Reproduced | Changes that restart it: anything in `apps/api/src/**/*.ts` (1 restart, and 1 more on revert); **`packages/form-schema/dist/index.d.ts`** (1 and 1). Changes that don't: `prisma/templates/*.json`, `schema.prisma`, `form-schema/dist/*.js`, a new `.d.ts` nothing imports, writes to `e2e/output`, mtime-only `touch`, and rebuilding form-schema with unchanged content (direct or through `turbo typecheck`). Each restart refused connections for about 1.1 s (11 × `ECONNREFUSED` at 100 ms polling), which is "fetch failed". So it happens whenever API or form-schema source is edited and rebuilt while a suite runs, which is the normal state while a brief is in progress. `nest-cli.json` also has `deleteOutDir: true`, so `apps/api/dist` is deleted during each recompile. `verify-templates-api.js` runs `dist/templates/seed-cli.js` from there, which fits its known reseed failure (suspected). Also seen again: stopping the watch task left `nest --watch`, its `npx` parent and the app on 4101 running; they were stopped by PID. | Have `e2e/run-all.js` build the API and start `node dist/main.js` itself on its own port (as this audit did, with no restart in any run), then stop it by PID. Or have it record `/health`'s boot time before and after each suite and mark a suite "API restarted" instead of failing it. | Small |
| T2 | **`docs.spec.ts` flakes on steps that wait for client-side JavaScript.** The exact `toHaveURL(/\/docs$/)` failure wasn't hit in 20 parallel repeats. Its siblings, which wait on the same thing, failed. | Should fix | Reproduced (sibling steps) | `docs.spec.ts --repeat-each=4` with the default 8 workers: 2 of 4 runs of "below 760px the side navigation is a menu" failed. After `menu.click()`, the menu link wasn't visible within 5 s, meaning the click landed before hydration. The `stand-in endpoint` test `--repeat-each=16`: 1 of 16 failed at `.zf-form` not visible within 5 s, the step right before the `/docs$` click. With 1 worker: 64 of 64 passed. Line 103 already gives another client-side navigation 20 s for the same reason. | Run Playwright against a production server (`next build && next start` in `webServer`; CI already builds). That removes on-demand compilation and makes hydration fast. Failing that, cap `workers` against `next dev` and wait for a hydration marker before the first interaction. | Small |
| T5 | **`home.spec.ts` flakes the same way.** "A signed-in visitor following a link to `/` ends on the app" clicks the header logo, a client-side link, and expects `/app`. Found during the release fixes (CP1), on the CI-style run (`CI=true`, Playwright's own `next dev`, no API): it failed once and passed on retry. The page was still `/login`, so the click landed before hydration, as in T2. Not the session change: no API was running, so no 401 and no `?signedOut=1`. | Later | Reproduced once; 6 of 6 passed when repeated warm | `CI=true pnpm --filter web test:e2e`: 33 passed, 2 flaky (this and T2's stand-in endpoint test). `--repeat-each=6 --retries=0` on this test alone: 6 passed. [home.spec.ts:113](../../apps/web/e2e/home.spec.ts#L113) | As T2: a production server for the web suite, or wait for a hydration marker before the click. | Small |
| T3 | **A leftover Vite holds port 5173.** Nothing in this repo starts or stops the external test app. `E2E_EXTERNAL_APP_URL` is set by hand (e2e/README.md). Suspected mechanism: a Vite left from an earlier run keeps 5173. A new one, without `strictPort`, moves silently to 5174, and the suites keep rendering against the stale app, which may serve another checkout's `src/forms`. | Should fix | Suspected: the app lives outside this repo, so it couldn't be reproduced here. Confirm with `strictPort` off and two starts. | [e2e/README.md:94](../../e2e/README.md) | `run-all.js`: before running, write a marker file into `E2E_EXTERNAL_FORMS_DIR` and fetch it through `E2E_EXTERNAL_APP_URL`; stop if it isn't there. In the external app, set `server.strictPort: true`. | Small |
| T4 | **Timeouts when many tests run at once against `next dev`.** `fullyParallel` with the default workers is 8 on this 16-core machine, all against one dev server compiling on demand. | Should fix | Reproduced | Same runs as T2: 8 workers took 73 s with 2 failures; 1 worker took 136 s with 0 failures. The full web suite, warm, passed 35/35 in 47 s. | As T2. | Small |

## Later

| ID | Finding | Status | Evidence | Suggested fix | Size |
|---|---|---|---|---|---|
| L1 | Any `localhost` or `127.0.0.1` origin is allowed by CORS in production, with credentials. Sign-in is a bearer header from `localStorage`, not a cookie, so another page gains nothing from it. | Reproduced (production image: `Origin: http://localhost:9999` → allowed; `https://evil.example` → not) | [main.ts:24](../../apps/api/src/main.ts#L24) | Allow localhost only outside production. | Small |
| L2 | The impersonation token travels in the URL query (`/impersonate?token=`), so it's kept in browser history for its hour. | Suspected | [impersonate/page.tsx](../../apps/web/src/app/impersonate/page.tsx) | Use the URL fragment, and clear it with `history.replaceState`. | Small |
| L3 | Tokens are in `localStorage`, and the CSP sets only `frame-ancestors`, so any future XSS can read them. No author-HTML sink exists today. | Suspected | [api.ts:13](../../apps/web/src/lib/api.ts#L13), [next.config.mjs](../../apps/web/next.config.mjs) | Add a `script-src` CSP (with nonces for the two boot scripts); later, consider HttpOnly cookies. | Medium |
| L4 | `GET /v1/invites/:token` isn't throttled. Tokens are 192-bit, so guessing isn't feasible. | Suspected | [invites.controller.ts](../../apps/api/src/team/invites.controller.ts) | Throttle it with the credential routes. | Small |
| L5 | Option import has no file size cap. It runs only in the author's browser; the 10 MB save limit bounds what reaches the server. | Suspected | [editor.tsx:2174-2181](../../apps/web/src/components/form-editor/editor.tsx#L2174-L2181) | Refuse files over a few MB with a message. | Small |
| L6 | The API image is 1.58 GB: its runtime is the build stage, with dev dependencies and the Nest CLI. It runs as root. | Reproduced | [apps/api/Dockerfile](../../apps/api/Dockerfile) | Add a runtime stage with production dependencies, the Prisma CLI for migrations, and `USER node`. | Small |
| L7 | Critical advisories in dev-only tools (vitest, tinypool). | Reproduced (`pnpm audit`) | Area 7 | Upgrade vitest to 3.2.6 or later. | Small |
| L8 | The admin console's port is open to the internet. Its data is behind `AdminGuard`, so only the static shell is public. | Suspected | [DEPLOY.md:49](../../DEPLOY.md) | Serve it only behind a VPN or an IP allowlist once HTTPS (D1) is in place. | Small |
| L9 | The minimum password is 6 characters. | Suspected | [auth.service.ts:33](../../apps/api/src/auth/auth.service.ts#L33) | 10 or more, and check against a breached-password list. | Small |
| L12 | The typecheck doesn't cover `apps/web/e2e/`: the web `tsconfig.json` excludes it, and CI's `pnpm typecheck` uses that. During the renderer 0.28.0 brief, a dropped backslash in a `docs.spec.ts` regex turned the rest of the line into a comment and reached the spec run, which stopped on a syntax error. The root `e2e/` suites are JavaScript, so nothing checks them either. | Reproduced | [tsconfig.json:22](../../apps/web/tsconfig.json#L22) | Typecheck `apps/web/e2e/` and `playwright.config.ts` with a tsconfig of their own. | Small |

## What couldn't be checked, and why

- **Real Google sign-in.** It needs Google. S2 was reproduced by stubbing `OAuth2Client.verifyIdToken` in the audit script's own process. The merge logic run is the API's compiled code, unchanged.
- **Email delivery.** No Resend key is configured, and nothing may be sent off this machine. The invite email was rendered in-process instead.
- **CI on GitHub.** Nothing has been pushed. The workflows were linted, and every CI step was run locally, but not on GitHub's runners.
- **The exact `toHaveURL(/\/docs$/)` failure.** It wasn't hit in 20 parallel repeats; sibling steps with the same dependency failed (T2). Runs from a cold `.next` weren't tried, because clearing `apps/web/.next` would wipe your dev cache.
- **The external test app and the Vite on 5173 (T3).** The app is outside this repo.
- **The Next.js advisories' preconditions (DEP1).** Reachability is from our configuration; the advisory texts weren't read in full.
- **The integrity gate against real data.** The local database holds one form (V3). Production has no data yet.
- **`deleteOutDir` breaking `verify-templates-api.js` mid-restart (T1).** It follows from the configuration and the known symptom, but wasn't reproduced on its own.
- **The HTTPS deployment (D1).** Nothing is deployed.

## How this was run

- The API was built and run with `node dist/main.js` on port 4100. A watch API ran on port 4101 only for T1.
- Postgres was the local `db` container, plus a throwaway `postgres:16` on 5440 for migrations from zero.
- The three images were built and run locally: the API image on 4200, the web image on 3300.
- Before the Playwright runs, ports 3000 and 3100 were checked free, with no `next dev` running in `apps/web`.
- Everything started for the audit has been stopped and removed: servers, the watcher and its orphaned processes, containers, the network, images, throwaway data, and scratch output.
