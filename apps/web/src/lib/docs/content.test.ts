import { describe, expect, it } from "vitest";
import { assertSchemaIntegrity, type FormSchema } from "@zoworkhq/zoforms/core";
import { getLivePages, pageFiles, readExampleForm } from "./content";
import { MARKDOWN_COMPONENTS } from "./markdown";
import { markdownFor } from "./page-markdown";
import { attributesOf, fenceWords, lintMdx, walk } from "./mdast";
import { DOCS_NAV, docsHref, isGroup, livePages, type DocsNavSection } from "./nav";
import { TEMPLATES, sectionsMatch } from "./templates";

/*
 * Every page in content/docs, held to the rules a page can break without the
 * site failing to build: the navigation, its template, its frontmatter, the
 * components it may use, and its example forms.
 */

const pages = getLivePages();
const components = Object.keys(MARKDOWN_COMPONENTS);

describe("the docs content", () => {
  it("has a file for every live page, and no file the navigation doesn't list", () => {
    expect(pageFiles()).toEqual(livePages().map((p) => p.slug).sort());
  });

  it("keeps planned pages out of sight but on record", () => {
    // A fixture, since the real navigation's planned pages go live one by one.
    const fixture: DocsNavSection[] = [
      {
        title: "Section",
        items: [
          { title: "Written", slug: "integrate/overview", status: "live" },
          { title: "Later", slug: "integrate/later", status: "planned", notes: "What it must say." },
        ],
      },
    ];
    expect(livePages(fixture).map((p) => p.slug)).not.toContain("integrate/later");
    // Every planned page in the real navigation has no file yet, and says what it needs.
    const planned = DOCS_NAV.flatMap((s) => s.items.flatMap((i) => (isGroup(i) ? i.pages : [i]))).filter((p) => p.status === "planned");
    for (const page of planned) {
      expect(pageFiles()).not.toContain(page.slug);
      expect(page.notes, page.slug).toBeTruthy();
    }
  });

  it.each(pages.map((p) => [p.file, p] as const))("%s has its template's sections, in order", (_, page) => {
    const h2 = page.headings.filter((h) => h.depth === 2).map((h) => h.text);
    expect(sectionsMatch(page.frontmatter.template, h2), `h2s: ${h2.join(" | ")}`).toBe(true);
  });

  it.each(pages.map((p) => [p.file, p] as const))("%s links only to pages that are live", (_, page) => {
    const live = new Set(livePages().map((p) => docsHref(p.slug)));
    const links = [...walk(page.tree)].flatMap((n) => {
      const href = n.type === "link" ? n.url : n.name === "Door" ? attributesOf(n).href : undefined;
      return href?.startsWith("/docs") ? [href.split("#")[0]] : [];
    });
    expect(links.filter((href) => !live.has(href) && !/\.\w+$/.test(href))).toEqual([]);
  });

  it("links each page to the previous and next in the navigation's order", () => {
    const order = livePages().map((p) => docsHref(p.slug));
    pages.forEach((page, i) => {
      expect([page.file, page.frontmatter.prev]).toEqual([page.file, i ? order[i - 1] : null]);
      expect([page.file, page.frontmatter.next]).toEqual([page.file, order[i + 1] ?? null]);
    });
  });

  it.each(pages.map((p) => [p.file, p] as const))("%s uses only the docs' components, with plain attributes", (_, page) => {
    expect(lintMdx(page.tree, components)).toEqual([]);
  });

  it.each(pages.map((p) => [p.file, p] as const))("%s has a live example only where its template has one", (_, page) => {
    const examples = [...walk(page.tree)].filter((n) => n.name === "LiveExample");
    if (!TEMPLATES[page.frontmatter.template].example) expect(examples).toEqual([]);
  });

  it("renders every example form file with the real renderer's integrity check", () => {
    for (const page of pages) {
      for (const node of walk(page.tree)) {
        if (node.name !== "LiveExample") continue;
        const { schema, file } = readExampleForm(page.slug, attributesOf(node).form);
        expect(() => assertSchemaIntegrity(schema as unknown as FormSchema), file).not.toThrow();
        // A real download: the builder stamps identity and format on every one.
        expect(Object.keys(schema).slice(0, 4), file).toEqual(["title", "formId", "formVersionId", "schemaVersion"]);
      }
    }
  });

  it.each(pages.map((p) => [p.file, p] as const))("%s has a Markdown version with no components left in it", (_, page) => {
    const md = markdownFor(page, "https://forms.example");
    expect(md.startsWith(`# ${page.frontmatter.title}\n`)).toBe(true);
    for (const name of components) expect(md).not.toMatch(new RegExp(`<${name}[\\s/>]`));
    // Check words on a fence are for the code-example test.
    if ([...walk(page.tree)].some((n) => n.type === "code" && Object.keys(fenceWords(n.meta)).length)) expect(md).not.toMatch(/^```\w+ /m);
  });
});
