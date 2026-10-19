# Builder brief — clean-up 7: static pages and homepage

The seventh of eight clean-up briefs. The plan is `docs/BUILDER-CLEANUP-PLAN.md`; the evidence is `docs/CLEANUP-AUDIT.md`, sections A16 and A17.

Save this brief as `docs/briefs/BUILDER-BRIEF-CLEANUP-7-STATIC-AND-HOME.md`, replace `docs/BUILDER-CLEANUP-PLAN.md` with the attached updated plan, and commit both on their own first.

**Stop after CP0 and wait for approval before changing any code.**

## Why

**Static pages.** The prototype and blueprint pages are research artefacts describing the old hosted product, about 22,800 lines of static HTML and Markdown. Two of them are served publicly at `/mockup` and `/docs`, and since brief 2's framing headers they show a blank frame anyway. Git history is the archive.

**Marketing site.** `/` sells the hosted product ("publish, and collect answers", "Unlimited forms & responses"). The builder has no public audience yet, so `/` should take people to sign-in, or into the app if they're already signed in.

## Scope

**Static pages (A16)**
- `apps/web/public/mockup.html`, `apps/web/public/docs.html`
- root `frame-prototype.html`, `blueprint.html`, `BLUEPRINT.md`
- the routes `app/mockup/page.tsx`, `app/docs/page.tsx`, and `components/embed-frame.tsx`
- references to these files:
  - fix comments, such as `packages/ui/preset.ts`;
  - leave the README, PROGRESS and GETTING-STARTED links to brief 8, which rewrites or deletes those files.

**Marketing site (A17)**
- `app/(marketing)/page.tsx` and `layout.tsx`
- `components/marketing/nav.tsx`, `footer.tsx`, `motion.tsx` and `faq.tsx`
- **Keep `Logo`.** Five auth pages import it. Move it out of `components/marketing/` (e.g. to `components/logo.tsx`) and update the imports. `LogoMark` loses its `export` if only `logo.tsx` uses it.
- any dependency only the marketing pages used (e.g. an animation library). Remove it from `package.json`.
- any other page under `(marketing)`, such as privacy or terms: list it in CP0; don't remove it yet.

**Homepage**
- Signed out, `/` leads to sign-in; signed in, it leads to `/app`. Use the simplest mechanism that works with how the web app knows a user is signed in (see CP0).
- Root metadata in `app/layout.tsx`: replace the hosted-product title and description. The wording is Dhawal's decision (see CP0).

**Tests**
- Replace `apps/web/e2e/marketing.spec.ts`, the only spec the CI browser job runs, with a sign-in smoke spec:
  - `/` signed out ends on the sign-in page;
  - the sign-in page shows its email and password fields.
- It must pass under the same conditions the CI job provides (see CP0).

## Rules

- **Never delete** shared tenancy helpers (`assertCanEdit`, `assertManager`, org-ownership checks).
- **Exclude** `.git`, `node_modules`, `.next`, `dist` and `e2e/output` from every search.
- List matches before changing anything; no blind replace-all.
- Commit at each checkpoint once tests pass, with clear messages. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- Every file and line to change, compared with the audit's A16 and A17 lists. Report any differences.
- **Signed-in state:** how the web app knows a user is signed in (cookie, `localStorage` token, the `/me` call), and what `/app` does today for a signed-out visitor. Propose the redirect mechanism for `/`.
- **CI:** exactly what `.github/workflows/ci.yml`'s browser job starts: web only, or web with the API and a database. Then say how the smoke spec will pass in that setup.
- **Metadata:** the current title and description in `app/layout.tsx`, and every other place the product's name appears in the web and admin UI. Dhawal will choose the wording.
- **Other pages** in `(marketing)`, and anything else that links to `/` expecting the marketing page, e.g. the auth pages' logo link, or emails.
- **Dependencies** that only the marketing pages or the static pages use.

**CP1 — Remove and redirect.**
- Apply the removals, the `Logo` move, the redirect, the metadata wording Dhawal chose, and the new smoke spec.
- Searches for `mockup`, `blueprint`, `prototype`, `marketing`, `pricing`, `frame` and `embed-frame`: report every remaining match with the reason it stays.
- In a browser, check:
  - `/` signed out ends on sign-in, and `/` signed in ends on `/app`;
  - `/mockup` and `/docs` return 404;
  - the five auth pages still show the logo, with no page errors.

**CP2 — Full run.**
- Full builder e2e with `E2E_EXTERNAL_APP_URL` and `E2E_EXTERNAL_FORMS_DIR` set; restore the external app's form files afterwards.
- Run the web package's Playwright spec as CI does.
- Report the suite count and results, and anything not done.
