import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const STRONG = "x".repeat(32);
const base = { DATABASE_URL: "postgresql://localhost/test" };
const prod = (extra: Record<string, string | undefined>) => parseEnv({ ...base, NODE_ENV: "production", ...extra });
const errors = (r: ReturnType<typeof parseEnv>) => (r.ok ? [] : r.errors);

describe("JWT_SECRET in production", () => {
  it("is required: unset or empty refuses to start", () => {
    expect(errors(prod({}))).toEqual(["JWT_SECRET is required in production. Set a strong, random secret."]);
    expect(errors(prod({ JWT_SECRET: "" }))).toEqual(["JWT_SECRET is required in production. Set a strong, random secret."]);
  });

  it("refuses the published example values, whatever their length", () => {
    for (const s of ["dev-secret-change-me", "change-me-to-a-long-random-string"]) {
      expect(errors(prod({ JWT_SECRET: s }))).toEqual(["JWT_SECRET is a published example value. Set a strong, random secret."]);
    }
  });

  it("must be at least 32 characters", () => {
    expect(errors(prod({ JWT_SECRET: "a" }))).toEqual(["JWT_SECRET must be at least 32 characters in production."]);
    expect(errors(prod({ JWT_SECRET: "x".repeat(31) }))).toEqual(["JWT_SECRET must be at least 32 characters in production."]);
    expect(prod({ JWT_SECRET: STRONG }).ok).toBe(true);
  });

  it("outside production, the dev default still applies", () => {
    const r = parseEnv(base);
    expect(r.ok && r.value.JWT_SECRET).toBe("dev-secret-change-me");
  });
});

describe("RETURN_EMAIL_LINKS_FOR_TESTS", () => {
  it("is off unless set to true", () => {
    const r = parseEnv(base);
    expect(r.ok && r.value.RETURN_EMAIL_LINKS_FOR_TESTS).toBe(false);
    const on = parseEnv({ ...base, RETURN_EMAIL_LINKS_FOR_TESTS: "true" });
    expect(on.ok && on.value.RETURN_EMAIL_LINKS_FOR_TESTS).toBe(true);
  });

  it("refuses to start in production when it is on", () => {
    expect(errors(prod({ JWT_SECRET: STRONG, RETURN_EMAIL_LINKS_FOR_TESTS: "true" }))).toEqual([
      "RETURN_EMAIL_LINKS_FOR_TESTS is on in production. It puts password reset and verification links in API responses. Remove it.",
    ]);
    expect(prod({ JWT_SECRET: STRONG, RETURN_EMAIL_LINKS_FOR_TESTS: "false" }).ok).toBe(true);
  });

  it("accepts only true or false", () => {
    expect(parseEnv({ ...base, RETURN_EMAIL_LINKS_FOR_TESTS: "yes" }).ok).toBe(false);
  });
});
