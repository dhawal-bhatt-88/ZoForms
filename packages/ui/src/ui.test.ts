import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets later Tailwind utilities win conflicts", () => {
    // tailwind-merge should collapse conflicting padding utilities.
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
