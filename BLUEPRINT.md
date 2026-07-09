# Tally.so — Product Teardown & Build Blueprint

> An implementation-ready product, design, business, and engineering teardown of **Tally.so**, with a full blueprint for building a better form platform. Prepared July 2026.
>
> **Evidence labels:** `[Verified]` = grounded in public facts about Tally · `[Assumption]` = informed inference (especially anything about Tally's internal architecture, which is not publicly documented). Tier gating is marked `[Free]` `[Pro]` `[Business]`.

---

## Contents

- [Product Overview](#product-overview)
- [Feature Audit — Form Builder](#feature-audit-form-builder)
- [Feature Audit — Publishing, Responses, Teams & AI](#feature-audit-publishing-responses-teams-ai)
- [End-to-End User Journey](#endtoend-user-journey)
- [UI / UX Analysis](#ui-ux-analysis)
- [Design System (Reverse-Engineered)](#design-system-reverseengineered)
- [Information Architecture](#information-architecture)
- [Business Model & Growth](#business-model-growth)
- [Technical Architecture](#technical-architecture)
- [Recommended Tech Stack](#recommended-tech-stack)
- [Database Design](#database-design)
- [API Architecture](#api-architecture)
- [DevOps & Infrastructure](#devops-infrastructure)
- [Security & Compliance](#security-compliance)
- [Scalability — 100 to 1M Users](#scalability-100-to-1m-users)
- [AWS Infrastructure & Cost Analysis](#aws-infrastructure-cost-analysis)
- [Capacity Planning & Scaling Design](#capacity-planning-scaling-design)
- [Product Roadmap](#product-roadmap)

---

## Product Overview

*Tally turned form-building into a document you just start typing into — then gave nearly all of it away for free, weaponizing generosity and SEO into a bootstrapped growth machine.*

- **~$5M** — ARR (2025) `[Verified]`
- **500K+** — Teams using Tally `[Verified]`
- **~11 → 34** — Team size (2025 → 2026) `[Verified]`
- **ChatGPT / AI** — #1 referral source `[Verified]`

### Vision & core value proposition

Tally’s positioning — *“The simplest way to create forms”* `[Verified]` — is not a tagline, it is the entire product thesis. Every incumbent had accreted friction: signup walls, template pickers, drag-and-drop canvases, and a paywall wrapped around basics like logic or removing response caps. Tally collapsed the funnel to a single act: **open a blank page and start typing**. No signup required to build `[Verified]`. The editor behaves like a Notion document — slash-command block insertion, natural typing, blocks that become questions `[Verified]`.

`Land on tally.so` → `Type a form (no signup)` → `Publish link / embed` → `Sign up only to keep responses`

The wedge: value is delivered *before* the account ask. Signup is deferred to the moment of maximum intent (a form you already built), inverting the incumbent funnel.

- **Time-to-first-form** — Document-style editing means a working form exists in seconds. The “simplest” claim is a *speed* claim — the metric that governs activation and word-of-mouth.
- **Generosity as strategy** — ~99% of features free, incl. unlimited forms & submissions, logic, payments, file uploads, integrations. `[Verified]` The free tier isn’t a trial — it’s the product.
- **Familiar mental model** — By borrowing Notion’s block/slash paradigm, Tally imported an interaction pattern millions already knew — near-zero learning curve for its core knowledge-worker audience.

### Target audience

Tally is horizontal, but its center of gravity is the **self-serve knowledge worker and builder** who needs a form *today* without procurement, design help, or a budget line. `[Assumption]` Segment mapping below is inferred from feature set, pricing, and named customers (Notion, Make, Buy Me a Coffee, Rakuten, Glovo `[Verified]`).

| Segment | Job-to-be-done | Example use cases |
| --- | --- | --- |
| **Creators & solo brands** | Monetize an audience and collect input without a website team | Paid bookings, tip/donation forms, community sign-ups, content requests |
| **Marketers** | Capture leads and route them into the stack fast | Lead-gen landing forms, gated-content, newsletter waitlists, campaign surveys |
| **Product teams** | Learn from users cheaply and continuously | Feedback widgets, NPS, feature-request intake, beta signups, research screeners |
| **HR / recruiting** | Structure high-volume intake with logic and files | Job applications (file upload + logic), candidate screening, onboarding, pulse surveys |
| **Founders / indie hackers** | Validate and collect money before building anything | Waitlists, pre-orders (Stripe), demand tests, customer discovery |
| **Agencies** | Ship branded client forms at volume, cheaply | Client intake, briefs, white-labeled forms (custom domain), lead capture per client |
| **Educators** | Assess and enroll without an LMS | Quizzes (calculated scores), course registration, assignment submission |
| **Ops / internal** | Wire structured intake into internal tooling | Requests & approvals, inventory/order forms, webhook-driven workflows |


### Primary use cases

- **Lead generation** — Embeddable, branded, routed to Sheets/CRM via integrations & webhooks. `[Verified]`
- **Surveys & feedback** — NPS, CSAT, research screeners; conditional logic keeps them short. `[Verified]`
- **Quizzes** — Calculated fields + logic drive scoring and branching outcomes. `[Verified]`
- **Applications** — Jobs, grants, programs — file upload, multi-page, review-ready. `[Verified]`
- **Waitlists** — The indie-hacker default; publish in minutes, prevent duplicates. `[Verified]`
- **Order / payment forms** — Native Stripe payment block collects money in-form. `[Verified]`
- **Event RSVPs** — Close-on-limit/date, self-notifications, redirect on complete. `[Verified]`
- **Product research** — Screeners, hidden fields for attribution, answer piping. `[Verified]`

### Problems it solves — before vs. after

| Dimension | Old-world form builders | Tally |
| --- | --- | --- |
| Setup friction | Signup wall, template picker, drag-and-drop canvas before you type a word | Blank doc, start typing, no signup to build `[Verified]` |
| Aesthetics | Generic, dated, obviously-a-form-builder look | Clean, minimal, document-native by default |
| Paywalled basics | Logic, payments, file uploads, integrations behind upgrades | All free, incl. logic, Stripe, uploads, integrations `[Verified]` |
| Response caps | Hard monthly submission limits force upgrades | Unlimited forms & submissions on free (fair-use) `[Verified]` |
| Pricing anxiety | “What will this cost at scale?” blocks adoption | Free covers ~99%; pay only for branding, domains, teams, analytics `[Verified]` |


### Competitive advantages & moat

- **Free-forever generosity** — Unlimited forms/submissions on free is a structural moat: competitors monetizing on caps cannot match it without breaking their own model. `[Verified]`
- **Editor UX** — The Notion-like document editor is the hardest thing to copy well — it’s craft, not a feature list. `[Verified]`
- **SEO template engine** — Template gallery ranks in Google; templates *are* the top-of-funnel. Near-zero paid CAC, ~100% organic. `[Verified]`
- **Bootstrapped focus** — No VC, ~$5M ARR on a tiny team → extreme margin discipline and freedom to keep the free tier generous forever. `[Verified]`

> ℹ️ The AI referral tailwind `[Verified]`
>
> ChatGPT/AI tools became Tally’s #1 referral source — LLMs recommend Tally when users ask “how do I make a free form.” This is compounding, defensible distribution the incumbents did not design for and cannot easily buy.

### Competitive landscape

Positioning and “price feel” are informed reads on public posture. `[Assumption]` Tally’s figures are `[Verified]`.

| Product | Positioning | Price feel | Standout | Weakness |
| --- | --- | --- | --- | --- |
| **Tally** | Simplest, doc-native, free-first | Free does ~everything; Pro $24 | Unlimited free + editor UX | Thin native AI; minimalist styling may feel plain |
| Typeform | Beautiful conversational forms | Feels expensive; response caps | Polished one-question-at-a-time UX, brand | Pricey, hard submission limits, heavier |
| Google Forms | Free, ubiquitous, utilitarian | Free | Zero-cost, Workspace ties | Ugly, no payments, weak logic/branding |
| Jotform | Everything-and-the-kitchen-sink | Tiered, cap-driven | Huge template/widget library, PDFs | Cluttered UX; limits nudge upgrades |
| Fillout | Powerful logic + data workflows | Generous free, similar wedge | Deep logic, DB/CRM integrations | Steeper curve; less brand awareness |
| Paperform | Design-rich, document-like forms | Mid-to-premium | Flexible styling, calculations | Costlier; more setup effort |
| Formless / Youform | AI-conversational / Typeform-alt | Cheap / free-first challengers | AI chat forms (Formless); no-cap value (Youform) | Early, narrow, small ecosystems |


Tally’s clearest threat vector is the **AI-native conversational** lane (Formless) and its clearest parity battle is with **Fillout**, which copies the free-first wedge and out-guns it on logic depth. `[Assumption]`

> 💡 Why it wins
>
> Tally aligned three flywheels that reinforce each other: (1) a **generous free tier** that removes every reason not to try, (2) a **document editor** so frictionless it produces delight and word-of-mouth, and (3) an **SEO + AI template funnel** that acquires users at near-zero cost. Because it’s bootstrapped, Tally can keep the free tier generous indefinitely — the exact move a VC-backed, cap-monetizing incumbent structurally cannot copy. **The moat is not a feature; it’s a business model competitors can’t adopt without cannibalizing themselves.** To beat Tally, a challenger must match the free generosity *and* out-craft the editor *and* win the AI/SEO channel — and add the AI-native layer Tally has so far under-invested in.

---

## Feature Audit — Form Builder

*A block-by-block teardown of Tally's builder: the full input palette, logic engine, layout system, and the free/pro gating that makes 99% of it cost nothing.*

Tally's builder is its moat. It reframes a form not as a schema-bound web object but as a **Notion-style document** — you type, hit `/` for a slash menu, and drop question blocks inline. That single design decision collapses the learning curve to near-zero and is the reason a bootstrapped team of 11 out-shipped VC-funded incumbents. Below is every block, every logic primitive, and exactly where the paywall sits.

> ℹ️ How to read the tier badges
>
> `[Free]` = available on the $0 plan (unlimited forms/submissions). `[Pro]` = $24/mo. `[Business]` = $74/mo. Nearly every *block type* is Free; gating happens on *volume, branding, and analytics*, not on question capability.

### The full block palette

`Short text` `Long text` `Multiple choice` `Checkboxes` `Dropdown` `Multi-select` `Number` `Email` `Phone` `Link / URL` `Date` `Time` `Rating` `Linear scale` `Ranking` `Matrix` `File upload` `Payment` `Signature` `Hidden field` `Calculated field` `Heading` `Text` `Image` `Video / embed` `Divider` `Button` `Page break` `Columns`

Inserted via the `/` slash command or the left-rail `+` menu. Verified block set; layout of the menu is an assumption based on the public editor.

### Input & question blocks

| Block | Description | Notable behavior | Tier |
| --- | --- | --- | --- |
| **Short text** | Single-line free text. | Min/max length; placeholder; can be marked required. | `[Free]` |
| **Long text** | Multi-line textarea. | Auto-growing input; good default for open feedback. | `[Free]` |
| **Multiple choice** | Single-select radio options. | Drives most branching logic; "Other" write-in option; image options supported. | `[Free]` |
| **Checkboxes** | Multi-select boolean set. | Min/max selectable count as a validation rule. | `[Free]` |
| **Dropdown** | Single-select collapsed list. | Preferred over multiple-choice for long option lists (10+); searchable. | `[Free]` |
| **Multi-select** | Tag-style multi-pick from a list. | Distinct from checkboxes — chip UI, better for many options. | `[Free]` |
| **Number** | Numeric-only input. | Feeds calculations; min/max range validation; usable in quiz scoring. | `[Free]` |
| **Email** | Email-format input. | Format validation; the anchor for Business-tier *email verification* (double opt-in). | `[Free]` |
| **Phone** | Telephone input. | Country/format handling `[Assumption]` on exact intl. validation. | `[Free]` |
| **Link / URL** | URL input. | Format validation on `http(s)`. | `[Free]` |
| **Date** | Calendar date picker. | Min/max date bounds; usable to gate submissions by date. | `[Free]` |
| **Time** | Time-of-day picker. | Often paired with Date for scheduling-style forms. | `[Free]` |
| **Rating** | Icon rating (stars/emoji). | Configurable icon + scale length; emits a numeric value into calculations. | `[Free]` |
| **Linear scale** | Numeric scale (e.g. 0–10). | NPS-style; custom min/max and end labels; numeric output for scoring. | `[Free]` |
| **Ranking** | Drag-to-order a list. | Returns an ordered array; heavier respondent effort — use sparingly. | `[Free]` |
| **Matrix** | Grid of rows × column choices. | Compact Likert batteries; one row = one sub-answer. | `[Free]` |
| **File upload** | Respondent file attachment. | **10 MB/file cap on Free**; cap removed on Pro. See file-upload detail below. | `[Free]` `[Pro]` |
| **Payment** | Collect money via Stripe. | Stripe (+ Stripe Connect `[Assumption]`); fixed or calculated amount; charge in-form. Free to use — Stripe fees apply. | `[Free]` |
| **Signature** | Draw-to-sign capture. | Stored as an image with the submission; for waivers/consent. | `[Free]` |
| **Hidden field** | Non-visible value carrier. | Populated from URL params, defaults, or answer piping; core to attribution. | `[Free]` |
| **Calculated field** | Formula over other answers. | Powers pricing, quiz scores, totals; can be hidden or shown; feeds the Payment block. | `[Free]` |


All rows `[Verified]` as available block types. Per-block config granularity (e.g. exact validation options) is a mix of Verified and reasonable Assumption.

> ⚠️ The competitive tell
>
> Typeform paywalls payments, file uploads, and logic. Tally ships **all of them on Free** and monetizes branding + analytics + volume instead. A challenger cannot win by matching Tally's free tier — you must beat it on a dimension Tally neglects (see AI, collaboration, and data sections). Feature-parity-for-free is table stakes here, not a differentiator.

### Rich content, media & layout blocks

| Block | Purpose | Notable behavior | Tier |
| --- | --- | --- | --- |
| **Heading** | Section titles / hierarchy. | Multiple levels; structures long forms visually. | `[Free]` |
| **Text** | Rich paragraph copy. | Inline formatting; supports answer piping for personalized text. | `[Free]` |
| **Image** | Inline image. | Branding, product shots, illustrated choices. | `[Free]` |
| **Video / embed** | Embedded video or third-party content. | YouTube/Vimeo and generic embeds `[Assumption]` on provider list. | `[Free]` |
| **Divider** | Visual separator. | Purely cosmetic rhythm. | `[Free]` |
| **Button** | CTA / navigation control. | Advance page, submit, or link out; label + style config. | `[Free]` |
| **Page break** | Splits form into pages/steps. | Turns a single form into a multi-step flow; enables per-page logic + progress bar. | `[Free]` |
| **Columns** | Side-by-side layout. | Place two blocks in a row (e.g. First/Last name); document-grid feel. | `[Free]` |


### Logic & flow engine

This is where Tally quietly out-punches its price. The logic primitives below combine into branching quizzes, dynamic pricing calculators, and personalized outcome pages — entirely on Free.

- **Conditional logic `[Free]`** — Show/hide blocks based on prior answers. Rule-based (`if answer = X then show Y`). The workhorse of dynamic forms.
- **Branching / jump logic `[Free]`** — Route respondents to different pages based on answers — skip irrelevant sections, build choose-your-path flows.
- **Calculations `[Free]`** — Arithmetic over answers into calculated fields. Drives quiz scores, price quotes, and the amount charged by the Payment block.
- **Answer piping `[Free]`** — Inject a previous answer into later question text or the Thank-You page (`Hi @name`), for conversational personalization.
- **Hidden fields `[Free]`** — Carry UTM/attribution, user IDs, or plan tiers through the form invisibly — captured in every submission.
- **URL pre-population `[Free]`** — Pass query params to pre-fill any field or hidden field, e.g. `?email=x&plan=pro`. Key for embeds + email campaigns.
- **Default values `[Free]`** — Seed a field with a starting value the respondent can override.
- **Required + validation `[Free]`** — Mark blocks required; type-level rules (email/URL format, number ranges, text length, min/max selections, date bounds).
- **Anti-spam & limits `[Free]`** — reCAPTCHA, prevent duplicate submissions, password-protect, close on submission limit or date.

`URL params & hidden fields` → `Questions + conditional show/hide` → `Branch / jump logic` → `Calculations & scoring` → `Personalized Thank-You / redirect`

The end-to-end respondent logic pipeline — every stage available on Free.

### Layout, multi-page & structure

- **Multi-page forms** — Insert a **Page break** to split into steps. Enables per-page branching and a lighter cognitive load per screen. `[Free]`
- **Progress indicator** — Progress bar across multi-page forms to reduce drop-off. `[Free]`
- **Column layouts** — Two blocks side-by-side via the Columns block — e.g. First/Last name on one line. `[Free]`
- **Section grouping** — Headings + dividers + page breaks create logical sections; there is no separate heavyweight "section" object — structure is document-native. `[Assumption]`
- **Partial submissions** — Capture answers even if the respondent abandons before submit. `[Pro]`

### Specialized blocks in depth

- **File uploads** — `[Free]` caps each file at **10 MB**. `[Pro]` removes the cap (unlimited file uploads). Files are stored with the submission and downloadable from responses. A challenger's easy win: larger free caps or direct-to-cloud (S3/GCS) handoff.
- **Payments (Stripe)** — Stripe integration — charge a **fixed or calculated** amount inline. On Free. Stripe Connect for payout routing is an `[Assumption]`. No native support for PayPal/other PSPs is a visible gap.
- **Signatures** — Draw-to-sign, stored as an image on the submission. Good enough for consent/waivers; **not** a legally-audited e-sign trail (no DocuSign-style certificate) — an opening for a compliance-grade competitor.
- **Rating / scale / ranking / matrix** — Rating (icons), Linear scale (NPS), Ranking (drag-order), Matrix (Likert grid). Rating and scale emit **numeric values** that flow straight into calculations for quizzes/scoring.
- **Quiz scoring** — No dedicated "quiz mode" object; quizzes are **assembled** from calculated fields + conditional logic + branched outcome pages. Powerful but manual — a guided quiz builder is a clear differentiation lane. `[Assumption]` on the absence of a first-class quiz UI.
- **Thank-You / outcome pages** — Custom Thank-You page (Free) with answer piping for personalization; redirect on completion (Free). Branching can route to **different** outcome pages — the basis for quiz results and lead-scoring flows.

### Templates, duplication & collaboration

| Capability | Detail | Tier |
| --- | --- | --- |
| Template gallery | Large first-party + community-created template library; templates double as an SEO channel (they rank in Google). | `[Free]` |
| Form duplication | Duplicate a form as a starting point. `[Assumption]` on exact UX. | `[Free]` |
| Workspaces & folders | Organize forms; needed once a team scales past a handful of forms. | `[Pro]` |
| Team collaboration | Unlimited team members editing forms. | `[Pro]` |
| Real-time co-editing | Multiple editors live in one form, Google-Docs style. `[Assumption]` — marketed as team collaboration; true concurrent-cursor CRDT editing is not confirmed and is likely a gap. | `[Pro]` |
| Version history | Up to 30 days on Pro; up to 90 days on Business. | `[Pro]` `[Biz]` |


> ⚠️ Builder-layer opportunities for a challenger
>
> **1) First-class quiz/scoring mode** — Tally makes you hand-wire it. **2) True real-time multiplayer editing** with presence/cursors — not clearly present. **3) AI form generation inside the editor** — Tally's AI story is an acquisition channel, not an in-product feature; a "describe your form, get a draft" flow is wide open. **4) Compliance-grade e-signatures** and larger free file caps. Match the free-tier breadth to survive; win on these four to differentiate.

---

## Feature Audit — Publishing, Responses, Teams & AI

*Where Tally's form lifecycle is deep and free, where it monetizes, and where the platform is thin enough to attack.*

Tally's product surface splits into five lifecycle stages: **build** (covered in Section 02), **publish**, **collect**, **integrate**, and **collaborate**. The strategic pattern is consistent — almost everything a solo creator needs is free, and the paywall sits precisely on the seams where a *brand* or a *team* starts to care: branding removal, custom domains, analytics, collaboration, and retention. AI is conspicuously absent from the core product, which is the single largest greenfield for a competitor.

- **5** — Embed modes shipped
- **~99%** — Features on Free tier
- **15+** — Native + automation integrations
- **90d** — Max version history (Business)

### 3.1 Publishing & Distribution

Publishing is Tally's most complete surface. The free tier ships a full distribution toolkit; the Pro paywall targets everything that makes a form look like it belongs to a company rather than to Tally.

| Capability | What it does | Tier | Evidence |
| --- | --- | --- | --- |
| Shareable link | Instant hosted URL (`tally.so/r/<id>`), no publish gate | `[Free]` | `[Verified]` |
| Inline embed | Renders form in-flow inside a host page container | `[Free]` | `[Verified]` |
| Popup / modal embed | Center-screen overlay triggered on load, delay, exit-intent, or click | `[Free]` | `[Verified]` |
| Full-page embed | Form occupies the entire viewport of the host route | `[Free]` | `[Verified]` |
| Side-tab embed | Edge-anchored tab that slides a panel in | `[Free]` | `[Verified]` |
| Popover embed | Floating bubble (corner) expanding to a compact form | `[Free]` | `[Verified]` |
| Custom Thank-You page | Post-submit screen with custom content / answer piping | `[Free]` | `[Verified]` |
| Redirect on completion | Send respondent to any URL after submit | `[Free]` | `[Verified]` |
| Password protection | Gate the form behind a shared password | `[Free]` | `[Verified]` |
| Close on date / on limit | Scheduling & submission-cap auto-close | `[Free]` | `[Verified]` |
| Remove Tally branding | Strips “Made with Tally” footer | `[Pro]` | `[Verified]` |
| Custom domain | Serve forms from `forms.yourbrand.com` | `[Pro]` | `[Verified]` |
| Link preview (OG) customization | Custom OG image, favicon, title, description for social/SEO unfurls | `[Pro]` | `[Verified]` |
| Advanced CSS / customization | Custom CSS injection for pixel-level theming | `[Pro]` | `[Verified]` |


> ℹ️ Read: the free tier *is* the funnel
>
> Every free form ships a “Made with Tally” footer and a `tally.so` URL. Five hundred thousand teams distributing branded forms across the web is a self-propagating SEO + word-of-mouth engine. The Pro paywall (branding removal + custom domain) monetizes exactly the users who most want to *stop* feeding that funnel. A competitor should preserve this loop but consider a cheaper “de-brand” micro-tier.

### 3.2 Responses, Analytics & Data Governance

Collection is where Tally shows tier discipline: capture and basic review are free; *optimization* data (why people drop off) and *governance* (retention, verification) are paid.

- **Response management `[Free]`** — Table view + per-question summary view, search & filtering, response editing/deletion, CSV/XLSX export, self email notifications, prevent-duplicate-submissions, reCAPTCHA. Everything a creator needs to run and clean a dataset without paying.
- **Optimization & governance `[Pro]` `[Business]`** — Form-visit + drop-off analytics and partial-submission capture (Pro); email verification and data-retention auto-delete (Business). This is the “serious operator” band — the features you only need once responses drive revenue or compliance.

| Feature | Detail | Tier | Evidence |
| --- | --- | --- | --- |
| Table & summary views | Row-per-response grid + aggregated per-question charts | `[Free]` | `[Assumption]` |
| Search & filtering | Query and segment responses in-dashboard | `[Free]` | `[Assumption]` |
| Edit / delete responses | Correct or remove individual submissions | `[Free]` | `[Assumption]` |
| CSV / XLSX export | Full dataset download | `[Free]` | `[Assumption]` |
| Self email notifications | Notify form owner on each submission | `[Free]` | `[Verified]` |
| Prevent duplicate submissions | Block repeat entries per respondent | `[Free]` | `[Verified]` |
| reCAPTCHA / spam protection | Bot mitigation on submit | `[Free]` | `[Verified]` |
| Visit & drop-off analytics | Views, completion rate, per-step drop-off | `[Pro]` | `[Verified]` |
| Partial submission capture | Store answers even if the form is abandoned | `[Pro]` | `[Verified]` |
| Email verification | Confirm respondent email validity | `[Business]` | `[Verified]` |
| Data-retention auto-delete | Scheduled purge of aged responses (GDPR hygiene) | `[Business]` | `[Verified]` |
| Respondent auto-reply email | Confirmation email back to the submitter | ? | `[Assumption — likely via integration/logic, not a first-class native toggle]` |
| Team submission notifications | Route alerts to teammates/channels | ? | `[Assumption — typically achieved via Slack/Discord/email integrations]` |


> ⚠️ Attack surface: analytics behind the paywall
>
> Completion rate and drop-off are the *single most valuable signal* for anyone optimizing a form — and Tally gates them at Pro. A competitor that ships basic funnel analytics on the free tier removes the strongest reason serious users upgrade, and turns “optimization” into a wedge rather than a toll. Pair it with a native respondent auto-reply and team routing (both apparently non-native in Tally today) for an immediate parity-plus story.

### 3.3 Integrations & Automation

Tally's integration strategy is “native for the destinations knowledge-workers already live in, automation platforms for the long tail, webhooks for engineers.” Notably, the entire native + automation + webhook layer is **free**; only *marketing analytics* integrations are gated to Pro.

| Category | Integrations | Purpose | Tier |
| --- | --- | --- | --- |
| Native data destinations | Google Sheets, Notion, Airtable | Push each response into a live table / database | `[Free]` |
| Native notifications | Slack, Discord | Post submissions to a channel | `[Free]` |
| Automation platforms | Zapier, Make, n8n, Integrately | Fan out to thousands of downstream apps | `[Free]` |
| Webhooks | Raw HTTP POST to any endpoint | Custom backends, developer pipelines | `[Free]` |
| Payments | Stripe (assumed + Stripe Connect) | Collect payments inside the form flow | `[Free]` |
| Marketing analytics | Google Analytics, Meta Pixel | Attribution & conversion tracking | `[Pro]` |


Stripe / Stripe Connect and Cloudflare CDN are informed `[Assumption]`s; native app list, automation list, and webhooks are `[Verified]`.

#### Example webhook payload shape `[Assumption (illustrative)]`

Tally's public payload schema is not documented in our grounding; the shape below is a plausible, implementation-ready reference a competitor should aim to match or beat (flat, typed, field-keyed):

```
POST https://your-endpoint.example/hook
Content-Type: application/json

{
  "eventId": "evt_9f2a...",
  "eventType": "FORM_RESPONSE",
  "createdAt": "2026-07-08T14:22:31Z",
  "data": {
    "responseId": "resp_5cd1...",
    "formId": "wA2bXk",
    "formName": "Beta waitlist",
    "submittedAt": "2026-07-08T14:22:30Z",
    "partial": false,
    "fields": [
      { "key": "q_email",  "label": "Work email", "type": "EMAIL",  "value": "dana@acme.com" },
      { "key": "q_plan",   "label": "Plan",       "type": "DROPDOWN", "value": "Business" },
      { "key": "q_seats",  "label": "Seats",      "type": "NUMBER",  "value": 12 },
      { "key": "h_utm",    "label": "utm_source", "type": "HIDDEN",  "value": "newsletter" }
    ]
  }
}
```

`Respondent submits` → `Tally ingest` → `Native sync (Sheets/Notion)` → `Webhook / Zapier fan-out`

### 3.4 Teams & Collaboration

Collaboration is Tally's **thinnest verified surface** — and therefore its clearest B2B opportunity. Unlimited team collaboration is a headline Pro feature, but the depth of roles, permissions, and audit is not evidenced in our grounding.

- **Workspaces & folders** — `[Pro]` Organize forms into workspaces and folders. `[Verified]`
- **Unlimited collaborators** — `[Pro]` No per-seat cap on team members. `[Verified]`
- **Version history** — 30 days `[Pro]` / 90 days `[Business]`. `[Verified]`
- **Roles & granular permissions** — Not detailed in grounding; likely coarse (member vs. owner). `[Assumption — thin today]`
- **Real-time co-editing** — Notion-like editor implies presence, but simultaneous multi-cursor editing is unconfirmed. `[Assumption]`
- **Audit log / activity history** — No evidence of an enterprise audit trail. `[Assumption — likely absent]`
- **SSO / SCIM / Enterprise tier** — No public Enterprise plan; SSO not listed. `[Verified (absent)]`

> 💡 Opportunity: the enterprise seam is wide open
>
> Tally stops at “unlimited collaborators + folders.” There is no verified role matrix, no audit log, no SSO/SCIM, and no Enterprise tier. A competitor can build a defensible up-market wedge with granular roles (admin/editor/viewer/analyst), form-level permissions, an audit trail, SSO/SAML, and SCIM provisioning — the exact checklist a 200-person company's security review demands, and precisely where a bootstrapped 11-person team is unlikely to invest first.

### 3.5 AI — Honest Assessment

This is the headline gap. AI has been Tally's most important *acquisition channel* (ChatGPT is their #1 referral source), yet the **core product ships little to no built-in AI**. Everything below the “likely exists” line should be treated as opportunity, not parity.

- **Likely / minimal today `[Assumption]`** — 
- **The big opportunity `[Opportunity]`** — 

### Wedge — Prompt-to-form

Convert Tally's #1 referral channel into a first-class feature: paste a prompt or a doc, get a structured multi-page form. Meets AI-native users at their existing mental model and neutralizes Tally's channel advantage.

### Depth — Build-time copilot

Inline suggestions for logic, calculations, validation, and translations — leveraging Tally's own conditional-logic and 45+ language surface as the target output.

### Moat — Response & analytics copilot

Summarize open-ended answers and answer drop-off questions in natural language. This compounds with the free-tier analytics wedge from 3.2 and is the hardest feature for a lean incumbent to match quickly.

> ⚠️ Net assessment
>
> Tally has won on *simplicity and generosity*, not on AI or enterprise depth. The three exploitable gaps — (1) analytics gated behind Pro, (2) shallow team/enterprise governance, and (3) a near-absent AI product despite an AI-native audience — are all structurally hard for a bootstrapped 11-person team to close fast. A competitor should match Tally's free-tier generosity on publishing/collection, then differentiate hard on AI-native building and up-market collaboration.

---

## End-to-End User Journey

*How Tally collapses the distance from a Google search to a live, response-collecting form — often in under five minutes and before an account exists.*

Tally's growth engine is not a funnel bolted onto a product; it *is* the product. The journey is engineered so the highest-friction, highest-drop-off step in every rival — the signup wall — is deferred until the user has already felt the payoff. Below is the canonical path, annotated per step with the screen, the load-bearing UI, the friction Tally deleted, and the emotional beat that keeps the user moving.

- **<5 min** — Assumed time-to-first-published-form
- **0** — Fields before you can build
- **99%** — Features free (verified)
- **#1** — ChatGPT as referral source (verified)

### The canonical flow

### Step 1 &middot; Discovery — SEO template page or AI recommendation

**Screen:** A ranked Google result or a ChatGPT answer landing on a template page (e.g. “event registration form template”). **Key UI:** template preview, a single prominent *Use this template* CTA, no login gate. **Friction removed:** no marketing-site maze — the template *is* the landing page. **Emotional beat:** recognition (“this is exactly the form I needed”). `[Verified]` templates rank in Google; AI tools are the #1 referral source.

### Step 2 &middot; Build (no signup) — Editor opens instantly, anonymous

**Screen:** the document-style editor, pre-filled if a template was chosen or a blank page with a blinking cursor. **Key UI:** Notion-like canvas, slash-command hint, block on hover. **Friction removed:** *the signup wall is gone* — you build first, authenticate later. **Emotional beat:** flow — the tool feels like a text document, not a form-config panel. `[Verified]` no signup required to start; Notion-like editor.

### Step 3 &middot; Compose — Slash commands & typed structure

**Screen:** same editor. **Key UI:** `/` opens the block palette (short/long text, multiple choice, rating, payment, signature, file upload…); headings and text are typed inline; multi-page and column layouts inserted as blocks. **Friction removed:** no separate “add field → configure field → save” modal cycle; structure and content are one motion. **Emotional beat:** mastery — the palette rewards exploration. `[Verified]` slash-command insertion, full block set, multi-page/column layouts.

`/short answer` `/multiple choice` `/rating` `/payment` `/signature` `/file upload` `/page break` `/columns`

### Step 4 &middot; Logic — Conditional logic, calculations, answer piping

**Screen:** logic/settings side of a block. **Key UI:** conditional show/hide rules, calculated fields, answer piping into later questions, hidden fields for URL params. **Friction removed:** branching — historically a paid, complex feature elsewhere — is free and inline. **Emotional beat:** empowerment (“I can build the smart form I thought needed a developer”). `[Verified &middot;]``[Free]` logic, calculations, piping, hidden fields all on the free plan.

### Step 5 &middot; Theme — Customize look & feel

**Screen:** design/theme panel. **Key UI:** colors, fonts, layout; advanced customization & custom CSS gated to Pro; branding removal gated to Pro. **Friction removed:** respectable defaults mean most users never need to theme — it looks good untouched. **Emotional beat:** pride of ownership. `[Verified]` basic theming free; `[Pro]` for custom CSS & branding removal.

### Step 6 &middot; Publish — THE AHA MOMENT — One click → live shareable link

**Screen:** Publish modal. **Key UI:** *Publish* button, shareable URL, embed options (inline, popup, full-page, side-tab, popover), custom Thank-You page, redirect. **This is where signup is finally requested** — the user must claim the form they already built to publish/own it. **Friction removed:** the account ask arrives *after* value is visible, so it reads as “save my work,” not “pay a toll.” **Emotional beat:** triumph. `[Verified]` instant publish, five embed modes, custom Thank-You & redirects.

### Step 7 &middot; Onboarding / Workspace — Account claimed, workspace materializes

**Screen:** lightweight signup, then the forms dashboard. **Key UI:** form list; workspaces & folders are a `[Pro]` organizing layer. **Friction removed:** onboarding is retroactive — there is no empty-state tutorial to sit through because the user arrives already holding a finished artifact. **Emotional beat:** relief & belonging. `[Verified]` workspaces/folders are Pro. `[Assumption]` exact signup form (email/Google/magic-link) not publicly documented.

### Step 8 &middot; Collect — SECOND AHA — First real response arrives

**Screen:** submissions/responses table + email notification. **Key UI:** per-form response list, self email notifications, duplicate-prevention, close-on-limit/date. **Friction removed:** notifications and a responses store work out of the box — no spreadsheet wiring required to see data. **Emotional beat:** validation (“a real human filled this out”) — the strongest retention hook. `[Verified &middot;]``[Free]` unlimited submissions, self-notifications, duplicate prevention.

### Step 9 &middot; Analyze — Response summary & drop-off analytics

**Screen:** analytics/insights tab. **Key UI:** per-question summaries; form-visit + drop-off analytics gated to `[Pro]`; partial-submission capture (Pro) recovers abandoners. **Friction removed:** no external analytics needed to know where a form leaks. **Emotional beat:** curiosity → optimization loop. `[Verified]` visit/drop-off analytics & partial submissions are Pro.

### Step 10 &middot; Integrate — Pipe data into the user's stack

**Screen:** integrations tab. **Key UI:** Google Sheets, Notion, Airtable, Slack, Discord, Zapier, Make, n8n, Integrately, webhooks (all free); Google Analytics & Meta Pixel are `[Pro]`. **Friction removed:** the form stops being a silo — it becomes a node in an existing workflow. **Emotional beat:** integration into daily life → habit formation. `[Verified &middot;]``[Free]` core integrations & webhooks.

### Step 11 &middot; Upgrade — Billing triggered by a felt ceiling

**Screen:** pricing/billing modal. **Key UI:** Pro $24/mo, Business $74/mo, annual = ~2 months free. **Trigger:** a concrete wall — wanting to remove branding, a custom domain, team seats, the 10 MB upload cap, or drop-off analytics. **Friction removed:** the user upgrades to unlock a need they discovered *through use*, not a need the paywall invented. **Emotional beat:** willing investment. `[Verified]` pricing & the specific Pro unlocks.

> 💡 The activation insight: value precedes the account
>
> Most SaaS front-loads the account (cost) and back-loads the value (reward). Tally inverts it: **build → publish → first response** can all begin before signup, so by the time an account is requested the user is loss-averse about abandoning a form they can already see working. The “aha” is not a feature demo — it is *a real stranger submitting a real answer*. That is why time-to-value is measured in minutes, and why word-of-mouth compounds: people share links to forms they are proud of, and every shared link is a top-of-funnel impression. `[Verified]` grounding; `[Assumption]` on the sub-5-minute timing.

`Discover` → `Build (no login)` → `Publish` → `Sign up` → `First response` → `Integrate` → `Upgrade`

Two accent nodes = the two activation moments. Note that signup sits *after* the first payoff, not before it.

### Conversion funnel & triggers

| Stage | User goal | Trigger / mechanic | Friction removed | Evidence |
| --- | --- | --- | --- | --- |
| **Visit** | Solve a specific form problem | SEO template page or AI recommendation lands on usable page | No marketing detour — template is the entry point | `[Verified]` |
| **Build** | Assemble the form | Editor opens anonymously; slash commands | Signup wall deferred; config modals eliminated | `[Verified]` |
| **Publish** | Get a live link | One-click publish; account claimed to own the form | Value shown before the account ask | `[Verified]` |
| **Collect** | Receive real responses | Email notification on first submission | No spreadsheet/notification wiring needed | `[Verified]` |
| **Upgrade** | Remove a felt ceiling | Branding removal, custom domain, seats, upload cap, analytics | Paywall maps to discovered needs, not invented ones | `[Verified]` |


> ℹ️ No-login onboarding as a growth mechanic
>
> Deferring signup is not a UX nicety — it is the core acquisition loop. It (1) maximizes the anonymous-visitor → engaged-builder conversion by removing the single largest drop-off point; (2) converts SEO and AI referral traffic at unusually high rates because there is no gate between intent and action; and (3) seeds virality — every published form is a branded (on free) link circulating to new prospects. The cost is a class of anonymous builders who never claim their form; Tally accepts that leakage because the winners publish, share, and recruit. **For a competitor:** matching feature parity is insufficient — you must replicate the *sequence* (value-before-account) and the *SEO/AI surface* that feeds it, or the funnel math will not work.

> ⚠️ Assumptions flagged
>
> Exact time-to-value, the specific signup mechanism (email vs. OAuth vs. magic link), the depth of the analytics screen, and any in-editor AI generation step are `[Assumptions]` — not publicly documented. The step *sequence*, block palette, publishing modes, integration set, and tier gating are `[Verified]` from grounding.

---

## UI / UX Analysis

*Tally's polish comes not from ornament but from ruthless subtraction: a document-shaped canvas, near-zero chrome, and defaults so good most users never touch a setting.*

### The Design Philosophy in One Sentence

Tally treats form-building as **writing a document, not configuring a database**. The interface disappears so the content is the only thing on screen. Everything below flows from that single decision. `[Verified]` that the editor is Notion-like, document-driven, with slash-command insertion and no required signup to start.

### Core Design Principles That Make It Feel Polished

- **Content-first canvas** — The form *is* the editing surface. No property inspector wall, no separate preview pane. You type the question where it will appear. `[Verified]`
- **Restraint / minimalism** — A near-monochrome palette, one accent color, minimal borders. Perceived simplicity is the product's headline promise, so the UI must embody it. `[Verified]` tagline; `[Assumption]` on exact palette.
- **Keyboard-first (slash commands)** — Type `/` to insert any block; type naturally for text. Power users never leave the keyboard. `[Verified]`
- **Direct manipulation** — Edit labels inline, drag to reorder blocks, no "edit" mode toggle. What you see is literally what respondents get. `[Assumption]` (drag reorder inferred from Notion-like model).
- **Progressive disclosure** — Advanced settings (logic, calculations, validation) hide behind a block's context menu until summoned, keeping the default surface calm. `[Assumption]`
- **Opinionated defaults** — A new block looks finished immediately — sensible spacing, placeholder copy, a styled button. The "empty form" already looks like a good form. `[Assumption]`
- **Generous whitespace** — Wide margins and airy line-height signal "premium and unhurried," which lowers the intimidation of building. `[Assumption]`
- **Instant feedback** — Inserted blocks appear in place, edits render live, autosave removes the "save" anxiety loop. `[Assumption]` (autosave inferred).
- **Low modal usage** — Configuration happens inline or in lightweight side popovers rather than blocking dialogs, preserving flow state. `[Assumption]`

### Layout, Hierarchy & Navigation Model

The builder is a three-zone shell — a thin left workspace/nav rail, the centered document canvas, and a contextual right/floating panel for block or form settings. Attention is anchored on the canvas by centering it in a wide neutral field.

`Workspace rail (forms, folders)` → `Document canvas (the form)` → `Contextual panel (block / share settings)`

Zone model is an `[Assumption]` reconstructed from the Notion-like editor description and standard builder ergonomics.

- **Visual hierarchy** — Driven almost entirely by **type weight and vertical spacing** rather than boxes and dividers. Headings, questions, and helper text form a clear three-tier scale; the accent color is reserved for the single primary action (the submit button), so it always reads as "the next step."
- **Navigation** — Two levels only: *between forms* (workspace/folder list) and *within a form* (scroll + page tabs for multi-step). No deep menu trees. Multi-page forms use a progress bar for respondent orientation. `[Verified]` multi-page + progress bar.

### Design System Fundamentals

| Dimension | How Tally handles it | Evidence |
| --- | --- | --- |
| Typography | Single clean sans-serif (likely a system/geometric sans such as Inter); a tight type scale with heavy contrast between heading and body weight carries most of the hierarchy. | `[Assumption]` |
| Spacing rhythm | Consistent vertical spacing unit (an ~8px baseline) between blocks; whitespace is the primary separator instead of rules/borders. | `[Assumption]` |
| Grid | Single centered column with a comfortable max-width; optional multi-column layouts inside the canvas for side-by-side fields. | `[Verified]` column layouts |
| Color usage | Near-monochrome neutrals + one brand accent; respondent-facing forms are re-themeable (advanced customization + custom CSS on Pro). | `[Pro]` custom CSS `[Verified]` |
| Component consistency | Every input block shares the same label / helper / field / validation anatomy, so 20+ block types feel like one family. | `[Assumption]` |
| Icons | Sparse, uniform line icons used mainly in the slash menu and block handles; icons never compete with content. | `[Assumption]` |
| Animation & micro-interactions | Subtle: block insertion, hover affordances on drag handles, smooth page transitions in multi-step forms. Motion communicates state, never decorates. | `[Assumption]` |


### Block Palette (the slash menu vocabulary)

`Short text` `Long text` `Multiple choice` `Checkboxes` `Dropdown` `Multi-select` `Number` `Email` `Phone` `Link/URL` `Date` `Time` `Rating` `Linear scale` `Ranking` `Matrix` `File upload` `Payment` `Signature` `Hidden field` `Calculated field` `Heading` `Text` `Image` `Video/embed` `Divider` `Button`

Block list `[Verified]`. Uniform block anatomy across all of these is what makes the palette feel small despite its breadth.

### UI States — Why It Feels Calm

| State | How it's handled | Why it feels calm |
| --- | --- | --- |
| Loading | Skeleton/placeholder canvas rather than a spinner; autosave means little blocking load. `[Assumption]` | No jarring spinner-lock; the layout is already there, only content fills in. |
| Empty | A new form is a single inviting prompt ("Type `/` to insert…") — the empty state teaches the core gesture. `[Assumption]` | Empty = onboarding, not a dead end. Zero configuration to begin. |
| Error | Respondent-side: inline validation beneath the offending field with quiet red text, no modal. Builder-side: non-blocking toast. `[Assumption]` | Errors stay local to their cause; the rest of the form is untouched. |
| Success | Custom Thank-You page or redirect on completion; builder shows a subtle "saved" affordance. `[Verified]` Thank-You + redirect. | A designed endpoint, not a generic alert — the flow resolves cleanly. |
| Disabled | Locked/gated features (branding removal, custom domain) surface as tasteful upgrade nudges rather than hard walls; closed forms show a friendly closed message. `[Assumption]` | Restriction reads as an invitation, not a scold. |


### Accessibility Checklist

- [x] **Keyboard nav:** Slash-command building is inherently keyboard-driven; respondent forms should be fully tabbable field-to-field. `[Verified]` builder / `[Assumption]` runtime.
- [x] **Focus states:** Visible focus rings on inputs and buttons expected; needs audit — thin minimalist styling risks low-visibility focus. `[Assumption]`
- [x] **Contrast:** Default neutral-on-white body copy is a risk area for WCAG AA on helper/placeholder text given the light aesthetic. `[Assumption]`
- [x] **ARIA:** Labels bound to inputs, error text associated via `aria-describedby`, required state announced — table stakes for a form runtime; verify coverage. `[Assumption]`
- [x] **Reduced motion:** Page-transition and insertion animations should honor `prefers-reduced-motion`. Unverified — a likely gap. `[Assumption]`
- [x] **Languages / RTL:** 45+ languages and right-to-left support ship in the runtime. `[Verified]` `[Free]`

> ⚠️ Accessibility is the soft underbelly of minimalist form tools
>
> Ultra-light styling frequently trades contrast and focus visibility for elegance. We should assume Tally is *good but not audited-perfect* here and treat WCAG 2.2 AA conformance in the published runtime as a concrete differentiation wedge.

### Responsive & Mobile Behavior

- **Published form runtime** — The single-column, content-first layout is inherently mobile-friendly — it reflows to full-width, large tap targets, and one-question focus. Multi-page + progress bar shine on small screens. Embeds (inline, popup, full-page, side-tab, popover) adapt to host. `[Verified]` layouts & embeds; `[Assumption]` reflow quality.
- **The builder** — Document editors with drag handles and side panels are hard on touch; the builder is almost certainly a **desktop-first, view-mostly-on-mobile** experience. Editing on a phone is likely degraded. `[Assumption]` — and a genuine opportunity for us.

### Scorecard

- **Runtime polish** — 
- **Builder flow / speed** — 
- **Accessibility (assumed)** — 
- **Mobile builder** — 

Scores are our informed judgment (`[Assumption]`), calibrated against the verified feature set.

> 💡 What we copy, and what we beat
>
> **Copy (non-negotiable):** (1) the *content-first document canvas* — the form is the editing surface; (2) *slash-command, keyboard-first insertion* with a uniform block anatomy so breadth feels small; (3) *opinionated defaults* so an empty form already looks finished; (4) *low-modal, inline progressive disclosure* that protects flow state.
>
> **Beat:** (1) ship a *genuinely usable mobile / touch builder* — Tally's biggest experiential gap; (2) make the published runtime *WCAG 2.2 AA-audited by default* (focus visibility, contrast floors, reduced-motion, full ARIA) so accessibility is a marketed feature, not an afterthought.

---

## Design System (Reverse-Engineered)

*A concrete, buildable token-and-component spec inferred from Tally's public editor and form runtime — precise enough for another team to reproduce the look 1:1.*

> ⚠️ Read this whole section as an informed Assumption
>
> All numeric values (hex, px, ms, easing) are estimated by eye from Tally's live surfaces, not read from a published design system. Tally publishes no design tokens. Treat the *structure* and *proportions* as high-confidence and the *exact values* as within ±1 step of truth. Verified facts are limited to observable behaviors (document-style editor, slash menu, progress bar, embed modes) established elsewhere in this report.

### Design DNA

Tally reads as a **Notion-adjacent "quiet document"** system: near-white paper, near-black ink, a single warm-neutral gray ramp, minimal chrome, and one restrained accent used sparingly for primary actions and focus. The form runtime is even calmer than the editor — respondents see typographic hierarchy and generous whitespace, not boxed "widgets." The whole language optimizes for *low visual friction / high completion*.

- **Neutral-first** — One warm gray ramp does 90% of the UI. Color is an event, not a texture.
- **Hairline chrome** — 1px borders + tiny shadows instead of heavy cards. Depth is barely-there.
- **Type as UI** — Hierarchy carried by size/weight, not boxes — the form *is* a document.
- **Calm motion** — Short, ease-out transitions; nothing bounces. Focus rings, not animations.

### Color tokens `[Assumption]`

A warm-neutral base (slight brown/olive cast, not pure gray) with a single indigo/near-black accent. Semantic colors are conventional. Hex values are eyeballed estimates.

| Token | Swatch | Hex (est.) | Role |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | #FFFFFF | Page / form canvas |
| `--paper` | `#faf9f8` | #FAF9F8 | App shell, sidebars, subtle fills |
| `--ink` | `#1a1a19` | #1A1A19 | Primary text / headings |
| `--ink-2` | `#4b4a47` | #4B4A47 | Secondary text, labels |
| `--muted` | `#8a8781` | #8A8781 | Placeholder, captions, help text |
| `--hairline` | `#eae8e4` | #EAE8E4 | Borders, dividers, input outlines |
| `--fill-hover` | `#f2f0ed` | #F2F0ED | Hover/selected rows, menu items |
| `--accent` | `#2c2c2c` | #2C2C2C | Primary button fill (near-black default) |
| `--accent-brand` | `#4f46e5` | #4F46E5 | Marketing / focus indigo, links |
| `--success` | `#2f9e57` | #2F9E57 | Valid state, success toast |
| `--warn` | `#d9820b` | #D9820B | Warnings, limits near cap |
| `--danger` | `#dc4340` | #DC4340 | Validation errors, destructive |


Respondent-facing accent is **user-themeable** — the form builder lets creators set a brand color, so `--accent` is a runtime variable, not a fixed brand asset. The app chrome itself trends near-black/neutral.

### Typography scale `[Assumption]`

System font stack (no web-font dependency, consistent with fast-loading forms): `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif`. Monospace for code/embed blocks: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`. Base body = 16px / 1.5.

| Role | Size | Weight | Line-height | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| Display | 40px | 700 | 1.1 | -0.02em | Form title / hero |
| H1 | 32px | 700 | 1.15 | -0.015em | Page heading block |
| H2 | 24px | 600 | 1.2 | -0.01em | Section heading |
| H3 | 20px | 600 | 1.3 | -0.005em | Sub-section, question group |
| H4 / Label | 16px | 600 | 1.4 | 0 | Question label, field title |
| Body | 16px | 400 | 1.5 | 0 | Paragraph, answers, inputs |
| Small | 14px | 400 | 1.45 | 0 | Help text, secondary UI |
| Caption | 12.5px | 500 | 1.4 | 0.01em | Meta, timestamps, counts |
| Code | 13.5px | 400 | 1.5 | 0 | Embed snippets, webhook payloads |


### Spacing, radius & elevation `[Assumption]`

- **Spacing — 4/8 base** — 4px atomic unit; 8px is the workhorse gap. Question blocks stack at 24–32px; form content column caps ~640px.
- **Border-radius** — 
- **Elevation** — 

### Component specs

Concise per-component contracts. States assume the token set above.

#### Buttons

| Variant | Rest | Hover | Active | Focus | Disabled |
| --- | --- | --- | --- | --- | --- |
| Primary | bg `--accent`, text #fff, radius 8, pad 10×16, 15px/600 | darken ~6% | darken ~12%, no move | +3px ring | 50% opacity, no pointer |
| Secondary | bg #fff, 1px `--hairline`, text `--ink` | bg `--fill-hover` | border darkens | +3px ring | 40% opacity |
| Ghost | transparent, text `--ink-2` | bg `--fill-hover` | bg slightly darker | +3px ring | 40% opacity |
| Danger | bg `--danger`, text #fff | darken ~8% | darken ~14% | ring rgba(220,67,64,.4) | 50% opacity |


Heights: sm 32px, md 40px (default), lg 48px (form submit). Icon-only buttons are square at the same height with radius 8.

#### Inputs

- **Container** — 40px min height, 10×12 padding, radius 8, bg #fff, 1px `--hairline`
- **Placeholder** — `--muted`; label sits above at H4/Label, help text below in Small/`--muted`
- **Hover / Focus** — border → `--ink-2` on hover; focus swaps to accent border + 3px ring, no layout shift
- **Error** — border `--danger`, message below in `--danger` Small; icon optional
- **Runtime style** — Form-facing inputs often render *borderless / underline* to feel document-like; app-facing settings inputs use full boxed style

- **Cards** — bg #fff, 1px `--hairline`, radius 12, pad 16–20, e0→e1 on hover. Template gallery tiles add a 16:10 preview header.
- **Tables** — Submissions grid: 40px rows, hairline row dividers only (no verticals), sticky header in `--paper`, hover row `--fill-hover`, 13.5px cells, right-aligned numerics.
- **Badges / Tags** — radius 4–full, 12px/500, 2×8 pad, tinted-bg + saturated-text pairs (e.g. success #E6F4EC / #2F9E57). Plan tags map to badge--free/pro/biz.

- **Dialogs / Modals** — Centered, max-width 480–560px, radius 16, e3 shadow, 24px pad. Backdrop rgba(20,20,19,.4). Title H3, body Body, action row right-aligned (Ghost cancel + Primary confirm). ESC + backdrop-click close; scroll-lock on body.
- **Dropdowns / Menus & the Slash Menu `[Verified]`** — The *slash-command block inserter* is verified. Menu: radius 12, e2 shadow, 6px inner pad, 32px items, icon + label + optional shortcut, hover `--fill-hover`, section dividers hairline. Type-to-filter, arrow-key nav.

- **Toasts** — Bottom-center or top-right, dark `--ink` bg / #fff text, radius 8, e2, auto-dismiss ~4s, slide+fade in. Leading status dot in semantic color.
- **Tooltips** — `--ink` bg, #fff 12.5px text, radius 6, 6×8 pad, e1, ~150ms delay-in / instant-out, 8px offset from trigger.
- **Tabs** — Underline style: 14–15px labels, active `--ink` + 2px accent underline, inactive `--ink-2`, hover `--ink`. Underline slides between tabs on switch.

#### Progress bar `[Verified]`

Multi-step forms show a progress indicator. Spec estimate: 3–4px track in `--hairline`, fill in the form's accent, width animated on step change (~250ms ease-out). Often paired with an "N of M" caption in Caption style.

### Iconography & motion `[Assumption]`

- **Iconography** — 
- **Motion principles** — 

`Tokens` → `Primitives (button, input, menu)` → `Blocks (question types)` → `Editor + Form runtime`

> 💡 Implementation shortcut for the competitor
>
> Ship this as CSS custom properties on `:root` with a `[data-theme]` override for respondent branding, primitives in a headless library (Radix/Ark) styled to the token table, and question-type "blocks" composed from those primitives. That mirrors Tally's document-editor architecture and gets you visual parity in days, not weeks — then differentiate on the accent expressiveness and motion polish Tally deliberately keeps minimal.

---

## Information Architecture

*How the product is organized end-to-end — from marketing site to a single form's tabs — and the URL scheme we should build against.*

Tally's IA is deliberately shallow. It borrows Notion's mental model: a workspace holds forms the way a workspace holds pages, and the editor *is* the primary surface. There is no signup wall, so the anonymous editor is effectively the top of the funnel. Below we reconstruct the observable structure (`[Verified]` where it maps to shipped, documented features) and flag inferred routing and grouping as `[Assumption]`. The recommendations are what **we** should build, not a claim about Tally's private routing.

- **3** — Nav depths to any form
- **4** — Form-level tabs
- **0** — Signup steps to build
- **5** — Publish surfaces

### 7.1 App sitemap

Four top-level zones: the **marketing/SEO surface** (the growth engine), **auth**, the **authenticated app**, and the **public runtime** that renders live forms to respondents. Only the last two carry product logic; the first is a content machine.

- Marketing & SEO surface · tally.so, /templates/*, /blog/*, /help/*, /pricing, /hire-an-expert
- Auth · /signin, /signup (optional — building starts anonymous), OAuth callback, magic-link
- Authenticated app · Dashboard → Workspace → Form → {Build · Share · Results · Settings}
- Public runtime · tally.so/r/{formId}, custom domain, embed (inline/popup/full-page/side-tab/popover)

Nested hierarchy of the authenticated app and where each feature-group lives:

- **Dashboard (root)** — entry after auth; lists workspaces + forms, global search, "New form" / template picker.
  - **Workspace** `[Pro: workspaces & folders]` — a scope for forms, members, and (Pro) folders.
    - **Folder** `[Pro]` — optional grouping inside a workspace.
    - **Form** — the atomic unit. Opens into four tabs:
      - **Build** — the Notion-like block editor (default tab).
      - **Share** — link, embed generator, custom domain, QR, publish state.
      - **Results** — submissions table, individual responses, summary/analytics, export.
      - **Settings** — form behavior, notifications, integrations, access, data.
  - **Account / Workspace settings** — profile, members & roles, billing & plan, custom domains, branding, API/webhooks, integrations.

Tab set and publish surfaces are `[Verified]` from documented capabilities; the exact placement of some settings sub-groups is an `[Assumption]` based on standard form-builder conventions.

### 7.2 Navigation model

- **Global chrome (persistent)** — A thin left rail / top bar carrying: workspace switcher, global "New form", search, help, and account menu. Present across Dashboard and drill-downs so users never lose the workspace context.
- **Workspace & folder switcher** — `[Pro]` A dropdown/section listing workspaces; selecting one repaints the forms list. Folders act as a second grouping axis inside a workspace. Free users effectively have one implicit workspace.
- **Form-level tabs** — The core navigation primitive. Once inside a form, a horizontal tab bar — **Build · Share · Results · Settings** — is the only mode switch. State (which form) persists across tabs; a "back to dashboard" affordance exits.
- **Moving between forms** — Exit to Dashboard/Workspace list, or use global search to jump directly by name. No form-to-form sibling nav inside the editor — the list is the hub, forms are spokes (hub-and-spoke).

`Dashboard` → `Workspace` → `Form` → `Build / Share / Results / Settings`

> 💡 Opinionated build note: keep the tab bar to four
>
> Resist a fifth tab. Analytics belongs *inside* Results, integrations *inside* Settings. Every added top-level tab dilutes the "it's just a document" promise that makes Tally feel light. Depth over breadth: nest, don't widen.

### 7.3 Page structure & feature-grouping logic

The organizing principle is **lifecycle-by-tab**: build it → ship it → read it → tune it. Group features by *which lifecycle question the user is answering*, not by data model. Recommended grouping for our build:

| Tab | User question | Feature groups it owns | Tier gates |
| --- | --- | --- | --- |
| **Build** | "What does it ask?" | Block editor, slash-insert, pages/steps, column layouts, conditional logic & calculations, answer piping, design/theme, custom CSS | Custom CSS + advanced design `[Pro]` |
| **Share** | "How do people reach it?" | Public link, embed generator (inline/popup/full-page/side-tab/popover), QR, custom domain, link preview (OG/favicon), publish/unpublish, Tally branding toggle | Custom domain, remove branding, link-preview `[Pro]` |
| **Results** | "What came back?" | Submissions table, single-response view, summary charts, visit + drop-off analytics, partial submissions, export (CSV), delete | Analytics, partial capture `[Pro]`; retention control `[Business]` |
| **Settings** | "How should it behave?" | Thank-you page / redirect, notifications, close-on-limit/date, password / reCAPTCHA / duplicate-prevention, email verification, integrations & webhooks, language/RTL, version history | Email verification, 90-day history `[Business]`; custom email domains, 30-day history `[Pro]` |


Feature-to-tier mapping is `[Verified]`; the assignment of each feature to a specific tab is our recommended IA (`[Assumption]` where Tally's exact placement isn't documented).

### 7.4 Dashboard architecture

- **Forms list (workspace view)** — Primary landing. Card or row per form showing: name, submission count, publish state, last-edited, thumbnail. Controls: New form, template gallery entry, folders/filter, search, sort. Row actions: open, duplicate, move, rename, share, delete.
- **Results view** — Two modes side-by-side: **Table** (one row per submission, columns = fields, filter/sort/search, CSV export) and **Summary** (per-question aggregates + charts). `[Pro]` adds a visits/drop-off funnel and partial-submission rows.
- **Workspace view** — The container: member list & roles, folders, workspace-level branding/domain, plan & billing entry. For Free users this collapses into "My workspace" with no member management.

- **Empty state** — First-run dashboard leads with "Create a form" + template picker — the conversion moment. Keep it one click from anonymous editor.
- **Search scope** — Global, across workspaces the user can access; returns forms by name. `[Assumption]`
- **Sort / filter** — By last-edited, name, submissions; filter by folder + publish state. `[Assumption]`
- **Bulk actions** — Multi-select move-to-folder / delete — recommended for our build; not confirmed in Tally.

### 7.5 URL structure (our build)

Design goals: SEO-clean marketing paths, short opaque IDs for the app, an unambiguous short public runtime path (Tally uses `/r/`), and clean custom-domain rewriting. IDs should be non-sequential (nanoid/slug) so form URLs aren't enumerable.

| Zone | Route pattern | Renders | Notes |
| --- | --- | --- | --- |
| Marketing | `/`, `/pricing`, `/templates/{slug}`, `/blog/{slug}`, `/help/{slug}` | Static/SSG pages | SEO engine. Keyword-rich slugs; `/templates/*` is the main organic ranking asset. `[Verified]` pattern class |
| Auth | `/signin`, `/signup`, `/auth/callback` | Auth flows | Signup optional — anonymous build first, then claim. `[Verified]` (no-signup) |
| App — dashboard | `/forms` or `/{workspaceId}` | Forms list | Authenticated shell |
| App — form tabs | `/forms/{formId}/build` · `/share` · `/results` · `/settings` | Editor & mgmt | Tab = last path segment; deep-linkable. `[Assumption]` |
| App — settings | `/settings/{account\|members\|billing\|domains}` | Account/workspace config | Separate from form scope |
| Public form | `/r/{formId}` | Live form runtime | Short, shareable, opaque ID. `[Verified]` (`/r/` path) |
| Custom domain | `https://{brand.com}/{slug}` | Live form runtime | `[Pro]` Reverse-proxy / rewrite to `/r/{formId}` |
| Embed | host page + `iframe src=/r/{formId}?embed=1` | Runtime in iframe | Modes via query/params: inline, popup, full-page, side-tab, popover. `[Verified]` |
| Webhook / API | `/api/v1/forms/{formId}/...`, outbound webhooks | JSON | Versioned prefix; webhooks fire on submission. `[Verified]` (webhooks exist) |


> ⚠️ What's inferred vs known
>
> **Known:** the four publish surfaces, the embed modes, the `/r/` public path, the no-signup entry, and the feature/tier mapping. **Inferred (label as assumption in any spec):** the exact authenticated route strings, the tab-as-path-segment scheme, dashboard sort/search/bulk controls, and the internal settings sub-grouping. We should adopt the patterns above as our own convention rather than presenting them as Tally's.

> ℹ️ One IA lever to beat Tally
>
> Tally's hub-and-spoke (exit to list to switch forms) adds friction for power users managing many forms. Add a lightweight **form quick-switcher** (command-K, jump by name without leaving the editor) and a persistent recent-forms strip. It's cheap, respects the four-tab discipline, and directly targets the 500k-team power-user segment.

---

## Business Model & Growth

*Tally monetizes brand, control, and collaboration — never the volume of value users create — and compounds distribution through SEO, embeds, and AI referral loops at near-zero CAC.*

- **$5M** — ARR (2025) `[Verified]`
- **500k+** — Teams using Tally `[Verified]`
- **~100%** — Organic growth, ~$0 CAC `[Verified]`
- **~99%** — Features free (fair-use) `[Verified]`

### The value-metric insight: don't meter what users create

The single most important pricing decision Tally made is **what it refuses to charge for**. Typeform and Jotform gate on *responses* and *forms* — the exact axis on which a successful form *grows*. That turns every viral survey into a paywall event and punishes the customer precisely when they are winning. Tally inverts this: **unlimited forms and unlimited submissions are free** `[Verified]`, and revenue comes from metrics orthogonal to usage volume — branding removal, custom domains, team seats, analytics depth, and data-retention control.

> 💡 Why this drives adoption
>
> A free plan that scales *with* the customer removes all friction from the highest-intent moment (a form going viral). The upgrade trigger is decoupled from success and instead tied to *professionalization* — removing branding, putting it on your own domain, inviting a team. Users self-select into paying when they have already embedded Tally in a real workflow, so willingness-to-pay is high and churn is low.

| Value metric | Typeform / Jotform | Tally | Consequence |
| --- | --- | --- | --- |
| Responses / submissions | Metered & capped | **Unlimited (free)** `[Verified]` | Tally wins every high-volume use case |
| Number of forms | Capped on low tiers | **Unlimited (free)** `[Verified]` | No reason to consolidate or delete |
| Branding removal | Paid | Paid (Pro) `[Pro]` | Free tier is a distribution channel (see loops) |
| Custom domain / team / analytics | Paid | Paid (Pro/Biz) | Charges for professionalization, not creation |


### Full pricing comparison

| Capability | `[Free $0]` | `[Pro $24/mo]` | `[Business $74/mo]` |
| --- | --- | --- | --- |
| Unlimited forms & submissions | ✓ | ✓ | ✓ |
| Payments, signatures, file uploads (10MB cap) | ✓ | ✓ | ✓ |
| Conditional logic, calculations, answer piping | ✓ | ✓ | ✓ |
| Integrations (Sheets, Notion, Zapier, Make, webhooks) | ✓ | ✓ | ✓ |
| 45+ languages & RTL, password-protect, close-on-limit | ✓ | ✓ | ✓ |
| Remove Tally branding | — | ✓ | ✓ |
| Custom domains & custom email domains | — | ✓ | ✓ |
| Unlimited team collaboration, workspaces & folders | — | ✓ | ✓ |
| Partial submissions capture, drop-off analytics | — | ✓ | ✓ |
| Advanced customization + custom CSS, link-preview control | — | ✓ | ✓ |
| Unlimited file uploads (removes 10MB cap) | — | ✓ | ✓ |
| Version history | — | 30 days | 90 days |
| Premium integrations (GA, Meta Pixel) | — | ✓ | ✓ |
| Data-retention control (auto-delete) | — | — | ✓ |
| Email verification of respondents | — | — | ✓ |


All tier contents above `[Verified]`. Annual billing gives ~2 months free.

> ℹ️ Our pricing twist
>
> **Keep the free tier as generous as Tally's** (unlimited forms + submissions is now table stakes) but add a low-friction **$12 "Solo" tier that unlocks only branding removal + one custom domain**. Tally's cheapest paid step is $24 — a jump that strands solo creators and indie hackers who only want to look professional. A $12 rung captures that segment, seeds custom-domain adoption (a retention anchor), and creates a natural upgrade ladder Solo → Pro → Business. Layer *usage-based add-ons* (below) on top rather than raising base prices.

### Free plan as the growth engine — upsell triggers

The free plan is not a loss leader; it is the **top of the acquisition funnel and the distribution surface**. Every free form carries a "Made with Tally" badge, so free users actively market the product. Upgrades are triggered by specific *moments of professional intent*, not by hitting a wall.

| Trigger moment | Felt need | Unlocks | Tier |
| --- | --- | --- | --- |
| Form is going in front of customers / on the website | "This looks amateur with a badge" | Remove branding + custom domain | `[Pro]` |
| Shared in Slack/social, needs a clean preview | "The link preview is ugly" | Link-preview control (OG image/title) | `[Pro]` |
| A colleague needs to edit | "I can't collaborate" | Unlimited team, workspaces & folders | `[Pro]` |
| Conversion matters (lead-gen, checkout) | "Where are people dropping off?" | Drop-off analytics + partial submissions | `[Pro]` |
| Collecting large files / portfolios | "10MB isn't enough" | Unlimited file uploads | `[Pro]` |
| Handling PII / regulated data | "We must auto-purge data & verify identity" | Retention control + email verification | `[Business]` |


### Growth loops

- **SEO template engine** — A large template gallery + community templates rank in Google for high-intent queries ("event registration form", "RSVP form"). Each ranked template is a landing page that converts searchers into signups. `[Verified]`
- **Embed / "Made with" badge** — Free forms embedded across the web carry a Tally badge — a backlink + brand impression on every high-traffic host page. Removing it costs money, which is itself the Pro upsell. `[Verified]`
- **AI / ChatGPT referral** — AI assistants became Tally's #1 referral source — they recommend Tally for "free form builder" prompts. Strong docs + template SEO feed the models' training and retrieval. `[Verified]`
- **Word-of-mouth** — A respondent who likes the form experience, or a teammate who sees it, asks "what did you use?" — the badge answers before they finish the sentence. `[Verified]`
- **Community templates** — User-created templates expand the SEO surface for free and create creator investment (a mild lock-in / status loop). `[Verified]`
- **Expert marketplace** — "Hire an expert" turns power users into an ecosystem that both retains them and markets Tally to their clients. `[Verified]`

The core viral loop — free forms are the advertising medium:

`Free user builds form` → `Embeds / shares w/ badge` → `Respondent sees "Made with Tally"` → `New signup` → `Builds their own form`

Loop mechanics `[Verified]`; exact viral coefficient is an `[Assumption]`. The SEO loop compounds in parallel: templates rank → searchers land → some publish public forms/templates → more indexable pages.

### Acquisition, retention & expansion

- **Acquisition** — Effectively zero paid CAC — SEO, embeds, AI referral, and word-of-mouth. No-signup-required-to-build removes the last activation barrier. `[Verified]`
- **Retention** — Custom domains and integrations (webhooks into Sheets/Notion/CRMs) create workflow lock-in; forms become load-bearing infrastructure. Workspaces/folders raise switching cost per added team. `[Assumption]` on lock-in strength.
- **Expansion** — Land solo-free → expand via team seats and workspaces. Because seats are *unlimited* at a flat Pro price rather than per-seat, expansion is via account count and Business-tier compliance needs, not seat metering. `[Verified]`
- **Viral features** — The badge, shareable public links, community templates, and the expert marketplace all turn usage into distribution. `[Verified]`

> ⚠️ Expansion gap to exploit
>
> Flat-price unlimited seats is generous but leaves money on the table for large orgs and forgoes an Enterprise motion (Tally lists no Enterprise tier). A competitor can keep unlimited seats on lower tiers *and* add an Enterprise tier gated on SSO/SAML, audit logs, SLAs, and data-residency guarantees — monetizing the largest accounts without touching the generous-free ethos.

### Revenue model & monetization levers we could add

Preserve the sacred rule — **never meter forms or submissions** — and monetize on *optional value-add consumption* and *professionalization* instead.

- **Usage-based add-ons** — Pay-as-you-go credits for things with real marginal cost: SMS/WhatsApp notifications, respondent email verification volume, large-file storage beyond a fair-use pool, e-signature legal-grade audit trails. Opt-in, so the free ethos is intact.
- **AI credits** — "Build a form from a prompt", AI response summarization, sentiment/clustering on open-text answers, auto-generated follow-up questions. Metered in credits (a bundle included per paid tier) — this is the highest-margin, most differentiating lever given Tally's minimal built-in AI today. `[Assumption: Tally has little in-product AI]`.
- **Template & expert marketplace take-rate** — Let creators sell premium templates and take 15–30%. Extend the "hire an expert" marketplace with escrow + a platform fee. Turns the community loop into a revenue line and deepens creator lock-in.
- **Payments rev-share** — On payment forms (Stripe Connect `[Assumption]`), add a small optional platform fee on transactions in exchange for lower-friction setup — classic embedded-fintech margin that scales with customer success without capping it.
- **Enterprise tier** — SSO/SAML, SCIM, audit logs, DPA + guaranteed EU/other-region residency, SLA, priority support. Sales-assisted, high ACV, does not degrade lower tiers.
- **Solo rung ($12)** — Branding removal + 1 custom domain. Converts the huge indie/creator base that balks at the $24 jump; a cheap first dollar that dramatically lifts free→paid conversion.

> ⚠️ Guardrail
>
> Every lever above is *additive and opt-in*. The moment a core form or its submissions get metered, the acquisition and viral loops break — that constraint is the whole strategy, not a limitation. Monetize marginal-cost consumption (AI, SMS, storage, payments) and organizational professionalization (domains, teams, compliance, enterprise), never the act of collecting responses.

---

## Technical Architecture

*A concrete, opinionated target architecture for a Tally-class form platform: edge-cached public forms, a NestJS API, a Postgres/JSONB core, and an async worker fabric for webhooks and integrations.*

The architecture splits cleanly into a **read-heavy public plane** (rendering and accepting form submissions at scale, must be cheap and cacheable) and a **write-heavy authoring plane** (the editor, dashboards, integrations, billing). We optimize each separately. Everything about Tally's *actual* stack is undocumented and labeled `[Assumption]`; everything about the product's observable behavior is `[Verified]`.

### System topology

- Client / Edge — Next.js (App Router) app + standalone form-runtime embed bundle, served behind Cloudflare (CDN, WAF, DDoS, SSL-for-SaaS custom domains)
- API — NestJS (TypeScript) REST + typed contracts; auth, tenancy, form CRUD, submissions ingest, billing, integration config
- Data — PostgreSQL (JSONB schema + responses) &middot; Redis (cache/sessions/rate-limit/queues) &middot; S3-compatible object storage (R2/S3) &middot; Typesense/Meilisearch (search) &middot; ClickHouse (later, analytics events)
- Workers — BullMQ consumers: webhook dispatch, integration sync, email, exports, file AV scan, AI jobs, analytics rollups
- External — Stripe / Stripe Connect &middot; Resend/Postmark &middot; Google Sheets, Notion, Airtable, Slack, Zapier/Make/n8n &middot; customer webhook endpoints

Primary = our recommended target. Tally likely runs a comparable but more consolidated shape (assumed): a single app framework, managed EU Postgres, Cloudflare edge, and a queue for outbound work.

### Concern-by-concern decisions

- **Frontend** — Two artifacts from one monorepo. The **authoring app** (Next.js App Router, React, TS, Tailwind + shadcn/ui) hosts the editor: TipTap/ProseMirror document model, dnd-kit reordering, Zustand for editor state, TanStack Query for server state. The **form runtime** is a separate tiny bundle (React Hook Form + Zod) shipped for embeds and public pages — no editor code, no auth cookies, aggressively cacheable.
- **Backend & API style** — NestJS modular monolith exposing versioned **REST** (`/v1`) with OpenAPI-generated typed clients; optional internal tRPC for first-party app calls. Prisma ORM. Clear module boundaries (forms, submissions, tenancy, billing, integrations, files) so a hot module can later peel off into its own service.
- **Authentication** — Session + JWT hybrid: HttpOnly session cookie for the first-party app, short-lived JWT for API/embeds. OAuth for integration grants (Google, Notion, Slack, Stripe Connect). WorkOS for SAML SSO + SCIM at the enterprise tier. Public form submission requires *no* auth — matches Tally's "no signup to start" ethos. `[Verified]` (no-signup building)
- **Authorization & multi-tenancy** — Row-level tenancy: every table carries `workspace_id`; every query is scoped by a Prisma middleware guard + Postgres RLS as defense-in-depth. RBAC roles (owner/admin/editor/viewer) map to workspaces & folders (a Pro concept). `[Pro]` unlocks workspaces/folders + unlimited collaborators. `[Verified]`
- **Database** — PostgreSQL as source of truth. Form **schema** stored as JSONB (block tree); **responses** stored as JSONB payload plus a few promoted columns (created_at, respondent hash, completion state) for indexing. Partition the responses table by month for retention/auto-delete. `[Business]` data-retention/auto-delete rides on the partition + a scheduled purge job. `[Verified]`
- **Object storage** — S3-compatible (Cloudflare R2 or S3) with **presigned direct uploads** from the browser — files never transit the API. Objects keyed by workspace/form/submission. AV scan queued on upload; 10MB cap enforced on Free, lifted on `[Pro]`. `[Verified]` (unlimited uploads on Pro)
- **Caching & search** — Redis for hot form schemas, session store, rate-limit counters, and idempotency keys. Published form definitions cached at the Cloudflare edge with tag-based purge on republish. Typesense/Meilisearch indexes responses (dashboard search) and the template gallery — templates ranking in Google is a core growth loop. `[Verified]` (SEO templates)
- **Queues, jobs & notifications** — BullMQ on Redis with dedicated worker processes and per-queue concurrency. Jobs: outbound webhooks, integration sync (Sheets/Notion/Airtable rows), transactional email via Resend/Postmark (self-notifications, email verification), CSV/Excel exports, AI enrichment, analytics rollups. Idempotent handlers keyed on submission id.
- **Logging, monitoring, analytics** — Sentry for errors; OpenTelemetry traces into Prometheus/Grafana/Loki; PostHog for product analytics + funnels. Form-visit and drop-off analytics (a `[Pro]` feature) are computed from lightweight client beacons rolled up async into Postgres now, ClickHouse at volume. `[Verified]` (visit/drop-off analytics)
- **Security posture** — Cloudflare WAF + rate limiting at the edge; reCAPTCHA and honeypot on public submit; per-form spam heuristics; signed webhook payloads (HMAC); encryption at rest + TLS in transit; GDPR data residency in the EU region. Secrets in a managed vault; least-privilege OAuth scopes. `[Verified]` (GDPR, EU hosting, encrypted, reCAPTCHA)

### Component responsibilities

| Component | Responsibility | Tech |
| --- | --- | --- |
| Edge / CDN | Serve static app + form-runtime bundle; cache published form JSON; WAF, DDoS, custom-domain SSL | Cloudflare (CDN, WAF, SSL-for-SaaS) |
| Authoring app | Editor, dashboards, workspace & billing UI | Next.js App Router, React, TS, Tailwind/shadcn, TipTap, Zustand, TanStack Query |
| Form runtime | Render + validate + submit public forms/embeds | Standalone React Hook Form + Zod bundle |
| API | Auth, tenancy guard, form CRUD, submission ingest, billing, integration config | NestJS, Prisma, OpenAPI |
| Primary DB | Forms (JSONB schema), responses (JSONB + promoted cols), users, workspaces, billing | PostgreSQL (partitioned responses) |
| Cache / broker | Hot schemas, sessions, rate limits, idempotency, queue backend | Redis |
| Object storage | File-upload + signature assets via presigned URLs | Cloudflare R2 / AWS S3 |
| Search | Response search, template gallery search | Typesense / Meilisearch |
| Workers | Webhooks, integrations, email, exports, AV scan, AI, rollups | BullMQ consumers (Node 20+) |
| Analytics store | High-volume visit/drop-off events (later stage) | ClickHouse |
| Billing / payments | Subscriptions + in-form payment collection | Stripe + Stripe Connect |


### Request lifecycle 1 — render & submit a public form

Optimized for speed and abuse-resistance: the read path is edge-cacheable and anonymous; heavy work happens after the respondent gets their "thank you."

`Respondent` → `Edge cache (form JSON)` → `Runtime bundle renders + Zod validates` → `POST /v1/submissions` → `Spam check (reCAPTCHA + honeypot + rate limit)` → `Persist JSONB response` → `Enqueue post-processing` → `200 + Thank-You / redirect`

Post-processing (email notify, Sheets/Notion sync, webhooks, AI) runs on workers — the respondent never waits on it. Partial-submission capture (`[Pro]`, `[Verified]`) writes incremental JSONB rows on field blur before final submit.

### Request lifecycle 2 — webhook / integration dispatch with retries

`Submission event` → `BullMQ queue (per integration)` → `Worker builds HMAC-signed payload` → `POST to endpoint / integration API` → `2xx? mark delivered` → `Else exp. backoff retry (jitter)` → `Max attempts → dead-letter + alert`

Each attempt is logged with status, latency, and response body for a user-facing delivery log. Idempotency key = submission id + integration id so retries never double-write. Circuit-breaker per endpoint on repeated 5xx.

### Multi-tenant model & data strategy

A single shared cluster (pooled multi-tenancy) — not a DB-per-tenant — keeps 500k+ teams economical on a bootstrapped cost base. Isolation is enforced in three layers:

- [x] Every domain row carries `workspace_id`; Prisma middleware injects the scope on every query.
- [x] Postgres **Row-Level Security** policies as a hard backstop against a missing app-layer filter.
- [x] Object-storage keys and search documents are namespaced by workspace; retention/purge jobs operate per-workspace.

The **form schema** is a versioned JSONB document (a block tree mirroring the TipTap model), which makes new block types additive with zero migrations and gives free `[Pro]` version history (store schema snapshots; 30/90-day windows `[Verified]`). **Responses** are stored schema-flexibly:

```
-- responses: JSONB payload + promoted, indexable columns
CREATE TABLE responses (
  id            uuid PRIMARY KEY,
  workspace_id  uuid NOT NULL,
  form_id       uuid NOT NULL,
  form_version  int  NOT NULL,       -- which schema snapshot answered
  answers       jsonb NOT NULL,      -- { blockId: value, ... }
  respondent    text,               -- hashed IP/email for dedupe
  completed     boolean NOT NULL,    -- partial vs final (Pro)
  created_at    timestamptz NOT NULL
) PARTITION BY RANGE (created_at);   -- monthly; enables retention auto-delete

CREATE INDEX ON responses (workspace_id, form_id, created_at DESC);
CREATE INDEX ON responses USING gin (answers);  -- filter/search inside answers
```

> ⚠️ Assumption: Tally's likely current shape
>
> Given a ~11-person bootstrapped team at $5M ARR, Tally almost certainly runs a **consolidated modular monolith** on managed EU Postgres behind Cloudflare, with a single queue for outbound webhooks/integrations and a JSONB-based schema/response model very similar to the above. Micro-services would be over-engineering at their headcount — and our target deliberately mirrors that lean shape while keeping module seams for later extraction.

> 💡 Where to out-build Tally
>
> The read/write plane split is the leverage point: shipping a truly tiny, framework-agnostic embed runtime (sub-15KB) and edge-cached form JSON makes public forms faster and cheaper than a monolith that renders forms through its app server. Pair that with signed webhooks, a visible delivery log, and RLS-backed tenancy from day one — areas where a fast-moving competitor can credibly claim reliability parity or better.

---

## Recommended Tech Stack

*An opinionated, TypeScript-end-to-end stack tuned for a small team's leverage today and a form platform's real scale tomorrow.*

The stack below is a concrete build order, not a wish list. Everything is **TypeScript, one language across the wire**, so a five-person team can move between editor code, API, and workers without context-switching. Tally itself is `[Verified]` a ~11-person team running ~$5M ARR with unlimited submissions on a free plan — meaning the winning constraint is *engineering leverage per person*, not raw novelty. Every choice here is judged against that bar. Where we assert Tally's own internals we label it `[Assumption]`; their stack is not publicly documented.

- **1** — Language across web, API, workers, shared schema
- **JSONB** — Form schema & responses in Postgres — no NoSQL sprawl
- **~7** — Managed services at launch; self-host later only if margin demands
- **<20KB** — Target gzip for the standalone public form runtime bundle

### Layer-by-layer justification

| Layer | Choice | Why | Alternatives considered |
| --- | --- | --- | --- |
| Frontend framework | Next.js (App Router) | SSR/ISR for SEO-critical template & public-form pages (Tally's growth engine is `[Verified]` SEO-driven); RSC trims client JS; one deploy target for marketing + app. | Remix (smaller ecosystem), SvelteKit (team-hiring risk), plain Vite SPA (loses SEO/SSR). |
| Language | TypeScript | Shared types from DB → API → editor → embed runtime via a common `form-schema` package. Compile-time safety on the schema that *is* the product. | JS (no safety), Go/Rust backend (splits the language, kills shared schema). |
| Styling | Tailwind CSS | Utility-first keeps CSS bounded as the app grows; trivially themeable for the Pro custom-CSS feature; zero runtime cost. | CSS Modules (verbose), styled-components/Emotion (runtime + RSC friction). |
| Component library | shadcn/ui + Radix | Own-the-code (copied in, not a black-box dep) + accessible Radix primitives. Critical for a form builder where a11y is table stakes. | MUI (heavy, hard to restyle), Chakra (runtime CSS), Mantine (less control). |
| Client / editor state | Zustand | Minimal boilerplate for high-frequency editor mutations (drag, reorder, inline edit); transient, non-serialized-by-default store fits a live document. | **Redux Toolkit** — see tradeoff below; Jotai (atom sprawl for a big doc); XState (overkill outside submit flow). |
| Server state | TanStack Query | Caching, dedupe, optimistic updates, background refetch for form lists/responses/analytics. Removes hand-rolled fetch glue. | SWR (fewer mutation primitives), RTK Query (drags in Redux). |
| Form editor engine | TipTap / ProseMirror | Battle-tested block/document model — the exact Notion-like slash-command editing Tally ships (`[Verified]`). Nodes map cleanly to question blocks; robust selection/undo. | Slate (more DIY, weaker undo), Lexical (younger plugin ecosystem), custom contenteditable (do not). |
| Drag-and-drop | dnd-kit | Accessible, keyboard-navigable, performant reordering of blocks/pages/options; composes with ProseMirror node views. | react-beautiful-dnd (unmaintained), native HTML5 DnD (poor a11y/touch). |
| Animation | Framer Motion | Declarative micro-interactions (page transitions, block insert) that make the editor feel premium with little code. | React Spring (steeper API), CSS-only (loses layout/shared-element transitions). |
| Public form runtime | React Hook Form + Zod, standalone bundle | Uncontrolled inputs = minimal re-renders on huge forms; Zod schema generated from `form-schema` so validation is identical client and server. Shipped as a tiny embeddable bundle (inline/popup/side-tab, all `[Verified]` embed modes). | Formik (more re-renders), the editor's own React tree (too heavy for third-party embeds). |
| Backend framework | NestJS | Structured DI, modules, guards, and typed pipes scale a growing team cleanly; native OpenAPI; can expose tRPC internally for the web app. | **FastAPI** — see tradeoff below; Express (unstructured at scale), Fastify (less batteries-included). |
| ORM | Prisma | Type-safe queries, migrations, and generated types feed the shared schema package. Fast to iterate for a small team. | Drizzle (leaner, less mature migrations/tooling — reconsider at high scale), TypeORM (rougher DX), Kysely (more manual). |
| Primary database | PostgreSQL (JSONB) | Relational for teams/workspaces/billing; JSONB for the flexible form schema and heterogeneous response payloads — one store, no Mongo. Rich indexing, GIN on JSONB, transactions. | MongoDB (loses relational integrity for billing/RBAC), MySQL (weaker JSON), DynamoDB (query rigidity). |
| Cache / ephemeral | Redis | Session store, rate limiting (protect free-tier unlimited submissions from abuse), response-page caching, and BullMQ broker in one dependency. | Memcached (no queues/structures), in-proc cache (no cross-instance coherence). |
| Search | Typesense (or Meilisearch) | Typo-tolerant search over templates (SEO landing pages) and a user's own responses; sub-50ms, cheap to run vs Elastic. | Elasticsearch (ops-heavy), Postgres FTS (fine early, weaker relevance/typo tolerance at scale). |
| Async / queue | BullMQ | Reliable, Redis-backed jobs for webhooks, integrations, notification emails, exports, and AI tasks — with retries/backoff. Reuses existing Redis. | Temporal (powerful but heavy for launch), SQS (adds AWS coupling), pg-boss (fine, less rich UI/tooling). |
| Object storage | S3-compatible (Cloudflare R2) | Presigned direct uploads for the file-upload block (`[Verified]` feature); R2 zero egress slashes cost of serving uploads; AV scan on ingest. | AWS S3 (egress cost), storing blobs in Postgres (never). |
| Auth | Session+JWT hybrid; WorkOS for SSO/SCIM | Cookie sessions for the app, short JWTs for embed/runtime; OAuth for integrations. WorkOS buys SAML/SCIM without building it — an enterprise unlock Tally lacks. | Auth0 (pricier at scale), NextAuth alone (no SCIM/SAML depth), roll-your-own SSO (do not). |
| Payments | Stripe + Stripe Connect | Stripe for our own billing (Free/$24/$74 tiers, `[Verified]`); Connect for payments collected *inside* a user's form (`[Verified]` feature). Tally almost certainly does the same `[Assumption]`. | Paddle/LemonSqueezy as merchant-of-record (simpler tax, less flexible Connect model). |
| Email | Resend (or Postmark) | High-deliverability transactional email for notifications, email-verification (Business tier, `[Verified]`), and custom email domains (Pro). Great DX, DKIM automation. | SES (deliverability tuning burden), SendGrid (DX/support complaints). |
| CDN / edge | Cloudflare | CDN, WAF, DDoS, and **SSL-for-SaaS** to provision certs for customer custom domains (Pro feature, `[Verified]`) — the single hardest piece of custom-domain support, solved as a product. | Fastly (pricier SSL-for-SaaS), Vercel edge alone (no SaaS custom-domain cert automation). |
| Container / orchestration | Docker; start on Fly.io/Render, K8s later | Ship on a PaaS to avoid a cluster no one has time to babysit; the Docker images port to Kubernetes untouched when scale (not vanity) demands it. | K8s from day one (premature ops tax), bare EC2 (manual toil), serverless-only (cold starts hurt the editor). |
| IaC | Terraform | Declarative, reviewable infra; provider coverage for Cloudflare, R2, Postgres, DNS. One source of truth as the footprint grows. | Pulumi (nice but smaller team knowledge base), ClickOps (unreproducible). |
| Observability | Sentry + OTel/Grafana/Loki + PostHog | Sentry for errors, OpenTelemetry→Prometheus/Grafana/Loki for metrics/logs/traces, PostHog for product analytics + funnels (mirrors the drop-off analytics Tally sells at Pro). | Datadog (excellent, expensive early), New Relic (cost), console.log (not a strategy). |
| CI/CD & testing | GitHub Actions + Turborepo; Playwright + Vitest | Turborepo caches monorepo builds; Vitest for units, Playwright for the submit/embed flows that *must not* break. Cheap, fast, standard. | CircleCI/Jenkins (more setup/ops), Cypress (Playwright edges it on speed/multi-browser). |


### Monorepo layout

A Turborepo monorepo lets shared code (the form schema, UI kit, and runtime) be a single source of truth that both the editor and the public form import — so a new question type is defined *once*.

```
tally-competitor/
├─ apps/
│  ├─ web/                 # Next.js: marketing, dashboard, form EDITOR (TipTap+dnd-kit+Zustand)
│  ├─ api/                 # NestJS REST/tRPC, Prisma, auth, billing, integrations
│  └─ workers/             # BullMQ consumers: webhooks, emails, exports, AI, AV scan
├─ packages/
│  ├─ ui/                  # shadcn/ui + Radix components, Tailwind preset, design tokens
│  ├─ form-schema/         # Zod + TS types for form blocks, logic, calculations (SHARED)
│  ├─ form-runtime/        # standalone public-form renderer (RHF+Zod), embed bundle
│  ├─ db/                  # Prisma schema, migrations, generated client
│  └─ config/              # eslint, tsconfig, tailwind, turbo pipeline configs
├─ infra/                  # Terraform: Cloudflare, R2, Postgres, DNS, WorkOS
├─ turbo.json
└─ package.json            # pnpm workspaces
```

`packages/form-schema` is the keystone: the editor writes it, the API validates against it, and `form-runtime` renders it — one definition, no drift.

> 💡 Philosophy: start lean, buy scale only when it bites
>
> Tally reached ~$5M ARR with ~11 people (`[Verified]`). Copy that leverage. Launch on a PaaS (Fly.io/Render), managed Postgres (Neon), Redis, R2, and a handful of SaaS APIs (Cloudflare, Stripe, Resend, WorkOS) — **no Kubernetes, no ClickHouse, no Elasticsearch on day one.** Each heavy component earns its way in only when a real metric forces it: move to K8s when PaaS bills/limits hurt; add ClickHouse when analytics event volume overwhelms Postgres; add a search cluster when Typesense stops keeping up. Premature infra is the tax that sinks small teams.

### Contested tradeoffs, decided

- **FastAPI vs NestJS → NestJS** — FastAPI is superb, but it forks the language — a Python API against a TypeScript editor kills the `form-schema` package that keeps client and server validation identical. NestJS keeps one language end-to-end, gives a small team guardrails (DI, modules, guards) as it grows, and can serve tRPC to the web app for zero-codegen type safety. We accept Python's ML edge is better and route AI work to jobs/services instead of the core API.
- **Redux vs Zustand → Zustand** — The editor is a live document mutated dozens of times per second (drag, reorder, inline edit). Redux's action/reducer ceremony is friction at that cadence, and its serialize-everything default fights transient editor state. Zustand gives direct, minimal-boilerplate stores with selective subscriptions to avoid re-render storms. Server/cache state that Redux is often stretched to cover already lives in TanStack Query — so Redux would be redundant on both fronts.
- **MongoDB vs Postgres+JSONB → Postgres** — The form *schema* and responses are semi-structured (JSONB fits), but teams, workspaces, RBAC, and billing are deeply relational and demand transactions and foreign keys. Postgres does both; a document DB would force a second store and lose integrity where money and access control live.
- **Elasticsearch vs Typesense → Typesense** — Elastic's power comes with a heavy ops burden a lean team can't afford early. Typesense delivers typo-tolerant, sub-50ms search for templates and responses with a fraction of the operational surface. Revisit Elastic/OpenSearch only if search needs outgrow it.

### The runtime path, end to end

`Editor (TipTap)` → `form-schema (Zod)` → `API (NestJS/Prisma)` → `Postgres JSONB` → `form-runtime (embed)` → `Submit → BullMQ`

- Client / Edge — Cloudflare (CDN, WAF, SSL-for-SaaS custom domains), Next.js, standalone form-runtime
- API — NestJS + tRPC, Prisma, WorkOS auth, Stripe/Connect
- Async — BullMQ workers (webhooks, email, exports, AI, AV scan)
- Data — PostgreSQL (JSONB), Redis, R2 object storage, Typesense
- Ops — Terraform, Docker/Fly.io→K8s, GitHub Actions, Sentry + OTel/Grafana + PostHog

> ⚠️ On Tally's actual stack
>
> Tally's real infrastructure is not publicly documented. Stripe + Stripe Connect, Cloudflare, an EU cloud host, and a transactional-email provider are `[Assumption]`s inferred from their verified feature set (in-form payments, custom domains, EU data residency, email notifications). Treat the stack above as *our* recommended build, not a reverse-engineering of theirs.

---

## Database Design

*A PostgreSQL-first schema that treats form structure as versioned JSONB, stores responses as block-keyed documents, and scopes every row to an organization for hard multi-tenancy at scale.*

> ⚠️ Evidence posture
>
> Tally's actual schema, ORM, and partitioning strategy are **not public**. Everything below is an opinionated, implementation-ready design for the competitor we are building on the canonical stack (PostgreSQL + JSONB, Prisma, Redis). Product capabilities we mirror (unlimited forms/submissions, version history, payments, file uploads, retention controls) are `[Verified]` from Tally's plans; the storage mechanics are `[Assumption]`.

### 11.1 Logical ERD — entities & relationships

| Entity | Key fields | Relationships |
| --- | --- | --- |
| `users` | id, email, name, password_hash, email_verified_at | M:N with `organizations` via `memberships`; 1:N author of `forms`, `audit_logs` |
| `organizations` | id, name, slug, plan_id, billing_email | Tenant root. 1:N `workspaces`, `memberships`, `forms`, `api_keys`, `subscriptions`; N:1 `plans` |
| `workspaces` | id, org_id, name, parent_folder_id | N:1 `organizations`; 1:N `forms`; self-ref folders `[Pro]` |
| `memberships` | id, org_id, user_id, role, status | Join table users&harr;orgs; carries `role` |
| `roles` | id, org_id, name, permissions[] | Optional custom roles; default enum (owner/admin/editor/viewer) |
| `forms` | id, org_id, workspace_id, slug, status, published_version_id | N:1 org/workspace; 1:N `form_versions`, `responses`, `webhooks`, `integration_connections` |
| `form_versions` | id, form_id, org_id, version, schema (JSONB), settings (JSONB) | N:1 `forms`; immutable snapshots; drives version history `[30d]` `[90d]` |
| `form_blocks` | (virtual — embedded in `schema` JSONB) | Ordered array of blocks keyed by `block_id`; not a table (see 11.4) |
| `responses` | id, form_id, org_id, version, answers (JSONB), status, submitted_at | N:1 `forms`/`form_versions`; 1:N `files` |
| `response_answers` | (virtual — `answers` JSONB keyed by block_id) | Optional flattened projection table for analytics/export (see 11.5) |
| `files` | id, org_id, response_id, storage_key, mime, size, scan_status | N:1 `responses`; object body in S3/R2 |
| `templates` | id, org_id (nullable=global), title, schema (JSONB), visibility | Seed for `form_versions`; global + community-authored |
| `integrations` | id, provider, oauth_config (JSONB) | Catalog row (Sheets, Notion, Slack…); 1:N `integration_connections` |
| `integration_connections` | id, org_id, form_id, integration_id, credentials (JSONB enc), config (JSONB) | N:1 org/form/integration; per-form binding |
| `webhooks` | id, org_id, form_id, url, secret, events[], active | N:1 form; 1:N `webhook_deliveries` |
| `webhook_deliveries` | id, webhook_id, response_id, status, attempts, response_code | N:1 `webhooks`; delivery ledger for retries |
| `api_keys` | id, org_id, name, hashed_key, scopes[], last_used_at | N:1 org; bearer auth for public API |
| `subscriptions` | id, org_id, plan_id, stripe_sub_id, status, current_period_end | N:1 org/plan; mirror of Stripe state |
| `plans` | id, code, name, price_cents, limits (JSONB) | Reference table (free/pro/business); 1:N subscriptions |
| `audit_logs` | id, org_id, actor_id, action, target_type, target_id, meta (JSONB) | N:1 org; append-only |
| `analytics_events` | id, org_id, form_id, type, session_id, block_id, ts | High-volume; visit/drop-off funnel `[Pro]`; ClickHouse at scale |


### 11.2 Core PostgreSQL DDL

```
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search on titles

-- ── Identity & tenancy ────────────────────────────────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT UNIQUE NOT NULL,
  name              TEXT,
  password_hash     TEXT,                       -- NULL if SSO-only
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ                  -- soft delete
);

CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,             -- 'free' | 'pro' | 'business'
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  limits      JSONB NOT NULL DEFAULT '{}'::jsonb, -- {file_mb, retention_days, versions_days...}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          CITEXT UNIQUE NOT NULL,
  plan_id       UUID NOT NULL REFERENCES plans(id),
  billing_email CITEXT,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE workspaces (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  parent_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- folder tree (Pro)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_workspaces_org ON workspaces(org_id) WHERE deleted_at IS NULL;

CREATE TABLE memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'editor',    -- owner|admin|editor|viewer
  status     TEXT NOT NULL DEFAULT 'active',    -- invited|active|suspended
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);

-- ── Forms & versioned schema ──────────────────────────────────────
CREATE TABLE forms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id        UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES users(id),
  slug                CITEXT NOT NULL,          -- public URL segment
  title               TEXT NOT NULL DEFAULT 'Untitled',
  status              TEXT NOT NULL DEFAULT 'draft', -- draft|published|closed
  published_version_id UUID,                    -- FK set after first publish
  close_at            TIMESTAMPTZ,              -- close-on-date
  submission_limit    INTEGER,                  -- close-on-limit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (org_id, slug)
);
CREATE INDEX idx_forms_org_ws ON forms(org_id, workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE form_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL,                    -- denormalized for row scoping
  version     INTEGER NOT NULL,                 -- monotonic per form
  schema      JSONB NOT NULL,                   -- ordered blocks (see 11.4)
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb, -- theme, logic, thank-you, redirect
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_id, version)
);
CREATE INDEX idx_fv_form ON form_versions(form_id, version DESC);
ALTER TABLE forms ADD CONSTRAINT fk_forms_pubver
  FOREIGN KEY (published_version_id) REFERENCES form_versions(id);

-- ── Responses (partitioned) ───────────────────────────────────────
CREATE TABLE responses (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL,
  org_id        UUID NOT NULL,
  version       INTEGER NOT NULL,               -- schema version answered against
  answers       JSONB NOT NULL DEFAULT '{}'::jsonb, -- { block_id: value }
  status        TEXT NOT NULL DEFAULT 'complete',  -- partial|complete (Pro captures partial)
  respondent_ip INET,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb, -- utm, hidden fields, device
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  PRIMARY KEY (id, submitted_at)
) PARTITION BY RANGE (submitted_at);
-- monthly partitions provisioned by pg_partman / BullMQ cron
CREATE TABLE responses_2026_07 PARTITION OF responses
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE INDEX idx_resp_form_time ON responses (form_id, submitted_at DESC);
CREATE INDEX idx_resp_answers_gin ON responses USING GIN (answers jsonb_path_ops);

-- ── Files ─────────────────────────────────────────────────────────
CREATE TABLE files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  response_id UUID,                             -- nullable until submit
  block_id    TEXT,                             -- which upload block
  storage_key TEXT NOT NULL,                    -- R2/S3 object key
  filename    TEXT, mime TEXT, size_bytes BIGINT,
  scan_status TEXT NOT NULL DEFAULT 'pending',  -- pending|clean|infected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_files_response ON files(response_id);

-- ── Webhooks & deliveries ─────────────────────────────────────────
CREATE TABLE webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id    UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     TEXT NOT NULL,                     -- HMAC signing key
  events     TEXT[] NOT NULL DEFAULT '{response.created}',
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id     UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  response_id    UUID,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed
  attempts       SMALLINT NOT NULL DEFAULT 0,
  response_code  SMALLINT,
  next_retry_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wd_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'failed';

-- ── API keys ──────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  hashed_key   TEXT NOT NULL,                   -- store SHA-256 of key, never plaintext
  prefix       TEXT NOT NULL,                   -- shown in UI (e.g. 'tly_live_ab12')
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_api_hashed ON api_keys(hashed_key);

-- ── Billing ───────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES plans(id),
  stripe_customer_id TEXT, stripe_sub_id TEXT,
  status             TEXT NOT NULL,             -- active|past_due|canceled|trialing
  current_period_end TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)                               -- one active sub per org
);

-- ── Audit log (append-only) ───────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,                    -- 'form.published', 'member.invited'
  target_type TEXT, target_id UUID,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC);
```

### 11.3 Form-schema storage strategy

We store the entire form structure as a **versioned JSONB document** (`form_versions.schema`), not a fully-normalized `form_blocks` table. The editor is a Notion-like document `[Verified]`, so blocks are inherently an ordered, heterogeneous tree — a natural JSON shape. Publishing writes a new immutable `form_versions` row; `forms.published_version_id` points to the live one. This gives version history `[30-day]` `[90-day]` for free.

- **Versioned JSONB (chosen)** — Whole-form read/write in one row; trivial snapshots & rollback; schema evolves without migrations; matches editor's block model 1:1; responses can reference the exact version they answered. Cost: no cross-form column queries on individual questions without a projection.
- **Fully-normalized blocks (rejected)** — A `form_blocks` table per question enables SQL over question metadata, but forces N-row rewrites on every edit, painful ordering/reparenting, migration churn as block types grow, and expensive version snapshots. Overkill for a document editor.

```
// form_versions.schema shape
{
  "blocks": [
    { "id": "b_a1", "type": "heading",  "text": "Contact" },
    { "id": "b_a2", "type": "email",    "label": "Your email", "required": true },
    { "id": "b_a3", "type": "multiple_choice",
      "label": "Plan", "options": [{"id":"o1","label":"Pro"}] }
  ],
  "logic":  [ { "if": {"block":"b_a3","eq":"o1"}, "then": {"show":["b_a4"]} } ],
  "layout": { "pages": [["b_a1","b_a2"],["b_a3"]], "columns": {} }
}
```

### 11.4 Response storage strategy

Responses store a JSONB `answers` object **keyed by `block_id`**, plus the `version` integer so we can always interpret an answer against the schema it was submitted against — critical because forms mutate. A GIN index (`jsonb_path_ops`) supports filtered queries; a nightly job can materialize a flattened `response_answers` projection for CSV export and column analytics without paying normalization cost on the write path.

| Concern | JSONB answers (chosen) | Normalized answer rows |
| --- | --- | --- |
| Write cost | 1 row per submission | N rows per submission |
| Read a full response | Single row, zero joins | Join + reassemble |
| Per-question analytics | GIN / projection table | Native SQL aggregate |
| Schema drift tolerance | High — version-pinned | Brittle FKs to blocks |
| Verdict | **Default for OLTP** | Only as async projection |


```
-- responses.answers
{ "b_a2": "sam@acme.com",
  "b_a3": { "optionId": "o1", "label": "Pro" },
  "b_a5": { "fileIds": ["f_9x2"] } }

-- Query: everyone who chose option o1, last 30 days, one form partition scanned
SELECT id, submitted_at FROM responses
WHERE form_id = $1
  AND answers @> '{"b_a3":{"optionId":"o1"}}'
  AND submitted_at >= now() - interval '30 days';
```

### 11.5 Multi-tenancy, indexing, partitioning & retention

- **Multi-tenancy** — `org_id` on every tenant-owned table (denormalized onto `form_versions`, `responses`, `audit_logs` to avoid joins for scoping). Enforce Postgres **Row-Level Security** with a `SET app.current_org` session GUC as defense-in-depth; the NestJS repository layer always injects `org_id` so a query can never leak across tenants even if RLS is off.
- **Indexing** — Composite leading-`org_id`/`form_id` B-trees for list views; `GIN jsonb_path_ops` on `answers` for filter queries; partial indexes (`WHERE deleted_at IS NULL`) to keep hot indexes small; `pg_trgm` on `forms.title` for in-app search (Typesense/Meilisearch for cross-form response search).
- **Partitioning** — `responses` is **RANGE-partitioned by `submitted_at`** (monthly), auto-provisioned by pg_partman via a BullMQ cron. With unlimited submissions `[Verified]` this is essential: queries prune to a few partitions, retention becomes an O(1) `DROP TABLE`, and index bloat stays bounded. High-traffic forms can be sub-partitioned by `form_id` hash.
- **Retention & soft-delete** — `deleted_at` soft-delete on user-facing entities (trash/restore UX). **Data-retention auto-delete** `[Business]` is a per-form `settings.retention_days`; a nightly worker hard-deletes expired responses + their S3 files and drops empty partitions. Audit logs are append-only and exempt.

### 11.6 Relationships explanation

| Relationship | Cardinality | Why it is modeled this way |
| --- | --- | --- |
| users &harr; organizations | M:N via memberships | One person belongs to many teams; `memberships.role` carries the join's authorization data. Matches unlimited team collaboration `[Pro]`. |
| organization → workspaces | 1:N (self-ref tree) | Workspaces & folders `[Pro]` nest via `parent_id`; org is the tenant root for cascade deletes. |
| form → form_versions | 1:N (immutable) | Every publish is an append; `published_version_id` pins the live one, enabling rollback and version history. |
| form_version → responses | 1:N (by version int) | Response stores the `version` it answered, so old submissions stay interpretable after edits. |
| response → files | 1:N | Upload blocks emit file rows; body lives in S3/R2 with presigned direct upload + AV scan. |
| form → webhooks → deliveries | 1:N → 1:N | Deliveries are a retry ledger (BullMQ), decoupled from the submit transaction for durability. |
| org → subscription → plan | 1:1 → N:1 | One active Stripe subscription per org; `plans.limits` JSONB gates free/pro/business features. |
| org → api_keys | 1:N | Keys are org-scoped bearer credentials; only the SHA-256 hash is stored. |


> 💡 Opinionated defaults
>
> Denormalize `org_id` aggressively (it is the single most-filtered column). Keep OLTP JSONB, push per-question analytics to a projection table and ClickHouse. Partition responses from day one — retro-partitioning a multi-billion-row table is the migration you never want.

---

## API Architecture

*A resource-oriented REST surface under `/v1` that cleanly separates the authenticated app/partner API from an unauthenticated, spam-hardened public form runtime.*

Tally exposes no publicly documented API today (`[Assumption]` — the product is form-first and closed), so this section prescribes the API *we* should build. The design goal: one predictable HTTP surface that serves three consumers at once — the Next.js app (session-auth), third-party developers and integrations (API keys / OAuth), and the public form-fill runtime embedded on millions of external pages (no auth, high volume, hostile traffic). We standardize on **REST under `/v1`** on our NestJS backend, with a thin internal tRPC layer for editor-to-BFF chatter where end-to-end TypeScript types pay off.

- **/v1** — Single versioned prefix
- **3** — Auth modes: session, API key, OAuth
- **1** — Unauthenticated public submit path
- **HMAC** — Signed, retried webhooks

### 12.1 Layered request path

- Cloudflare (WAF, DDoS, bot score, SSL-for-SaaS custom domains, CDN cache for GET form schema)
- API Gateway / NestJS edge — auth resolution, rate limiting (Redis), idempotency, request validation (Zod/class-validator)
- Domain services — Forms, Responses, Publishing, Integrations, Billing
- Postgres (JSONB schema + payloads) &middot; Redis (cache/queues) &middot; BullMQ workers (webhooks, integrations, exports) &middot; S3/R2 (files)

Verified grounding: form schema and response payloads are stored as JSONB in Postgres; Redis backs cache/rate-limit/queues; BullMQ drives async fan-out — per the canonical stack. Layer boundaries are our design (`[Assumption]`).

### 12.2 Endpoint catalog

All paths are prefixed `/v1`. **Auth legend:** `S` = app session cookie, `K` = API key or OAuth bearer, `P` = public/unauthenticated (spam-protected), `W` = webhook signature (inbound from us). Every list endpoint is cursor-paginated.

#### Auth & session

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | /v1/auth/signup | Create account (email + OAuth SSO) | P |
| POST | /v1/auth/login | Password / magic-link / SSO login, mints session | P |
| POST | /v1/auth/logout | Revoke current session | S |
| GET | /v1/auth/session | Current user + active workspace context | S |
| POST | /v1/auth/tokens | Issue a personal/API key (scoped) | S |
| GET / DELETE | /v1/auth/tokens/:id | Inspect / revoke an API key | S |
| POST | /v1/oauth/authorize &middot; /v1/oauth/token | OAuth2 authorization-code flow for public API apps | P |


#### Workspaces & members

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET / POST | /v1/workspaces | List / create workspaces `[Pro]` for folders | S,K |
| GET / PATCH / DELETE | /v1/workspaces/:wid | Read / rename / delete workspace | S,K |
| GET | /v1/workspaces/:wid/members | List members & roles | S,K |
| POST | /v1/workspaces/:wid/members/invite | Invite by email `[Pro]` unlimited collab | S,K |
| PATCH / DELETE | /v1/workspaces/:wid/members/:uid | Change role (owner/admin/editor/viewer) / remove | S,K |
| GET / PATCH / DELETE | /v1/workspaces/:wid/folders/:fid | Manage folders `[Pro]` | S,K |


#### Forms, versions & blocks

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET / POST | /v1/forms | List / create forms (`?workspace=`, cursor) | S,K |
| GET / PATCH / DELETE | /v1/forms/:fid | Read / update meta / soft-delete a form | S,K |
| POST | /v1/forms/:fid/duplicate | Clone form + schema | S,K |
| GET / PUT | /v1/forms/:fid/schema | Read / replace the block document (JSONB draft) | S,K |
| PATCH | /v1/forms/:fid/blocks/:bid | Granular block edit (used by autosave) | S |
| GET | /v1/forms/:fid/versions | Version history `[30d]` `[90d]` | S,K |
| POST | /v1/forms/:fid/versions/:vid/restore | Roll back to a prior version | S,K |


`[Verified]` block types (short/long text, choice, checkbox, dropdown, multi-select, number, email, phone, URL, date, time, rating, linear scale, ranking, matrix, file, payment, signature, hidden, calculated) and version-history retention tiers are grounded facts; endpoint shapes are our design.

#### Publishing

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | /v1/forms/:fid/publish | Snapshot draft → immutable published version, invalidate CDN | S,K |
| POST | /v1/forms/:fid/unpublish | Take form offline | S,K |
| GET / PUT | /v1/forms/:fid/settings | Thank-you page, redirect, close-on-limit/date, password, reCAPTCHA | S,K |
| GET / PUT | /v1/forms/:fid/domain | Custom domain mapping `[Pro]` (SSL-for-SaaS) | S,K |
| GET / PUT | /v1/forms/:fid/branding | Remove-branding, OG/link preview, favicon `[Pro]` | S,K |


#### Responses & exports

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | /v1/forms/:fid/responses | List responses (filter/sort/cursor) | S,K |
| GET / DELETE | /v1/forms/:fid/responses/:rid | Read / delete a single response | S,K |
| POST | /v1/forms/:fid/responses/export | Async CSV/XLSX export job (BullMQ) | S,K |
| GET | /v1/exports/:jobId | Poll export status / signed download URL | S,K |
| PUT / DELETE | /v1/forms/:fid/retention | Auto-delete / data-retention policy `[Business]` | S,K |


#### Files & uploads

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | /v1/uploads/presign | Get presigned S3/R2 PUT URL (10MB cap free; unlimited `[Pro]`) | S,P |
| POST | /v1/uploads/:id/complete | Finalize upload, enqueue AV scan | S,P |
| GET | /v1/files/:id | Signed, short-lived download URL | S,K |


Public-form uploads use `P`: the presign call is gated by the form's live submission token + rate limit, not a user session, so respondents can attach files without an account.

#### Templates, integrations, webhooks, billing, analytics

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | /v1/templates | Public gallery (search via Typesense, cursor) | P |
| POST | /v1/templates/:tid/use | Instantiate a form from a template | S,K |
| GET / POST | /v1/forms/:fid/integrations | List / connect Sheets, Notion, Airtable, Slack, Zapier, etc. | S,K |
| DELETE | /v1/integrations/:cid | Disconnect an integration | S,K |
| GET / POST | /v1/forms/:fid/webhooks | List / register webhook endpoints (+ secret) | S,K |
| PATCH / DELETE | /v1/webhooks/:whid | Update / delete; `/replay/:deliveryId` to resend | S,K |
| GET | /v1/billing/subscription | Current plan & entitlements (Free/Pro/Business) | S,K |
| POST | /v1/billing/checkout &middot; /v1/billing/portal | Stripe Checkout / customer portal session | S |
| POST | /v1/billing/stripe/webhook | Inbound Stripe events (invoice, sub updated) | W |
| GET | /v1/forms/:fid/analytics | Visits, drop-off, completion funnel `[Pro]` | S,K |


`[Verified]` integration set (Google Sheets, Notion, Airtable, Slack, Discord, Zapier, Make, n8n, Integrately), webhooks, Stripe payments, and visit/drop-off analytics as Pro features; the routing above is our design (`[Assumption]`).

#### Public form runtime `[Core surface]`

This is the hottest, most exposed path — served from the CDN edge, unauthenticated, and independently scalable from the app API.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | /v1/live/:slug | Fetch published, immutable form schema (edge-cached, ETag) | P |
| POST | /v1/live/:slug/session | Mint a short-lived submission token (bot score, honeypot seed) | P |
| PATCH | /v1/live/:slug/partial | Save partial/in-progress answers `[Pro]` | P |
| POST | /v1/live/:slug/submit | **Submit response — unauthenticated, spam-protected, idempotent** | P |


> ℹ️ Why the public submit endpoint is hardened by construction
>
> It is the one route an attacker can hit at will. Four layers protect it: (1) a per-form **submission token** from `/session` binds the submit to a real page load; (2) **reCAPTCHA + honeypot + Cloudflare bot score** gate obvious bots (reCAPTCHA is `[Verified]` available); (3) an **idempotency key** (client-generated UUID) makes double-taps and retries safe — the second POST returns the first result, never a duplicate row (aligns with the `[Verified]` "prevent duplicate submissions" feature); (4) **per-IP + per-form rate limits** in Redis. Validation is re-run server-side against the published schema with Zod — the client bundle is never trusted.

### 12.3 Example: create a form

```
POST /v1/forms  HTTP/1.1
Authorization: Bearer tally_sk_live_9f2c...        # API key
Idempotency-Key: 6f1e2b0a-7c4d-4a1e-9b0f-11c2d3e4f5a6
Content-Type: application/json

{
  "workspaceId": "ws_3kQ9",
  "title": "Beta waitlist",
  "schema": {
    "blocks": [
      { "id": "b_h1",   "type": "heading",  "props": { "text": "Join the beta" } },
      { "id": "b_name", "type": "short_text", "props": { "label": "Your name", "required": true } },
      { "id": "b_mail", "type": "email",      "props": { "label": "Work email", "required": true } },
      { "id": "b_use",  "type": "dropdown",   "props": { "label": "Team size",
          "options": ["1", "2-10", "11-50", "50+"] } }
    ]
  }
}

HTTP/1.1 201 Created
Location: /v1/forms/frm_8Ab2
{
  "id": "frm_8Ab2",
  "workspaceId": "ws_3kQ9",
  "title": "Beta waitlist",
  "status": "draft",
  "version": 1,
  "publishedSlug": null,
  "createdAt": "2026-07-08T10:14:22Z",
  "updatedAt": "2026-07-08T10:14:22Z"
}
```

### 12.4 Example: submit a response (public)

```
POST /v1/live/beta-waitlist/submit  HTTP/1.1
Content-Type: application/json
X-Tally-Submission-Token: subm_eph_2p9x...          # from POST /session
Idempotency-Key: c3a1f7e0-55d2-4b8e-8f21-9a0b1c2d3e4f

{
  "answers": {
    "b_name": "Ada Lovelace",
    "b_mail": "ada@analytical.dev",
    "b_use":  "2-10"
  },
  "meta": { "recaptchaToken": "03AGdBq26...", "hp": "", "startedAt": "2026-07-08T10:20:01Z" }
}

HTTP/1.1 201 Created
{
  "responseId": "res_QeR7",
  "formId": "frm_8Ab2",
  "receivedAt": "2026-07-08T10:20:44Z",
  "redirectUrl": "https://acme.com/thanks",
  "duplicate": false
}
```

A retried POST with the same `Idempotency-Key` returns the identical body with `"duplicate": true` and no new row — safe under flaky mobile networks.

### 12.5 API conventions

- **Authentication** — **App:** HttpOnly session cookie (SameSite=Lax) + CSRF token. **Public API:** `Authorization: Bearer tally_sk_live_...` API keys (scoped, revocable) or OAuth2 authorization-code bearer tokens for third-party apps. **Runtime:** ephemeral submission token, never a user credential.
- **Versioning** — URL-prefix `/v1`. Breaking changes ship as `/v2`; additive fields never break. Deprecations announced via `Sunset` header + changelog.
- **Pagination** — Cursor-based only: `?limit=50&cursor=eyJpZCI6...`. Response carries `{ "data": [...], "nextCursor": "..." }`. Opaque, stable under inserts — no offset drift on high-write response tables.
- **Filtering / sorting** — `?filter[status]=completed&filter[createdAt][gte]=2026-01-01&sort=-createdAt`. Whitelisted fields per resource; server rejects unknown keys with 422.
- **Idempotency** — All non-GET mutating routes accept `Idempotency-Key`. Key + response cached in Redis 24h; replays return the original result. Required on public submit.
- **Rate limiting** — Redis token-bucket. Headers on every response: `X-RateLimit-Limit`, `-Remaining`, `-Reset`. Over limit → `429` + `Retry-After`. Tighter, per-IP+per-form buckets on `/live/*`.
- **Errors** — Single envelope (below), always with a machine `code` and stable `type`.

```
// Standard error envelope (all 4xx/5xx)
{
  "error": {
    "type": "validation_error",          // stable category
    "code": "field_required",            // machine-readable
    "message": "Work email is required.",// human-readable
    "requestId": "req_7Hx2Kp",           // echoes X-Request-Id for support
    "fields": { "b_mail": "required" }   // present for 422s
  }
}
```

`400 bad_request` `401 unauthenticated` `403 forbidden` `404 not_found` `409 conflict / idempotency_replay` `422 validation_error` `429 rate_limited` `5xx server_error`

### 12.6 Webhooks

Delivery is queued through BullMQ workers — decoupled from the request that triggered it, so a slow customer endpoint never blocks a form submission.

| Event | Fires when | Key payload |
| --- | --- | --- |
| `form.response.created` | A submission is accepted | formId, responseId, answers, meta |
| `form.response.partial` | Partial capture saved `[Pro]` | formId, sessionId, partial answers |
| `form.response.deleted` | Response removed / auto-deleted | formId, responseId, reason |
| `form.published` / `form.unpublished` | Publish state changes | formId, version, slug |
| `payment.succeeded` / `payment.failed` | In-form Stripe payment resolves | responseId, amount, currency, stripeId |
| `file.uploaded` | Upload finalized + AV-clean | responseId, fileId, size, mime |
| `member.invited` / `member.removed` | Workspace membership changes | workspaceId, userId, role |


- **Delivery guarantee** — At-least-once. Consumers must dedupe on `X-Tally-Delivery-Id`. Ordering is best-effort per form, not strict.
- **Retries** — Exponential backoff (e.g. 1m, 5m, 30m, 2h, 6h) up to ~24h on non-2xx or timeout. Then dead-lettered; manual `replay` available.
- **Signing** — HMAC-SHA256 of the raw body with the endpoint secret, sent as `X-Tally-Signature: t=<ts>,v1=<hex>`. Verify + reject if timestamp skew > 5min (replay defense).

```
POST https://acme.com/hooks/tally  HTTP/1.1
X-Tally-Event: form.response.created
X-Tally-Delivery-Id: dl_92kQx
X-Tally-Signature: t=1751969244,v1=9d4b7c...e10

{ "event": "form.response.created", "createdAt": "2026-07-08T10:20:44Z",
  "data": { "formId": "frm_8Ab2", "responseId": "res_QeR7",
            "answers": { "b_name": "Ada Lovelace", "b_mail": "ada@analytical.dev" } } }
```

### 12.7 REST vs GraphQL vs tRPC — where each fits

- **REST /v1 (public + app)** — Chosen. Cacheable at the CDN edge (critical for `GET /live`), trivially consumable by Zapier/Make/no-code, easy webhooks and API keys, and battle-tested rate-limiting/idempotency semantics. Resources map 1:1 to our domain.
- **tRPC (internal)** — For Next.js editor &harr; BFF calls where both ends are our TypeScript. End-to-end types kill a whole class of bugs during fast editor iteration. Not exposed publicly — no stable contract obligations.
- **GraphQL (declined)** — Attractive for the analytics/reporting dashboard's flexible reads, but the cost — query-complexity limits, caching loss at the edge, harder rate-limiting, steeper partner onboarding — outweighs it. Revisit only if a data-heavy public reporting API emerges.

> ⚠️ Evidence note
>
> Tally's real API surface, auth model, and webhook signing are not publicly documented; the specific paths, headers, envelopes, and event names above are our opinionated design (`[Assumption]`), anchored to the `[Verified]` feature set (payments, file upload, partial submissions, analytics, duplicate-prevention, integrations, reCAPTCHA) and the canonical NestJS/Postgres/Redis/BullMQ/Stripe/Cloudflare stack.

---

## DevOps & Infrastructure

*The delivery machine: a one-command local stack, a gated CI/CD pipeline, safe database evolution, and an observability-plus-DR posture that keeps a form runtime up when other people's businesses depend on it.*

> ⚠️ Evidence posture
>
> Tally's actual infrastructure is not publicly documented. Everything below describes the recommended build for *our* competitor on the canonical stack (NestJS + Postgres + Redis + BullMQ + S3, deployed on Fly.io/Render early, Kubernetes at scale). Tally-specific infra references are labelled `[Assumption]`. Stack choices we control are `[Verified]` as our own decisions.

### 13.1 Local development — one command to a working stack

A new engineer clones the monorepo and runs `make bootstrap` (wrapping `docker compose up` + Prisma migrate + seed). No cloud dependency, no shared dev database. Every backing service Tally-in-production would call has a local stand-in: **Postgres** (primary store), **Redis** (cache/queues), **MinIO** (S3-compatible object storage for file uploads), **Mailhog** (SMTP sink so transactional email is inspectable in a browser at :8025).

```
# docker-compose.dev.yml (trimmed)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: tally
      POSTGRES_PASSWORD: tally
      POSTGRES_DB: tally_dev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tally"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
    ports: ["9000:9000", "9001:9001"]   # S3 API + web console
    volumes: ["miniodata:/data"]

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]   # SMTP + web UI

volumes: { pgdata: {}, miniodata: {} }
```

> 💡 Bootstrap contract
>
> `make bootstrap` = `docker compose up -d` → wait for healthchecks → `prisma migrate deploy` → `pnpm db:seed`. Seed data provisions one workspace, two users (owner + member), three sample forms (payment, multi-page, file-upload), and ~50 fake responses so analytics and exports have something to render on first boot. Target: green app in < 3 minutes on a cold machine.

### 13.2 Environments, config & secrets

| Env | Purpose | Data | Who deploys |
| --- | --- | --- | --- |
| **local** | Feature dev, fast inner loop | Docker volumes; synthetic seed only | Each engineer (no deploy) |
| **preview** | Ephemeral per-PR environment for review & e2e | Fresh migrated DB + seed, torn down on merge | CI (auto, on PR open/update) |
| **staging** | Pre-prod integration, migration dry-run, load tests | Anonymised/subset restore of prod schema; real integrations in sandbox mode | CI (auto on merge to `main`) |
| **production** | Live customer traffic (EU-hosted) | Real customer data, GDPR scope | CI on promote — manual approval gate (release engineer / on-call) |


- **Config source of truth** — Typed, Zod-validated env schema (`@app/config`). App refuses to boot on missing/invalid vars — fail fast, never silently default a secret.
- **Non-secret config** — `.env.example` committed; per-env values in Fly/Render/K8s config maps. Feature flags via PostHog / DB flags, not redeploys.
- **Secrets** — Never in git. Doppler or 1Password Secrets Automation in dev; cloud secret manager (Fly secrets / K8s Sealed Secrets / AWS Secrets Manager) in prod. Rotation runbook for DB, Stripe, Resend, OAuth keys.
- **Isolation** — Separate Stripe accounts (test vs live), separate S3 buckets, separate Postgres clusters per env. No cross-env credential reuse.

### 13.3 CI/CD pipeline

GitHub Actions, Turborepo remote cache keyed on affected packages so unchanged code never re-runs. The critical property: **nothing reaches production without passing every gate on a green preview deploy first.**

`lint` → `typecheck` → `unit` → `build` → `e2e` → `preview deploy` → `promote`

```
# .github/workflows/ci.yml (trimmed)
name: ci
on: { pull_request: {}, push: { branches: [main] } }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: pg }, ports: ["5432:5432"] }
      redis:    { image: redis:7,     ports: ["6379:6379"] }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build   # gates 1-4, parallel + cached
      - run: pnpm prisma migrate deploy && pnpm test:integration
      - run: pnpm exec playwright install --with-deps && pnpm test:e2e   # gate 5
      - run: pnpm danger ci                               # PR hygiene + coverage delta

  preview:
    needs: verify
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - run: flyctl deploy --app tally-pr-${{ github.event.number }} --strategy immediate
      # posts preview URL back to the PR; DB is a fresh migrated+seeded branch

  promote:
    needs: verify
    if: github.ref == 'refs/heads/main'
    environment: production        # requires manual approval in GitHub UI
    runs-on: ubuntu-latest
    steps:
      - run: flyctl deploy --app tally-prod --strategy bluegreen
```

### 13.4 Testing layers & quality gates

- **Unit — Vitest** — Pure logic: schema validation, calculated-field engine, conditional-logic evaluator, pricing math. Fast, no I/O, run on every save. Target > 80% on core domain.
- **Integration** — NestJS handlers against a real Postgres + Redis (Testcontainers/CI services). Verifies migrations, Prisma queries, webhook dispatch, BullMQ job flow.
- **E2E — Playwright** — Golden paths in a browser: build a form in the editor, publish, submit a response as a respondent, receive email in Mailhog, see it in analytics.
- **Quality gates** — ESLint + Prettier (fmt-check), `tsc --noEmit`, Danger (PR size, changelog, missing tests), coverage delta must not regress. All blocking.

Playwright also drives the public form runtime bundle in isolation to guard embed size and cross-browser behaviour — the runtime ships as a tiny standalone bundle, so a size-budget assertion (e.g. < 40 KB gzip) is a hard CI gate.

### 13.5 Deployment, migrations & rollback

- **Release strategy** — Containerised (Docker). **Fly.io/Render** early stage using built-in *blue-green*; migrate to **Kubernetes** at scale with Argo Rollouts for *canary* (5% → 25% → 100%, gated on error-rate + latency SLO). Workers deploy as a separate deployment from the API.
- **Migrations: expand/contract** — Schema changes ship *backward-compatible first*. **Expand:** add nullable column / new table, deploy code that writes both. **Migrate:** backfill via job. **Contract:** a later release drops the old column once no code reads it. Never a breaking DDL in the same deploy as the code that needs it.
- **Rollback** — App rollback = repoint blue-green / re-promote previous image (seconds), safe *because* expand/contract kept the old schema readable. Data rollback avoided by design; forward-fix migrations preferred over `down` migrations in prod.

> ⚠️ The rule that prevents 2am incidents
>
> A deploy and the migration it depends on are decoupled. Because every migration is additive until the contract phase, the previous app image always runs against the new schema. That is what makes instant blue-green rollback *actually* safe — the usual killer is "rolled back the code but the DB already changed."

### 13.6 Monitoring, logging, alerting & SLOs

- Errors & traces — Sentry (frontend + backend), OpenTelemetry spans across API → DB → queue
- Metrics & dashboards — Prometheus + Grafana (RED metrics, queue depth, DB connections, Stripe/webhook success)
- Logs — structured JSON → Loki, correlated by trace/request id; PII-scrubbed before ship
- Product analytics — PostHog (funnels, feature-flag exposure); ClickHouse later for high-volume submission events

| SLO | Target | Alert trigger (paging) |
| --- | --- | --- |
| Public form-runtime availability | 99.95% monthly | Fast burn: > 2% error budget in 1h |
| Form submission success (POST /submit) | 99.9% | 5xx rate > 1% over 5 min |
| Editor / dashboard API p95 latency | < 400 ms | p95 > 800 ms for 10 min |
| Async job (webhook/integration) lag | < 60 s p95 | BullMQ backlog > 5k or oldest job > 5 min |


Alerting via Grafana/Sentry → PagerDuty (or Opsgenie) with a single on-call rotation early, split app/infra rotations later. **Runtime and submission-path pages are P1** (respondents losing data is worse than the owner's dashboard being slow); editor/analytics degradation is P2. Every alert links to a runbook; symptom-based alerts only (page on user-visible SLO breach, not on CPU).

### 13.7 Backup & disaster recovery

- **Postgres** — Continuous WAL archiving for **point-in-time recovery** (Neon/RDS-managed or WAL-G to R2). Daily automated logical + physical snapshots, 30-day retention. Restore drills run quarterly against staging — an untested backup is not a backup.
- **Object storage & config** — S3/R2 **bucket versioning** + cross-region replication for uploaded files & signatures; lifecycle rules honour Business-tier data-retention/auto-delete. IaC (Terraform) and secrets are themselves backed up so the whole env is reproducible.

- **RPO (data loss tolerance)** — &le; 5 minutes — bounded by WAL archive interval; near-zero for committed submissions once queued.
- **RTO (time to restore service)** — &le; 1 hour for full-region failure (restore PITR + repoint app); &le; 15 min for a bad deploy (blue-green rollback).
- **DR runbook owner** — On-call release engineer; documented failover to secondary EU region; annual game-day exercise simulating primary-DB loss.
- **Residency constraint** — `[Verified]` requirement (GDPR / EU-hosted): all backups and replicas stay within EU regions.

> ℹ️ Where to invest first
>
> Order of build for a bootstrapped team: (1) one-command local + preview envs (velocity multiplier), (2) expand/contract migration discipline (prevents the worst outages cheaply), (3) SLO-based paging on the submission path, (4) tested PITR restores. Kubernetes, ClickHouse, and multi-region DR are deliberately deferred — start on Fly.io/Render and earn the complexity.

---

## Security & Compliance

*A form builder is a hostile-input machine: it accepts untrusted rich content from creators and untrusted submissions from the anonymous public, then fans that data out to webhooks and integrations — so security is a product feature, not a checkbox.*

> ℹ️ Threat model in one paragraph
>
> Two adversarial surfaces dominate. (1) The **form editor** lets tenants inject rich HTML/embeds that later render in a victim's browser — a stored-XSS vector against form respondents and against other workspace members. (2) The **public submit endpoint** is unauthenticated, high-volume, and a magnet for spam bots, credential-stuffing of email fields, and resource-exhaustion abuse. Everything below is engineered around isolating these two surfaces while keeping a legitimate anonymous respondent's path frictionless.

### 1. Authentication

Tally's own auth is `[Assumption]` (undocumented). We prescribe a **session + JWT hybrid** on the canonical stack: a long-lived, HttpOnly, Secure, SameSite=Lax session cookie for first-party web app calls, and short-lived (10–15 min) access JWTs minted from that session for the NestJS API and embed runtime, with rotating refresh tokens stored server-side in Redis so sessions are revocable.

- **Passwords & passwordless** — Argon2id hashing (memory-hard), per-user salt, breach-check against HaveIBeenPwned k-anonymity API on set. Offer magic-link + OAuth (Google, Microsoft, Apple) to reduce password surface entirely for the mass market.
- **MFA / TOTP** — RFC 6238 TOTP (authenticator apps) + WebAuthn/passkeys as the strong second factor. Recovery codes issued once, hashed at rest. MFA enforceable per-workspace by admins (a Business/Enterprise policy toggle).
- **Enterprise SSO** — SAML 2.0 + OIDC via WorkOS, plus **SCIM 2.0** for automated user provisioning/de-provisioning. De-provisioning on SCIM `active:false` immediately revokes sessions — a hard requirement for enterprise deals and a gap Tally has no public answer for.

SSO + SCIM is the clearest wedge for an upmarket Enterprise tier: Tally lists no Enterprise plan, so no advertised SAML/SCIM. `[Assumption]`

### 2. Authorization — RBAC, org scoping, per-form ACL

Authorization is enforced **server-side on every row**. We never trust a client-supplied `workspaceId`; the tenant scope is derived from the authenticated principal and injected into every Prisma query. Roles are checked at the NestJS guard layer; object-level ACLs are checked in the service layer against the resolved resource.

| Layer | Enforcement | Mechanism |
| --- | --- | --- |
| Org / workspace scoping | Every query filtered by `workspaceId` from JWT claims, never request body | Prisma middleware injects tenant predicate; a global `@TenantScoped()` decorator makes the unscoped query the exception that must be justified |
| Role (RBAC) | `Owner` > `Admin` > `Editor` > `Viewer` | NestJS `RolesGuard` + CASL ability definitions |
| Per-form ACL | Form-level and folder-level grants override workspace defaults | Resolved resource ACL check in service; deny-by-default |
| Response data | Row-level: a Viewer of Form A cannot read Form B responses | Foreign-key join back to an authorized form before serialization |


> ⚠️ The classic form-builder IDOR
>
> The most common critical bug in this category is an unscoped `GET /responses/:id` or predictable numeric submission IDs. Mitigation: opaque, unguessable IDs (UUIDv7/nanoid) for all externally-referenced objects *and* a mandatory ownership check — never one or the other alone.

### 3. Rate limiting & abuse prevention on the public submit endpoint

The submit endpoint is unauthenticated by design (no signup to respond — a core Tally value). Defense is layered so a legitimate respondent sees zero friction while bots are throttled and challenged progressively.

`Cloudflare WAF + DDoS` → `IP + form rate limit (Redis)` → `Honeypot + timing check` → `Turnstile challenge` → `Email verification` → `Dup-prevention`

- [x] **Edge:** Cloudflare WAF, managed rulesets, and L3/L4 DDoS absorption before traffic reaches origin.
- [x] **Sliding-window rate limits** in Redis, keyed by IP, by form ID, and by IP×form. Separate, tighter budgets for the submit path vs. read paths.
- [x] **Honeypot field** (hidden input real users never fill) + **submission-timing heuristic** (sub-second fills are bots) — invisible, zero-friction filters that catch the cheapest bots.
- [x] **Cloudflare Turnstile** as the default CAPTCHA (privacy-preserving, no Google dependency), with reCAPTCHA available for parity. Trigger adaptively only on risk signals, not every submit. `[reCAPTCHA available in Tally]`
- [x] **Email verification** (send a confirm link before accepting the response) — kills the bulk of spam. `[Business]` `[Biz]`
- [x] **Duplicate prevention** (block repeat submissions per respondent). `[Free]` `[Free]`

### 4. Encryption & secrets management

- **In transit** — TLS 1.2+ everywhere (prefer 1.3), HSTS with preload, TLS terminated at Cloudflare and re-encrypted to origin (full-strict). SSL-for-SaaS issues per-tenant certs for custom domains. `[Encrypted (marketing claim)]`
- **At rest** — AES-256 on Postgres volumes, object storage, and backups via managed-provider disk encryption. Backups encrypted and access-controlled; PITR retained per policy.
- **Field-level PII encryption** — Application-layer envelope encryption for high-sensitivity fields (payment metadata, signatures, fields flagged sensitive). Per-tenant data keys wrapped by a KMS master key — enables crypto-shredding on erasure requests.

**Secrets:** no secrets in env files in production — use a KMS/Vault (AWS KMS + Secrets Manager, or HashiCorp Vault) with short-lived, rotated credentials. Integration OAuth tokens and webhook signing secrets are encrypted at the application layer before storage, never logged, and redacted in Sentry via scrubbing rules.

### 5. OWASP Top 10 mapping

| OWASP (2021) | Risk in a form builder | How we mitigate |
| --- | --- | --- |
| A01 Broken Access Control | IDOR on responses/forms across tenants | Server-side row checks, tenant predicate injected via Prisma, opaque IDs, deny-by-default ACLs (see &sect;2) |
| A02 Cryptographic Failures | PII exposure at rest/in transit | TLS 1.2+/HSTS, AES-256 at rest, field-level envelope encryption, KMS-managed keys |
| A03 Injection (SQLi) | Malicious input in submissions/filters | Prisma parameterized queries only; **no raw string SQL**; input validated with Zod at the boundary |
| A03 Injection (XSS) — *top risk* | Stored XSS via rich-content editor & answer piping rendered to respondents/admins | Server-side HTML sanitization (DOMPurify/sanitize-html allowlist) on save *and* render; React auto-escaping; strict CSP; embeds rendered in sandboxed iframes; piped answers HTML-escaped, never `dangerouslySetInnerHTML` on user data |
| A04 Insecure Design | Anonymous submit abused for spam/exfil | Layered abuse controls (&sect;3), rate limits as a design invariant, least-privilege by default |
| A05 Security Misconfiguration | Permissive CORS, verbose errors, open buckets | Locked-down CORS allowlist, generic error responses, IaC-audited buckets (no public ACLs), security headers via middleware |
| A06 Vulnerable Components | Supply-chain in a large JS dep tree | Dependabot/Renovate, `npm audit` + Snyk in CI, SBOM, pinned lockfiles |
| A07 Auth Failures | Credential stuffing, weak MFA | Argon2id, breach checks, TOTP/passkeys, login rate-limits, revocable server-side sessions |
| A08 Integrity Failures | Tampered webhooks/CI artifacts | Signed webhook payloads (HMAC), signed commits, protected pipelines, dependency pinning |
| A09 Logging & Monitoring | Undetected breach/abuse | Structured audit logs, Sentry, OTel traces, alerting on anomalous submit/login rates |
| A10 SSRF — *top risk* | Webhooks & integrations fetch attacker-controlled URLs, hitting cloud metadata (169.254.169.254) or internal services | Egress allowlist, DNS-rebinding-safe resolver, block private/link-local/loopback CIDRs, no redirects to internal hosts, outbound calls via an isolated egress proxy with no cloud-role credentials |


> 💡 CSRF
>
> State-changing first-party routes use SameSite=Lax cookies plus a double-submit CSRF token (or Origin/Referer validation) for cookie-authenticated requests. Bearer-JWT API calls from the SPA are not cookie-authenticated and are inherently CSRF-resistant. The public submit endpoint accepts only its own signed form context and is rate-limited, so it needs no per-user CSRF token.

### 6. File-upload security

File upload is a Free-tier feature (10 MB cap; unlimited on Pro) — a direct RCE/malware surface if mishandled. `[Free]` `[Free]` `[Pro removes cap]`

- **Direct upload** — Presigned PUT straight to R2/S3 — bytes never transit the API. Presigned URLs are short-lived and single-object scoped.
- **Validation** — Enforce size + type server-side by *magic-byte sniffing*, not the client-supplied Content-Type or extension. Per-form allowlist of MIME types.
- **AV scan** — Async ClamAV/vendor scan (BullMQ job) before a file is marked available; quarantine on hit, notify tenant.
- **Isolation** — Dedicated bucket on a cookieless domain, private by default. No execution — static object host only, no server-side rendering of uploads.
- **Serving** — Downloads via short-lived signed URLs + `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to prevent HTML/SVG being rendered inline as XSS.

### 7. API security, audit logging & tenant isolation

- **API security** — Scoped API keys (hashed at rest, prefix-identifiable, rotatable) and OAuth for integrations. Per-key rate limits, request-size caps, strict schema validation (Zod) rejecting unknown fields, and no PII in URLs/logs.
- **Audit logging** — Append-only audit trail of security-relevant events (logins, role changes, exports, deletions, integration connects, data-retention edits) with actor, IP, timestamp, before/after. Exportable — an Enterprise/SOC 2 requirement.
- **Tenant isolation** — Shared-DB, row-level isolation with mandatory `workspaceId` scoping and Postgres RLS as a defense-in-depth backstop. Optional dedicated-schema/DB for large Enterprise tenants.
- **Isolation testing** — Automated cross-tenant test suite in CI: authenticate as Tenant A, attempt to read/write every Tenant B object type, assert 403/404. A failing test blocks release.

### 8. Compliance

Tally publicly claims GDPR compliance, EU data hosting, and encryption. `[Verified]` Everything below beyond those three is our recommended posture. `[Assumption]`

| Framework | Status / target | Key controls |
| --- | --- | --- |
| **GDPR** | Verified for Tally; day-one for us | EU data residency, DPA + SCCs, published sub-processor list, right-to-erasure (crypto-shred via per-tenant keys), configurable retention/auto-delete, consent + data-minimization by design |
| **SOC 2 Type II** | Assumption — pursue in year 1 | Documented controls, continuous evidence (Vanta/Drata), independent audit over a 6–12 mo window; the table-stakes trust artifact for B2B |
| **ISO 27001** | Assumption — year 2, EU-buyer driver | ISMS, risk register, Statement of Applicability; strong signal for European enterprise procurement |
| **PCI-DSS** | Offloaded to Stripe (SAQ-A) | Card data never touches our servers — Stripe Elements/Checkout + Stripe Connect for in-form payments. We stay in the lowest-scope tier |
| **HIPAA** | Assumption — opt-in Enterprise add-on | BAA, PHI field-level encryption, stricter audit logging + retention, no PHI in logs/analytics; gated to a plan tier, not enabled globally |


#### Security-controls checklist

- [x] TLS 1.2+ everywhere, HSTS preload, AES-256 at rest, field-level PII encryption
- [x] MFA (TOTP + passkeys), SSO (SAML/OIDC), SCIM provisioning/de-provisioning
- [x] RBAC + per-form ACL + server-side row checks + Postgres RLS backstop
- [x] Layered abuse defense on public submit (WAF, rate limits, honeypot, Turnstile, email verification)
- [x] Server-side HTML sanitization + strict CSP + sandboxed embeds (stored-XSS defense)
- [x] SSRF egress allowlist + private-CIDR blocking on webhooks/integrations
- [x] File uploads: magic-byte validation, AV scan, isolated cookieless bucket, signed URLs, no execution
- [x] KMS/Vault secrets, encrypted integration tokens, HMAC-signed webhooks
- [x] Append-only audit logs, Sentry + OTel monitoring, anomaly alerting
- [x] Automated cross-tenant isolation tests gating every release
- [x] Dependency scanning (Snyk/Dependabot), SBOM, coordinated disclosure + bug-bounty program
- [x] GDPR DPA, sub-processor registry, right-to-erasure, configurable retention; SOC 2 Type II roadmap

Opinionated bottom line: Tally's public security story is thin (GDPR + EU hosting + “encrypted”). SOC 2 Type II, SSO/SCIM, audit logs, and a published sub-processor list are the concrete, sellable controls that unlock the mid-market and enterprise revenue Tally's freemium motion leaves on the table.

---

## Scalability — 100 to 1M Users

*A staged evolution of the recommended stack, tuned to the real bottlenecks of a form product and disciplined about deferring cost until traffic demands it.*

A form product has a lopsided traffic shape: a small number of authenticated *builders* editing forms, and a very large, spiky, unauthenticated *respondent* population hitting published forms and writing submissions. The scaling story is therefore mostly about the **public read path** (form render) and the **write path** (response ingest + fan-out), not about the editor. Tally serves `[Verified]` 500,000+ teams with unlimited submissions on the free plan — the architecture below is our `[Assumption]` of what it takes to sustain that fair-use promise profitably.

- **4** — Scale stages
- **~10k×** — Read : write ratio (assumed)
- **1** — Postgres primary until ~100k
- **Edge** — Where form schema is served

### Stage table — provisioning per tier

| Dimension | Stage 1 — 100 users | Stage 2 — 10k users | Stage 3 — 100k users | Stage 4 — 1M users |
| --- | --- | --- | --- | --- |
| **App tier** | 1–2 containers on Fly.io/Render, monolith NestJS + Next.js | 3–5 stateless API replicas behind LB; Next.js on edge/CDN; workers split out | Autoscaling K8s pool (10–30 pods); form-runtime API isolated from editor API | Multi-region K8s (EU primary + US/APAC read edges); cellular deploys per region |
| **Database** | Single managed Postgres (Neon/RDS), 2 vCPU | Primary + 1 read replica; PgBouncer transaction pooling | Primary + 2–3 replicas; `responses` partitioned by form/month; tuned autovacuum | Sharded by workspace (Citus or app-level routing); regional primaries; replicas per read region |
| **Cache** | Single Redis (cache + sessions + rate limit) | Redis + published-schema cache; CDN edge cache for form JSON | Redis cluster; separate instances for queues vs cache; CDN as primary schema source | Regional Redis clusters; multi-tier cache (edge KV → regional Redis → Postgres) |
| **Queue / async** | BullMQ on shared Redis, in-process worker | Dedicated worker processes; separate queues for webhooks/email/exports | Worker autoscaling by queue depth; DLQ + retry policy per job type | Per-region workers; Kafka/Redpanda considered for webhook + analytics firehose |
| **Search** | Postgres `ILIKE` / trigram — no search engine | Meilisearch/Typesense single node for template + response search | Typesense cluster (3 nodes), async indexing via queue | Sharded Typesense per region; template search served from edge |
| **Storage / CDN** | S3/R2 bucket, presigned direct uploads; Cloudflare CDN | R2 + Cloudflare cache; AV scan on upload queue | R2 with lifecycle rules; signed URLs; per-workspace usage metering | Multi-region R2/S3 replication; tiered storage (hot/cold) + auto-delete retention jobs |
| **Observability** | Sentry + platform logs | Sentry + OpenTelemetry traces + Grafana/Loki | Full OTel + Prometheus/Grafana; PostHog product analytics; SLO dashboards | Per-region telemetry, distributed tracing sampled, on-call + error budgets |
| **Monthly cost driver** | ~$50–150 (mostly one DB + one container) | ~$0.5–2k (replica, workers, CDN egress) | ~$8–25k (K8s, DB fleet, ClickHouse, egress) | ~$80k–250k+ (multi-region compute, storage, egress dominates) |
| **Dominant bottleneck** | Nothing — developer velocity | DB connections + N+1 on dashboards | Response write throughput + analytics volume | Cross-region latency, storage egress, hot-workspace shards |
| **Key change introduced** | Ship the monolith | Read replica + PgBouncer + edge-cache the form schema | Partition responses; move analytics to ClickHouse; split runtime from editor | Shard + go multi-region; firehose analytics; tiered storage |


Cost bands are order-of-magnitude `[Assumption]` figures for planning, not quotes. Egress and object storage — not compute — become the top line item past Stage 3 for a file-upload-heavy product.

### The five bottlenecks specific to a form product

- **1. Response write throughput** — Submissions are the critical write. Keep the synchronous path tiny: validate (Zod), `INSERT` the response as JSONB, enqueue everything else, return 200. Partition `responses` by month (and/or by form) so writes hit small, hot partitions and vacuum stays cheap. Use PgBouncer transaction pooling so thousands of ephemeral respondent connections don't exhaust Postgres. Never run integrations inline.
- **2. Analytics event volume** — Form-visit, view, field-focus, and drop-off events outnumber submissions 50–100×. Writing them to Postgres poisons the primary. Batch them client-side, ship to an ingest endpoint, buffer in Redis/Kafka, and land them in **ClickHouse** (Stage 3+). Funnel/drop-off queries then run on a columnar store built for it, not on your OLTP DB.
- **3. Webhook & integration fan-out** — One submission may trigger Google Sheets, Slack, a webhook, and an email — each slow, each able to fail. All go through **BullMQ** with per-endpoint concurrency caps, exponential-backoff retries, and a dead-letter queue. Fan-out is decoupled from ingest so a slow customer endpoint never delays the respondent's confirmation.
- **4. File storage growth** — Uploads grow monotonically and unboundedly. Presigned **direct-to-R2/S3** uploads keep bytes off the app tier entirely. Enforce per-plan caps (10MB free, unlimited Pro `[Pro]`), lifecycle rules for cold data, and honor Business data-retention auto-delete `[Business]`. Egress is metered and cached at the CDN.
- **5. Public-form render latency** — A published form is effectively static until edited. Serve its schema JSON from the **CDN edge** (Cloudflare KV / cache), keyed by form id + version; publishing purges that key. The runtime is a tiny standalone bundle (React Hook Form + Zod). The respondent never touches Postgres to *view* a form — only to *submit*.
- **Cross-cutting: horizontal API scale** — Keep the API fully **stateless** (sessions in Redis, nothing on local disk) so replicas scale linearly behind the load balancer. Split the *form-runtime* service (public, spiky, cache-heavy) from the *editor/dashboard* service (authenticated, write-heavy) so a viral form can't starve builders.

### Architecture evolution

**Stage 1 → 2:** the single decisive move — put the published form schema on the edge and add a read replica, so reads scale independently of the write primary.

`Respondent` → `CDN edge (schema cache)` → `API (submit only)` → `Postgres primary` → `Read replica (dashboards)`

**Stage 2 → 3:** the write and analytics paths diverge. Ingest stays lean; analytics and fan-out become their own pipelines.

`Submit API` → `Postgres (partitioned responses)` → `BullMQ` → `Webhooks / email / integrations`

`Analytics events` → `Redis / Kafka buffer` → `ClickHouse` → `Funnel & drop-off queries`

**Stage 3 → 4:** the whole system goes regional and sharded. EU stays the primary write region (aligns with Tally's `[Verified]` EU-hosted, GDPR posture); other regions serve cached reads and buffer writes.

- Edge (Cloudflare) — schema cache, WAF, SSL-for-SaaS custom domains, DDoS
- Regional runtime API pods (EU / US / APAC) — stateless, autoscaled
- Async tier — per-region BullMQ/Kafka workers, DLQ, retry
- Data — sharded Postgres (by workspace) + regional replicas; ClickHouse; Typesense
- Storage — multi-region R2/S3 with tiered hot/cold + retention jobs

### Scaling levers, in priority order

- **Edge-cache schema** — Cheapest, biggest win. Removes ~99% of read load from origin before you ever touch the DB.
- **PgBouncer pooling** — Survive connection storms from spiky respondent traffic without over-provisioning Postgres.
- **Read replicas** — Route dashboards, exports, and analytics reads off the write primary.
- **Queue everything non-critical** — Webhooks, emails, integrations, exports, AI jobs — none block the submit response.
- **Partition responses** — Keeps hot partitions small; makes retention/auto-delete a partition drop, not a mass DELETE.
- **Analytics to ClickHouse** — Move the highest-volume, lowest-value-per-row writes off OLTP entirely.
- **Shard + multi-region** — Last resort. Highest operational cost; only when a single primary genuinely can't keep up.

> ⚠️ Premature optimization — what NOT to build until you need it
>
> Every item below is a real cost that buys nothing at Stage 1–2 and slows you down. Defer ruthlessly:
>
> - [x] **Kubernetes** before ~10k users — Fly.io/Render autoscaling is plenty; K8s is a full-time job you don't have.
> - [x] **Microservices** from day one — ship the modular monolith; split only the form-runtime service when its traffic shape actually diverges.
> - [x] **Database sharding** before a single primary + replicas is measurably saturated — sharding is a one-way door that complicates every query.
> - [x] **ClickHouse / Kafka** before analytics volume actually hurts Postgres — a partitioned Postgres table serves early analytics fine.
> - [x] **Multi-region** before you have paying customers demanding it — it multiplies infra, data-consistency, and on-call burden.
> - [x] **A dedicated search cluster** when Postgres trigram/`ILIKE` answers template and response search at low volume.
> - [x] **Custom autoscalers, service mesh, self-hosted everything** — managed Postgres, managed Redis, and Cloudflare buy you years of runway.
>
> The bootstrapped lesson from Tally itself `[Assumption]`: an ~11-person team reached ~$5M ARR — small teams win by *not* operating infrastructure they don't yet need. Instrument first (Sentry + OTel + PostHog), let real bottlenecks announce themselves, and buy the next lever only when a dashboard says you must.

> 💡 The one rule that scales the whole product
>
> Keep the synchronous submit path down to **validate → write → enqueue → respond**, and serve the published form from the edge. Get those two right and the same architecture carries you from 100 to 1M users with mostly additive changes — no rewrites.

---

## AWS Infrastructure & Cost Analysis

*What each growth phase costs to run on AWS — raw self-managed EC2 vs. managed services — with a cost-vs-performance comparison and a recommended path.*

> ⚠️ Read every number here as a planning estimate `[Assumption]`
>
> Figures are **monthly USD, us-east-1, on-demand list prices (≈2026), ~730 hrs/mo**, and *exclude* AWS Support plans, taxes, and one-off data-migration/egress spikes. Real bills swing **±30–50%** with traffic shape, file/response sizes, and — most of all — data egress. Reserved Instances / Savings Plans / Graviton are applied only in the columns that say so. Treat these as ballpark ranges for budgeting, not quotes.

### The two reference architectures

Every phase is priced two ways, exactly as requested: **Scenario A — Vanilla EC2** (you run everything yourself on raw EC2) and **Scenario B — Managed AWS** (you rent AWS-operated equivalents). A third micro-option, **AWS Lightsail**, is the cheapest AWS on-ramp for the MVP and is noted where relevant.

| Concern | Scenario A — Vanilla EC2 (self-managed) | Scenario B — Managed AWS |
| --- | --- | --- |
| Compute / app | App + workers as processes/containers on EC2; you patch & scale | ECS Fargate / App Runner / EKS with auto-scaling |
| Database (Postgres) | PostgreSQL installed on an EC2 instance + EBS; you handle replication, backups, failover | RDS for PostgreSQL or Aurora (Multi-AZ, automated backups, failover) |
| Cache / queue | Redis on EC2 (self-clustered) | ElastiCache (Redis) + SQS |
| Load balancing | Nginx/HAProxy on EC2 | Application Load Balancer (ALB) |
| Object storage + CDN | S3 (+ optional CloudFront); or MinIO on EC2 | S3 + CloudFront (edge cache, egress) |
| Search / analytics | OpenSearch/Typesense & ClickHouse self-hosted on EC2 | Amazon OpenSearch Service (managed) |
| Secrets / DNS / TLS | Self-managed (.env, certbot) + Route 53 | Secrets Manager + ACM + Route 53 |
| You are responsible for | **Everything** — patching, HA, backups, on-call | App + config; AWS runs the undifferentiated heavy lifting |


> ⚠️ The number that isn't on the invoice
>
> Scenario A always looks cheaper on the AWS bill because the biggest cost is invisible to it: **engineering & on-call labor** to self-run Postgres HA, Redis clustering, search, patching, and backups. One SRE ≈ **$10–15k/mo fully loaded** — which, past ~100k users, dwarfs the hardware savings. Always compare *infra + people*, not infra alone.

### Phase 1 — ~100 users · MVP / pilot

- **Load profile** — <1 req/s avg · a few thousand responses/mo · <10 GB data · negligible egress
- **Goal** — Ship cheaply; a single small box is plenty. HA not yet worth paying for.

| Component | Scenario A — Vanilla EC2 | Scenario B — Managed AWS |
| --- | --- | --- |
| Compute (app+workers) | 1× t3.small, all-in-one ≈ $15 | App Runner / 1 Fargate task ≈ $25 |
| Database | Postgres on same box ≈ $0 | RDS db.t4g.micro ≈ $12 |
| Cache | Redis on same box ≈ $0 | ElastiCache t4g.micro (optional) ≈ $12 |
| Load balancer | Nginx on box ≈ $0 | ALB ≈ $20 |
| Storage + CDN | EBS 30 GB + S3 ≈ $3 | S3 + CloudFront ≈ $4 |
| DNS / secrets / logs / egress | Route 53 + snapshots + CW ≈ $7 | Route 53 + Secrets + CW + egress ≈ $10 |
| **Estimated total / mo** | **≈ $25–40** | **≈ $80–120** (trim ALB+cache → ~$55) |


Cheapest AWS option at this size is actually **Lightsail** (a $5–20/mo VPS bundle with fixed egress) — a fine home for an MVP before you need real elasticity.

### Phase 2 — ~10,000 users · V2 / traction

- **Load profile** — ~5–20 req/s peaks · 100k–500k responses/mo · 50–200 GB · files & embeds create real egress
- **Goal** — Separate the database from app; introduce HA for data. Downtime now costs customers.

| Component | Scenario A — Vanilla EC2 | Scenario B — Managed AWS |
| --- | --- | --- |
| Compute (app+workers) | 2× t3.large ≈ $120 | 2–3 Fargate tasks ≈ $90 |
| Database | 1× t3.large + 200 GB gp3 ≈ $76 (single, no HA) | RDS db.t4g.large Multi-AZ + storage ≈ $220 |
| Cache | 1× t3.small Redis ≈ $15 | ElastiCache t4g.small ≈ $24 |
| LB / CDN | Nginx ≈ $0 / CloudFront ≈ $15 | ALB ≈ $25 / CloudFront ≈ $15 |
| Storage + egress | S3 + ~30 GB egress ≈ $25 | S3 + egress + SQS/SES ≈ $30 |
| Backups / secrets / logs | Snapshots + CW ≈ $20 | Automated + Secrets + CW ≈ $25 |
| **Estimated total / mo** | **≈ $250–380** `[no DB HA]` | **≈ $430–620** `[HA + backups]` |


### Phase 3 — ~100,000 users · V3 / scale

- **Load profile** — ~50–200 req/s peaks · millions of responses/mo · 0.5–2 TB · analytics + search now material
- **Goal** — Horizontal app tier, read replicas, real search/analytics. Self-managing the data layer gets dangerous.

| Component | Scenario A — Vanilla EC2 | Scenario B — Managed AWS |
| --- | --- | --- |
| App + worker fleet | 4× m5.large + 2× t3.large ≈ $400 | EKS/ECS on Graviton (m6g) ≈ $600 |
| Database | r5.xlarge primary + r5.large replica + 1 TB IOPS ≈ $400 | Aurora r6g.xlarge writer + 1 reader + I/O ≈ $600 |
| Cache | 2× r5.large self-clustered ≈ $184 | ElastiCache r6g.large (2 nodes) ≈ $360 |
| Search / analytics | 3× m5.large OpenSearch (self) ≈ $210 | OpenSearch Service 3× m6g.large ≈ $300 |
| CDN + egress + LB + NAT | CloudFront ≈ $150 · NAT ≈ $35 | CloudFront ≈ $150 · ALB $40 · WAF $30 · NAT $35 |
| Storage / backups / logs | S3 + snapshots + CW ≈ $140 | S3 + backups + Secrets + CW ≈ $120 |
| **Estimated total / mo** | **≈ $1,600–2,600** `[heavy on-call]` | **≈ $3,000–5,500** · with Savings Plans+Graviton **≈ $2,400–3,600** |


### Phase 4 — ~1,000,000 users · hyperscale

- **Load profile** — hundreds–1,000+ req/s peaks · tens of millions of responses/mo · multi-TB · egress is the dominant line item
- **Goal** — Elastic multi-AZ everything, edge-cached form delivery, queue-buffered writes, managed data services.

| Component | Scenario A — Vanilla EC2 | Scenario B — Managed AWS |
| --- | --- | --- |
| App + worker fleet | 10–12× m5.xlarge + 4× m5.large ≈ $1,800 | EKS Graviton + Fargate Spot workers ≈ $2,500 |
| Database | r5.2xlarge primary + 2–3 replicas + 4 TB IOPS ≈ $1,400 | Aurora r6g.2xlarge writer + 3 readers (or Serverless v2) ≈ $1,900 |
| Cache | 3× r5.xlarge self-cluster ≈ $555 | ElastiCache r6g.xlarge ×3 ≈ $1,080 |
| Search / analytics | 6× m5.xlarge OpenSearch (self) ≈ $840 | OpenSearch Service cluster ≈ $1,200 |
| CDN + egress (dominant) | CloudFront heavy egress ≈ $1,500 | CloudFront heavy egress ≈ $1,500 |
| LB / NAT / WAF / Shield / logs / backups | ≈ $650 | ALB + WAF + Shield + NAT + CW + backups ≈ $900 |
| **Estimated total / mo** | **≈ $7,500–13,000** `[fragile without an SRE team]` | **≈ $12,000–24,000** · with Savings Plans+Spot+Graviton **≈ $9,000–13,000** |


### Cost at a glance

| Phase | Users | Vanilla EC2 /mo | Managed AWS /mo | Managed + Savings Plans/Graviton | Ops burden |
| --- | --- | --- | --- | --- | --- |
| 1 · MVP | ~100 | ≈ $30 | ≈ $95 | ≈ $55–70 | `[Low · but all yours]` |
| 2 · V2 | ~10k | ≈ $300 | ≈ $520 | ≈ $400 | `[Medium]` |
| 3 · V3 | ~100k | ≈ $2,100 | ≈ $4,000 | ≈ $2,800 | A: `[High]` · B: `[Low]` |
| 4 · Scale | ~1M | ≈ $9,500 | ≈ $16,000 | ≈ $10,500 | A: `[Very high]` · B: `[Medium]` |


Vanilla EC2 is ~40–50% cheaper on the invoice at every phase — but that gap is repaid in engineering time and reliability risk, and Savings Plans + Graviton shrink the managed premium to ~20–30%.

### Comparison study — vanilla EC2 vs managed

| Dimension | Scenario A — Vanilla EC2 | Scenario B — Managed AWS |
| --- | --- | --- |
| Raw infra cost | Best — lowest sticker price | 20–50% higher on paper |
| Total cost (infra + people) | Worse at scale — SRE labor dominates | Best past ~10k users |
| Performance ceiling | High if expertly tuned; easy to get wrong | High & consistent (Aurora, ElastiCache, CloudFront edge) |
| Scalability / elasticity | Manual; slow to react to spikes | Auto-scaling, read replicas, serverless options |
| Reliability / HA | You build it (and page yourself) | Multi-AZ, automated failover & backups built in |
| Security & patching | Your responsibility (OS, DB, CVEs) | Managed patching, encryption, IAM integration |
| Ops effort / headcount | High — needs real infra/SRE skill | Low — small team can run large scale |
| Time to market | Slower (you assemble everything) | Faster (compose services) |
| Best for | Extreme cost control, predictable load, in-house infra expertise | Small teams, spiky growth, reliability-sensitive products |


### Cost-optimization levers (typical savings)

| Lever | Typical saving | Applies to |
| --- | --- | --- |
| Graviton (ARM) instances | ~20% + better price/perf | EC2, RDS/Aurora, ElastiCache, OpenSearch |
| Compute Savings Plans / Reserved Instances (1–3 yr) | 30–60% | Steady-state compute & DB |
| Fargate Spot / EC2 Spot | up to 70% | Stateless workers, batch, exports, AI jobs |
| Aurora Serverless v2 | Big on spiky/low-avg load | Databases with uneven traffic |
| Aurora I/O-Optimized | 20–40% at high I/O | Write/read-heavy databases |
| S3 Intelligent-Tiering / lifecycle | 40–70% on cold data | Old file uploads, exports, logs |
| CloudFront caching + compression | Cuts origin egress & compute | Published form delivery, embeds, assets |
| VPC endpoints instead of NAT | $32+/mo/AZ + data | S3/DynamoDB/private AWS traffic |
| Right-sizing + scale-to-zero (dev/staging) | 20–40% | Over-provisioned or idle environments |


> ⚠️ Watch the sneaky lines — they blindside form products
>
> **Data egress** (S3/CloudFront out at ~$0.085–0.09/GB) is the #1 surprise once you serve embeds and file downloads at volume; **NAT Gateway** data processing, **inter-AZ traffic**, **RDS storage/IOPS**, **CloudWatch log ingestion**, and the **AWS Support plan** (Business ≈ 3–10% of the bill) round out the usual overruns. Put a **Budgets alarm** and Cost Anomaly Detection in from day one.

### Recommendations

- **✅ Recommended — balanced hybrid** — Cheap **Graviton compute** (EC2 Auto Scaling or Fargate, Spot for workers) + a **managed data layer you never self-run** (RDS/Aurora, ElastiCache) + **S3 + CloudFront** + Savings Plans. You skip the riskiest ops (databases) while keeping compute cheap and elastic.
- **💸 Most cost-effective** — MVP on **Lightsail/App Runner**; move to Graviton + **Savings Plans/RIs** for steady load and **Spot** for async work; aggressive CloudFront caching + S3 lifecycle; single-AZ until revenue justifies HA. Never trade DB reliability for a few dollars.
- **⚡ Best performance** — **Aurora (I/O-Optimized) + read replicas**, ElastiCache, **CloudFront edge-cached published forms** (form runtime served from S3/edge), EKS Graviton with HPA, OpenSearch for search, Multi-AZ everywhere, and a separate analytics store (ClickHouse/managed) so reporting never touches the write path.

| Phase | Recommended AWS setup (balanced) | Target /mo |
| --- | --- | --- |
| 1 · MVP (~100) | App Runner (or Lightsail) + RDS t4g.micro + S3/CloudFront; skip ALB & ElastiCache | ≈ $50–90 |
| 2 · V2 (~10k) | Fargate + RDS Multi-AZ (Graviton) + ElastiCache small + CloudFront + SQS | ≈ $400–550 |
| 3 · V3 (~100k) | ECS/EKS Graviton + Aurora + reader + ElastiCache + OpenSearch + CloudFront + Savings Plans | ≈ $2,500–3,500 |
| 4 · Scale (~1M) | EKS Graviton + Fargate Spot workers + Aurora (readers/Serverless v2) + ElastiCache cluster + OpenSearch + CloudFront + Savings Plans | ≈ $9,000–12,000 |


> 💡 Bottom line
>
> Use **vanilla EC2** only for the MVP and only if you already have infra expertise — it wins on sticker price but loses on people-cost the moment you have real users. From ~10k users on, the **balanced hybrid (cheap Graviton compute + managed data services)** is both the cost-effective *and* the reliable choice; layer **Savings Plans, Spot, and CloudFront/edge caching** on top for the best price-per-performance. Budget **~$50–90/mo → ~$500 → ~$3k → ~$10–12k** across the four phases, and always weigh infra *plus* engineering time, not the AWS invoice alone.

---

## Capacity Planning & Scaling Design

*How many users and responses each infrastructure tier can actually carry — and the scale-out design that lets capacity grow layer by layer.*

> ⚠️ How to read these capacity numbers `[Assumption]`
>
> Throughput figures are engineering estimates for a well-tuned stack (indexed Postgres, connection pooling, edge caching, async writes). Real ceilings vary with query shape, payload size, and traffic burstiness by **±40%**. They are meant for sizing decisions, not guarantees — always load-test before a launch. Each tier maps 1:1 to the cost phases in the previous section.

### The capacity model — what actually creates load

A form product has **two very different traffic types**, and conflating them is the #1 capacity-planning mistake:

- **Respondent traffic (public, high volume)** — **Form render (GET)** — cacheable at the edge, so it scales almost for free via CloudFront. **Submission (POST)** — a write; the real limiter, but absorbed by a queue so origins rarely feel spikes.
- **Creator traffic (authenticated, low volume / heavy)** — Builder autosaves, dashboards, browsing responses, analytics. Far fewer requests, but heavier queries — served off **read replicas** so they never contend with submissions.

> ℹ️ From "responses/month" to peak load (the math)
>
> Average submits/sec = monthly ÷ 2,592,000. But traffic concentrates — peaks run **~15–30× the average** (business hours, campaigns, virality). So a form doing **1M responses/month averages only ~0.4 submits/sec**, but you design for **~8–12/sec peak**. Views run 5–20× submissions on top of that — but they are edge-cached. Net: because **reads cache and writes queue**, the origin database is asked to do far less than the headline numbers suggest.

### What each component can carry

| Layer | Sustainable throughput | Practical ceiling (single unit) | How it scales |
| --- | --- | --- | --- |
| CloudFront (cached form render) | Effectively unbounded | Limited only by cache-hit ratio | Raise TTL / cache-key hygiene; edge is global |
| ALB | Tens of thousands RPS | Auto-scales; rarely the limit | Managed — nothing to do |
| App instance (2 vCPU) | ~300–600 mixed RPS · ~150–300 submits/s | CPU-bound around there | **Add stateless instances** behind ALB — linear |
| Postgres / Aurora primary (writes) | ~500–3,000 write TPS (single-row JSONB, tuned) | IOPS + connection-bound | Upsize → partition responses → shard / multi-writer |
| Read replica / Aurora reader | Thousands of read QPS each | Replica lag under heavy write | Add readers; route dashboards/analytics to them |
| ElastiCache (Redis) | 100k+ ops/s per node | Memory-bound | Cluster mode / bigger node — rarely the bottleneck |
| SQS + workers (submissions, webhooks) | Effectively unbounded ingest | Worker count & DB write rate | Add workers; buffer absorbs spikes |
| Object storage (S3) | Effectively unbounded | Per-prefix request rate | Prefix sharding; managed |


### Capacity per infrastructure tier

| Tier (setup) | Sustained · peak RPS | Submits/s | Concurrent form sessions | Caters to (creators) | Responses / month | First bottleneck |
| --- | --- | --- | --- | --- | --- | --- |
| **1 · MVP** single small box / App Runner + RDS micro | ~50 · ~150 | ~20 | ~300–500 | **~1k–3k** | ~100k–300k | Single-instance CPU + co-located DB; no HA |
| **2 · V2** 2× app + RDS Multi-AZ + Redis + CloudFront | ~800 · ~2,500 | ~300 | ~10k | **~25k–50k** | ~2M–5M | Single DB primary — writes & connections |
| **3 · V3** app fleet + Aurora + reader + ElastiCache + CDN + OpenSearch + SQS | ~8k · edge-scaled | ~2,000 (queued) | ~100k | **~250k–500k** | ~20M–50M | Response-table size; analytics on OLTP; webhook fan-out |
| **4 · Scale** EKS fleet + Aurora cluster + ElastiCache cluster + partitioned responses + ClickHouse + CDN | ~50k+ · edge-scaled | ~10k+ (queued) | ~1M+ | **~1M+** | ~100M–500M+ | Single-region write ceiling → shard / multi-region |


"Concurrent form sessions" = people actively filling a form at the same instant. Because renders are edge-cached, a tier can serve many times more *total* visitors than concurrent sessions.

### What breaks first — and what you scale

Capacity is a sequence of moving bottlenecks. The design goal is that **each ceiling has a pre-planned, mostly-horizontal fix**, so no single rewrite is ever forced:

- **~3k users** — one box saturates CPU → split the database onto RDS; run 2 app instances behind an ALB.
- **~50k users** — DB writes/connections tighten → add pgBouncer, a read replica for dashboards, and CloudFront to cache form renders.
- **~500k users** — reads and spikes dominate → queue-buffer submissions (SQS), add Aurora readers, move analytics off the OLTP path.
- **~5M+ responses/table** — indexes slow → partition the responses table by month/form; push events to ClickHouse.
- **Single-region write ceiling** — shard by workspace and/or go multi-region active-active.

### Scale-out design principles (built in from day one)

- [x] **Stateless app tier** behind an ALB — add instances for linear capacity; no sticky sessions.
- [x] **Edge-cache the published form** (CloudFront) — respondent reads scale globally, decoupled from the origin.
- [x] **Queue-buffer submissions** (SQS / BullMQ) — absorb 20× spikes, protect the DB, retry safely; return a fast 202.
- [x] **Read replicas** for dashboards & exports — heavy reads never touch the write primary.
- [x] **Partition the responses table** by time/form — keep inserts and indexes fast as rows reach the hundreds of millions.
- [x] **Separate analytics store** (ClickHouse) — reporting queries never contend with live submissions.
- [x] **Async webhook & integration fan-out** via workers — a slow downstream never blocks a submit.
- [x] **Autoscaling policies** on CPU, p95 latency, and queue depth — capacity follows demand automatically.
- [x] **Multi-AZ everywhere**; shard-by-workspace / multi-region only at the very top end.

### The scalable request path

Read and write paths are deliberately separated so each scales independently:

`Respondent` → `CloudFront (cached render)` → `Origin only on cache miss`

`Submit` → `ALB → App (validate)` → `Queue (SQS) → 202 fast` → `Worker → DB write + webhooks + integrations`

`Creator` → `ALB → App` → `Read replica (dashboards, exports)`

### Scaling triggers & SLOs

| Signal | Warning threshold | Automated / planned action |
| --- | --- | --- |
| App CPU (sustained) | > 65% | Autoscale out — add app instances |
| API p95 latency | > 300 ms | Scale app; inspect slow queries |
| DB CPU / replica lag | > 70% · > 1 s | Add reader; upsize; then partition |
| DB connection pool | > 80% used | pgBouncer; raise pool; split reads |
| Redis memory | > 75% | Scale node / enable cluster mode |
| Queue depth / message age | > 30 s old | Add workers (autoscale on depth) |
| CloudFront cache-hit on form GET | < 85% | Fix cache headers / TTL / cache key |
| Rows per response partition | > ~50–100M | Roll to monthly/form partitions |


> 💡 Bottom line
>
> The same money spends very differently on capacity depending on design. With **edge-cached reads and queue-buffered writes**, a modest **~$500/mo tier comfortably carries ~25k–50k creators and a few million responses a month**, and the architecture scales to **1M+ users** by adding replicas, workers, partitions, and cache — not by rewriting. Build the stateless-app + CDN + queue + replica pattern from the start, and every later ceiling becomes a routine, horizontal change instead of a crisis.

---

## Product Roadmap

*A ruthlessly sequenced path from a minimum-lovable form builder to an AI-native automation platform, staged so each phase ships revenue-relevant value before the next begins.*

The strategic logic below is opinionated: **ship a document-editor MVP that is already lovable, monetize with a thin Pro tier, and defer everything that does not directly help someone build, publish, and collect responses.** Tally's own history validates this: it grew ~100% organically to ~$5M ARR with a team of ~11 `[Verified]`, which is only possible when the core loop is delightful and the surface area stays small. Everything after MVP is sequenced by how fast it compounds distribution (SEO templates, sharing) and retention (collaboration, analytics), not by how impressive it looks.

- **P0** — MVP — minimum lovable
- **P1** — V2 — usability & collaboration
- **P2** — V3 — enterprise
- **P3** — Future — AI & marketplace

### Phased roadmap

### Phase 0 &middot; Months 0–4 &middot; MVP — The minimum lovable form builder

Goal: a stranger can land, build a real multi-question form with logic, publish it, embed it, and start collecting paid or free responses — **without signing up to start** `[Verified positioning]`. If this loop is not delightful, nothing later matters.

- [x] Notion-style document editor: slash-command block insertion, type-to-build, drag reorder `[Verified pattern]`
- [x] Core input blocks only: short/long text, multiple choice, checkboxes, dropdown, number, email, date, rating, file upload, **payment (Stripe)** `[Verified block set]`
- [x] Rich blocks: headings, text, image, divider, button; multi-page + progress bar
- [x] Conditional logic (show/hide, jump) — the single most-cited reason people pick Tally `[Verified (free tier)]`
- [x] Publish: shareable link + inline & popup embed; custom Thank-You page; redirect on completion
- [x] Responses table with export (CSV); self email notifications on submit
- [x] Auth + workspaces; anonymous drafts that convert to an account on first save
- [x] Stripe billing for Free vs Pro ($24) `[Verified price]`
- [x] 1–2 integrations only: **Google Sheets** + a webhook. Everything else is a Zapier/Make handoff `[Sequencing call]`
- [x] SEO-ready public template pages (server-rendered) — this is the growth engine, not a nicety `[Verified channel]`

### Phase 1 &middot; Months 4–9 &middot; V2 — Usability, analytics & collaboration

Goal: convert free builders into paying teams and reduce drop-off. This is where Pro earns its $24.

- [x] Form-visit + **drop-off / funnel analytics** per question `[Pro]` `[Verified]`
- [x] Partial-submission capture (recover abandoners) `[Pro]` `[Verified]`
- [x] Custom domains + link-preview customization (OG image/favicon/title) `[Pro]` `[Verified]`
- [x] Version history (30 days) `[Pro]`; remove branding; advanced customization + custom CSS `[Verified]`
- [x] Workspaces, folders, team roles & unlimited collaboration `[Pro]` `[Verified]`
- [x] Richer template gallery + community-submitted templates (compounds SEO) `[Verified channel]`
- [x] Native integrations: Notion, Airtable, Slack, Zapier, Make, n8n `[Free]` `[Verified set]`
- [x] Remaining input blocks: phone, URL, time, linear scale, ranking, matrix, multi-select, signature, hidden & calculated fields `[Verified]`

### Phase 2 &middot; Months 9–16 &middot; V3 — Enterprise readiness

Goal: unlock a Business/Enterprise tier and land regulated buyers. Tally today caps at Business ($74) with no public Enterprise tier `[Verified]` — this is open white space to *out-position* them.

- [x] SSO (SAML/OIDC) + SCIM user provisioning `[Enterprise]` `[Gap vs Tally]`
- [x] Audit logs (who changed/exported what) + granular role-based permissions `[Enterprise]`
- [x] Data-residency options (EU is baseline; add US/other) — extends Tally's EU-hosting claim `[EU verified]` `[Multi-region is new]`
- [x] Full white-label (custom email domains verified, branded end-to-end) `[Enterprise]` `[Custom email domain verified]`
- [x] Data-retention controls / auto-delete + email verification `[Business]` `[Verified]`
- [x] Version history 90 days; SLAs; SOC 2 Type II; DPA + sub-processor list `[Compliance push]`

### Phase 3 &middot; Months 16+ &middot; Future Vision — AI, automation & marketplace

Goal: leapfrog Tally, whose core product has historically had minimal built-in AI `[Verified]`. AI is Tally's #1 *referral channel* but barely a *feature* — that asymmetry is the single biggest opportunity in this teardown.

- **AI form generation** — Prompt → fully-built form with the right blocks, logic, and copy. The wedge that makes "no signup to start" 10× faster. `[Opportunity]`
- **AI logic & branching suggestions** — Detect intent and propose show/hide rules and jumps as you build. `[Opportunity]`
- **Response summarization & insights** — Auto-cluster open-text answers; surface themes, sentiment, outliers. `[Opportunity]`
- **Analytics copilot** — "Why did drop-off spike on Q4?" answered in natural language over funnel data. `[Opportunity]`
- **Auto-translation + AI form-fill** — One-click 45+ languages/RTL `[Language set verified]`; AI pre-fills known respondent data. `[AI layer is new]`
- **Integration marketplace + visual workflows** — Third-party apps + a node-based automation canvas (trigger → condition → action). Extends the existing "Hire an expert" marketplace. `[Marketplace exists]` `[App store is new]`

### Prioritization matrix

Impact and effort scored 1–5. Priority = Impact &divide; Effort, bucketed P0–P3. Scores are opinionated engineering/PM estimates `[Assumption]`.

| Feature | Impact | Effort | Phase | Priority |
| --- | --- | --- | --- | --- |
| Document editor + core blocks | 5 | 4 | MVP | P0 |
| Conditional logic | 5 | 3 | MVP | P0 |
| Publish + embed + Thank-You | 5 | 2 | MVP | P0 |
| Responses table + email notify | 4 | 2 | MVP | P0 |
| Stripe payment block + billing | 4 | 3 | MVP | P0 |
| SEO template pages | 5 | 3 | MVP | P0 |
| Drop-off / funnel analytics | 4 | 3 | V2 | P1 |
| Partial submissions | 4 | 2 | V2 | P1 |
| Custom domains + link preview | 3 | 2 | V2 | P1 |
| Workspaces + team roles | 4 | 3 | V2 | P1 |
| Version history | 3 | 3 | V2 | P2 |
| SSO / SAML / SCIM | 4 | 4 | V3 | P2 |
| Audit logs + granular permissions | 3 | 4 | V3 | P2 |
| Data residency + white-label | 3 | 4 | V3 | P2 |
| AI form generation from prompt | 5 | 4 | Future | P1* |
| Response summarization & insights | 4 | 3 | Future | P2 |
| Integration marketplace + visual workflows | 4 | 5 | Future | P3 |


*AI form generation is technically "Future" by dependency (needs a stable schema) but its impact justifies pulling a thin version forward as soon as the editor stabilizes.

- **Highest impact &divide; effort: Conditional logic** — The differentiator that is free even on Tally's own free plan.
- **Highest strategic upside: AI form generation** — Turns Tally's #1 acquisition channel into a product moat.

> ⚠️ What to cut from MVP to ship fast
>
> **Cut ruthlessly.** None of these block the core build–publish–collect loop, and each can ship later without re-architecture:
>
> - **Advanced/rare blocks** — ranking, matrix, linear scale, signature, calculated fields. Ship the 10 common inputs; add the rest in V2.
> - **All integrations except Google Sheets + webhook.** Notion/Airtable/Slack/Zapier all wait for V2 — a webhook covers power users on day one.
> - **Analytics, version history, partial submissions, custom domains** — these are Pro-tier retention features, not acquisition features. V2.
> - **Advanced customization + custom CSS, custom email domains** — polish, not core. Ship one clean default theme.
> - **Popover / side-tab / full-page embeds** — inline + popup cover 90% of use; add the rest later `[Embed types verified]`.
> - **All of AI.** Tempting, but it is a Phase-3 moat, not a launch requirement. Do not let it delay the loop.
>
> What you must *not* cut: the Notion-like editor feel, conditional logic, no-signup-to-start, and SEO-rendered template pages. These are the four things that made Tally win.
