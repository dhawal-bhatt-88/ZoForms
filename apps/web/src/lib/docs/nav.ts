import { DOCS_HOME, DOCS_NAV, type DocsNavGroup, type DocsNavPage, type DocsNavSection } from "../../../content/docs/nav";

/*
 * Reading the navigation config (content/docs/nav.ts). Pure, so the side
 * navigation (a client component) and the server routes share it.
 */

export type { DocsNavGroup, DocsNavPage, DocsNavSection };
export { DOCS_HOME, DOCS_NAV };

export const isGroup = (item: DocsNavPage | DocsNavGroup): item is DocsNavGroup => "pages" in item;

/** The URL of a page: "" is the docs home. */
export const docsHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

/** The same page as plain Markdown. */
export const markdownHref = (slug: string) => `${docsHref(slug)}.md`;

/** Where a page sits: its section, and its group when it is in one. */
export type DocsTrail = { section?: string; group?: string };

export type LivePage = DocsNavPage & DocsTrail;

/** Every live page in reading order, the docs home first. */
export function livePages(nav: DocsNavSection[] = DOCS_NAV): LivePage[] {
  const out: LivePage[] = [DOCS_HOME];
  for (const section of nav) {
    for (const item of section.items) {
      const pages = isGroup(item) ? item.pages : [item];
      for (const page of pages) {
        if (page.status === "live") out.push({ ...page, section: section.title, group: isGroup(item) ? item.title : undefined });
      }
    }
  }
  return out;
}

/** The navigation as shown: sections, groups and pages with no live page left out. */
export function visibleNav(nav: DocsNavSection[] = DOCS_NAV): DocsNavSection[] {
  return nav
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => (isGroup(item) ? { ...item, pages: item.pages.filter((p) => p.status === "live") } : item))
        .filter((item) => (isGroup(item) ? item.pages.length > 0 : item.status === "live")),
    }))
    .filter((section) => section.items.length > 0);
}

/** The previous and next live pages, by the navigation's order. */
export function neighbours(slug: string): { prev: LivePage | null; next: LivePage | null } {
  const pages = livePages();
  const i = pages.findIndex((p) => p.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: pages[i - 1] ?? null, next: pages[i + 1] ?? null };
}

/**
 * The live pages of a page's own section, in order: a how-to guide's "More
 * about …" list. With `inGroup`, only those of its group, for a section as
 * long as "Integrate forms".
 */
export function sectionPages(slug: string, inGroup = false): LivePage[] {
  const pages = livePages();
  const self = pages.find((p) => p.slug === slug);
  if (!self?.section) return [];
  return pages.filter((p) => p.section === self.section && (!inGroup || p.group === self.group));
}
