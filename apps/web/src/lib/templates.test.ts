import { describe, expect, it } from "vitest";
import { formProblems, FormSchema } from "@formbuilder/form-schema";
import { CATEGORIES, COMMUNITY_TEMPLATES, TEMPLATES } from "./templates";

// A form made from a template must save: its lists are coded (contract §13), its block types
// exist (there is no payment block), and it passes every save rule.
describe("templates", () => {
  it.each([...TEMPLATES, ...COMMUNITY_TEMPLATES].map((t) => [t.name, t] as const))("%s parses and has no save problems", (_, template) => {
    const form = FormSchema.parse(template.schema);
    expect(formProblems(form)).toEqual([]);
    for (const block of form.blocks) {
      for (const option of block.options ?? []) expect(option.code).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
    }
  });

  it("offers no category chip without a template behind it", () => {
    const used = new Set([...TEMPLATES, ...COMMUNITY_TEMPLATES].map((t) => t.category));
    expect(CATEGORIES.filter((c) => c !== "All" && !used.has(c))).toEqual([]);
  });
});
