import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, FileStack, GitBranch, Layers, ListChecks, Lock, Package, Save, Tags } from "lucide-react";
import type { FormSchema } from "@zoworkhq/zoforms/core";
import { HeroVisual } from "@/components/home/hero-visual";
import { SeeItWorking, type HomeExample } from "@/components/home/see-it-working";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { buttonClasses } from "@/components/ui";
import { readExampleForm, readJson } from "@/lib/docs/content";
import { rendererStyles } from "@/lib/docs/renderer";

const TITLE = "ZoForms: clinical forms that run in your app";
const DESCRIPTION =
  "A form builder for behavioral health teams. Build forms with logic and scoring, download them, and render them in your own app with @zoworkhq/zoforms.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // The image is opengraph-image.tsx beside this file.
  openGraph: { type: "website", url: "/", siteName: "ZoForms", title: TITLE, description: DESCRIPTION },
};

/*
 * The public home page. A signed-in visitor is sent on to My forms before
 * paint (HOME_REDIRECT_SCRIPT in the root layout) or, arriving by a link
 * inside the app, by SignedInRedirect.
 *
 * Wording rules (docs/briefs/BUILDER-BRIEF-HOME.md): US spelling; nothing a
 * regulator has approved, only what the architecture does; no invented
 * numbers, logos or quotes; every capability named is in the builder and the
 * renderer today. Check a new claim against the contracts in docs/ first.
 */

/** Why ZoForms, right after the hero: each card links to the docs page that shows it. */
const USPS = [
  {
    Icon: Calculator,
    title: "Clinical scoring built in",
    body: "Give options scores and add formulas to groups, several to a group if you need them. Show the results after submit when the author allows it. The browser never sends scores: your server works them out again.",
    link: { label: "Read scores", href: "/docs/integrate/scores" },
  },
  {
    Icon: GitBranch,
    title: "Logic for real clinical forms",
    body: "Show or hide questions with AND and OR logic. Nest groups and repeat them, split a form into pages with a review step, and let people save drafts.",
    link: { label: "Show a question only when it applies", href: "/docs/build/show-questions-conditionally" },
  },
  {
    Icon: Lock,
    title: "Answers never touch our servers",
    body: "The form in your app posts straight to your own endpoint. ZoForms never receives or stores answers.",
    link: { label: "Where respondents’ data goes", href: "/docs/compliance/data-flow" },
  },
  {
    Icon: Package,
    title: "Developer-friendly package",
    body: "One npm package. The same validation and scoring from its /core runs in the browser and on your Node server. Add your own validators, and theme it with --zf-* custom properties.",
    link: { label: "Quickstart", href: "/docs/integrate/quickstart" },
  },
];

/** "See it working": real builder downloads, rendered by the real package. */
const HOME_FORMS = path.join(process.cwd(), "content", "home");
function homeExamples(): HomeExample[] {
  const home = (file: string) => readJson(path.join(HOME_FORMS, file)) as unknown as FormSchema;
  return [
    {
      name: "check-in",
      title: "Scored check-in",
      body: "Five invented questions, each option scored from 0 to 3, and a group total the form shows after you submit. An example of scoring, not a clinical tool.",
      schema: home("check-in.form.json"),
    },
    {
      name: "follow-up-question",
      title: "Follow-up question",
      body: "Answer Yes and a required follow-up question appears. Answer No and it goes, and its answer is left out of what is sent.",
      schema: readExampleForm("examples/follow-up-question", "follow-up-question").schema as unknown as FormSchema,
    },
    {
      name: "medications",
      title: "Repeating group",
      body: "Add an entry for each medication, with its name and how often it is taken, and remove any you don’t need.",
      schema: home("medications.form.json"),
    },
  ];
}

const STEPS = [
  { title: "Build the form", body: "Add questions, groups, pages, logic and scores in the editor." },
  { title: "Download the file", body: "Each saved version downloads as one JSON file." },
  {
    title: "Render it in your app",
    body: (
      <>
        Pass the file to <code className="font-mono text-[0.8125rem]">@zoworkhq/zoforms</code>. Answers post straight to
        your own endpoint.
      </>
    ),
  },
];

const CAPABILITIES = [
  {
    Icon: Layers,
    title: "Groups and repeating groups",
    body: "Nest questions in groups, and let people add a group again, such as one per medication.",
  },
  {
    Icon: FileStack,
    title: "Pages with a review step",
    body: "Split a long form into pages, then show every answer for a check before submitting.",
  },
  {
    Icon: GitBranch,
    title: "Conditional logic",
    body: "Show a question, group or page when conditions hold, combined with AND, OR and brackets.",
  },
  {
    Icon: Calculator,
    title: "Scoring",
    body: "Give options a score and add formulas to groups, such as a total or a weighted sum.",
  },
  { Icon: Tags, title: "Coded options", body: "Every option carries a code. Import long lists from a CSV file." },
  {
    Icon: ListChecks,
    title: "Your own checks",
    body: "Add validation in your code. It runs in the form and again on your server.",
  },
  {
    Icon: Save,
    title: "Save progress",
    body: "Let people come back later, with drafts kept on their device or on your server.",
  },
];

const ACCESSIBILITY = [
  "An error summary lists each problem, and each entry links to its question.",
  "Every error is tied to its question, so a screen reader reads them together.",
  "Required questions say so to assistive technology, not only with an asterisk.",
  "On a form with pages, focus moves to each new page’s title, so the change is announced.",
];

const FAQ = [
  {
    q: "Where are the answers stored?",
    a: "Wherever your app sends them. ZoForms never sees them.",
  },
  {
    q: "Which frameworks does it work with?",
    a: "The form component needs React 18 or later. Validation and scoring also run in Node, without React.",
  },
  {
    q: "What does a developer need to do?",
    a: "Install @zoworkhq/zoforms, render the form file, and write the endpoint that receives the answers. The Quickstart in the docs shows each step.",
  },
  {
    q: "How do changes reach a live form?",
    a: "Save a new version, download it and ship it with your app. Nothing changes for respondents until you release it.",
  },
];

function CallToAction() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/signup" className={buttonClasses({ variant: "primary" })}>
        Get started
      </Link>
      <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
        Sign in
      </Link>
    </div>
  );
}

const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";

export default function HomePage() {
  return (
    <>
      <SignedInRedirect />

      <section aria-labelledby="hero-title" className={`${SECTION} pb-16 pt-14 sm:pb-24 sm:pt-20`}>
        <h1 id="hero-title" className="display-lg max-w-[18ch]">
          Clinical forms, built here, running in your app
        </h1>
        <p className="lede mt-5 max-w-[60ch]">
          ZoForms is a form builder for behavioral health teams. You design the form; it runs inside your own
          application, and the answers go to your own server.
        </p>
        <div className="mt-8">
          <CallToAction />
        </div>
        <div className="mt-12 sm:mt-16">
          <HeroVisual />
        </div>
      </section>

      <section aria-labelledby="why-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="why-title" className="display-sm">
            Why ZoForms
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {USPS.map(({ Icon, title, body, link }) => (
              <li key={title} className="surface flex flex-col p-5">
                <Icon aria-hidden="true" className="h-4 w-4 text-brand-deep" strokeWidth={2} />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="body-sm mt-1.5 flex-1 text-graphite">{body}</p>
                <Link href={link.href} className="link mt-4 inline-flex items-center gap-1.5 self-start text-[0.8125rem] font-medium">
                  {link.label}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="how-title" className="display-sm">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="surface p-5">
                <p aria-hidden="true" className="font-mono text-[0.75rem] text-brand-deep">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="body-sm mt-1.5 text-graphite">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="examples-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="examples-title" className="display-sm">
            See it working
          </h2>
          <p className="lede mt-3 max-w-[60ch]">
            Three forms built in ZoForms and rendered here by the real package. Submitting runs in your browser only:
            nothing is sent anywhere.
          </p>
          <SeeItWorking css={rendererStyles()} examples={homeExamples()} />
        </div>
      </section>

      <section aria-labelledby="features-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="features-title" className="display-sm">
            Built for clinical forms
          </h2>
          <p className="lede mt-3 max-w-[60ch]">Everything here is in the builder and the renderer today.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ Icon, title, body }) => (
              <li key={title} className="surface p-5">
                <Icon aria-hidden="true" className="h-4 w-4 text-brand-deep" strokeWidth={2} />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="body-sm mt-1.5 text-graphite">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="data-title" className="border-t border-rule bg-accent-wash">
        <div className={`${SECTION} grid gap-8 py-16 sm:py-20 md:grid-cols-2`}>
          <div>
            <h2 id="data-title" className="display-sm">
              Your data stays with you
            </h2>
            <p className="body mt-4 text-graphite">
              The form runs in your app and posts answers to your endpoint. ZoForms never receives or stores them.
            </p>
            <p className="body mt-3 text-graphite">
              On your server, the same package can check the answers again and recalculate the scores, so you never
              have to rely on totals sent from the browser.
            </p>
          </div>
          <dl className="grid content-start gap-5">
            <div>
              <dt className="font-semibold">In your app and on your server</dt>
              <dd className="body-sm mt-1 text-graphite">The answers people give, and the scores worked out from them.</dd>
            </div>
            <div>
              <dt className="font-semibold">In ZoForms</dt>
              <dd className="body-sm mt-1 text-graphite">The forms you build, their versions and your team’s accounts.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="a11y-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="a11y-title" className="display-sm">
            Accessible forms
          </h2>
          <p className="lede mt-3 max-w-[60ch]">
            What a form rendered by <span className="font-mono text-[0.9em]">@zoworkhq/zoforms</span> does for people who
            use assistive technology:
          </p>
          <ul className="body mt-6 max-w-[64ch] list-disc space-y-2 pl-5 text-graphite marker:text-brand-deep">
            {ACCESSIBILITY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="faq-title" className="display-sm">
            Questions
          </h2>
          <div className="surface mt-8 max-w-3xl divide-y divide-rule">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="font-mono text-graphite transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="body-sm px-5 pb-5 text-graphite">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="border-t border-rule">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <h2 id="cta-title" className="display-sm">
            Build your first form
          </h2>
          <p className="lede mt-3">Create an account, build a form and download it.</p>
          <div className="mt-8">
            <CallToAction />
          </div>
        </div>
      </section>
    </>
  );
}
