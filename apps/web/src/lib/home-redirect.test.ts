import { describe, expect, it, vi } from "vitest";
import { HOME_REDIRECT_SCRIPT } from "./home-redirect";

/** Runs the script against a stand-in `location`, `localStorage` and `document`. */
function run(pathname: string, getItem: (key: string) => string | null) {
  const replace = vi.fn();
  const setAttribute = vi.fn();
  new Function("location", "localStorage", "document", HOME_REDIRECT_SCRIPT)(
    { pathname, replace },
    { getItem },
    { documentElement: { setAttribute } },
  );
  return Object.assign(replace, { marked: setAttribute });
}

describe("HOME_REDIRECT_SCRIPT", () => {
  it("sends a visitor holding a token from `/` to `/app`", () => {
    const getItem = vi.fn(() => "a-token");
    expect(run("/", getItem)).toHaveBeenCalledWith("/app");
    expect(getItem).toHaveBeenCalledWith("frame_token");
  });

  it("leaves a visitor without a token on `/`", () => {
    expect(run("/", () => null)).not.toHaveBeenCalled();
  });

  it("does nothing on any other page, token or not", () => {
    for (const path of ["/login", "/signup", "/docs", "/app"]) {
      expect(run(path, () => "a-token")).not.toHaveBeenCalled();
    }
  });

  it("marks <html> signed in on every page while a token is held, and only then", () => {
    for (const path of ["/", "/docs", "/docs/integrate/quickstart", "/app"]) {
      expect(run(path, () => "a-token").marked).toHaveBeenCalledWith("data-signed-in", "");
      expect(run(path, () => null).marked).not.toHaveBeenCalled();
    }
  });

  it("shows the home page when storage refuses to be read", () => {
    const replace = run("/", () => {
      throw new Error("SecurityError");
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
