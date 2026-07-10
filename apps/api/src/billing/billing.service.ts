import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../config/env";
import { PLANS, Plan, planForPrice, planOf, priceForPlan } from "./plans";
import type { AuthUser } from "../auth/current-user.decorator";

@Injectable()
export class BillingService {
  private readonly logger = new Logger("Billing");
  private readonly stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY)
    : null;

  constructor(private readonly prisma: PrismaService) {}

  get managed() {
    return !!this.stripe;
  }

  async summary(user: AuthUser) {
    const org = await this.org(user.orgId);
    const forms = await this.prisma.form.count({
      where: { workspace: { orgId: user.orgId } },
    });
    return {
      plan: org.plan,
      managed: this.managed,
      usage: { forms },
      plans: Object.values(PLANS),
    };
  }

  /** Start an upgrade. With Stripe → a Checkout URL; without → applied in dev mode. */
  async checkout(user: AuthUser, target: string) {
    await this.assertManager(user);
    if (target !== "pro" && target !== "business") {
      throw new BadRequestException("Choose the Pro or Business plan.");
    }
    const plan = target as Plan;
    const org = await this.org(user.orgId);

    if (!this.stripe) {
      // Dev mode: no Stripe configured — apply the plan immediately so gating
      // and the UI can be exercised end-to-end.
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { plan },
      });
      return { devMode: true, plan };
    }

    const price = priceForPlan(plan);
    if (!price) throw new BadRequestException(`No Stripe price configured for ${plan}.`);

    const customerId = await this.ensureCustomer(org.id, org.stripeCustomerId, user.email);
    const base = env.PUBLIC_TENANT_URL.replace(/\/$/, "");
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}/app/billing?upgraded=1`,
      cancel_url: `${base}/app/billing`,
      metadata: { orgId: org.id, plan },
      subscription_data: { metadata: { orgId: org.id, plan } },
    });
    return { url: session.url };
  }

  /** Stripe customer portal for managing/cancelling a subscription. */
  async portal(user: AuthUser) {
    await this.assertManager(user);
    const org = await this.org(user.orgId);
    if (!this.stripe || !org.stripeCustomerId) {
      throw new BadRequestException("Billing management isn't available yet.");
    }
    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${env.PUBLIC_TENANT_URL.replace(/\/$/, "")}/app/billing`,
    });
    return { url: session.url };
  }

  /** Handle a Stripe webhook: keep org.plan in sync with the subscription. */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.stripe || !env.STRIPE_WEBHOOK_SECRET) return { received: true };
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature ?? "",
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (e) {
      throw new BadRequestException(`Webhook signature failed: ${(e as Error).message}`);
    }

    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.metadata?.orgId;
      const plan = (s.metadata?.plan as Plan) || "pro";
      if (orgId) {
        await this.prisma.organization.update({
          where: { id: orgId },
          data: {
            plan,
            stripeCustomerId: (s.customer as string) ?? undefined,
            stripeSubId: (s.subscription as string) ?? undefined,
          },
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      const active = sub.status === "active" || sub.status === "trialing";
      const plan =
        event.type === "customer.subscription.deleted" || !active
          ? "free"
          : planForPrice(sub.items.data[0]?.price?.id) ?? "pro";
      if (orgId) {
        await this.prisma.organization.update({ where: { id: orgId }, data: { plan } });
      }
    }
    return { received: true };
  }

  /* ---------- helpers ---------- */

  private async ensureCustomer(
    orgId: string,
    existing: string | null,
    email: string,
  ): Promise<string> {
    if (existing) return existing;
    const customer = await this.stripe!.customers.create({
      email,
      metadata: { orgId },
    });
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private async org(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new BadRequestException("Organization not found");
    return org;
  }

  private async assertManager(user: AuthUser) {
    const m = await this.prisma.membership.findFirst({
      where: { orgId: user.orgId, userId: user.sub },
      select: { role: true },
    });
    if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
      throw new ForbiddenException("Only owners and admins can manage billing.");
    }
  }
}

/** Shared plan-gate: throw if the org is at its form limit. */
export async function assertFormQuota(
  prisma: PrismaService,
  orgId: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const limit = planOf(org?.plan).maxForms;
  if (limit === null) return;
  const count = await prisma.form.count({ where: { workspace: { orgId } } });
  if (count >= limit) {
    throw new ForbiddenException(
      `Your ${planOf(org?.plan).name} plan is limited to ${limit} forms. Upgrade to add more.`,
    );
  }
}

/** Shared plan-gate: throw if a feature isn't included in the org's plan. */
export async function assertFeature(
  prisma: PrismaService,
  orgId: string,
  feature: "customDomains" | "removeBranding",
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  if (!planOf(org?.plan)[feature]) {
    throw new ForbiddenException(
      `${planOf(org?.plan).name} plan doesn't include this. Upgrade to Pro or Business.`,
    );
  }
}
