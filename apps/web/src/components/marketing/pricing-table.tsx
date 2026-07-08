"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

type Plan = {
  name: string;
  monthly: number;
  tagline: string;
  cta: string;
  featured?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Free",
    monthly: 0,
    tagline: "Everything you need to start collecting.",
    cta: "Start for free",
    features: [
      "Unlimited forms & submissions",
      "Conditional logic & calculations",
      "Payments, signatures & file uploads",
      "45+ languages & RTL support",
      "Google Sheets, Notion, Slack, Zapier & webhooks",
      "Password protection & close on date/limit",
    ],
  },
  {
    name: "Pro",
    monthly: 24,
    tagline: "For creators and teams who go pro.",
    cta: "Upgrade to Pro",
    featured: true,
    features: [
      "Everything in Free, plus:",
      "Remove Frame branding",
      "Custom domains",
      "Unlimited team collaboration",
      "Partial submissions & drop-off analytics",
      "Custom CSS & link-preview control",
      "Version history (30 days)",
    ],
  },
  {
    name: "Business",
    monthly: 74,
    tagline: "For organizations with advanced needs.",
    cta: "Upgrade to Business",
    features: [
      "Everything in Pro, plus:",
      "Control data retention",
      "Email verification",
      "Version history (90 days)",
      "Priority support",
    ],
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(true);

  const priceFor = (monthly: number) => {
    if (monthly === 0) return "$0";
    // Annual = 2 months free -> monthly-equivalent
    const value = annual ? Math.round((monthly * 10) / 12) : monthly;
    return `$${value}`;
  };

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${annual ? "text-muted" : "text-ink"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setAnnual((a) => !a)}
          role="switch"
          aria-checked={annual}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            annual ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform ${
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${annual ? "text-ink" : "text-muted"}`}
        >
          Annual
        </span>
        <span className="rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent-2">
          2 months free
        </span>
      </div>

      {/* Plans */}
      <div className="mt-12 grid items-start gap-6 md:grid-cols-3">
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
            <p className="mt-1 text-sm text-muted">{p.tagline}</p>
            <p className="mt-5">
              <span className="text-4xl font-bold tracking-tight">
                {priceFor(p.monthly)}
              </span>
              <span className="text-muted">/mo</span>
            </p>
            <p className="mt-1 h-4 text-xs text-muted">
              {p.monthly > 0 && annual ? "billed annually" : " "}
            </p>
            <Link
              href="/app"
              className={`btn mt-5 w-full ${p.featured ? "btn-accent" : "btn-outline"}`}
            >
              {p.cta}
            </Link>
            <ul className="mt-7 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-accent-2" />
                  <span
                    className={
                      f.endsWith("plus:")
                        ? "font-semibold text-ink"
                        : "text-ink/80"
                    }
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
