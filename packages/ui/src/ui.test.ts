import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { buttonVariants } from "./button";

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

describe("buttonVariants", () => {
  it("applies default variant + size when none given", () => {
    const cls = buttonVariants();
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("h-10");
  });

  it("honours explicit variant and size", () => {
    const cls = buttonVariants({ variant: "accent", size: "lg" });
    expect(cls).toContain("bg-accent");
    expect(cls).toContain("h-12");
  });
});
