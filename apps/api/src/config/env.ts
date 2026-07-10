import "dotenv/config";
import { z } from "zod";

/**
 * Validated environment.
 *
 * Parsed once at boot so a misconfigured deploy fails fast with a clear,
 * actionable message instead of surfacing later as a confusing runtime error
 * (e.g. an unsigned JWT or a missing database). Import `env` anywhere you'd
 * otherwise reach for `process.env`.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required").default("dev-secret-change-me"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  // Public origin of the tenant web app — used to build invite/accept links.
  PUBLIC_TENANT_URL: z.string().url().default("http://localhost:3000"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  // Custom domains (Cloudflare SSL-for-SaaS). All optional — without them, the
  // domain flow falls back to a DNS (CNAME) verification the user sets up.
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  // The CNAME target customers point their domain at (e.g. "cname.frame.so").
  DOMAIN_CNAME_TARGET: z.string().default("cname.frame.so"),
  // Cloudflare Turnstile secret for spam protection. Without it, forms that
  // enable spam protection still submit (verification is skipped, not enforced).
  TURNSTILE_SECRET: z.string().optional(),
  // Resend transactional email. Without a key, emails are logged and skipped.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Frame <onboarding@resend.dev>"),
  // Stripe billing. Without keys, upgrades apply immediately in dev mode.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_BUSINESS: z.string().optional(),
  // Meilisearch for response search. Without it, search falls back to Postgres.
  MEILI_HOST: z.string().optional(),
  MEILI_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function load(): Env {
  // docker-compose substitutes unset interpolated vars with an empty string;
  // treat "" as absent so schema defaults apply instead of failing validation.
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== ""),
  );
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  const value = parsed.data;
  if (value.NODE_ENV === "production" && value.JWT_SECRET === "dev-secret-change-me") {
    // eslint-disable-next-line no-console
    console.error(
      "\n❌ JWT_SECRET is still the dev placeholder in production. Set a strong, random secret.\n",
    );
    process.exit(1);
  }
  return value;
}

export const env = load();
