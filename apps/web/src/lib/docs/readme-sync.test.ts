import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { describe, expect, it } from "vitest";
import { isDeveloperPage } from "./code-examples";
import { CONTENT_DIR, getLivePages, getPage, readReference, type DocsPage } from "./content";
import { textOf, walk, type MdNode } from "./mdast";
import { cssReference, typeReference } from "./reference";

/*
 * Keeping the developer pages and the renderer's README in step (docs brief,
 * "Not contradicting the README"). Three things:
 *   - renderer-sources.json pins the README and both contracts by hash, so any
 *     change to one stops here until someone re-reads the pages against it;
 *   - what both state as data (props and their defaults, the drafts options,
 *     engines and peers) is compared;
 *   - every message the pages quote must be a message the package really has.
 *
 * After a package upgrade, re-read the README's diff against these pages, then
 * regenerate the pin with
 *
 *   DOCS_WRITE_REFERENCE=1 pnpm --filter web exec vitest run src/lib/docs/readme-sync.test.ts
 */

const PACKAGE_DIR = path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms");
const REPO_DOCS = path.join(process.cwd(), "..", "..", "docs");
const PIN = path.join(CONTENT_DIR, "integrate", "renderer-sources.json");

const sha256 = (text: string) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const read = (full: string) => fs.readFileSync(full, "utf8");

const readme = read(path.join(PACKAGE_DIR, "README.md"));
const manifest = JSON.parse(read(path.join(PACKAGE_DIR, "package.json"))) as {
  version: string;
  engines: { node: string };
  exports: Record<string, unknown>;
  peerDependencies: Record<string, string>;
};
const tree = unified().use(remarkParse).use(remarkGfm).parse(readme) as unknown as MdNode;

/** The first table after a heading, as rows of cell text. */
function tableAfter(heading: string): string[][] {
  const nodes = tree.children ?? [];
  const at = nodes.findIndex((n) => n.type === "heading" && textOf(n) === heading);
  const table = nodes.slice(at).find((n) => n.type === "table");
  if (at < 0 || !table) throw new Error(`The README has no table after "${heading}"`);
  return (table.children ?? []).map((row) => (row.children ?? []).map(textOf));
}

/** The first code block after a heading. */
function codeAfter(heading: string): string {
  const nodes = tree.children ?? [];
  const at = nodes.findIndex((n) => n.type === "heading" && textOf(n) === heading);
  const code = nodes.slice(at).find((n) => n.type === "code");
  if (at < 0 || !code?.value) throw new Error(`The README has no code after "${heading}"`);
  return code.value;
}

describe("the sources the developer pages were read against", () => {
  const fresh = {
    package: `@zoworkhq/zoforms ${manifest.version}`,
    readme: sha256(readme),
    groupsAndPagesContract: sha256(read(path.join(REPO_DOCS, "GROUPS-AND-PAGES-CONTRACT.md"))),
    draftsContract: sha256(read(path.join(REPO_DOCS, "DRAFTS-CONTRACT.md"))),
  };
  if (process.env.DOCS_WRITE_REFERENCE) fs.writeFileSync(PIN, `${JSON.stringify(fresh, null, 2)}\n`);

  it("haven't changed since. If this fails, re-read the pages against what changed", () => {
    expect(JSON.parse(read(PIN))).toEqual(fresh);
  });
});

describe("the FormRenderer page and the README", () => {
  const rows = tableAfter("FormRenderer props").slice(1);
  const props = readReference("integrate/reference/form-renderer")!.props;

  it("list the same props", () => {
    expect(rows.map((r) => r[0])).toEqual(props.map((p) => p.name));
  });

  it("give the same defaults", () => {
    expect(rows.map((r) => r[2])).toEqual(props.map((p) => (p.required ? "required" : p.default ?? "")));
  });

  it("give the same options for drafts", () => {
    const options = [...codeAfter("Drafts and data in the browser").matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
    const [drafts] = typeReference(["DraftsOptions"]).types;
    expect(options).toEqual(drafts.members.map((m) => m.name));
  });
});

describe("the Content Security Policy page and the README", () => {
  it("give the same policy, word for word", () => {
    const page = getPage("integrate/content-security-policy")!;
    const policy = [...walk(page.tree)].find((n) => n.type === "code" && n.lang === "text")?.value;
    expect(policy).toBe(codeAfter("Content Security Policy"));
  });

  it("say the same about Trusted Types and the progress bar", () => {
    const page = getPage("integrate/content-security-policy")!;
    for (const sentence of [
      "It also works with `require-trusted-types-for 'script'`.",
      "The bar then shows, even if the author didn't ask for",
    ]) {
      expect(readme.replace(/\s+/g, " ")).toContain(sentence);
      expect(page.body.replace(/\s+/g, " ")).toContain(sentence);
    }
  });
});

describe("what changed in 0.28.1, on the pages and in the README", () => {
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const body = (slug: string) => flat(getPage(slug)!.body);

  it("give the same cases that need the as FormSchema cast", () => {
    const listed = /A schema imported from JSON needs a cast when it has (.+?)\. /.exec(flat(readme))?.[1];
    const cases = (listed ?? "").split(/, | or /);
    expect(cases).toEqual(["conditions", "pages", "a `drafts` mode", "a `navigation.progressStyle`"]);
    for (const slug of ["integrate/frameworks", "integrate/reference/form-renderer"]) {
      for (const one of cases) expect(body(slug), `${slug}: ${one}`).toContain(one);
      expect(body(slug), slug).toMatch(/[Cc]ast every (file|schema)/);
    }
  });

  it("say no new React key is needed after a refusal", () => {
    const sentence = "No new React `key` is needed.";
    expect(flat(readme)).toContain(sentence);
    for (const slug of ["integrate/handle-errors", "integrate/reference/form-renderer", "integrate/tutorial-nextjs"]) expect(body(slug), slug).toContain(sentence);
    for (const page of getLivePages().filter((p) => isDeveloperPage(p.slug))) expect(flat(page.body), page.slug).not.toMatch(/tries again when it gets a new React `key`/);
  });

  it("give the same bounds for the body's formVersionId", () => {
    expect(flat(readme)).toContain("a `formVersionId` that isn't text of 1–256 characters");
    expect(body("integrate/reference/posted-body")).toContain("isn't text of 1–256 characters");
    expect(body("integrate/reference/prepare-submission")).toContain("isn't text of 1–256 characters");
  });
});

describe("the overview and the package", () => {
  const page = getPage("integrate/overview")!;

  it("name the three entry points the package exports", () => {
    expect(Object.keys(manifest.exports).sort()).toEqual(["./core", "./react", "./styles.css"]);
    for (const entry of Object.keys(manifest.exports)) expect(page.body).toContain(`@zoworkhq/zoforms/${entry.slice(2)}`);
  });

  it("state the same requirements", () => {
    expect(manifest.engines.node).toBe(">=20");
    expect(manifest.peerDependencies).toEqual({ react: "^18.0.0 || ^19.0.0", "react-dom": "^18.0.0 || ^19.0.0" });
    expect(readme).toContain("It needs `react` and `react-dom` 18 or 19. On a server, `/core` needs Node 20 or later.");
    expect(page.body).toContain("It needs `react` and `react-dom` 18 or 19, and on a server `/core` needs Node 20 or later.");
  });
});

describe("the README's custom properties and the stylesheet", () => {
  // The CSS reference shows the stylesheet's defaults and the README's "Used for"; here the README's own defaults must agree.
  const properties = cssReference().properties;
  const rowsOf = (bold: string) => {
    const nodes = tree.children ?? [];
    const at = nodes.findIndex((n) => n.type === "paragraph" && textOf(n).startsWith(`${bold}.`));
    const table = nodes.slice(at).find((n) => n.type === "table");
    if (at < 0 || !table) throw new Error(`The README has no table after "${bold}."`);
    return (table.children ?? []).slice(1).map((row) => (row.children ?? []).map(textOf));
  };
  const byName = (name: string) => properties.find((p) => p.name === name)!;

  it("give the same colours, light and dark", () => {
    for (const [name, light, dark] of rowsOf("Colours")) expect([name, light.toLowerCase(), dark.toLowerCase()]).toEqual([name, byName(name).light?.toLowerCase(), byName(name).dark?.toLowerCase()]);
  });

  it("give the same density values", () => {
    for (const [name, patient, standard, dense] of rowsOf("Density")) expect([name, patient, standard, dense]).toEqual([name, ...Object.values(byName(name).density!)]);
  });

  it("give the same shape and type defaults", () => {
    for (const [name, fallback] of rowsOf("Shape and type")) expect([name, fallback.startsWith("none") ? null : fallback]).toEqual([name, byName(name).light]);
  });

  it("describe each derived default by the properties and percentage the stylesheet uses", () => {
    for (const [name, fallback] of rowsOf("Derived")) {
      const css = byName(name).light!;
      for (const used of css.match(/--zf-[\w-]+|\d+(?:\.\d+)?(?:%|rem)/g) ?? []) expect(fallback, name).toContain(used);
    }
  });
});

describe("the messages the developer pages quote", () => {
  const dist = path.join(PACKAGE_DIR, "dist");
  /** The package's strings as a reader sees them, em dashes and all. */
  const decode = (js: string) => js.replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\\"/g, '"');
  const corpus = decode(read(path.join(dist, "react", "index.js")) + fs.readdirSync(dist).filter((f) => f.endsWith(".js")).map((f) => read(path.join(dist, f))).join("\n"));

  /** The package's template strings, each as a pattern: a message with a value in it. */
  const templates = [...corpus.matchAll(/`([^`\n]*\$\{[^`\n]*)`/g)]
    // Enough words of its own that it can't match just anything.
    .filter((m) => m[1].replace(/\$\{.*?\}/g, "").length >= 12)
    .map((m) => new RegExp(`^${m[1].replace(/[.*+?^()|[\]\\]/g, "\\$&").replace(/\$\{.*?\}/g, ".*")}$`));

  const inCorpus = (message: string) => {
    if (corpus.includes(message) || templates.some((t) => t.test(message))) return true;
    // A page writes {label} where the package builds the text from the question.
    const parts = message.split(/\{\w+\}/).filter(Boolean);
    return /\{\w+\}/.test(message) && parts.every((p) => corpus.includes(p));
  };

  const quotedIn = (page: DocsPage) => {
    const found: string[] = [];
    for (const node of walk(page.tree)) {
      if (node.type === "text") for (const [, quoted] of (node.value ?? "").matchAll(/"([A-Z][^"\n]*[.?!])"/g)) found.push(quoted);
      // Messages holding quotation marks are in code, whole.
      if (node.type === "inlineCode" && /^(Invalid submission|clearDrafts |This form uses|Submission failed|Must be at|"\{label\}"|Answer every|Rank every|Cannot validate|validators\[)/.test(node.value ?? "")) found.push(node.value ?? "");
    }
    return found;
  };

  const pages = getLivePages().filter((p) => isDeveloperPage(p.slug));

  it("finds them", () => {
    expect(pages.flatMap(quotedIn).length).toBeGreaterThan(20);
  });

  /** What an example page may also quote: its form file's labels, and its own validators' messages. */
  const ownWords = (page: DocsPage) => {
    if (!page.slug.startsWith("examples/")) return "";
    const dir = path.join(CONTENT_DIR, "examples");
    const name = page.slug.split("/")[1];
    return [`${name}.form.json`, `${name}.validators.js`].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => read(path.join(dir, f))).join("\n");
  };

  it.each(pages.map((p) => [p.slug, p] as const))("%s quotes only real messages", (_, page) => {
    const own = ownWords(page);
    expect(quotedIn(page).filter((m) => !inCorpus(m) && !own.includes(m))).toEqual([]);
  });

  it("fails on a message the package doesn't have", () => {
    expect(inCorpus("Form submitted successfully.")).toBe(true);
    expect(inCorpus("Form was submitted successfully.")).toBe(false);
    expect(inCorpus("Submission failed with status 422")).toBe(true);
    expect(inCorpus("Submission failed: status 422")).toBe(false);
  });
});
