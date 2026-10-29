import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AllExceptionsFilter } from "./all-exceptions.filter";

/** The JSON the filter answers with, for an exception thrown by a handler. */
function answer(exception: unknown) {
  let sent: { status?: number; body?: Record<string, unknown> } = {};
  const res = { status: (s: number) => ((sent.status = s), { json: (b: Record<string, unknown>) => (sent.body = b) }) };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: "PUT", url: "/v1/forms/f/schema" }) }) };
  new AllExceptionsFilter().catch(exception, host as never);
  return sent;
}

describe("AllExceptionsFilter", () => {
  it("keeps a conflict's code and the latest version the editor names", () => {
    const { status, body } = answer(new ConflictException({ message: "Saved elsewhere.", code: "VERSION_CONFLICT", latestVersion: 7 }));
    expect(status).toBe(409);
    expect(body).toMatchObject({ statusCode: 409, message: "Saved elsewhere.", code: "VERSION_CONFLICT", latestVersion: 7 });
  });

  it("adds no latestVersion when there is none", () => {
    expect(answer(new ConflictException({ message: "No changes to save.", code: "NO_CHANGES" })).body).not.toHaveProperty("latestVersion");
  });
});
