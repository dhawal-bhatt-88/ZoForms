import { describe, expect, it } from "vitest";
import {
  emptyForm,
  newBlock,
  resolveTheme,
  validateSubmission,
  type FormSchema,
} from "./index";

describe("emptyForm", () => {
  it("returns a titled form with no blocks", () => {
    expect(emptyForm()).toEqual({ title: "Untitled form", blocks: [] });
    expect(emptyForm("Survey").title).toBe("Survey");
  });
});

describe("newBlock", () => {
  it("seeds options for option-type blocks", () => {
    expect(newBlock("choice").options).toEqual(["Option 1", "Option 2", "Option 3"]);
  });

  it("seeds columns for a matrix and min/max for a scale", () => {
    expect(newBlock("matrix").columns).toHaveLength(3);
    const scale = newBlock("scale");
    expect(scale.min).toBe(1);
    expect(scale.max).toBe(5);
  });

  it("does not seed options for a short-answer block", () => {
    expect(newBlock("short").options).toBeUndefined();
  });

  it("applies overrides last", () => {
    expect(newBlock("short", { label: "Your name", required: true })).toMatchObject({
      type: "short",
      label: "Your name",
      required: true,
    });
  });
});

describe("validateSubmission", () => {
  const form: FormSchema = {
    title: "Contact",
    blocks: [
      { id: "name", type: "short", label: "Name", required: true },
      { id: "note", type: "long", label: "Note", required: false },
      { id: "intro", type: "heading", label: "Welcome", required: false },
    ],
  };

  it("returns cleaned values for a valid submission", () => {
    expect(validateSubmission(form, { name: "Ada", note: "hi" })).toEqual({
      name: "Ada",
      note: "hi",
    });
  });

  it("omits empty optional answers", () => {
    expect(validateSubmission(form, { name: "Ada" })).toEqual({ name: "Ada" });
  });

  it("throws when a required field is missing", () => {
    expect(() => validateSubmission(form, { note: "hi" })).toThrow(/"Name" is required/);
  });

  it("treats empty strings and empty arrays as missing", () => {
    expect(() => validateSubmission(form, { name: "" })).toThrow(/required/);
    expect(() => validateSubmission(form, { name: [] })).toThrow(/required/);
  });

  it("never collects a value for static (layout) blocks", () => {
    const cleaned = validateSubmission(form, { name: "Ada", intro: "should be ignored" });
    expect(cleaned).not.toHaveProperty("intro");
  });
});

describe("resolveTheme", () => {
  it("falls back to brand defaults on a light background", () => {
    const t = resolveTheme();
    expect(t.accent).toBe("#6D5EFA");
    expect(t.background).toBe("#F6F7F9");
    expect(t.text).toBe("#1B1D22");
    expect(t.surface).toBe("#FFFFFF");
  });

  it("adapts text + surface for a dark background", () => {
    const t = resolveTheme({ background: "#111111" });
    expect(t.text).toBe("#F4F4F5");
    expect(t.surface).toBe("#1C1F26");
  });

  it("caps the card radius so a pill setting never becomes a blob", () => {
    const t = resolveTheme({ radius: "full" });
    expect(t.radius).toBe("9999px");
    expect(t.cardRadius).toBe("28px");
  });

  it("maps width presets to concrete values", () => {
    expect(resolveTheme({ width: "narrow" }).maxWidth).toBe("480px");
    expect(resolveTheme({ width: "wide" }).maxWidth).toBe("820px");
  });
});
