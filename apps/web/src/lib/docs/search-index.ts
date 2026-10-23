import type { DocsPage } from "./content";
import type { MdNode } from "./mdast";
import { livePages } from "./nav";
import type { SearchEntry } from "./search";

/** The text a reader could search for: prose and inline code, not code blocks. */
function proseOf(node: MdNode): string {
  if (node.type === "code") return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  return (node.children ?? []).map(proseOf).join(" ");
}

/** /docs/search-index.json. */
export function searchIndex(pages: readonly DocsPage[]): SearchEntry[] {
  const where = new Map(livePages().map((p) => [p.slug, p.section ?? "Overview"]));
  return pages.map((page) => ({
    slug: page.slug,
    title: page.frontmatter.title,
    summary: page.frontmatter.summary,
    section: where.get(page.slug) ?? "Overview",
    headings: page.headings.filter((h) => h.depth === 2).map((h) => h.text),
    text: proseOf(page.tree).replace(/\s+/g, " ").trim(),
  }));
}
