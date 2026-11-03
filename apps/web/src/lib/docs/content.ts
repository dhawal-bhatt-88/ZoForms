import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, type DocsFrontmatter } from "./frontmatter";
import { headingsOf, parseMdx, type Heading, type MdNode } from "./mdast";
import { livePages } from "./nav";
import { expandForDevelopers } from "./question-values";
import type { CssReference, Reference, TypeReference } from "./reference";

/*
 * Reading the docs' content files (apps/web/content/docs) on the server. Every
 * docs route is built static, so this runs at build time, and in `next dev`
 * on each request so edits show at once.
 */

export const CONTENT_DIR = path.join(process.cwd(), "content", "docs");

export type DocsPage = {
  /** The path under /docs; "" for the docs home. */
  slug: string;
  /** Relative to content/docs, e.g. "build/question-types/dropdown.mdx". */
  file: string;
  frontmatter: DocsFrontmatter;
  body: string;
  tree: MdNode;
  headings: Heading[];
};

/** A JSON file, naming the file if it doesn't parse. */
export function readJson(full: string): unknown {
  const text = fs.readFileSync(full, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${full}: ${(error as Error).message} (${text.length} characters read)`);
  }
}

const fileOf = (slug: string) => (slug ? `${slug}.mdx` : "index.mdx");

/** Every .mdx file under content/docs, as slugs. */
export function pageFiles(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(CONTENT_DIR, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(rel);
      else if (entry.name.endsWith(".mdx")) out.push(rel === "index.mdx" ? "" : rel.slice(0, -4));
    }
  };
  visit("");
  return out.sort();
}

export function getPage(slug: string): DocsPage | null {
  const file = fileOf(slug);
  const full = path.join(CONTENT_DIR, file);
  if (!fs.existsSync(full)) return null;
  const { frontmatter, body } = parseFrontmatter(fs.readFileSync(full, "utf8"), file);
  // Generated sections are part of the page for everything that reads it: headings, search, the .md.
  const tree = expandForDevelopers(parseMdx(body));
  return { slug, file, frontmatter, body, tree, headings: headingsOf(tree) };
}

/** Every live page in reading order. Throws if the navigation lists one with no file. */
export function getLivePages(): DocsPage[] {
  return livePages().map((p) => {
    const page = getPage(p.slug);
    if (!page) throw new Error(`content/docs/nav.ts lists "${p.slug}" as live, but content/docs/${fileOf(p.slug)} doesn't exist`);
    return page;
  });
}

/**
 * An API reference page's table: `<page>.props.json` beside it, generated
 * from the package (lib/docs/reference.ts) and checked by reference.test.ts.
 * Null for a page without one.
 */
export function readReference(pageSlug: string): Reference | null {
  const full = path.join(CONTENT_DIR, `${pageSlug}.props.json`);
  return fs.existsSync(full) ? (readJson(full) as Reference) : null;
}

/**
 * A page's other generated tables and signatures: `<page>.types.json` beside
 * it, generated from the package and checked by reference.test.ts. Null for a
 * page without one.
 */
export function readTypes(pageSlug: string): TypeReference | null {
  const full = path.join(CONTENT_DIR, `${pageSlug}.types.json`);
  return fs.existsSync(full) ? (readJson(full) as TypeReference) : null;
}

/**
 * The CSS reference's classes, custom properties and host hooks:
 * `<page>.css.json`, generated like the others and checked by reference.test.ts.
 */
export function readCss(pageSlug: string): CssReference | null {
  const full = path.join(CONTENT_DIR, `${pageSlug}.css.json`);
  return fs.existsSync(full) ? (readJson(full) as CssReference) : null;
}

/**
 * An example's form file: `<name>.form.json` beside the page that shows it. A
 * real download from the builder (scripts/docs-example-forms.mjs), never
 * written by hand.
 */
export function readExampleForm(pageSlug: string, name: string): { schema: Record<string, unknown>; file: string } {
  const dir = path.posix.dirname(fileOf(pageSlug));
  const file = path.posix.join(dir === "." ? "" : dir, `${name}.form.json`);
  const full = path.join(CONTENT_DIR, file);
  if (!fs.existsSync(full)) throw new Error(`${fileOf(pageSlug)}: no example form at content/docs/${file}`);
  return { schema: readJson(full) as Record<string, unknown>, file };
}
