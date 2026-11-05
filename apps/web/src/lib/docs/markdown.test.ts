import { describe, expect, it } from "vitest";
import type { DocsPage } from "./content";
import { parseFrontmatter } from "./frontmatter";
import { llmsTxt } from "./llms";
import { markdownLink, pageMarkdown } from "./markdown";
import { headingsOf, parseMdx } from "./mdast";

/** A page from MDX text, as content.ts would load it. */
function page(body: string, slug = "build/question-types/dropdown", template = "question-type"): DocsPage {
  const raw = `---\ntitle: T\nsummary: S.\ntemplate: ${template}\nbadges: []\nupdated: 2026-10-23\nprev: null\nnext: null\n---\n${body}`;
  const { frontmatter, body: b } = parseFrontmatter(raw, "test.mdx");
  const tree = parseMdx(b);
  return { slug, file: "test.mdx", frontmatter, body: b, tree, headings: headingsOf(tree) };
}

const md = (body: string, template?: string) =>
  pageMarkdown({
    page: page(body, undefined, template),
    origin: "https://forms.example",
    exampleForm: () => ({ title: "F", blocks: [] }),
  });

describe("a page's Markdown version", () => {
  it("starts with the title, the summary and Last updated", () => {
    expect(md("Body.")).toBe("# T\n\n> S.\n\nLast updated 2026-10-23.\n\nBody.\n");
  });

  it("names each callout in words", () => {
    expect(md("<Note>\nIt can't do this.\n</Note>")).toContain("> **Note:** It can't do this.");
    expect(md("<Warning>\nAnswers are lost.\n</Warning>")).toContain("> **Warning:** Answers are lost.");
  });

  it("gives a live example as its form file, with React code only on the example template", () => {
    const question = md('<LiveExample form="f" />');
    expect(question).toContain('```json\n{\n  "title": "F",');
    expect(question).not.toContain("```jsx");
    expect(md('<LiveExample form="f" />', "example")).toContain("import { FormRenderer } from '@zoworkhq/forms/react';");
  });

  it("points links to other docs pages at their Markdown versions", () => {
    expect(md("See [FormRenderer](/docs/integrate/reference/form-renderer#props).")).toContain(
      "(https://forms.example/docs/integrate/reference/form-renderer.md#props)",
    );
  });

  it("refuses a component it has no Markdown for", () => {
    expect(() => md("<Mystery />")).toThrow("no Markdown for <Mystery>");
  });
});

describe("markdownLink", () => {
  it("maps docs pages, the docs home included, and leaves anything else", () => {
    expect(markdownLink("/docs", "https://x")).toBe("https://x/docs.md");
    expect(markdownLink("/docs/a/b", "https://x")).toBe("https://x/docs/a/b.md");
    expect(markdownLink("/docs/a/b/#c", "https://x")).toBe("https://x/docs/a/b.md#c");
    expect(markdownLink("/login", "https://x")).toBe("/login");
    expect(markdownLink("https://example.com/docs/a", "https://x")).toBe("https://example.com/docs/a");
  });
});

describe("headings", () => {
  it("get ids from their text, numbered when repeated", () => {
    const h = headingsOf(parseMdx("## When to use\n\n### `schema`\n\n## When to use"));
    expect(h.map((x) => x.id)).toEqual(["when-to-use", "schema", "when-to-use-1"]);
  });
});

describe("llms.txt", () => {
  it("lists each page's Markdown version with its summary", () => {
    const text = llmsTxt([page("x", "examples/follow-up-question", "example")], "https://forms.example");
    expect(text.startsWith("# Zowork Forms\n\n> ")).toBe(true);
    expect(text).toContain("## Examples\n\n- [T](https://forms.example/docs/examples/follow-up-question.md): S.\n");
  });
});

describe("frontmatter", () => {
  const bad = (yaml: string) => () => parseFrontmatter(`---\n${yaml}\n---\nx`, "bad.mdx");
  const base = "title: T\nsummary: S\ntemplate: how-to\nbadges: []\nupdated: 2026-10-23\nprev: null\nnext: null";

  it("accepts a complete set", () => {
    expect(() => bad(base)()).not.toThrow();
  });
  it("names the file and the problem", () => {
    expect(bad(base.replace("template: how-to", "template: blog"))).toThrow(/bad\.mdx: frontmatter "template" must be one of/);
    expect(bad(base.replace("prev: null", "prev: /login"))).toThrow('"prev" must be a /docs URL or null');
    expect(bad(base.replace("updated: 2026-10-23", "updated: 23 Oct"))).toThrow('"updated" must be YYYY-MM-DD');
    expect(bad(`${base}\nauthor: me`)).toThrow("unknown keys: author");
    expect(() => parseFrontmatter("no fence", "none.mdx")).toThrow("none.mdx: no frontmatter");
  });
});
