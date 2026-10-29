import { describe, expect, it } from "vitest";
import { tokenRevoked } from "./auth.guard";
import { sessionsStart } from "./auth.service";

describe("tokenRevoked", () => {
  const from = new Date("2026-10-29T12:00:00.500Z");
  const ms = from.getTime();

  it("never revokes when sessionsValidFrom is null", () => {
    expect(tokenRevoked({ iat: 0 }, null)).toBe(false);
    expect(tokenRevoked({}, null)).toBe(false);
  });

  it("goes by issuedAtMs, to the millisecond", () => {
    expect(tokenRevoked({ issuedAtMs: ms - 1, iat: Math.floor(ms / 1000) }, from)).toBe(true);
    expect(tokenRevoked({ issuedAtMs: ms, iat: Math.floor(ms / 1000) }, from)).toBe(false);
    expect(tokenRevoked({ issuedAtMs: ms + 60_000 }, from)).toBe(false);
  });

  it("without issuedAtMs, goes by iat in seconds: earlier in the same second is revoked", () => {
    expect(tokenRevoked({ iat: Math.floor(ms / 1000) }, from)).toBe(true);
    expect(tokenRevoked({ iat: Math.floor(ms / 1000) + 1 }, from)).toBe(false);
  });

  it("revokes a token with no issue time once sessionsValidFrom is set", () => {
    expect(tokenRevoked({}, from)).toBe(true);
  });

  it("a token signed right after sessionsStart() is valid", () => {
    const start = sessionsStart();
    expect(tokenRevoked({ issuedAtMs: Date.now(), iat: Math.floor(Date.now() / 1000) }, start)).toBe(false);
  });
});
