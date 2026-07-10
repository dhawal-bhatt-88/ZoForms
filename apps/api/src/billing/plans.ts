import { env } from "../config/env";

export type Plan = "free" | "pro" | "business";

export type PlanDef = {
  id: Plan;
  name: string;
  price: number; // USD / month
  /** null = unlimited */
  maxForms: number | null;
  customDomains: boolean;
  removeBranding: boolean;
  features: string[];
};

export const PLANS: Record<Plan, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    maxForms: 3,
    customDomains: false,
    removeBranding: false,
    features: ["Up to 3 forms", "Unlimited responses", "Core blocks & logic"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 29,
    maxForms: 50,
    customDomains: true,
    removeBranding: true,
    features: ["Up to 50 forms", "Custom domains", "Remove Frame branding", "Email notifications"],
  },
  business: {
    id: "business",
    name: "Business",
    price: 99,
    maxForms: null,
    customDomains: true,
    removeBranding: true,
    features: ["Unlimited forms", "Everything in Pro", "Priority support", "Team roles & SSO-ready"],
  },
};

export function planOf(plan: string | null | undefined): PlanDef {
  return PLANS[(plan as Plan) ?? "free"] ?? PLANS.free;
}

/** Map a Stripe price id back to a plan (for webhook sync). */
export function planForPrice(priceId: string | undefined): Plan | null {
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}

export function priceForPlan(plan: Plan): string | undefined {
  if (plan === "pro") return env.STRIPE_PRICE_PRO;
  if (plan === "business") return env.STRIPE_PRICE_BUSINESS;
  return undefined;
}
