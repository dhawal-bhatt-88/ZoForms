import { describe, expect, it, vi } from "vitest";
import { HOME_REDIRECT_SCRIPT } from "./home-redirect";

/** Runs the script against a stand-in `location` and `localStorage`. */
function run(pathname: string, getItem: (key: string) => string | null) {
  const replace = vi.fn();
  new Function("location", "localStorage", HOME_REDIRECT_SCRIPT)({ pathname, replace }, { getItem });
  return replace;
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

  it("shows the home page when storage refuses to be read", () => {
    const replace = run("/", () => {
      throw new Error("SecurityError");
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
