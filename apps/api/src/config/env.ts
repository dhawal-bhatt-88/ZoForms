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
const DEV_JWT_SECRET = "dev-secret-change-me";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required").default(DEV_JWT_SECRET),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  // Extra comma-separated origins allowed by CORS (the deployment host + its
  // ports are always allowed automatically).
  CORS_ORIGINS: z.string().optional(),
  // Public origin of the tenant web app — used to build invite/accept links.
  PUBLIC_TENANT_URL: z.string().url().default("http://localhost:3000"),
  // Resend transactional email. Without a key, emails are logged and skipped.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Zowork Forms <onboarding@resend.dev>"),
  // Google sign-in — verifies the ID token audience. Without it, the /google
  // endpoint rejects and the web login hides the Google button.
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Test only: put verification and password reset links in API responses, so a
  // flow can be followed without an inbox. Never in production (boot refuses it).
  RETURN_EMAIL_LINKS_FOR_TESTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/** Secrets from this repo's own examples: public, so never good enough for production. */
const KNOWN_JWT_SECRETS = new Set([DEV_JWT_SECRET, "change-me-to-a-long-random-string"]);
const MIN_PRODUCTION_JWT_SECRET = 32;

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse an environment (process.env's shape) into `Env`, or the reasons it
 * can't start. Pure, so the rules can be tested without exiting the process.
 */
export function parseEnv(raw: Record<string, string | undefined>): { ok: true; value: Env } | { ok: false; errors: string[] } {
  // docker-compose substitutes unset interpolated vars with an empty string;
  // treat "" as absent so schema defaults apply instead of failing validation.
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ""));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const value = parsed.data;
  const errors: string[] = [];
  if (value.NODE_ENV === "production") {
    if (cleaned.JWT_SECRET === undefined) {
      errors.push("JWT_SECRET is required in production. Set a strong, random secret.");
    } else if (KNOWN_JWT_SECRETS.has(value.JWT_SECRET)) {
      errors.push("JWT_SECRET is a published example value. Set a strong, random secret.");
    } else if (value.JWT_SECRET.length < MIN_PRODUCTION_JWT_SECRET) {
      errors.push(`JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET} characters in production.`);
    }
    if (value.RETURN_EMAIL_LINKS_FOR_TESTS) {
      errors.push(
        "RETURN_EMAIL_LINKS_FOR_TESTS is on in production. It puts password reset and verification links in API responses. Remove it.",
      );
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function load(): Env {
  const result = parseEnv(process.env);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${result.errors.map((e) => `  - ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  return result.value;
}

export const env = load();
