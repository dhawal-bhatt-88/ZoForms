import { describe, expect, it } from "vitest";
import { parseCount, repeatBadgeText, repeatPreviewText } from "./repeat-settings";

describe("repeatBadgeText", () => {
  it("shows the limits", () => {
    expect(repeatBadgeText({ minOccurs: 1, maxOccurs: 3 })).toBe("Repeats · 1–3");
    expect(repeatBadgeText({ minOccurs: 0 })).toBe("Repeats · 0 or more");
    expect(repeatBadgeText({ minOccurs: 1 })).toBe("Repeats · 1 or more");
    expect(repeatBadgeText({ minOccurs: 2, maxOccurs: 2 })).toBe("Repeats · exactly 2");
  });

  it("counts a missing minimum as 1", () => {
    expect(repeatBadgeText({})).toBe("Repeats · 1 or more");
    expect(repeatBadgeText({ maxOccurs: 4 })).toBe("Repeats · 1–4");
  });
});

describe("repeatPreviewText", () => {
  it("upper-cases only the heading's first character and uses the name verbatim elsewhere", () => {
    expect(repeatPreviewText("patient")).toBe("Patient 1 · Add another patient · Remove patient 1");
    expect(repeatPreviewText("line item")).toBe("Line item 1 · Add another line item · Remove line item 1");
    expect(repeatPreviewText("GP visit")).toBe("GP visit 1 · Add another GP visit · Remove GP visit 1");
  });

  it("shows nothing while the name is blank", () => {
    expect(repeatPreviewText("")).toBeNull();
    expect(repeatPreviewText("   ")).toBeNull();
    expect(repeatPreviewText(undefined)).toBeNull();
  });
});

describe("parseCount", () => {
  it("treats blank as not set", () => {
    expect(parseCount("")).toBeUndefined();
    expect(parseCount("  ")).toBeUndefined();
  });

  it("keeps any number as typed, so the save rule can flag it", () => {
    expect(parseCount("0")).toBe(0);
    expect(parseCount("3")).toBe(3);
    expect(parseCount("1.5")).toBe(1.5);
    expect(parseCount("-2")).toBe(-2);
  });
});
