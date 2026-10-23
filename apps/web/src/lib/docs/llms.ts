import type { DocsPage } from "./content";
import { markdownHref, livePages } from "./nav";

/**
 * /docs/llms.txt (llmstxt.org): the site in one line, then every live page's
 * Markdown version with its one-line summary, under its section.
 */
export function llmsTxt(pages: readonly DocsPage[], origin: string): string {
  const where = new Map(livePages().map((p) => [p.slug, p.section ?? "Overview"]));
  const sections = new Map<string, DocsPage[]>();
  for (const page of pages) {
    const section = where.get(page.slug) ?? "Overview";
    sections.set(section, [...(sections.get(section) ?? []), page]);
  }
  const lines = [
    "# Zowork Forms",
    "",
    "> Build clinical forms with logic and scoring in the Zowork Forms builder, then render them in your own app with @zoworkhq/forms. Answers go to your own API.",
    "",
    "Every page below is the Markdown version of a page at /docs.",
  ];
  for (const [section, list] of sections) {
    lines.push("", `## ${section}`, "");
    for (const page of list) lines.push(`- [${page.frontmatter.title}](${origin}${markdownHref(page.slug)}): ${page.frontmatter.summary}`);
  }
  return `${lines.join("\n")}\n`;
}
