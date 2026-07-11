import type { Metadata } from "next";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { Reveal } from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, generous pricing. Unlimited forms and responses on the free plan. Pro from $24/mo, Business from $74/mo.",
};

const faqs = [
  {
    q: "Is the free plan really free forever?",
    a: "Yes. You get unlimited forms and unlimited responses for free, within fair-use limits. About 99% of features are available on the free plan.",
  },
  {
    q: "What do I actually pay for?",
    a: "Paid plans unlock professionalization — removing branding, custom domains, team collaboration, deeper analytics, and data-retention controls. We never cap your responses to force an upgrade.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Absolutely. Upgrade, downgrade, or cancel at any time. Annual billing gives you two months free.",
  },
  {
    q: "Do you take a cut of payments I collect?",
    a: "No platform fee on payments — you connect your own Stripe account and keep what you collect (standard Stripe processing fees apply).",
  },
];

export default function PricingPage() {
  return (
    <main className="overflow-hidden">
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="mesh" aria-hidden />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h1 className="mt-5 text-balance text-5xl font-bold tracking-tight text-ink">
            Simple pricing that scales with you
          </h1>
          <p className="mt-4 text-lg text-muted">
            Start free with unlimited forms and responses. Upgrade only when you
            need branding, teams, or a custom domain.
          </p>
        </Reveal>

        <Reveal delay={120} className="relative mt-14">
          <PricingTable />
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-surface py-20">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <Faq items={faqs} />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
