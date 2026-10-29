// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listForms, login, TOKEN_KEY } from "./api";

// A stand-in location, so the redirect can be read instead of navigating jsdom.
const realLocation = window.location;
let location: { pathname: string; href: string };

function answer(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

beforeEach(() => {
  location = { pathname: "/app/forms", href: "http://localhost/app/forms" };
  Object.defineProperty(window, "location", { configurable: true, value: location });
  localStorage.clear();
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  vi.unstubAllGlobals();
});

describe("a 401 to a signed-in call", () => {
  it("clears the token and goes to sign-in, which says the session ended", async () => {
    localStorage.setItem(TOKEN_KEY, "old-token");
    answer(401, { message: "Unauthorized" });
    await expect(listForms()).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(location.href).toBe("/login?signedOut=1");
  });

  it("outside the app, clears the token but stays on the page", async () => {
    location.pathname = "/invite/abc";
    localStorage.setItem(TOKEN_KEY, "old-token");
    answer(401);
    await expect(listForms()).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(location.href).toBe("http://localhost/app/forms");
  });
});

describe("a 401 to a call without a token", () => {
  it("a wrong password doesn't redirect: the form shows the message", async () => {
    location.pathname = "/app";
    answer(401, { message: "Invalid email or password." });
    await expect(login("a@example.test", "wrong")).rejects.toThrow("Invalid email or password.");
    expect(location.href).toBe("http://localhost/app/forms");
  });
});
