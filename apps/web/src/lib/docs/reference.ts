import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/*
 * The reference tables, read from the installed package rather than written by
 * hand (docs brief, "Accuracy rules"):
 *   - names, types, required and each member's doc comment from the .d.ts files;
 *   - FormRenderer's defaults from dist/react/index.js, where FillForm's props
 *     are destructured with them. The types can't say what a default is.
 *
 * The results are committed beside each page (<page>.props.json for
 * FormRenderer's props, <page>.types.json for anything else a page shows) and
 * reference.test.ts fails when the package and those files disagree. Only tests
 * and the generator import this module: it needs the TypeScript compiler, which
 * the pages never load.
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

/** One exported declaration: its text as the package declares it, and its members when it has any. */
export type ReferenceType = {
  name: string;
  /** Which .d.ts file declares it, relative to dist. */
  file: string;
  /** The declaration without comments or `declare`. */
  text: string;
  doc: string | null;
  members: Omit<ReferenceProp, "default">[];
};

export type TypeReference = { package: string; types: ReferenceType[] };

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

const packageName = (dir: string) => `@zoworkhq/forms ${JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version as string}`;

export function formRendererReference(dir = PACKAGE_DIR): Reference {
  const dtsPath = path.join(dir, "dist", "react", "index.d.ts");
  const text = fs.readFileSync(dtsPath, "utf8");
  const file = ts.createSourceFile(dtsPath, text, ts.ScriptTarget.Latest, true);
  const props = file.statements.find(
    (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === "FormRendererProps",
  );
  if (!props) throw new Error("dist/react/index.d.ts has no interface FormRendererProps");

  // FormRenderer passes every prop but drafts, onDraftProblem and onRenderError on to FillForm, which sets the defaults.
  const js = fs.readFileSync(path.join(dir, "dist", "react", "index.js"), "utf8");
  const defaults = destructuredDefaults(js, "FillForm");

  return {
    package: packageName(dir),
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

/**
 * The package's declaration files: its two entry points and the shared types
 * file, whose name carries a build hash.
 */
function declarationFiles(dir: string): string[] {
  const dist = path.join(dir, "dist");
  const shared = fs.readdirSync(dist).filter((f) => /^types-.*\.d\.ts$/.test(f));
  return [path.join("core", "index.d.ts"), path.join("react", "index.d.ts"), ...shared];
}

type Declaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.FunctionDeclaration | ts.ClassDeclaration | ts.VariableStatement;

function declaredName(node: ts.Statement): string | undefined {
  if (ts.isVariableStatement(node)) {
    const [first] = node.declarationList.declarations;
    return ts.isIdentifier(first.name) ? first.name.text : undefined;
  }
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return node.name?.text;
  }
}

const printer = ts.createPrinter({ removeComments: true });

/** A member's own type text, on one line. */
const typeText = (node: ts.TypeNode | undefined, file: ts.SourceFile) => (node ? node.getText(file).replace(/\s+/g, " ") : "unknown");

function membersOf(node: Declaration, file: ts.SourceFile, text: string): ReferenceType["members"] {
  if (!ts.isInterfaceDeclaration(node) && !ts.isClassDeclaration(node)) return [];
  const members: ReferenceType["members"] = [];
  for (const m of node.members) {
    if ((ts.isPropertySignature(m) || ts.isPropertyDeclaration(m)) && m.name) {
      members.push({ name: m.name.getText(file), type: typeText(m.type, file), required: !m.questionToken, doc: docOf(m, text) });
    }
  }
  return members;
}

/**
 * The named exports of /core and /react, as `<page>.types.json` holds them.
 * A name the package doesn't declare throws, so a page can't show a table of
 * something that has gone.
 */
export function typeReference(names: readonly string[], dir = PACKAGE_DIR): TypeReference {
  const files = declarationFiles(dir).map((rel) => {
    const full = path.join(dir, "dist", rel);
    const text = fs.readFileSync(full, "utf8");
    return { rel: rel.split(path.sep).join("/"), text, file: ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true) };
  });
  const find = (name: string): ReferenceType => {
    for (const { rel, text, file } of files) {
      const node = file.statements.find((s) => declaredName(s) === name) as Declaration | undefined;
      if (!node) continue;
      return {
        name,
        // The shared file's name changes with every build of the package.
        file: rel.startsWith("types-") ? "types.d.ts" : rel,
        text: printer.printNode(ts.EmitHint.Unspecified, node, file).replace(/^declare /, "").trim(),
        doc: docOf(node, text),
        members: membersOf(node, file, text),
      };
    }
    throw new Error(`@zoworkhq/forms declares no "${name}"`);
  };
  return { package: packageName(dir), types: [...new Set(names)].sort().map(find) };
}
