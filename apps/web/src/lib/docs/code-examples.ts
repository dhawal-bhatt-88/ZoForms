import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CONTENT_DIR, type DocsPage } from "./content";
import { fenceWords, walk } from "./mdast";

/*
 * The code on the developer pages, as a test reads it (docs brief, "Every code
 * example is tested"). Each fence says how it is checked, in the words after
 * its language:
 *
 *   ```js file=server.js check=esm run=server
 *
 *   file=     the reader's file name, shown on the block. Fences on one page
 *             share a folder, so they can import each other.
 *   in=       a folder of its own for the file, so two versions of one file
 *             (JavaScript and TypeScript) don't meet. Not shown.
 *   check=    esm        a complete Node module (ES modules)
 *             cjs        a complete Node module (CommonJS)
 *             browser    a complete module for a bundler
 *             fragment   a JSX expression, such as <FormRenderer … />
 *             statements lines of code, run inside an async function
 *             app        compiled only by the real-app check: it needs a
 *                        project this repo doesn't have (e2e/verify-dev-docs-apps.js)
 *             body       a JSON body prepareSubmission must accept
 *             stored     the JSON prepareSubmission stores for the body named by of=
 *   run=      server     started with real Node, and posted to at route=
 *             handler    a route handler's POST, called with a real Request
 *             node       run with real Node, and must exit 0
 *             browser    rendered with the real FormRenderer
 *   form=     the form file a server or body is for: intake (the default) or
 *             visit-feedback
 *   auth=     the token a server wants, as "Authorization: Bearer <token>"
 *   limit=    the server's body-size limit: a bigger body must get a 413
 *   rejects=  a question one of the page's validators refuses a long answer to
 *   name=, of= a body's name, and the stored submission that answers it
 *   stub=     replaced by a recording stand-in when a server runs: what the
 *             reader swaps for their own storage.
 *
 * Fragments and statements are wrapped with fragmentPrelude, whose names are
 * real values, so one wrapped file is both type-checked and rendered. A name
 * outside the prelude fails the type-check.
 */

export type ExampleCheck = "esm" | "cjs" | "browser" | "fragment" | "statements" | "app" | "body" | "stored";

export type CodeExample = {
  /** "integrate/quickstart". */
  page: string;
  /** The line of the fence in the .mdx file, for messages. */
  line: number;
  lang: string;
  code: string;
  words: Record<string, string>;
  check?: ExampleCheck;
  run?: string;
  /** The file's path in the page's folder. */
  file: string;
};

/** The fences the test reads: those of every developer page. */
export const isDeveloperPage = (slug: string) => /^(integrate|compliance)\//.test(slug);

/** Where the extracted files go. Git ignores it, and tsconfig's globs skip a folder starting with a dot. */
export const CHECK_DIR = path.join(process.cwd(), ".docs-check");

export const pageFolder = (slug: string, root = CHECK_DIR) => path.join(root, slug.replace(/\//g, "__"));

const COMPILED_LANGS = ["js", "jsx", "ts", "tsx"];

const defaultFile = (lang: string, check: ExampleCheck | undefined, index: number) => {
  if (check === "fragment" || check === "statements") return `_example-${index}.tsx`;
  return `_example-${index}.${check === "cjs" ? "cjs" : lang}`;
};

/** The page's fences in order, each with its words read and a file to go in. */
export function examplesOf(page: DocsPage): CodeExample[] {
  // The MDX body starts below the frontmatter, and the parser counts from there.
  const offset = fs.readFileSync(path.join(CONTENT_DIR, page.file), "utf8").split("\n").length - page.body.split("\n").length;
  const out: CodeExample[] = [];
  for (const node of walk(page.tree)) {
    if (node.type !== "code") continue;
    const lang = node.lang ?? "";
    const words = fenceWords(node.meta);
    const check = words.check as ExampleCheck | undefined;
    out.push({
      page: page.slug,
      line: (node.position?.start.line ?? 0) + offset,
      lang,
      code: node.value ?? "",
      words,
      check,
      run: words.run,
      file: path.posix.join(words.in ?? "", words.file ?? defaultFile(lang, check, out.length)),
    });
  }
  return out;
}

/** Why a fence can't be checked, or null. */
export function fenceProblem(example: CodeExample): string | null {
  if (!COMPILED_LANGS.includes(example.lang)) return null;
  if (!example.check) return "has no check=";
  if (!["esm", "cjs", "browser", "fragment", "statements", "app"].includes(example.check)) return `has an unknown check=${example.check}`;
  return null;
}

/**
 * What every fragment and statements block can use: the two entry points, and
 * real stand-ins for what a reader's app would have.
 */
export const fragmentPrelude = `
import { FormRenderer, clearDrafts, ClearDraftsError, type DraftsOptions } from '@zoworkhq/forms/react';
import { calculateScores, prepareSubmission, validateSubmission, type FieldValidator, type FormSchema } from '@zoworkhq/forms/core';
import data from './intake-form.json';

const schema = data as FormSchema;
const body: unknown = {};
const user = { id: 'user-demo-1' };
const userId = user.id;
const patient = { id: 'client-demo-1', displayName: 'Demo Client' };
const scope = user.id + ':' + patient.id;
const router = { push: (_url: string) => {} };
const getAccessToken = async () => 'demo-token';
const getDraftKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const draftOptions: DraftsOptions = { mode: 'off' };
const validators: FieldValidator[] = [];
const reportError = (_error: unknown) => {};
const report = (_error: unknown, _stack?: string) => {};
void [FormRenderer, clearDrafts, ClearDraftsError, calculateScores, prepareSubmission, validateSubmission];
void [schema, body, user, userId, patient, scope, router, getAccessToken, getDraftKey, draftOptions, validators, reportError, report];
`;

/** A block as the file that goes on disk: wrapped, or word for word. */
function fileText(example: CodeExample): string {
  if (example.check === "fragment") {
    return `${fragmentPrelude}\nexport default function Example() {\n  return (\n<>\n${example.code}\n</>\n  );\n}\n`;
  }
  if (example.check === "statements") return `${fragmentPrelude}\nexport default async function example() {\n${example.code}\n}\n`;
  return `${example.code}\n`;
}

/** The form file a reader imports, as this repo's real download. */
export const INTAKE_FORM = path.join(CONTENT_DIR, "integrate", "intake-form.form.json");

/** Every form file the pages' code may load, by the name the code uses: real downloads. */
export const FORM_FILES: Record<string, string> = {
  "intake-form.json": INTAKE_FORM,
  "visit-feedback.json": path.join(CONTENT_DIR, "integrate", "visit-feedback.form.json"),
};

const isWrapped = (e: CodeExample) => e.check === "fragment" || e.check === "statements";

type FormTarget = { name: string; typedBy: boolean };

/**
 * Where a block loads a form file from: beside the page's top folder and src/,
 * and any relative path it names. `typedBy` is true when a TypeScript block
 * imports it, which must cast it; JavaScript gets it typed as a FormSchema.
 */
function formFileTargets(examples: readonly CodeExample[]): Map<string, FormTarget> {
  const targets = new Map<string, FormTarget>();
  const add = (target: string, name: string, typedBy = false) => {
    // Never outside the page's folder.
    if (target.startsWith("..")) return;
    targets.set(target, { name, typedBy: typedBy || (targets.get(target)?.typedBy ?? false) });
  };
  for (const name of Object.keys(FORM_FILES)) {
    add(name, name);
    add(path.posix.join("src", name), name);
  }
  for (const example of examples) {
    const typed = /\.tsx?$/.test(example.file) && !isWrapped(example);
    for (const [, relative, name] of example.code.matchAll(/['"`](\.{1,2}\/(?:[^'"`]*\/)?([\w-]+\.json))['"`]/g)) {
      if (!FORM_FILES[name]) continue;
      // An import is relative to its file; readFileSync, to the folder the server starts in.
      add(path.posix.normalize(path.posix.join(path.posix.dirname(example.file), relative)), name, typed);
      add(path.posix.normalize(relative), name);
    }
  }
  return targets;
}

/** JavaScript has no cast, so JS blocks see the form file as a FormSchema. TypeScript blocks import the real file and need theirs. */
const FORM_FILE_TYPES = `import type { FormSchema } from '@zoworkhq/forms/core';\ndeclare const schema: FormSchema;\nexport default schema;\n`;

/**
 * Every block on disk, one folder per page, ready to compile and run. Returns
 * the folder. Replaces what was there, so a removed fence leaves nothing behind.
 */
export function writeProject(slug: string, examples: readonly CodeExample[], root = CHECK_DIR): string {
  const dir = pageFolder(slug, root);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }\n');
  const forms = formFileTargets(examples.filter((e) => COMPILED_LANGS.includes(e.lang)));
  for (const [target, { name, typedBy }] of forms) {
    fs.mkdirSync(path.dirname(path.join(dir, target)), { recursive: true });
    fs.copyFileSync(FORM_FILES[name], path.join(dir, target));
    if (!typedBy) fs.writeFileSync(path.join(dir, target.replace(/\.json$/, ".d.json.ts")), FORM_FILE_TYPES);
  }
  for (const example of examples) {
    if (!COMPILED_LANGS.includes(example.lang) || example.check === "app") continue;
    const full = path.join(dir, example.file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, fileText(example));
  }
  return dir;
}

const BASE: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowJs: true,
  checkJs: true,
};

/** How each kind of block is compiled. Strict everywhere, but JS parameters need no annotations, as a JS reader's don't. */
const PROGRAMS: { name: string; options: ts.CompilerOptions; matches: (e: CodeExample) => boolean }[] = (() => {
  const isTs = (e: CodeExample) => /\.tsx?$/.test(e.file);
  const node: ts.CompilerOptions = {
    ...BASE,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ["lib.es2022.d.ts"],
    types: ["node"],
  };
  const browser: ts.CompilerOptions = {
    ...BASE,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.dom.d.ts", "lib.dom.iterable.d.ts", "lib.es2022.d.ts"],
    types: [],
    jsx: ts.JsxEmit.ReactJSX,
    resolveJsonModule: true,
    allowArbitraryExtensions: true,
  };
  const inNode = (e: CodeExample) => e.check === "esm" || e.check === "cjs";
  const inBrowser = (e: CodeExample) => e.check === "browser" || e.check === "fragment" || e.check === "statements";
  return [
    { name: "Node, JavaScript", options: { ...node, noImplicitAny: false }, matches: (e) => inNode(e) && !isTs(e) },
    { name: "Node, strict TypeScript", options: node, matches: (e) => inNode(e) && isTs(e) },
    { name: "bundler, JavaScript", options: { ...browser, noImplicitAny: false }, matches: (e) => inBrowser(e) && !isTs(e) },
    { name: "bundler, strict TypeScript", options: browser, matches: (e) => inBrowser(e) && isTs(e) },
  ];
})();

export type CompileError = { where: string; message: string };

/** Every compile error in every block, each named by its page, file and line in the .mdx. */
export function compileExamples(examples: readonly CodeExample[]): { programs: string[]; errors: CompileError[] } {
  const errors: CompileError[] = [];
  const programs: string[] = [];
  for (const { name, options, matches } of PROGRAMS) {
    const chosen = examples.filter(matches);
    if (chosen.length === 0) continue;
    programs.push(name);
    const onDisk = (e: CodeExample) => path.join(pageFolder(e.page), e.file).split(path.sep).join("/");
    // Lower case only to look a diagnostic's file up: Windows may report a drive letter in either case.
    const fileOf = new Map(chosen.map((e) => [onDisk(e).toLowerCase(), e]));
    const program = ts.createProgram({ rootNames: chosen.map(onDisk), options });
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
      const file = diagnostic.file?.fileName.toLowerCase();
      if (file && !file.includes(".docs-check")) continue;
      const example = file ? fileOf.get(file) : undefined;
      const at = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line : 0;
      const wrapped = example?.check === "fragment" || example?.check === "statements";
      const where = example
        ? `${example.page}.mdx, the fence at line ${example.line}${wrapped ? "" : `, its line ${at + 1}`}`
        : `${diagnostic.file?.fileName ?? "the compiler"} (${name})`;
      errors.push({ where, message: `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}` });
    }
  }
  return { programs, errors };
}
