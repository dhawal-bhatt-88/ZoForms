import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  GitBranch,
  Inbox,
  PenLine,
  Play,
  Puzzle,
  Send,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Frame — Forms that feel like writing",
  description:
    "Frame turns a blank page into a working form. Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
};

const features = [
  {
    icon: PenLine,
    eyebrow: "Document editor",
    title: "Build forms like you write a doc",
    body: "Type naturally and hit “/” to drop in any question — short answer, multiple choice, rating, payment. No drag-and-drop maze, no clutter. Just words on a page that collect answers.",
  },
  {
    icon: GitBranch,
    eyebrow: "Logic & calculations",
    title: "Ask the right question every time",
    body: "Show, hide, and jump between questions based on answers. Score quizzes, run calculations, and pipe earlier answers into later questions — all without code.",
  },
  {
    icon: Share2,
    eyebrow: "Share anywhere",
    title: "One form, every surface",
    body: "Share a link, embed inline or as a popup, or connect a custom domain. Your form looks native wherever it lives — and loads fast from the edge.",
  },
  {
    icon: Puzzle,
    eyebrow: "Integrations",
    title: "Send responses where they belong",
    body: "Pipe submissions into Sheets, Notion, Slack, Airtable, or 30+ tools via Zapier and webhooks. Set it once and never copy-paste a response again.",
  },
];

const steps = [
  {
    icon: PenLine,
    title: "Write",
    body: "Start from a blank page or a template. Type your questions.",
  },
  {
    icon: Send,
    title: "Publish",
    body: "One click. Share a link, embed it, or put it on your domain.",
  },
  {
    icon: Inbox,
    title: "Collect",
    body: "Watch responses roll in, with analytics and instant notifications.",
  },
];

const plans = [
  { name: "Free", price: "$0", note: "Unlimited forms & responses" },
  { name: "Pro", price: "$24", note: "Custom domains, no branding, teams", featured: true },
  { name: "Business", price: "$74", note: "Data controls, verification, more" },
];

const testimonials = [
  {
    quote:
      "We replaced three separate tools with Frame in an afternoon. Our team actually enjoys building forms now — it feels like a doc, not a database.",
    name: "Maya Krishnan",
    role: "Head of Ops, Northwind Studio",
    initials: "MK",
  },
  {
    quote:
      "Time-to-first-form is basically zero. I shared a working survey before I’d have finished configuring it anywhere else.",
    name: "Leo Barros",
    role: "Founder, Brightlabs",
    initials: "LB",
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-6 pb-10 pt-20 text-center md:pt-28">
          <span className="eyebrow">
            <Sparkles className="h-4 w-4" /> Now with AI form generation
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.03] tracking-tight text-ink md:text-6xl">
            Forms that feel like writing.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Frame turns a blank page into a working form. Type a question, hit
            “/” for anything else — logic, calculations, payments. No clutter.
            Just words on a page that collect answers.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/app" className="btn btn-primary btn-lg">
              Start for free — no card
            </Link>
            <Link href="/app" className="btn btn-outline btn-lg">
              <Play className="h-4 w-4" /> See a live demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Free forever plan · Unlimited forms · Set up in 60 seconds
          </p>
        </div>

        {/* Product mock */}
        <div className="mx-auto max-w-3xl px-6 pb-20">
          <div className="card-mkt overflow-hidden shadow-pop">
            <div className="flex items-center gap-1.5 border-b border-line bg-bg px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="ml-3 text-xs text-muted">
                frame.so/r/customer-feedback
              </span>
            </div>
            <div className="px-8 py-8">
              <h3 className="text-2xl font-bold tracking-tight">
                Customer feedback survey
              </h3>
              <p className="mt-1 text-sm text-muted">
                Help us improve — this takes about 2 minutes.
              </p>
              <div className="mt-6 rounded-xl border border-accent-weak bg-accent-weak/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-white text-accent-2">
                    <PenLine className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-semibold">
                    What&apos;s your name?
                  </span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-muted">
                  Type your answer…
                </div>
              </div>
              <div className="mt-3 space-y-2 px-1">
                <p className="text-sm font-semibold">
                  How would you rate your experience?
                </p>
                {["Excellent", "Good", "Could be better"].map((o) => (
                  <div
                    key={o}
                    className="flex items-center gap-2.5 text-sm text-ink/80"
                  >
                    <span className="h-4 w-4 rounded-full border border-line" />
                    {o}
                  </div>
                ))}
              </div>
              <button className="mt-6 btn btn-accent">
                Submit <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Logo cloud */}
      <section className="border-y border-line bg-surface py-12">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm text-muted">Trusted by 500,000+ teams</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 opacity-60">
            {["Northwind", "Brightlabs", "Fieldnotes", "Rakuto", "Glide", "Makeflow"].map(
              (b) => (
                <span
                  key={b}
                  className="text-lg font-bold tracking-tight text-ink/70"
                >
                  {b}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why Frame</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">
            Everything a form needs. Nothing it doesn&apos;t.
          </h2>
          <p className="mt-4 text-lg text-muted">
            The power of a heavy form builder, with the calm of a blank page.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card-mkt p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2">
                <f.icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-accent-2">
                {f.eyebrow}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">
              From idea to answers in three steps
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-line bg-bg p-7">
                <span className="absolute right-6 top-6 text-5xl font-bold text-line">
                  {i + 1}
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">
            Generous free plan. Fair paid plans.
          </h2>
          <p className="mt-4 text-lg text-muted">
            99% of features are free — including unlimited forms and responses.
            Pay only when you need branding, teams, or a custom domain.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-7 ${
                p.featured
                  ? "border-accent bg-gradient-to-b from-accent-weak to-surface shadow-pop"
                  : "border-line bg-surface shadow-soft"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {p.featured && (
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-3">
                <span className="text-4xl font-bold tracking-tight">
                  {p.price}
                </span>
                <span className="text-muted">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted">{p.note}</p>
              <Link
                href="/pricing"
                className={`btn mt-6 w-full ${p.featured ? "btn-accent" : "btn-outline"}`}
              >
                See what&apos;s included
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/pricing" className="font-semibold text-accent-2">
            Compare all plans →
          </Link>
        </p>
      </section>

      {/* Testimonials */}
      <section className="border-t border-line bg-surface py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.name} className="card-mkt p-8">
                <div className="mb-4 flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="text-lg leading-relaxed text-ink">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-weak text-sm font-semibold text-accent-2">
                    {t.initials}
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">
                      {t.name}
                    </span>
                    <span className="text-muted">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-white">
            Build your first form in 60 seconds
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            No credit card. No setup. Just start typing.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/app"
              className="btn btn-lg bg-white text-primary hover:opacity-90"
            >
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="btn btn-lg border border-white/25 text-white hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
            <Check className="h-4 w-4" /> Free forever · Unlimited forms &amp;
            responses
          </p>
        </div>
      </section>
    </main>
  );
}
