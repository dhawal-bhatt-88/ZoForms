import fs from "node:fs";
import path from "node:path";
import postcss, { type AtRule } from "postcss";
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

const PACKAGE_DIR = path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms");

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

const packageName = (dir: string) => `@zoworkhq/zoforms ${JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version as string}`;

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
    throw new Error(`@zoworkhq/zoforms declares no "${name}"`);
  };
  return { package: packageName(dir), types: [...new Set(names)].sort().map(find) };
}

/* ---------- CSS: classes, custom properties and host hooks ---------- */

export type CssClass = { key: string; name: string; doc: string | null };

export type CssProperty = {
  name: string;
  /** The README's table it is in: "Colours", "Derived", "Shape and type" or "Density". */
  group: string;
  /** The README's "Used for". */
  usedFor: string;
  /** The stylesheet's default, as CSS, with its private --_zf- names written as the public ones; null when there is none. */
  light: string | null;
  /** The dark theme's default, when it has its own. */
  dark: string | null;
  /** Each density's default, for the properties that follow density. */
  density: { patient: string; standard: string; dense: string } | null;
  /** A default the stylesheet changes in a media query. */
  media: { query: string; value: string } | null;
};

export type CssHook = { attribute: string; values: string[] };

export type CssReference = { package: string; source: string; classes: CssClass[]; properties: CssProperty[]; hooks: CssHook[] };

/** The README's tables after "Custom properties", each named by the bold word before it ("Colours."). */
function readmePropertyTables(readme: string): Map<string, { group: string; usedFor: string }> {
  const out = new Map<string, { group: string; usedFor: string }>();
  const lines = readme.replace(/\r\n/g, "\n").split("\n");
  let group = "";
  for (const line of lines.slice(lines.indexOf("### Custom properties"))) {
    if (line.startsWith("## ")) break;
    const bold = /^\*\*([^*]+?)\.\*\*/.exec(line);
    if (bold) group = bold[1];
    const row = /^\| `(--zf-[\w-]+)` \|(.*)\|$/.exec(line);
    if (row) out.set(row[1], { group, usedFor: row[2].split("|").pop()!.trim() });
  }
  return out;
}

export function cssReference(dir = PACKAGE_DIR): CssReference {
  const dtsPath = path.join(dir, "dist", "react", "index.d.ts");
  const text = fs.readFileSync(dtsPath, "utf8");
  const file = ts.createSourceFile(dtsPath, text, ts.ScriptTarget.Latest, true);
  const statement = file.statements.find((s): s is ts.VariableStatement => ts.isVariableStatement(s) && declaredName(s) === "classNames");
  const literal = statement?.declarationList.declarations[0].type;
  if (!literal || !ts.isTypeLiteralNode(literal)) throw new Error("dist/react/index.d.ts declares no classNames type literal");
  const classes = literal.members.filter(ts.isPropertySignature).map((m) => ({
    key: m.name.getText(file),
    name: m.type!.getText(file).replace(/^"|"$/g, ""),
    doc: docOf(m, text),
  }));

  const root = postcss.parse(fs.readFileSync(path.join(dir, "dist", "styles.css"), "utf8"));
  const publicName = (css: string) => css.replace(/var\(--_zf-([\w-]+)\)/g, "var(--zf-$1)");
  /** `--_zf-x: var(--zf-x, fallback)` → fallback, or null with none. */
  const fallbackOf = (value: string, name: string) => {
    const head = `var(${name}`;
    const trimmed = value.trim();
    if (!trimmed.startsWith(head) || !trimmed.endsWith(")")) return null;
    const inner = trimmed.slice(head.length, -1).replace(/^\s*,/, "").trim();
    return inner === "" ? null : inner;
  };
  const light = new Map<string, string | null>();
  const dark = new Map<string, string>();
  const media = new Map<string, { query: string; value: string }>();
  const densities: Record<string, Map<string, string>> = { patient: new Map(), standard: new Map(), dense: new Map() };
  const hooks = new Map<string, Set<string>>();
  root.walkRules((rule) => {
    for (const [, attribute, value] of rule.selector.matchAll(/\[(data-zf-[\w-]+)=([\w-]+)\]/g)) hooks.set(attribute, (hooks.get(attribute) ?? new Set()).add(value));
    const density = /^:where\(\[data-zf-density=(\w+)\]\)$/.exec(rule.selector)?.[1];
    const parent = rule.parent as AtRule | undefined;
    const inMedia = parent?.type === "atrule" && parent.name === "media" ? parent.params : null;
    rule.walkDecls(/^--_zf-/, (decl) => {
      const name = decl.prop.replace("--_zf-", "--zf-");
      if (density) return void densities[density].set(decl.prop, decl.value.trim());
      if (!decl.value.includes(`var(${name}`)) return;
      const fallback = fallbackOf(decl.value, name);
      if (inMedia) media.set(name, { query: inMedia, value: publicName(fallback ?? "") });
      else if (rule.selector.includes("[data-zf-theme=dark]")) dark.set(name, publicName(fallback ?? ""));
      else if (!light.has(name)) light.set(name, fallback);
    });
  });

  const readme = readmePropertyTables(fs.readFileSync(path.join(dir, "README.md"), "utf8"));
  const properties = [...light.entries()].map(([name, fallback]): CssProperty => {
    const fromReadme = readme.get(name);
    if (!fromReadme) throw new Error(`The README's custom property tables have no ${name}`);
    const viaDensity = fallback ? /^var\((--_zf-density-[\w-]+),\s*(.+)\)$/.exec(fallback) : null;
    return {
      name,
      ...fromReadme,
      light: viaDensity ? viaDensity[2] : fallback === null ? null : publicName(fallback),
      dark: dark.get(name) ?? null,
      density: viaDensity
        ? { patient: densities.patient.get(viaDensity[1])!, standard: densities.standard.get(viaDensity[1])!, dense: densities.dense.get(viaDensity[1])! }
        : null,
      media: media.get(name) ?? null,
    };
  });
  const order = ["Colours", "Derived", "Shape and type", "Density"];
  properties.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || [...readme.keys()].indexOf(a.name) - [...readme.keys()].indexOf(b.name));

  return {
    package: packageName(dir),
    source: "dist/react/index.d.ts (classNames), dist/styles.css (defaults and hooks), README.md (each property's table and use)",
    classes,
    properties,
    hooks: [...hooks.entries()].map(([attribute, values]) => ({ attribute, values: [...values] })),
  };
}
