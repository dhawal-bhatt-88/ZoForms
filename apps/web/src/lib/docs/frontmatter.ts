import { parse } from "yaml";
import { TEMPLATE_NAMES, type TemplateName } from "./templates";

/**
 * A page's frontmatter (docs brief, "Content format"). `prev` and `next` are
 * URLs such as "/docs/build/question-types/dropdown", or null at either end; a
 * unit test checks they follow the navigation's order.
 */
export type DocsFrontmatter = {
  title: string;
  /** One line, under the title, in search and in llms.txt. */
  summary: string;
  template: TemplateName;
  badges: string[];
  /** YYYY-MM-DD. */
  updated: string;
  prev: string | null;
  next: string | null;
};

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Split a page into its frontmatter and its MDX body. Throws, naming the file, on anything malformed. */
export function parseFrontmatter(raw: string, file: string): { frontmatter: DocsFrontmatter; body: string } {
  const match = FENCE.exec(raw);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const data = parse(match[1]) as Record<string, unknown>;
  const fail = (what: string): never => {
    throw new Error(`${file}: frontmatter ${what}`);
  };
  const text = (key: string) =>
    typeof data[key] === "string" && (data[key] as string).trim() ? (data[key] as string) : fail(`needs "${key}" as text`);
  const list = (key: string) =>
    Array.isArray(data[key]) && (data[key] as unknown[]).every((v) => typeof v === "string")
      ? (data[key] as string[])
      : fail(`needs "${key}" as a list of text`);
  const link = (key: string) =>
    data[key] === null || (typeof data[key] === "string" && /^\/docs(\/|$)/.test(data[key] as string))
      ? (data[key] as string | null)
      : fail(`"${key}" must be a /docs URL or null`);

  const known = ["title", "summary", "template", "badges", "updated", "prev", "next"];
  const extra = Object.keys(data).filter((k) => !known.includes(k));
  if (extra.length) fail(`has unknown keys: ${extra.join(", ")}`);

  const template = text("template");
  if (!TEMPLATE_NAMES.includes(template as TemplateName)) fail(`"template" must be one of ${TEMPLATE_NAMES.join(", ")}`);
  const updated = text("updated");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) fail(`"updated" must be YYYY-MM-DD`);

  return {
    frontmatter: {
      title: text("title"),
      summary: text("summary"),
      template: template as TemplateName,
      badges: list("badges"),
      updated,
      prev: link("prev"),
      next: link("next"),
    },
    body: raw.slice(match[0].length),
  };
}
