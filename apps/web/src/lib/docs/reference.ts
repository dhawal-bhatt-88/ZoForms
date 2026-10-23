import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/*
 * The FormRenderer reference table, read from the installed package rather
 * than written by hand (docs brief, "Accuracy rules"):
 *   - names, types, required and each prop's doc comment from
 *     dist/react/index.d.ts (`interface FormRendererProps`);
 *   - defaults from dist/react/index.js, where FormRenderer's props are
 *     destructured with them. The types can't say what a default is.
 *
 * The result is committed beside the page (form-renderer.props.json) and
 * reference.test.ts fails when the package and that file disagree. Only tests
 * and the generator import this module: it needs the TypeScript compiler,
 * which the pages never load.
 */

export type ReferenceProp = {
  name: string;
  /** The type as the .d.ts writes it. */
  type: string;
  required: boolean;
  /** As code, e.g. "'same-origin'" or "30000"; null when there is none. */
  default: string | null;
  /** The doc comment in the .d.ts, if any. */
  doc: string | null;
};

export type Reference = { package: string; source: string; props: ReferenceProp[] };

const PACKAGE_DIR = path.join(process.cwd(), "node_modules", "@zoworkhq", "forms");

/** Doc comment text without the comment markers. */
function docOf(node: ts.Node, text: string): string | null {
  const ranges = ts.getLeadingCommentRanges(text, node.pos) ?? [];
  const jsdoc = ranges.map((r) => text.slice(r.pos, r.end)).filter((c) => c.startsWith("/**")).pop();
  if (!jsdoc) return null;
  return jsdoc
    .replace(/^\/\*\*|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `name = value` pairs in the parameter list of `function <fn>({ … })`. */
function destructuredDefaults(js: string, fn: string): Map<string, string> {
  const start = js.indexOf(`function ${fn}({`);
  if (start < 0) throw new Error(`dist/react/index.js has no function ${fn}({ … })`);
  const params = js.slice(start, js.indexOf("})", start));
  const out = new Map<string, string>();
  for (const [, name, value] of params.matchAll(/^\s*(\w+)\s*=\s*(.+?),?\s*$/gm)) {
    const number = Number(value);
    out.set(name, Number.isFinite(number) ? String(number) : value.replace(/^"(.*)"$/, "'$1'"));
  }
  return out;
}

export function formRendererReference(dir = PACKAGE_DIR): Reference {
  const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version as string;
  const dtsPath = path.join(dir, "dist", "react", "index.d.ts");
  const text = fs.readFileSync(dtsPath, "utf8");
  const file = ts.createSourceFile(dtsPath, text, ts.ScriptTarget.Latest, true);
  const props = file.statements.find(
    (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === "FormRendererProps",
  );
  if (!props) throw new Error("dist/react/index.d.ts has no interface FormRendererProps");

  // FormRenderer passes every prop but drafts and onDraftProblem on to FillForm, which sets the defaults.
  const js = fs.readFileSync(path.join(dir, "dist", "react", "index.js"), "utf8");
  const defaults = new Map([...destructuredDefaults(js, "FormRenderer"), ...destructuredDefaults(js, "FillForm")]);

  return {
    package: `@zoworkhq/forms ${version}`,
    source: "dist/react/index.d.ts (interface FormRendererProps) and dist/react/index.js (defaults)",
    props: props.members.filter(ts.isPropertySignature).map((m) => {
      const name = m.name.getText(file);
      return {
        name,
        type: m.type ? m.type.getText(file).replace(/\s+/g, " ") : "unknown",
        required: !m.questionToken,
        default: defaults.get(name) ?? null,
        doc: docOf(m, text),
      };
    }),
  };
}
