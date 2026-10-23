/**
 * The four page templates (docs/briefs/BUILDER-BRIEF-DOCS.md, "Page
 * templates"), and the docs home. Each lists the `h2` sections its pages have,
 * in order; a unit test holds every page to its template. A section ending in
 * " …" matches any heading that starts with the rest ("More about …"), and one
 * ending in "?" may be left out.
 *
 * `example` is the live example block's tabs for that template, when it has one.
 */

export type ExampleTab = "preview" | "schema" | "react" | "payload" | "server";

export type TemplateName = "home" | "question-type" | "how-to" | "api-reference" | "example";

type Template = {
  /** Shown as the page's first badge. */
  label: string;
  sections: readonly string[];
  example?: { tabs: readonly ExampleTab[]; density: boolean };
};

export const TEMPLATES: Record<TemplateName, Template> = {
  home: { label: "Overview", sections: ["How it fits together"] },
  "question-type": {
    label: "Question type",
    sections: [
      "When to use",
      "Add it in the builder",
      "Settings",
      "Validation and error messages",
      "Accessibility",
      "For developers",
      "Troubleshooting",
    ],
    example: { tabs: ["preview", "schema", "payload", "server"], density: true },
  },
  "how-to": {
    label: "How-to guide",
    sections: [
      "When you'd use this",
      "Before you start",
      "Steps",
      "What happens behind the scenes",
      "Rules the builder enforces",
      "Troubleshooting",
      "More about …",
    ],
  },
  "api-reference": {
    label: "API reference",
    sections: ["Import", "Props at a glance", "Props", "Related"],
  },
  example: {
    label: "Example",
    // Related examples only once there is another example to relate to.
    sections: ["Try this", "How it works", "Related examples?"],
    example: { tabs: ["preview", "schema", "react", "payload", "server"], density: false },
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];

/**
 * Whether a page's `h2`s are exactly its template's sections, in order. A
 * section ending in "?" may be left out.
 */
export function sectionsMatch(template: TemplateName, headings: readonly string[]): boolean {
  const is = (w: string, h: string | undefined) => h !== undefined && (w.endsWith(" …") ? h.startsWith(w.slice(0, -1)) : h === w);
  let i = 0;
  for (const section of TEMPLATES[template].sections) {
    const optional = section.endsWith("?");
    const wanted = optional ? section.slice(0, -1) : section;
    if (is(wanted, headings[i])) i++;
    else if (!optional) return false;
  }
  return i === headings.length;
}
