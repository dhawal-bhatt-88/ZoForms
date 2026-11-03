import { describe, expect, it } from "vitest";
import { sectionsMatch, TEMPLATES } from "./templates";

describe("live examples", () => {
  it("are allowed on how-to pages, with the question-type pages' tabs", () => {
    expect(TEMPLATES["how-to"].example).toEqual(TEMPLATES["question-type"].example);
  });
});

describe("sectionsMatch", () => {
  it("wants every section, in order", () => {
    expect(sectionsMatch("api-reference", ["Import", "Props at a glance", "Props", "Related"])).toBe(true);
    expect(sectionsMatch("api-reference", ["Import", "Props", "Props at a glance", "Related"])).toBe(false);
    expect(sectionsMatch("api-reference", ["Import", "Props at a glance", "Props"])).toBe(false);
    expect(sectionsMatch("api-reference", ["Import", "Props at a glance", "Props", "Related", "Extra"])).toBe(false);
  });

  it("lets an optional section be left out, but not moved", () => {
    expect(sectionsMatch("example", ["Try this", "How it works"])).toBe(true);
    expect(sectionsMatch("example", ["Try this", "How it works", "Related examples"])).toBe(true);
    expect(sectionsMatch("example", ["Related examples", "Try this", "How it works"])).toBe(false);
  });

  it("gives every question-type page For developers, before Troubleshooting", () => {
    const before = ["When to use", "Add it in the builder", "Settings", "Validation and error messages", "Accessibility"];
    expect(sectionsMatch("question-type", [...before, "For developers", "Troubleshooting"])).toBe(true);
    expect(sectionsMatch("question-type", [...before, "Troubleshooting"])).toBe(false);
    expect(sectionsMatch("question-type", [...before, "Troubleshooting", "For developers"])).toBe(false);
  });

  it("lets a page have its own sections where a template says *", () => {
    expect(sectionsMatch("concept", ["In short", "Related"])).toBe(true);
    expect(sectionsMatch("concept", ["In short", "One", "Two", "Related"])).toBe(true);
    expect(sectionsMatch("concept", ["One", "In short", "Related"])).toBe(false);
    expect(sectionsMatch("concept", ["In short", "One"])).toBe(false);
    expect(sectionsMatch("concept", ["In short", "Related", "One"])).toBe(false);
  });

  it("gives a how-to page the rules of the builder or of the package", () => {
    const start = ["When you'd use this", "Before you start", "Steps", "What happens behind the scenes"];
    const end = ["Troubleshooting", "More about integrating"];
    expect(sectionsMatch("how-to", [...start, "Rules the package enforces", ...end])).toBe(true);
    expect(sectionsMatch("how-to", [...start, "Rules the builder enforces", ...end])).toBe(true);
    expect(sectionsMatch("how-to", [...start, ...end])).toBe(true);
  });

  it("matches a section ending in … by its start", () => {
    const howTo = ["When you'd use this", "Before you start", "Steps", "What happens behind the scenes", "Rules the builder enforces", "Troubleshooting"];
    expect(sectionsMatch("how-to", [...howTo, "More about building forms"])).toBe(true);
    expect(sectionsMatch("how-to", [...howTo, "See also"])).toBe(false);
  });
});
