import type { CssReference } from "./reference";

/*
 * The CSS reference's tables, from the page's generated `<page>.css.json`
 * (lib/docs/reference.ts, cssReference). One function builds the rows for both
 * the web page and its Markdown version, so the two can't say different things.
 */

/** A cell: code, plain text, or text whose `backticks` are code. */
export type CssCell = { kind: "code" | "text" | "rich"; value: string };

export type CssTable = { headers: string[]; rows: CssCell[][] };

export const CSS_TABLES = ["classes", "Colours", "Derived", "Shape and type", "Density"] as const;
export type CssTableName = (typeof CSS_TABLES)[number];

const code = (value: string): CssCell => ({ kind: "code", value });
const text = (value: string): CssCell => ({ kind: "text", value });
const rich = (value: string): CssCell => ({ kind: "rich", value });

/** Text with its `backticked` parts marked, for a cell of kind "rich". */
export function richParts(value: string): { code: boolean; value: string }[] {
  return value.split(/(`[^`]+`)/).filter(Boolean).map((part) => (part.startsWith("`") ? { code: true, value: part.slice(1, -1) } : { code: false, value: part }));
}

export function cssTable(css: CssReference, of: CssTableName): CssTable {
  if (of === "classes") {
    return {
      headers: ["Key", "Class", "What it's on"],
      rows: css.classes.map((c) => [code(c.key), code(c.name), rich(c.doc ?? "")]),
    };
  }
  const properties = css.properties.filter((p) => p.group === of);
  if (properties.length === 0) throw new Error(`The CSS reference has no "${of}" properties`);
  if (of === "Colours") {
    return { headers: ["Property", "Light", "Dark", "Used for"], rows: properties.map((p) => [code(p.name), code(p.light ?? ""), code(p.dark ?? p.light ?? ""), rich(p.usedFor)]) };
  }
  if (of === "Density") {
    return {
      headers: ["Property", "Patient", "Standard (default)", "Dense", "Used for"],
      rows: properties.map((p) => [code(p.name), code(p.density!.patient), code(p.density!.standard), code(p.density!.dense), rich(p.usedFor)]),
    };
  }
  return {
    headers: ["Property", "Default", "Used for"],
    rows: properties.map((p) => {
      const fallback = p.light === null ? text("None: your page's font") : code(p.light);
      const media = p.media ? `${p.usedFor}. \`${p.media.value}\` at \`${p.media.query}\`` : p.usedFor;
      return [code(p.name), fallback, rich(media)];
    }),
  };
}
