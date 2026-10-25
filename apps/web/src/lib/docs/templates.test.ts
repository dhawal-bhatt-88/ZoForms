import { describe, expect, it } from "vitest";
import { sectionsMatch } from "./templates";

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

  it("lets a question-type page leave out For developers", () => {
    const before = ["When to use", "Add it in the builder", "Settings", "Validation and error messages", "Accessibility"];
    expect(sectionsMatch("question-type", [...before, "For developers", "Troubleshooting"])).toBe(true);
    expect(sectionsMatch("question-type", [...before, "Troubleshooting"])).toBe(true);
    expect(sectionsMatch("question-type", [...before, "Troubleshooting", "For developers"])).toBe(false);
  });

  it("matches a section ending in … by its start", () => {
    const howTo = ["When you'd use this", "Before you start", "Steps", "What happens behind the scenes", "Rules the builder enforces", "Troubleshooting"];
    expect(sectionsMatch("how-to", [...howTo, "More about building forms"])).toBe(true);
    expect(sectionsMatch("how-to", [...howTo, "See also"])).toBe(false);
  });
});
