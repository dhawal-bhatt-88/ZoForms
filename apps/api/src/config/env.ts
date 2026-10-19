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
});

type Env = z.infer<typeof EnvSchema>;

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
