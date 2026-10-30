# Builder brief — developer docs ("Integrate forms")

Builder repo, branch `formbuiler-service-dhawal`, web app only (`apps/web`). Builds on the docs site (BUILDER-BRIEF-DOCS.md, BUILDER-BRIEF-DOCS-QUESTIONS.md) and the renderer 0.28.0 adoption (`9fa916f`).

**First:** save this brief as `docs/briefs/BUILDER-BRIEF-DEVELOPER-DOCS.md` and commit it on its own.

**Stop after CP0 and wait for approval before writing any page.** Then stop after **each** checkpoint for review.

## Audience: developers who integrate a form

A developer at a client receives a form file from an author. They put it in their app with `@zoworkhq/forms`, receive answers on their own server, and store them. These pages take them from install to a stored, validated submission, then cover everything they'll need after that.

Author pages stay as they are, except for adding their "For developers" section (scope item 3).

## Sources and accuracy (most important)

- **Every fact comes from:**
  - the installed `@zoworkhq/forms` 0.28.0: its README, `.d.ts` files and source in the vendored tarball;
  - `docs/GROUPS-AND-PAGES-CONTRACT.md` and `docs/DRAFTS-CONTRACT.md`;
  - the builder's code, for example what Download produces.

  Nothing from memory, including this brief. Where this brief and the sources disagree, follow the sources and say so in the report.
- **Every code example is tested.** Code blocks on these pages are extracted by a script and type-checked against the installed package, in ESM, CommonJS and strict TypeScript where relevant. Runnable server examples are executed against a real `prepareSubmission`, and browser examples are rendered. A page whose code doesn't compile fails the build. CP0 proposes how.
- **Reference tables are generated from, or checked against, the `.d.ts`** by a test that fails on drift, as `form-renderer.props.json` does today. This extends to every `/core` export documented.
- **Messages are quoted exactly from the renderer.**
- **Not contradicting the README.** Where a page and the 0.28.0 README cover the same thing, they must agree. CP0 proposes how to keep them in step: shared generated data, a test, or both.
- **No legal or compliance claims.** Don't write "HIPAA compliant", "no BAA needed" or similar. State facts about where data goes and what is stored. Anything that reads as a legal position becomes `[TODO: legal review]`.
- **Not published yet.** The package isn't on npm yet. Write install commands for the public npm package as it will ship (`npm install @zoworkhq/forms`) and mark it in the report. Don't invent a docs URL or a support address.
- Anything you can't source: `[TODO: …]` in the page, listed in the report.

## Scope

**1. "Integrate forms" pages.** The agreed structure has a quickstart, a tutorial, how-to guides, reference and concepts. CP0 confirms the list against the README's sections and the package's exports. Proposed:

| Kind | Page | Covers |
|---|---|---|
| Overview | How Zowork Forms fits your app | Builder → form file → `@zoworkhq/forms` in your app → your endpoint; Zowork never receives answers; the existing docs-home diagram |
| Quickstart | Render a form and receive answers | Vite + React and a small Node server. Install, put the downloaded file in, render, endpoint, `prepareSubmission`, store `submission`. About 10 minutes. |
| Tutorial | Build an intake page in Next.js | App Router, `'use client'`, a route handler with `prepareSubmission`, deduping on `idempotencyKey`, `onRenderError`, a signed-in `scope` |
| How-to (template B) | Validate and store submissions on your server | `prepareSubmission`, `submission`, dedupe, versionMismatch, body-size limits, CommonJS |
| How-to | Add your own validation | `validators`: shape, messages, the summary format, the fail-closed message |
| How-to | Send the submission with your app's sign-in | `credentials`, `getAuthHeaders`, `timeoutMs`, `onSuccess`, `onError` |
| How-to | Save progress (drafts) | session, device, server and off; `scope`, `owner`, `label`, `getKey`, the server functions, `expiresAfterDays`; `clearDrafts` at sign-out |
| How-to | Shared devices and kiosks | The clinic-tablet case, what each mode does, the prompt, `mode: 'off'`, `clearDrafts()` between respondents, and what no setting can prevent (a form left on screen) |
| How-to | Handle errors | What respondents and hosts see: `onRenderError`, `onError`, `onDraftProblem`; development mode |
| How-to | Use it with your framework | Vite, Next.js App Router, CommonJS servers, TypeScript (`as FormSchema`), React 18 and 19 |
| How-to | Style the form | `--zf-*` properties, `classNames`, density, dark mode; host CSS winning by design; CSS resets, including Tailwind 3's preflight and the `@layer` fix; the planned **host headings** content from BUILDER-BRIEF-DOCS.md ("Known content for later pages") |
| How-to | Content Security Policy | One complete policy; `frame-src` and `media-src` only when used; the Next.js nonce note; the A6-8 progress-bar limit |
| How-to | Update to a new form version | Re-downloading, `formVersionId`, `versionMismatch`, drafts across versions |
| How-to | Read scores | `derived`, `calculateScores`, and what the server recalculates |
| Reference (template C) | `FormRenderer` | **Rewritten.** Fix every out-of-date line found in the 0.28.0 adoption CP0 (`form-renderer.mdx:47,48,65,67,146,168,237`). |
| Reference | `prepareSubmission` and `validateSubmission` | Parameters, the result (`ok`, `submission`, `answers`, `errors`, `versionMismatch`, `derived`), every error case |
| Reference | Other `/core` exports | The ones a host would use (CP0 decides which; internal helpers left out) |
| Reference | `clearDrafts` | Options, when it rejects (`ClearDraftsError`) |
| Reference | The posted body | What the browser sends, field by field, and the response the endpoint must return |
| Reference | The form file | Its top level (ids, `schemaVersion`, `drafts`, `blocks`), from the types; links to each question page for block details |
| Reference | CSS classes and custom properties | Generated from `classNames` and the stylesheet's `--zf-*` list |
| Concepts | Answers and their states | `answered` and `empty`, the empty-answer rule, hidden answers kept while filling but never stored, the value formats |
| Concepts | What is stored in the browser | Each mode, keys, lifetime, encryption, plain-HTTP behavior; facts only |
| Compliance and security | Where respondents' data goes | The builder holds form definitions, never answers; answers go from the browser to the client's endpoint; what the package stores in the browser; what the client is responsible for. Facts only, with `[TODO: legal review]` for anything else. |

**2. Navigation.** Every new page goes in `nav.ts` under "Integrate forms" (and "Compliance and security"), with `.md` versions, `llms.txt` entries and search. Planned pages already listed in the config are either written here or stay planned. CP0 says which.

**3. "For developers" on question pages.** Every answerable question page gets the optional section that template A already allows:
- the payload value shape;
- what `prepareSubmission` stores;
- the condition comparisons it can drive;
- whether it can be scored;
- a validator example where useful.

To keep 20 sections from drifting, CP0 proposes generating the shapes and comparisons from one data file that a test checks against `/core`, for example by running each example value through `prepareSubmission`. The existing Dropdown page's developer section is brought into line with the rest.

**4. Examples.** Optional. If one or two integration examples (template D) help, for example "Drafts on this device" or "Your own validator", CP0 proposes them. Otherwise none.

**Out of scope:**
- Author pages beyond item 3.
- The renderer's README.
- Deployment.
- Storing the feedback widget's answers.
- Signed-in pages.

## Example content

- Realistic behavioral health intake and admin examples, as on the author pages.
- **No clinical risk logic** in examples: no screening or safety question shown, skipped or scored on a cut-off.
- **No real or realistic personal data** in code: obviously fake names, dates and ids.
- Server examples use a plain store function the reader replaces. No real database, cloud service or vendor named as a recommendation.

## Rules

- List matches before changing anything; no blind replace-all.
- Exclude `.git`, `node_modules`, `dist`, `.next` and `.vite` from searches.
- Every existing unit test, web spec, e2e suite, `verify-docs`, `verify-a11y` and the contrast gate keep passing.
- Every new page is covered by `verify-a11y` in light and dark, has no sideways scroll at 320px, and gets screenshots at 375 and 1440 wide, light and dark.
- Stop only processes you launched, recorded by PID and start time when you launch them. Never use parent-PID lookups or name patterns.
- Commit at each checkpoint once checks pass. Don't push.

## Checkpoints

**CP0 — Inventory and plan. Report only. Stop and wait.**
- The README's sections, and the package's exports and props, mapped to the proposed pages. Note anything with no page, and any page with no source.
- The final page list and navigation order, with the template for each.
- The code-example test: how blocks are extracted, type-checked and run, and in which module systems.
- The drift tests: reference tables, the "For developers" data file, and keeping the docs and the README in step.
- Every out-of-date line on `form-renderer.mdx` and the existing Dropdown developer section.
- Which planned pages in `nav.ts` this brief covers.
- Proposed examples, if any.
- Every fact you can't source yet.

**CP1 — Start here.**
- The overview, quickstart and posted-body reference.
- `FormRenderer` (rewritten), `prepareSubmission`/`validateSubmission` and `clearDrafts` references.
- The code-example test and the reference drift tests.

**CP2 — Server and integration how-tos.** Validate and store, your own validation, sign-in, errors, frameworks, CSP, form versions, scores.

**CP3 — Browser data.** Save progress, shared devices, the browser-storage concept, answers and states, and the compliance and security page.

**CP4 — Styling and the rest of the reference.** Style the form (with the host headings content), CSS classes and custom properties, the form file, other `/core` exports.

**CP5 — Question pages and tutorial.** "For developers" on every answerable question page from the data file, the Dropdown section aligned, the Next.js tutorial, and any approved examples.

**CP6 — Checks.**
- Full e2e, `verify-docs`, `verify-a11y`, the contrast gate, the web spec, typecheck, unit tests and the code-example test.
- Keyboard: the reference pages' on-this-page links and every code block's copy button.
- The report lists every `[TODO]` left, every `[TODO: legal review]`, and every place the sources disagreed with this brief.
