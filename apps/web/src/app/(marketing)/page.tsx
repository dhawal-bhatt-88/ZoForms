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
  X,
  Zap,
} from "lucide-react";
import { Counter, Reveal } from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Frame — Forms that feel like writing",
  description:
    "Frame turns a blank page into a working form. Type a question, add logic, publish, and collect answers. Free forever, unlimited forms.",
};

const stats = [
  { to: 500, suffix: "K+", label: "Teams building" },
  { to: 40, suffix: "M+", label: "Responses collected" },
  { to: 99.99, decimals: 2, suffix: "%", label: "Uptime SLA" },
  { to: 4.9, decimals: 1, suffix: "/5", label: "Average rating" },
];

const steps = [
  { icon: PenLine, title: "Write", body: "Start from a blank page or a template. Type a question, hit “/” for anything else." },
  { icon: Send, title: "Publish", body: "One click. Share a link, embed it on any site, or put it on your own domain." },
  { icon: Inbox, title: "Collect", body: "Watch responses roll in — with live analytics and instant notifications." },
];

const comparison = [
  ["Time to first form", "Hours of drag-and-drop", "Seconds — just start typing"],
  ["Logic & branching", "Locked behind add-ons", "Built in, no code"],
  ["Response limits", "Capped to force upgrades", "Unlimited, free forever"],
  ["Analytics", "Export to a spreadsheet", "Live funnel & drop-off"],
  ["Design control", "Rigid templates", "Colors, fonts, custom CSS"],
];

const security = [
  { icon: ShieldCheck, title: "SOC 2 Type II", body: "Independently audited controls across security, availability, and confidentiality." },
  { icon: Lock, title: "GDPR & encryption", body: "EU data residency, encryption at rest and in transit, and signed webhooks by default." },
  { icon: Users, title: "SSO & roles", body: "SAML single sign-on, SCIM provisioning, and granular role-based access for your org." },
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

const logos = ["Northwind", "Brightlabs", "Fieldnotes", "Rakuto", "Glide", "Makeflow", "Airspace", "Lumen"];
const integrations = ["Google Sheets", "Slack", "Notion", "Airtable", "Zapier", "Webhooks", "Stripe", "HubSpot", "Make", "Mailchimp"];

export default function LandingPage() {
  return (
    <main className="overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative">
        <div className="mesh" aria-hidden />
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_50%_at_50%_0%,#000,transparent)]" aria-hidden />

        {/* floating chips */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <div className="glass float absolute left-[8%] top-40 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-medium shadow-soft">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-green/10 text-green"><Check className="h-3.5 w-3.5" /></span>
            New response
          </div>
          <div className="glass float-slow absolute right-[9%] top-52 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-medium shadow-soft">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-weak text-accent-2"><Sparkles className="h-3.5 w-3.5" /></span>
            Generated with AI
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-20 text-center md:pt-28">
          <Reveal>
            <Link href="/#features" className="eyebrow transition-colors hover:border-accent/40">
              <Sparkles className="h-4 w-4" /> Now with AI form generation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.03] tracking-tight text-ink md:text-[68px]">
              Forms that feel like <span className="gradient-text">writing.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
              Frame turns a blank page into a working form. Type a question, hit
              “/” for anything else — logic, calculations, payments. No clutter.
              Just words on a page that collect answers.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn btn-dark btn-shine btn-lg w-full transition-transform hover:-translate-y-0.5 sm:w-auto">
                Start for free — no card
              </Link>
              <Link href="/app" className="btn btn-outline btn-lg w-full transition-transform hover:-translate-y-0.5 sm:w-auto">
                <Play className="h-4 w-4" /> See a live demo
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
              <div className="flex -space-x-2">
                {["#6D5EFA", "#159C56", "#C4790B", "#DC4B47", "#3B3F47"].map((c, i) => (
                  <span key={i} className="h-8 w-8 rounded-full border-2 border-bg" style={{ background: c }} />
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
          </Reveal>
        </div>

        {/* Product mock */}
        <Reveal delay={200} y={28}>
          <div className="relative mx-auto max-w-3xl px-6 pb-20">
            <div className="card-mkt float-slow overflow-hidden shadow-pop">
              <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
                <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
                <span className="h-3 w-3 rounded-full bg-[#e0e2e7]" />
                <span className="ml-3 rounded-md bg-bg px-2 py-0.5 text-xs text-muted">frame.so/r/customer-feedback</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                  </span>
                  Live
                </span>
              </div>
              <div className="px-8 py-8">
                <h3 className="text-2xl font-bold tracking-tight">Customer feedback survey</h3>
                <p className="mt-1 text-sm text-muted">Help us improve — this takes about 2 minutes.</p>
                <div className="mt-6 rounded-xl border border-accent-weak bg-accent-weak/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded bg-white text-accent-2"><PenLine className="h-3 w-3" /></span>
                    <span className="text-sm font-semibold">What&apos;s your name?</span>
                  </div>
                  <div className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-muted">Type your answer…</div>
                </div>
                <div className="mt-3 space-y-2 px-1">
                  <p className="text-sm font-semibold">How would you rate your experience?</p>
                  {["Excellent", "Good", "Could be better"].map((o, i) => (
                    <div key={o} className="flex items-center gap-2.5 text-sm text-ink/80">
                      <span className={`grid h-4 w-4 place-items-center rounded-full border ${i === 0 ? "border-accent bg-accent" : "border-line"}`}>
                        {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {o}
                    </div>
                  ))}
                </div>
                <button className="btn btn-accent mt-6">Submit <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ LOGO MARQUEE ============ */}
      <section className="border-y border-line bg-surface py-12">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-sm font-medium text-muted">Trusted by high-growth teams and enterprises alike</p>
          <div className="fade-x mt-7 overflow-hidden">
            <div className="marquee flex w-max items-center gap-14">
              {[...logos, ...logos].map((b, i) => (
                <span key={i} className="whitespace-nowrap text-lg font-bold tracking-tight text-ink/30 transition-colors hover:text-ink/60">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="text-center">
              <p className="text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
                <Counter to={s.to} suffix={s.suffix} decimals={s.decimals} />
              </p>
              <p className="mt-1.5 text-sm text-muted">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ BENTO FEATURES ============ */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why Frame</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-[42px]">Everything a form needs. Nothing it doesn&apos;t.</h2>
          <p className="mt-4 text-lg text-muted">The power of a heavy form builder, with the calm of a blank page.</p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-6">
          {/* Editor — large */}
          <Reveal className="md:col-span-4">
            <article className="card-mkt card-lift group h-full overflow-hidden p-8 hover:border-line-2 hover:shadow-pop">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform duration-300 group-hover:scale-110">
                <PenLine className="h-5 w-5" />
              </span>
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-accent-2">Document editor</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">Build forms like you write a doc</h3>
              <p className="mt-2 max-w-md leading-relaxed text-muted">
                Type naturally and hit “/” to drop in any question — short answer, rating, payment. No drag-and-drop maze.
              </p>
              {/* mini slash-menu illustration */}
              <div className="mt-6 rounded-xl border border-line bg-surface-2 p-3">
                <div className="flex items-center gap-2 text-sm text-faint">
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-line-2 text-muted">+</span>
                  <span className="font-mono">/rating</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {[["Short answer", true], ["Rating"], ["Multiple choice"], ["Payment"]].map(([label, active], i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${active ? "bg-accent-weak text-accent-2" : "text-ink-2 group-hover:bg-white"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      {label as string}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </Reveal>

          {/* AI */}
          <Reveal delay={80} className="md:col-span-2">
            <article className="card-mkt card-lift group relative h-full overflow-hidden p-8 hover:border-line-2 hover:shadow-pop">
              <div className="glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform duration-300 group-hover:scale-110">
                <Sparkles className="h-5 w-5" />
              </span>
              <h3 className="relative mt-5 text-lg font-semibold tracking-tight">Generate with AI</h3>
              <p className="relative mt-2 leading-relaxed text-muted">Describe your form and let Claude draft the questions in seconds.</p>
            </article>
          </Reveal>

          {/* Logic */}
          <Reveal className="md:col-span-2">
            <article className="card-mkt card-lift group h-full p-8 hover:border-line-2 hover:shadow-pop">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform duration-300 group-hover:scale-110">
                <GitBranch className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">Logic & calculations</h3>
              <p className="mt-2 leading-relaxed text-muted">Show, hide, jump, score, and pipe answers — all without code.</p>
            </article>
          </Reveal>

          {/* Analytics with sparkline */}
          <Reveal delay={80} className="md:col-span-2">
            <article className="card-mkt card-lift group h-full p-8 hover:border-line-2 hover:shadow-pop">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform duration-300 group-hover:scale-110">
                <BarChart3 className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">Live analytics</h3>
              <p className="mt-2 leading-relaxed text-muted">Views, starts, and completion — with a live funnel.</p>
              <svg viewBox="0 0 120 34" className="mt-4 h-9 w-full" aria-hidden>
                <polyline points="0,28 20,22 40,25 60,14 80,17 100,7 120,3" fill="none" stroke="#6D5EFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="120" cy="3" r="3" fill="#6D5EFA" />
              </svg>
            </article>
          </Reveal>

          {/* Integrations */}
          <Reveal className="md:col-span-2">
            <article className="card-mkt card-lift group h-full p-8 hover:border-line-2 hover:shadow-pop">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-weak text-accent-2 transition-transform duration-300 group-hover:scale-110">
                <Puzzle className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">Integrations</h3>
              <p className="mt-2 leading-relaxed text-muted">Pipe responses to Sheets, Slack, Notion, and 30+ tools.</p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS — timeline ============ */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">From idea to answers in three steps</h2>
        </Reveal>
        <div className="relative mt-14">
          <div className="absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-transparent via-line-2 to-transparent md:block" aria-hidden />
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120} className="relative text-center">
                <span className="relative z-[1] mx-auto grid h-[68px] w-[68px] place-items-center rounded-2xl border border-line bg-surface text-accent-2 shadow-soft transition-transform hover:-translate-y-1">
                  <s.icon className="h-6 w-6" />
                  <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-muted">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COMPARISON ============ */}
      <section className="border-y border-line bg-surface py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">The Frame difference</span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Why teams switch — and stay</h2>
          </Reveal>
          <Reveal delay={100} className="mt-12 overflow-hidden rounded-2xl border border-line bg-bg shadow-soft">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-line bg-surface-2 text-sm font-semibold">
              <div className="px-5 py-4 text-muted" />
              <div className="px-5 py-4 text-muted">The old way</div>
              <div className="flex items-center gap-1.5 px-5 py-4 text-accent-2">
                <LogoDot /> Frame
              </div>
            </div>
            {comparison.map(([label, old, frame], i) => (
              <div key={label} className={`grid grid-cols-[1.2fr_1fr_1fr] items-center text-sm ${i % 2 ? "bg-surface/50" : ""}`}>
                <div className="px-5 py-4 font-medium text-ink">{label}</div>
                <div className="flex items-center gap-2 px-5 py-4 text-muted">
                  <X className="h-4 w-4 flex-none text-red/70" /> {old}
                </div>
                <div className="flex items-center gap-2 px-5 py-4 font-medium text-ink">
                  <Check className="h-4 w-4 flex-none text-green" /> {frame}
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ INTEGRATIONS marquee ============ */}
      <section id="integrations" className="mx-auto max-w-6xl px-6 py-20 text-center">
        <Reveal>
          <span className="eyebrow"><Zap className="h-4 w-4" /> Integrations</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Connects to the tools you already run on</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">Push every response straight into your stack — automatically, in real time.</p>
        </Reveal>
        <Reveal delay={100} className="fade-x mt-10 overflow-hidden">
          <div className="marquee flex w-max items-center gap-3">
            {[...integrations, ...integrations].map((name, i) => (
              <span key={i} className="whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 shadow-soft transition-colors hover:border-accent/40 hover:text-ink">
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ SECURITY (dark) ============ */}
      <section id="security" className="relative overflow-hidden border-y border-line bg-primary py-24 text-white">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/90">
              <ShieldCheck className="h-4 w-4" /> Enterprise-grade
            </span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Security your compliance team will sign off on</h2>
            <p className="mt-4 text-lg text-white/60">Built for regulated industries — with the certifications, controls, and access management enterprises require.</p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {security.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="card-lift h-full rounded-2xl border border-white/10 bg-white/[0.04] p-7 hover:border-white/20 hover:bg-white/[0.07]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white"><s.icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-white/60">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-white/50">
            {["SOC 2 Type II", "GDPR", "CCPA", "SAML SSO", "SCIM", "HIPAA-ready"].map((b) => (
              <span key={b} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-white/70" /> {b}</span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section id="customers" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Customers</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">Teams ship faster with Frame</h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <figure className="card-mkt card-lift flex h-full flex-col p-8 hover:border-line-2 hover:shadow-pop">
                <div className="mb-4 flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, k) => (<Star key={k} className="h-4 w-4 fill-current" />))}
                </div>
                <blockquote className="flex-1 leading-relaxed text-ink">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: t.color }}>{t.initials}</span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{t.name}</span>
                    <span className="text-muted">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ PRICING PREVIEW ============ */}
      <section className="border-t border-line bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Pricing</span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Generous free plan. Fair paid plans.</h2>
            <p className="mt-4 text-lg text-muted">99% of features are free — including unlimited forms and responses. Pay only when you need branding, teams, or a custom domain.</p>
          </Reveal>
          <div className="mt-14 grid items-start gap-6 md:grid-cols-3">
            {plans.map((p, i) => (
              <Reveal key={p.name} delay={i * 90}>
                <div className={`card-lift rounded-2xl border p-7 ${p.featured ? "relative border-accent bg-gradient-to-b from-accent-weak to-surface shadow-pop md:-translate-y-2" : "border-line bg-bg shadow-soft hover:border-line-2 hover:shadow-pop"}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {p.featured && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">Popular</span>}
                  </div>
                  <p className="mt-3"><span className="text-4xl font-bold tracking-tight">{p.price}</span><span className="text-muted">/mo</span></p>
                  <p className="mt-2 text-sm text-muted">{p.note}</p>
                  <Link href="/pricing" className={`btn mt-6 w-full transition-transform hover:-translate-y-0.5 ${p.featured ? "btn-accent btn-shine" : "btn-outline"}`}>See what&apos;s included</Link>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            <Link href="/pricing" className="font-semibold text-accent-2 hover:underline">Compare all plans →</Link>
          </p>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal y={28}>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center">
            <div className="mesh opacity-70" aria-hidden />
            <div className="grid-lines pointer-events-none absolute inset-0 opacity-[0.1]" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-white md:text-5xl">Build your first form in 60 seconds</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/70">No credit card. No setup. Just start typing.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/signup" className="btn btn-shine btn-lg w-full bg-white text-primary transition-transform hover:-translate-y-0.5 hover:opacity-95 sm:w-auto">Start for free <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/pricing" className="btn btn-lg w-full border border-white/25 text-white transition-colors hover:bg-white/10 sm:w-auto">View pricing</Link>
              </div>
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60"><Check className="h-4 w-4" /> Free forever · Unlimited forms &amp; responses</p>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function LogoDot() {
  return <span className="inline-block h-3.5 w-3.5 rounded-[4px] bg-gradient-to-br from-[#7C6BFF] to-[#5546E6]" />;
}
