import { unified } from "unified";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import type { DocsPage } from "./content";
import { exampleReactCode } from "./example-code";
import { attributesOf, type MdNode } from "./mdast";
import { docsHref, sectionPages } from "./nav";
import { TEMPLATES } from "./templates";

/*
 * A page as plain Markdown, for `<page>.md`, "Copy page" and llms.txt readers.
 * Each docs component becomes the Markdown that says the same thing; a live
 * example becomes its form file, which is what a reader without the page
 * needs. MARKDOWN_COMPONENTS is also the list of components a page may use.
 */

export type MarkdownContext = {
  page: DocsPage;
  /** The site's address, for absolute links. */
  origin: string;
  /** "0.26.0". */
  version: string;
  /** An example's form file, by name. */
  exampleForm: (name: string) => Record<string, unknown>;
};

const p = (...children: MdNode[]): MdNode => ({ type: "paragraph", children });
const text = (value: string): MdNode => ({ type: "text", value });
const strong = (value: string): MdNode => ({ type: "strong", children: [text(value)] });
const link = (url: string, value: string): MdNode => ({ type: "link", url, children: [text(value)] });
const code = (lang: string, value: string): MdNode => ({ type: "code", lang, value: value.replace(/\n$/, "") });
const item = (...children: MdNode[]): MdNode => ({ type: "listItem", spread: false, children } as MdNode);
const list = (ordered: boolean, items: MdNode[]): MdNode => ({ type: "list", ordered, spread: false, children: items } as MdNode);

/** Prefix a component's first paragraph, e.g. with "Note:", or start one. */
function lead(prefix: MdNode[], children: MdNode[]): MdNode[] {
  const [first, ...rest] = children;
  if (first?.type === "paragraph") return [{ ...first, children: [...prefix, text(" "), ...(first.children ?? [])] }, ...rest];
  return [p(...prefix), ...children];
}

type Convert = (node: MdNode, attrs: Record<string, string>, children: MdNode[], ctx: MarkdownContext) => MdNode[];

const callout =
  (word: string): Convert =>
  (_, __, children) => [{ type: "blockquote", children: lead([strong(`${word}:`)], children) }];

export const MARKDOWN_COMPONENTS: Record<string, Convert> = {
  Note: callout("Note"),
  Tip: callout("Tip"),
  Warning: callout("Warning"),

  LiveExample: (_, { form }, __, ctx) => {
    const tabs = TEMPLATES[ctx.page.frontmatter.template].example?.tabs ?? [];
    const url = ctx.origin + docsHref(ctx.page.slug);
    return [
      p(strong("Live example."), text(" Try it on the web page: "), link(url, url), text(". The form file:")),
      code("json", JSON.stringify(ctx.exampleForm(form), null, 2)),
      ...(tabs.includes("react") ? [p(text("Rendered in React:")), code("jsx", exampleReactCode(form))] : []),
    ];
  },

  UseCases: (_, __, children) => children,
  UseCase: (_, { title }, children) => lead([strong(`${title}.`)], children),

  Gif: (_, { alt }) => [p({ type: "emphasis", children: [text(`[Animation not recorded yet: ${alt}]`)] })],

  Series: (_, __, ___, ctx) => [
    list(
      false,
      sectionPages(ctx.page.slug).map((page) =>
        item(p(page.slug === ctx.page.slug ? text(`${page.title} (this page)`) : link(docsHref(page.slug), page.title))),
      ),
    ),
  ],

  Prop: (_, { name, type, default: fallback, required }, children) => [
    { type: "heading", depth: 3, children: [{ type: "inlineCode", value: name }] },
    list(false, [
      item(p(strong("Type:"), text(" "), { type: "inlineCode", value: type })),
      item(p(strong("Default:"), text(" "), fallback ? { type: "inlineCode", value: fallback } : text("none"))),
      item(p(strong("Required:"), text(required === undefined ? " no" : " yes"))),
    ]),
    ...children,
  ],
  Rules: (_, __, children) => [{ type: "blockquote", children: lead([strong("Rules:")], children) }],

  TryThis: (_, __, children) => children,

  // Each Door comes out as one paragraph; together they are a list.
  Doors: (_, __, children) => [list(false, children.map((c) => item(c)))],
  Door: (_, { title, href }, children) => [p(...lead([link(href, title), text(":")], children).flatMap((c) => c.children ?? []))],

  // The same four stages and caption as the Architecture component.
  Architecture: () => [
    list(true, [
      item(p(strong("Zowork Forms builder:"), text(" you build the form."))),
      item(p(strong("JSON form file:"), text(" you download it."))),
      item(p({ type: "inlineCode", value: "@zoworkhq/forms" }, text(" in your app: renders the file."))),
      item(p(strong("Your API:"), text(" receives the answers."))),
    ]),
    p(text("Nothing a person types into the form reaches Zowork Forms: your app posts the answers to your own API.")),
  ],
};

/** A link to another docs page, as the absolute address of its Markdown version; any other link as it is. */
export function markdownLink(url: string, origin: string): string {
  const match = /^\/docs(\/[^#?]*)?([#?].*)?$/.exec(url);
  if (!match) return url;
  const path = (match[1] ?? "").replace(/\/$/, "");
  return `${origin}/docs${path}.md${match[2] ?? ""}`;
}

function convert(nodes: MdNode[], ctx: MarkdownContext): MdNode[] {
  return nodes.flatMap((node) => {
    const children = node.children ? convert(node.children, ctx) : undefined;
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
      const fn = MARKDOWN_COMPONENTS[node.name ?? ""];
      if (!fn) throw new Error(`${ctx.page.file}: no Markdown for <${node.name}>`);
      return fn(node, attributesOf(node), children ?? [], ctx).map((n) => relink(n, ctx.origin));
    }
    return [relink(children ? { ...node, children } : node, ctx.origin)];
  });
}

/** `relink` for one node and everything in it. */
function relink(node: MdNode, origin: string): MdNode {
  const url = node.type === "link" && node.url ? markdownLink(node.url, origin) : node.url;
  return { ...node, ...(url !== undefined && { url }), ...(node.children && { children: node.children.map((c) => relink(c, origin)) }) };
}

export function pageMarkdown(ctx: MarkdownContext): string {
  const { frontmatter } = ctx.page;
  const header: MdNode[] = [
    { type: "heading", depth: 1, children: [text(frontmatter.title)] },
    { type: "blockquote", children: [p(text(frontmatter.summary))] },
    p(text(appliesToText(frontmatter.appliesTo, ctx.version) + ` Last updated ${frontmatter.updated}.`)),
  ];
  const root = { type: "root", children: [...header, ...convert(ctx.page.tree.children ?? [], ctx)] };
  const out = unified()
    .use(remarkStringify, { bullet: "-", emphasis: "_", fences: true, rule: "-" })
    .use(remarkGfm)
    .stringify(root as never);
  return String(out);
}

/** "Applies to: Zowork Forms builder · @zoworkhq/forms 0.26.0 or later." */
export function appliesToText(appliesTo: readonly string[], version: string): string {
  const parts = [
    ...(appliesTo.includes("builder") ? ["Zowork Forms builder"] : []),
    ...(appliesTo.includes("package") ? [`@zoworkhq/forms ${version} or later`] : []),
  ];
  return `Applies to: ${parts.join(" · ")}.`;
}
