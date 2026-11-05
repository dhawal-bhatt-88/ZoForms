import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, FileStack, GitBranch, Layers, ListChecks, Save, Tags } from "lucide-react";
import { HeroVisual } from "@/components/home/hero-visual";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { buttonClasses } from "@/components/ui";

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
