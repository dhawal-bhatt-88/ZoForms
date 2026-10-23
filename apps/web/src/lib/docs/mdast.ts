import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";

/*
 * The syntax tree of a page's MDX body, shared by everything that reads a page
 * without rendering it: the "On this page" list, the template check, search,
 * and the Markdown version. Typed loosely on purpose: only these few fields
 * are read.
 */

export type MdNode = {
  type: string;
  depth?: number;
  value?: string;
  lang?: string | null;
  url?: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: MdNode[];
  data?: Record<string, unknown>;
};

export function parseMdx(body: string): MdNode {
  return unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(body) as unknown as MdNode;
}

/** Every node, depth first, in document order. */
export function* walk(node: MdNode): Generator<MdNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

/** A node's plain text. */
export function textOf(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** Anchor ids for headings: lower case, words joined by "-", repeats numbered. One per page. */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base =
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

export type Heading = { depth: 2 | 3; text: string; id: string };

/** The page's `h2` and `h3` headings with the ids the rendered page gives them. */
export function headingsOf(tree: MdNode): Heading[] {
  const slug = createSlugger();
  const out: Heading[] = [];
  for (const node of walk(tree)) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const text = textOf(node);
      out.push({ depth: node.depth, text, id: slug(text) });
    }
  }
  return out;
}

/** The remark plugin that puts those same ids on the rendered headings. */
export function remarkHeadingIds() {
  return (tree: MdNode) => {
    const slug = createSlugger();
    for (const node of walk(tree)) {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
        node.data = { ...node.data, hProperties: { id: slug(textOf(node)) } };
      }
    }
  };
}

/** A JSX element's attributes as text: `<X a="b" c />` gives { a: "b", c: "" }. */
export function attributesOf(node: MdNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of node.attributes ?? []) if (a.name) out[a.name] = typeof a.value === "string" ? a.value : "";
  return out;
}

/**
 * What a page may contain beyond Markdown: the named components, with plain
 * text attributes. No imports, exports or `{expressions}`, so the content stays
 * plain files that another site could render. Returns each problem found.
 */
export function lintMdx(tree: MdNode, components: readonly string[]): string[] {
  const problems: string[] = [];
  for (const node of walk(tree)) {
    if (node.type === "mdxjsEsm") problems.push("imports and exports aren't allowed");
    if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") problems.push("{expressions} aren't allowed");
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
      if (!node.name || !components.includes(node.name)) problems.push(`unknown component <${node.name ?? ""}>`);
      for (const a of node.attributes ?? []) {
        if (a.type !== "mdxJsxAttribute") problems.push(`<${node.name}> has a spread attribute`);
        else if (a.value !== null && a.value !== undefined && typeof a.value !== "string")
          problems.push(`<${node.name} ${a.name}> must be plain text`);
      }
    }
  }
  return problems;
}
