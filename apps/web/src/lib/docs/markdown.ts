import { unified } from "unified";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import type { DocsPage } from "./content";
import { exampleReactCode, formExcerpt } from "./example-code";
import { attributesOf, type MdNode } from "./mdast";
import { docsHref, sectionPages } from "./nav";
import { cssTable, richParts, type CssCell, type CssTableName } from "./css-table";
import type { CssReference, Reference, ReferenceType, TypeReference } from "./reference";
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
  /** "0.28.1". */
  version: string;
  /** An example's form file, by name. */
  exampleForm: (name: string) => Record<string, unknown>;
  /** An API reference page's generated table, when it has one. */
  reference?: Reference | null;
  /** The page's other generated tables, when it has any. */
  types?: TypeReference | null;
  /** The CSS reference page's classes and custom properties. */
  css?: CssReference | null;
};

function referenceOf(ctx: MarkdownContext): Reference {
  if (!ctx.reference) throw new Error(`${ctx.page.file}: no reference table beside it`);
  return ctx.reference;
}

/** A type or function from the page's `<page>.types.json`. */
function typeOf(ctx: MarkdownContext, name: string): ReferenceType {
  const found = ctx.types?.types.find((t) => t.name === name);
  if (!found) throw new Error(`${ctx.page.file}: "${name}" isn't in ${ctx.page.slug}.types.json`);
  return found;
}

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

  LiveExample: (_, { form, validators }, __, ctx) => {
    const tabs = TEMPLATES[ctx.page.frontmatter.template].example?.tabs ?? [];
    const url = ctx.origin + docsHref(ctx.page.slug);
    return [
      p(strong("Live example."), text(" Try it on the web page: "), link(url, url), text(". The form file:")),
      code("json", JSON.stringify(ctx.exampleForm(form), null, 2)),
      ...(tabs.includes("react") ? [p(text("Rendered in React:")), code("jsx", exampleReactCode(form, validators !== undefined))] : []),
    ];
  },

  FormExcerpt: (_, { form, block, field }, __, ctx) => [code("json", formExcerpt(ctx.exampleForm(form), block, field))],

  UseCases: (_, __, children) => children,
  UseCase: (_, { title }, children) => lead([strong(`${title}.`)], children),

  Gif: (_, { alt }) => [p({ type: "emphasis", children: [text(`[Animation not recorded yet: ${alt}]`)] })],

  Series: (_, attrs, ___, ctx) => [
    list(
      false,
      sectionPages(ctx.page.slug, "group" in attrs).map((page) =>
        item(p(page.slug === ctx.page.slug ? text(`${page.title} (this page)`) : link(docsHref(page.slug), page.title))),
      ),
    ),
  ],

  PropsAtAGlance: (_, __, ___, ctx) => [
    {
      type: "table",
      align: [],
      children: [
        { type: "tableRow", children: ["Name", "Type", "Default", "Required"].map((h) => ({ type: "tableCell", children: [text(h)] })) },
        ...referenceOf(ctx).props.map((prop) => ({
          type: "tableRow",
          children: [
            [{ type: "inlineCode", value: prop.name }],
            [{ type: "inlineCode", value: prop.type }],
            [prop.default ? { type: "inlineCode", value: prop.default } : text("None")],
            [text(prop.required ? "Yes" : "No")],
          ].map((cell) => ({ type: "tableCell", children: cell })),
        })),
      ],
    } as MdNode,
  ],
  Prop: (_, { name }, children, ctx) => {
    const prop = referenceOf(ctx).props.find((x) => x.name === name);
    if (!prop) throw new Error(`${ctx.page.file}: <Prop name="${name}"> isn't in the reference`);
    return [
      { type: "heading", depth: 3, children: [{ type: "inlineCode", value: name }] },
      list(false, [
        item(p(strong("Type:"), text(" "), { type: "inlineCode", value: prop.type })),
        item(p(strong("Default:"), text(" "), prop.default ? { type: "inlineCode", value: prop.default } : text("none"))),
        item(p(strong("Required:"), text(prop.required ? " yes" : " no"))),
      ]),
      ...children,
    ];
  },
  Rules: (_, __, children) => [{ type: "blockquote", children: lead([strong("Rules:")], children) }],

  Signature: (_, { of }, __, ctx) => [code("ts", typeOf(ctx, of).text)],
  // One row of the table FieldList builds: its description is one paragraph.
  Field: (_, { name }, children) => [{ type: "docsField", value: name, children }],
  FieldList: (_, { of }, children, ctx) => {
    const cell = (...nodes: MdNode[]) => ({ type: "tableCell", children: nodes });
    return [
      {
        type: "table",
        align: [],
        children: [
          { type: "tableRow", children: ["Field", "Type", "Required", "What it is"].map((h) => cell(text(h))) },
          ...typeOf(ctx, of).members.map((member) => {
            const row = children.find((c) => c.type === "docsField" && c.value === member.name);
            if (!row) throw new Error(`${ctx.page.file}: <FieldList of="${of}"> has no <Field name="${member.name}">`);
            return {
              type: "tableRow",
              children: [
                cell({ type: "inlineCode", value: member.name }),
                cell({ type: "inlineCode", value: member.type }),
                cell(text(member.required ? "Yes" : "No")),
                cell(...(row.children?.[0]?.children ?? [])),
              ],
            };
          }),
        ],
      } as MdNode,
    ];
  },

  CssTable: (_, { of }, __, ctx) => {
    if (!ctx.css) throw new Error(`${ctx.page.file}: no ${ctx.page.slug}.css.json beside it`);
    const { headers, rows } = cssTable(ctx.css, of as CssTableName);
    const cell = (c: CssCell): MdNode => ({
      type: "tableCell",
      children: c.kind === "rich" ? richParts(c.value).map((part) => (part.code ? { type: "inlineCode", value: part.value } : text(part.value))) : [c.kind === "code" ? { type: "inlineCode", value: c.value } : text(c.value)],
    });
    return [
      {
        type: "table",
        align: [],
        children: [{ type: "tableRow", children: headers.map((h) => cell({ kind: "text", value: h })) }, ...rows.map((row) => ({ type: "tableRow", children: row.map(cell) }))],
      } as MdNode,
    ];
  },

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
    // A fence's check words are for the code-example test, not for readers.
    if (node.type === "code") return [{ ...node, meta: null }];
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

/** "Applies to: Zowork Forms builder · @zoworkhq/forms 0.28.1 or later." */
export function appliesToText(appliesTo: readonly string[], version: string): string {
  const parts = [
    ...(appliesTo.includes("builder") ? ["Zowork Forms builder"] : []),
    ...(appliesTo.includes("package") ? [`@zoworkhq/forms ${version} or later`] : []),
  ];
  return `Applies to: ${parts.join(" · ")}.`;
}
