import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Check,
  GitBranch,
  Inbox,
  Lock,
  PenLine,
  Play,
  Puzzle,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Frame — Forms that feel like writing",
  description:
    "Frame turns a blank page into a working form. Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
};

const stats = [
  { value: "500K+", label: "Teams building" },
  { value: "40M+", label: "Responses collected" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "4.9/5", label: "Average rating" },
];

const features = [
  {
    icon: PenLine,
    eyebrow: "Document editor",
    title: "Build forms like you write a doc",
    body: "Type naturally and hit “/” to drop in any question — short answer, multiple choice, rating, payment. No drag-and-drop maze. Just words on a page that collect answers.",
  },
  {
    icon: GitBranch,
    eyebrow: "Logic & calculations",
    title: "Ask the right question every time",
    body: "Show, hide, and jump between questions based on answers. Score quizzes, run calculations, and pipe earlier answers into later questions — all without code.",
  },
  {
    icon: Puzzle,
    eyebrow: "Integrations",
    title: "Send responses where they belong",
    body: "Pipe submissions into Sheets, Notion, Slack, Airtable, or 30+ tools via Zapier and webhooks. Set it once and never copy-paste a response again.",
  },
  {
    icon: BarChart3,
    eyebrow: "Analytics",
    title: "See what's working, instantly",
    body: "Track views, starts, and completion rate with a live funnel and 14-day trends. Break down by device and source — no spreadsheet gymnastics.",
  },
];

const integrations = [
  "Google Sheets",
  "Slack",
  "Notion",
  "Airtable",
  "Zapier",
  "Webhooks",
  "Stripe",
  "HubSpot",
  "Make",
  "Mailchimp",
];

const steps = [
  { icon: PenLine, title: "Write", body: "Start from a blank page or a template. Type your questions." },
  { icon: Send, title: "Publish", body: "One click. Share a link, embed it, or put it on your domain." },
  { icon: Inbox, title: "Collect", body: "Watch responses roll in, with analytics and instant notifications." },
];

const security = [
  { icon: ShieldCheck, title: "SOC 2 Type II", body: "Independently audited controls across security, availability, and confidentiality." },
  { icon: Lock, title: "GDPR & encryption", body: "EU data residency, encryption at rest and in transit, and signed webhooks by default." },
  { icon: Users, title: "SSO & roles", body: "SAML single sign-on, SCIM provisioning, and granular role-based access for your whole org." },
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
    color: "#6D5EFA",
  },
  {
    quote:
      "Time-to-first-form is basically zero. I shared a working survey before I'd have finished configuring it anywhere else.",
    name: "Leo Barros",
    role: "Founder, Brightlabs",
    initials: "LB",
    color: "#159C56",
  },
  {
    quote:
      "The logic engine and analytics gave us everything our enterprise vendor did, at a tenth of the cost and none of the friction.",
    name: "Priya Nair",
    role: "VP Product, Rakuto",
    initials: "PN",
    color: "#C4790B",
  },
];

const logos = ["Northwind", "Brightlabs", "Fieldnotes", "Rakuto", "Glide", "Makeflow"];

export default function LandingPage() {
  return (
    <main className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-20 text-center md:pt-28">
          <span className="eyebrow">
            <Sparkles className="h-4 w-4" /> Now with AI form generation
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold leading-[1.03] tracking-tight text-ink md:text-[68px]">
            Forms that feel like <span className="gradient-text">writing.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
            Frame turns a blank page into a working form. Type a question, hit
            “/” for anything else — logic, calculations, payments. No clutter.
            Just words on a page that collect answers.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-dark btn-lg w-full sm:w-auto">
              Start for free — no card
            </Link>
            <Link href="/app" className="btn btn-outline btn-lg w-full sm:w-auto">
              <Play className="h-4 w-4" /> See a live demo
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <div className="flex -space-x-2">
              {["#6D5EFA", "#159C56", "#C4790B", "#DC4B47", "#3B3F47"].map((c, i) => (
                <span
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-bg"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </span>
              Loved by <span className="font-semibold text-ink">500,000+</span> teams
            </div>
          </div>
        </div>

        {/* Product mock */}
        <div className="relative mx-auto max-w-3xl px-6 pb-20">
          <div className="card-mkt overflow-hidden shadow-pop">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
              <span className="ml-3 rounded-md bg-bg px-2 py-0.5 text-xs text-muted">
                frame.so/r/customer-feedback
              </span>
            </div>
            <div className="px-8 py-8">
              <h3 className="text-2xl font-bold tracking-tight">Customer feedback survey</h3>
              <p className="mt-1 text-sm text-muted">Help us improve — this takes about 2 minutes.</p>
              <div className="mt-6 rounded-xl border border-accent-weak bg-accent-weak/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-white text-accent-2">
                    <PenLine className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-semibold">What&apos;s your name?</span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-muted">
                  Type your answer…
                </div>
              </div>
              <div className="mt-3 space-y-2 px-1">
                <p className="text-sm font-semibold">How would you rate your experience?</p>
                {["Excellent", "Good", "Could be better"].map((o) => (
                  <div key={o} className="flex items-center gap-2.5 text-sm text-ink/80">
                    <span className="h-4 w-4 rounded-full border border-line" />
                    {o}
                  </div>
                ))}
              </div>
              <button className="btn btn-accent mt-6">
                Submit <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Logo cloud */}
      <section className="border-y border-line bg-surface py-12">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm font-medium text-muted">
            Trusted by high-growth teams and enterprises alike
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
            {logos.map((b) => (
              <span key={b} className="text-lg font-bold tracking-tight text-ink/40">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
                {s.value}
              </p>
              <p className="mt-1.5 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why Frame</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-[42px]">
            Everything a form needs. Nothing it doesn&apos;t.
          </h2>
          <p className="mt-4 text-lg text-muted">
            The power of a heavy form builder, with the calm of a blank page.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-mkt group p-7 transition-shadow hover:shadow-pop"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-accent-2">
                {f.eyebrow}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="border-y border-line bg-surface py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <span className="eyebrow">
            <Zap className="h-4 w-4" /> Integrations
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Connects to the tools you already run on
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Push every response straight into your stack — automatically, in real time.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {integrations.map((name) => (
              <span
                key={name}
                className="rounded-full border border-line bg-bg px-4 py-2 text-sm font-medium text-ink-2 shadow-soft"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">
            From idea to answers in three steps
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-line bg-surface p-7 shadow-soft">
              <span className="absolute right-6 top-6 text-5xl font-extrabold text-line-2">
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
      </section>

      {/* Security & compliance */}
      <section id="security" className="border-y border-line bg-primary py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/90">
              <ShieldCheck className="h-4 w-4" /> Enterprise-grade
            </span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">
              Security your compliance team will sign off on
            </h2>
            <p className="mt-4 text-lg text-white/60">
              Built for regulated industries — with the certifications, controls, and
              access management enterprises require.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {security.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-white/50">
            {["SOC 2 Type II", "GDPR", "CCPA", "SAML SSO", "SCIM", "HIPAA-ready"].map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-white/70" /> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="customers" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Customers</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">
            Teams ship faster with Frame
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="card-mkt flex flex-col p-8">
              <div className="mb-4 flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 leading-relaxed text-ink">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white"
                  style={{ background: t.color }}
                >
                  {t.initials}
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-ink">{t.name}</span>
                  <span className="text-muted">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-t border-line bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6">
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
                    : "border-line bg-bg shadow-soft"
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
                  <span className="text-4xl font-bold tracking-tight">{p.price}</span>
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
            <Link href="/pricing" className="font-semibold text-accent-2 hover:underline">
              Compare all plans →
            </Link>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="glow relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.15]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-white md:text-5xl">
              Build your first form in 60 seconds
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              No credit card. No setup. Just start typing.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn btn-lg w-full bg-white text-primary hover:opacity-90 sm:w-auto">
                Start for free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="btn btn-lg w-full border border-white/25 text-white hover:bg-white/10 sm:w-auto"
              >
                View pricing
              </Link>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
              <Check className="h-4 w-4" /> Free forever · Unlimited forms &amp; responses
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
