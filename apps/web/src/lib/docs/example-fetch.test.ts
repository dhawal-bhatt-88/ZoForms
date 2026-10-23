// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_ENDPOINT_PREFIX, SHIM_MARK, registerExampleEndpoint } from "./example-fetch";

/*
 * The stand-in endpoint must only ever answer its own path, exist only while
 * an example is registered, and leave fetch exactly as it found it.
 */

const real = vi.fn(async () => new Response("from the network"));
const path = (name: string) => `${EXAMPLE_ENDPOINT_PREFIX}${name}`;

beforeEach(() => {
  real.mockClear();
  window.fetch = real as unknown as typeof fetch;
});
afterEach(() => {
  window.fetch = real as unknown as typeof fetch;
});

describe("registerExampleEndpoint", () => {
  it("answers its own path and passes everything else to the real fetch", async () => {
    const handler = vi.fn(() => new Response("handled"));
    const remove = registerExampleEndpoint(path("a"), handler);

    expect(await (await fetch(path("a"), { method: "POST", body: '{"x":1}' })).text()).toBe("handled");
    expect(handler).toHaveBeenCalledWith('{"x":1}');
    expect(real).not.toHaveBeenCalled();

    expect(await (await fetch("/docs/llms.txt")).text()).toBe("from the network");
    expect(await (await fetch(`${path("a")}/more`)).text()).toBe("from the network");
    expect(await (await fetch(`https://elsewhere.example${path("a")}`)).text()).toBe("from the network");
    expect(real).toHaveBeenCalledTimes(3);
    remove();
  });

  it("wraps fetch only while an example is registered", () => {
    expect(SHIM_MARK in window.fetch).toBe(false);
    const removeA = registerExampleEndpoint(path("a"), () => new Response());
    const removeB = registerExampleEndpoint(path("b"), () => new Response());
    expect(SHIM_MARK in window.fetch).toBe(true);
    removeA();
    expect(SHIM_MARK in window.fetch).toBe(true);
    removeB();
    expect(window.fetch).toBe(real);
  });

  it("leaves a fetch that something else wrapped later in place", async () => {
    const remove = registerExampleEndpoint(path("a"), () => new Response("handled"));
    const theirs = window.fetch;
    const later = vi.fn((input: RequestInfo | URL, init?: RequestInit) => theirs(input, init));
    window.fetch = later as unknown as typeof fetch;
    remove();
    expect(window.fetch).toBe(later);
    expect(await (await fetch(path("a"))).text()).toBe("from the network");
  });

  it("refuses a path outside the reserved prefix, or one already taken", () => {
    expect(() => registerExampleEndpoint("/api/submit", () => new Response())).toThrow(EXAMPLE_ENDPOINT_PREFIX);
    const remove = registerExampleEndpoint(path("a"), () => new Response());
    expect(() => registerExampleEndpoint(path("a"), () => new Response())).toThrow("already has a handler");
    remove();
  });
});
