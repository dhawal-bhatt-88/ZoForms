# Builder brief — public home page for Zowork Forms

Builder repo, branch `formbuiler-service-dhawal`, web app only (`apps/web`). Run this brief **before** BUILDER-BRIEF-DOCS.md; the docs reuse the public header and routing set up here.

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-HOME.md` and commit it on its own.

**Stop after CP0 and wait for approval before changing any code.**

## Why

Since the clean-up (16 Oct 2026), `/` redirects straight to sign-in. People arriving from the "Forms" link on zoblocks.design, or from a link a colleague shares, see a login box with no explanation of what the product is. We need a public home page.

## What the market does (research, 23 Oct 2026)

Ten form products' home pages were reviewed: Typeform, Jotform, Tally, Google Forms, Microsoft Forms, SurveyJS, Form.io, Tripetto SDK, JSON Forms and react-jsonschema-form (whose docs intro serves as its home). Common patterns:

- **Header:** logo, a few links (product, docs, pricing), **Log in** plus one primary button. Every one of the ten.
- **Hero:** one headline, one supporting line, one primary and at most one secondary button, and a product visual. The developer-facing products show the **schema next to the rendered form** (Form.io) or a **live example with Demo / Schema / Data tabs** (JSON Forms).
- **How it works:** the builder-plus-renderer products (SurveyJS, Form.io, Tripetto) show builder → JSON definition → runner in your app → data to your own backend. This is exactly our architecture.
- **Data ownership:** SurveyJS, Tripetto and Form.io each have a section saying form data stays with the customer. Tripetto states its SDK has no built-in storage.
- **Security / compliance:** Google and Form.io have one. Form.io names HIPAA in a compliance module.
- **FAQ before the footer:** Tally, Google, SurveyJS.
- **Final call to action** repeating the hero buttons: most of the ten.
- **Footer:** grouped link columns, legal links, copyright.
- **Social proof** (logos, user counts, ratings, testimonials) sits right after the hero on Typeform, Jotform, Tally and Form.io. **We have no customers yet, so we leave this out. Never invent logos, numbers or quotes.**

## The page

A single, public page at `/`. Same look as the rest of the builder (the ZoBlocks console look already in `apps/web`: Instrument Sans with JetBrains Mono, teal, light and dark via the `zoblocks-theme` cookie, the component kit in `apps/web/src/components/ui/`). Use the existing tokens; add no new colours.

Sections, in order:

1. **Public header** (a new shared component, reused by the docs): logo and "Zowork Forms" · Docs · Sign in · **Get started** (to sign-up). Theme toggle.
2. **Hero:** headline and one line saying what it is — a form builder for behavioural health teams whose forms run inside your own application. Primary and secondary buttons. Visual: a short schema excerpt beside the same form rendered (decision 3).
3. **How it works:** three steps — build in Zowork Forms → download the form file → render it in your app with `@zoworkhq/forms`; answers go straight to your own backend.
4. **Built for clinical forms:** a few capability cards using only shipped features: groups and repeating groups, pages and wizard with review, conditional logic with AND/OR, scoring formulas on groups, coded options with import, custom validation on your server, drafts. One sentence each; link each to its docs page once it exists.
5. **Your data stays with you:** answers are posted from the form in your app to your endpoint; Zowork Forms never receives or stores them. Validation and scoring run again on your server with the same package.
6. **Accessibility:** forms are built and tested against WCAG 2.1 AA (automated checks in CI). State only what is true at release.
7. **FAQ:** 4–6 questions a buyer or developer asks (where answers are stored, which frameworks, what a developer must do, how updates reach a live form, what it costs → decision 4).
8. **Final call to action:** the hero's buttons again.
9. **Footer:** Product (Docs, Release notes), Company (Zowork, ZoBlocks), Legal (privacy, terms — placeholders until real pages exist), copyright.

**Wording rules**
- No claim of HIPAA compliance or certification. Say what the architecture does, not what a regulator has approved.
- No invented numbers, logos, quotes or ratings.
- Every capability named must exist in the current builder and renderer.
- Plain, short sentences; sentence case headings.

## Routing

- `/` shows the home page to signed-out visitors.
- A signed-in visitor going to `/` goes to their forms list, as today after sign-in (decision 2).
- The home page and everything under it must load without a session. Nothing else becomes public.
- `metadata`: title, description, Open Graph image placeholder.

## Decisions for Dhawal (CP0 lists them again with what the code shows)

1. **Primary button — decided (23 Oct 2026):** self-service sign-up exists, so the primary button is **"Get started"**, going to the existing sign-up page, with **"Sign in"** beside it. Don't change the sign-up flow in this brief.
2. **Signed-in visitors on `/`:** redirect to the forms list (recommended) or show the home page with "Open my forms".
3. **Hero visual:** a static, accurate screenshot pair (schema + rendered form), or a live form rendered with `@zoworkhq/forms` if the package is already available to `apps/web`. *Recommendation:* static now; live once the docs bring the package in.
4. **Pricing:** billing was removed (7 Oct). FAQ answer "Contact us" or leave the question out.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Contrast gate and axe suite (`verify-a11y.js`) must cover the new page and pass in light and dark.
- Every existing unit test, web spec and e2e suite keeps passing.
- Commit at each checkpoint once tests pass. Don't push.

## Checkpoints

**CP0 — Report only. Stop and wait.**
- How `/` redirects today (middleware, page, layout) and how routes are marked public or signed-in.
- The sign-up route the "Get started" button should open, and what a new sign-up lands on.
- What remains of the old marketing homepage removed on 16 Oct (files, assets) that could be reused or must stay deleted.
- Whether `@zoworkhq/forms` is installed in `apps/web`, and how.
- Which kit components the page can use as they are, and anything missing.
- Decisions 2–4 above with your proposal for each.
- A section-by-section outline with the exact headings and button labels you propose.

**CP1 — Routing and public header.**
- Public `/`, signed-in redirect, public header component, theme toggle, metadata.
- Unit tests and web spec pass; a web spec covers signed-out `/` and signed-in `/`.

**CP2 — Page content and checks.**
- All sections, mobile layout (stacks at phone width, no horizontal scroll at 375px).
- Full e2e, contrast gate and axe on the home page in light and dark.
- Screenshots at 375, 768 and 1440 wide, light and dark.
