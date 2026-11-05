import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import * as core from "@zoworkhq/zoforms/core";
import * as react from "@zoworkhq/zoforms/react";
import { prepareSubmission, type FormSchema } from "@zoworkhq/zoforms/core";
import { CONTENT_DIR, getLivePages, getPage, readCss, readReference, readTypes } from "./content";
import { attributesOf, textOf, walk } from "./mdast";
import { livePages } from "./nav";
import { cssReference, formRendererReference, typeReference } from "./reference";

/*
 * The drift tests for the reference pages (docs brief, "Accuracy rules"). The
 * tables on a page come from <page>.props.json and <page>.types.json; these
 * fail when the installed package says something else, or when a page leaves a
 * member out. After a package upgrade, regenerate the files with
 *
 *   DOCS_WRITE_REFERENCE=1 pnpm --filter web exec vitest run src/lib/docs/reference.test.ts
 *
 * and re-read every entry the diff touches before committing it.
 */

const SLUG = "integrate/reference/form-renderer";
const FILE = path.join(CONTENT_DIR, `${SLUG}.props.json`);

describe("the FormRenderer reference", () => {
  const fresh = formRendererReference();
  if (process.env.DOCS_WRITE_REFERENCE) fs.writeFileSync(FILE, `${JSON.stringify(fresh, null, 2)}\n`);

  it("matches the installed package's types and defaults", () => {
    expect(readReference(SLUG)).toEqual(fresh);
  });

  it("reads what the package says", () => {
    const byName = new Map(fresh.props.map((p) => [p.name, p]));
    expect(byName.get("schema")).toMatchObject({ type: "FormSchema", required: true, default: null });
    expect(byName.get("credentials")?.default).toBe("'same-origin'");
    expect(byName.get("timeoutMs")?.default).toBe("30000");
  });

  it("has one entry on the page for every prop, in the package's order", () => {
    const page = getPage(SLUG)!;
    const entries = [...walk(page.tree)].filter((n) => n.name === "Prop").map((n) => attributesOf(n).name);
    expect(entries).toEqual(fresh.props.map((p) => p.name));
    expect([...walk(page.tree)].some((n) => n.name === "PropsAtAGlance")).toBe(true);
  });
});

/** The types and functions a page shows. */
const shownOn = (slug: string) =>
  [...walk(getPage(slug)!.tree)].filter((n) => n.name === "Signature" || n.name === "FieldList").map((n) => attributesOf(n).of);

describe.each(getLivePages().filter((p) => shownOn(p.slug).length > 0).map((p) => [p.slug] as const))("the tables on %s", (slug) => {
  const fresh = typeReference(shownOn(slug));
  if (process.env.DOCS_WRITE_REFERENCE) fs.writeFileSync(path.join(CONTENT_DIR, `${slug}.types.json`), `${JSON.stringify(fresh, null, 2)}\n`);

  it("match the installed package's types", () => {
    expect(readTypes(slug)).toEqual(fresh);
  });

  it("describe every member of every type, in the package's order", () => {
    for (const node of walk(getPage(slug)!.tree)) {
      if (node.name !== "FieldList") continue;
      const { of } = attributesOf(node);
      const fields = (node.children ?? []).filter((c) => c.name === "Field");
      expect([of, ...fields.map((f) => attributesOf(f).name)]).toEqual([of, ...fresh.types.find((t) => t.name === of)!.members.map((m) => m.name)]);
      for (const field of fields) expect(field.children?.length, `${of}.${attributesOf(field).name}: one paragraph, for the Markdown table`).toBe(1);
    }
  });
});

describe("the package's exports", () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "integrate", "reference", "core-exports.json"), "utf8")) as Record<string, Record<string, string>>;
  const dist = path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms", "dist");
  /** Every name an entry point's .d.ts exports. */
  const exportsOf = (entry: string) => {
    const full = path.join(dist, entry, "index.d.ts");
    const file = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    return file.statements
      .filter(ts.isExportDeclaration)
      .flatMap((s) => (s.exportClause && ts.isNamedExports(s.exportClause) ? s.exportClause.elements.map((e) => e.name.text) : []));
  };

  it.each(["core", "react"])("/%s: each is documented or marked internal, so a new one fails here", (entry) => {
    expect(Object.keys(ledger[entry]).sort()).toEqual(exportsOf(entry).sort());
  });

  it("lists every value the entry points really export", () => {
    for (const name of [...Object.keys(core), ...Object.keys(react)]) expect(new Set([...exportsOf("core"), ...exportsOf("react")])).toContain(name);
  });

  it("names a page that exists, or will, for each one documented", () => {
    const live = new Set(livePages().map((p) => p.slug));
    const planned = fs.readFileSync(path.join(CONTENT_DIR, "nav.ts"), "utf8");
    for (const [name, slug] of Object.entries({ ...ledger.core, ...ledger.react })) {
      if (slug !== "internal") expect(live.has(slug) || planned.includes(`slug: "${slug}"`), `${name}: ${slug}`).toBe(true);
    }
  });

  it("shows each one on its page, once the page is live", () => {
    const live = new Set(livePages().map((p) => p.slug));
    for (const [name, slug] of Object.entries({ ...ledger.core, ...ledger.react })) {
      if (!live.has(slug)) continue;
      const page = getPage(slug)!;
      const tables = JSON.stringify(readTypes(slug) ?? "");
      expect(page.body.includes(name) || tables.includes(name), `${name} isn't on ${slug}`).toBe(true);
    }
  });
});

describe("the errors on the clearDrafts page", () => {
  it("are rejections, not throws, with the page's messages", async () => {
    const page = getPage("integrate/reference/clear-drafts")!;
    const both = react.clearDrafts({ scope: "a", owner: "b" });
    await expect(both).rejects.toBeInstanceOf(TypeError);
    const message = await both.catch((e: Error) => e.message);
    expect(page.body).toContain(`\`${message}\``);
    const notAnObject = await react.clearDrafts("a" as never).catch((e: Error) => e.message);
    expect(page.body).toContain(`\`${notAnObject}\``);
  });
});

describe("the errors on the prepareSubmission page", () => {
  const page = getPage("integrate/reference/prepare-submission")!;
  const opts = (...codes: string[]) => codes.map((code) => ({ code, label: code.toUpperCase() }));
  const form = {
    formId: "f",
    formVersionId: "v",
    title: "T",
    schemaVersion: 2,
    blocks: [
      { id: "short", type: "short", label: "L", required: true },
      { id: "email", type: "email", label: "L" },
      { id: "phone", type: "phone", label: "L" },
      { id: "link", type: "link", label: "L" },
      { id: "number", type: "number", label: "L", min: 1, max: 5 },
      { id: "date", type: "date", label: "L" },
      { id: "time", type: "time", label: "L" },
      { id: "choice", type: "choice", label: "L", options: opts("a", "b") },
      { id: "country", type: "country", label: "L" },
      { id: "scale", type: "scale", label: "L", min: 1, max: 5 },
      { id: "rating", type: "rating", label: "L" },
      { id: "matrix", type: "matrix", label: "L", completeRequired: true, options: opts("r1", "r2"), columns: opts("c1") },
      { id: "ranking", type: "ranking", label: "L", completeRequired: true, options: opts("a", "b") },
      { id: "grid", type: "grid", label: "L", rows: opts("r1"), columns: [{ code: "c1", label: "C", type: "radio", required: true, options: opts("a") }, { code: "c2", label: "D", type: "text" }] },
      { id: "repeat", type: "group", label: "R", repeats: true, repeatLabel: "entry", minOccurs: 0, blocks: [{ id: "inner", type: "short", label: "I" }] },
    ],
  } as unknown as FormSchema;
  const answered = (value: unknown) => ({ state: "answered", value });
  /** Everything the form requires, so each row below shows its own error alone. */
  const complete = {
    short: answered("x"),
    matrix: answered({ r1: "c1", r2: "c1" }),
    ranking: answered(["a", "b"]),
    grid: answered({ r1: { c1: "a" } }),
  };
  const when = { idempotencyKey: "k", formVersionId: "v", submittedAt: "2026-10-30T09:15:00.000Z" };
  const run = (answers: Record<string, unknown>) => prepareSubmission(form, { ...when, answers: { ...complete, ...answers } });
  const messages = (result: ReturnType<typeof run>) => (result.ok ? [] : result.errors.map((e) => e.message));

  it("starts from answers that pass", () => {
    expect(run({})).toMatchObject({ ok: true });
  });

  // Each row: what is sent, and the message as the table gives it.
  it.each<[string, Record<string, unknown>, string]>([
    ["required", { short: { state: "empty" } }, '"{label}" is required.'],
    ["a bare value", { short: "x" }, "Invalid answer."],
    ["free text that isn't text", { short: answered(5) }, "Invalid answer."],
    ["too long", { short: answered("x".repeat(core.MAX_FREE_TEXT_LENGTH + 1)) }, "Your answer is too long."],
    ["email", { email: answered("a@b") }, "Enter a valid email address."],
    ["phone", { phone: answered("12") }, "Enter a valid phone number."],
    ["link", { link: answered("javascript:alert(1)") }, "Enter a valid URL, including https://."],
    ["number", { number: answered("0x10") }, "Enter a valid number."],
    ["below min", { number: answered(0) }, "Must be at least {min}."],
    ["above max", { number: answered(6) }, "Must be at most {max}."],
    ["date", { date: answered("2023-02-29") }, "Enter a valid date."],
    ["time", { time: answered("24:00") }, "Enter a valid time."],
    ["option", { choice: answered("A") }, "Select a valid option."],
    ["a repeated option", { ranking: answered(["a", "a"]) }, "Select a valid option."],
    ["country", { country: answered("Nowhere") }, "Select a valid option."],
    ["scale", { scale: answered(6) }, "Select a value from the scale."],
    ["rating", { rating: answered(6) }, "Select a rating from 1 to 5."],
    ["matrix", { matrix: answered({ nope: "c1" }) }, "Invalid answer."],
    ["every row", { matrix: answered({ r1: "c1" }) }, 'Answer every row of "{label}".'],
    ["every option", { ranking: answered(["a"]) }, 'Rank every option in "{label}".'],
    ["a repeat that isn't a list", { repeat: "x" }, "Invalid answer."],
    ["a repeat's entry that isn't an object", { repeat: ["x"] }, "Invalid answer."],
  ])("%s", (_, answers, table) => {
    expect(messages(run(answers))).toEqual([table.replace("{label}", "L").replace("{min}", "1").replace("{max}", "5")]);
    expect(page.body).toContain(table);
  });

  it("gives a grid's own messages", () => {
    expect(messages(run({ grid: answered({ r1: { c2: "x" } }) }))).toEqual(["Required."]);
    expect(messages(run({ grid: answered({ r1: { c1: "z" } }) }))).toEqual(["Select a valid option."]);
    expect(messages(run({ grid: answered({ r1: { c1: "a", c2: "x".repeat(core.MAX_FREE_TEXT_LENGTH + 1) } }) }))).toEqual(["Your answer is too long."]);
    expect(messages(run({ grid: answered({ nope: { c1: "a" } }) }))).toEqual(["Invalid answer."]);
  });

  it("gives the request's messages, on the page word for word", () => {
    const of = (body: unknown) => {
      const result = prepareSubmission(form, body);
      return result.ok ? [] : result.errors;
    };
    const shown = [
      ...of(null),
      ...of({ ...when, idempotencyKey: undefined, answers: complete }),
      ...of({ ...when, submittedAt: undefined, answers: complete }),
      ...of({ ...when, formVersionId: undefined, answers: complete }),
    ];
    expect(shown.map((e) => [e.blockId, e.path])).toEqual([["", []], ["", []], ["", []], ["", []]]);
    for (const error of shown) expect(page.body).toContain(`\`${error.message}\``);
  });

  it("returns a malformed body's error alone, and the others before any answer's", () => {
    const result = prepareSubmission(form, { answers: {} });
    const errors = result.ok ? [] : result.errors;
    expect(errors.slice(0, 2).map((e) => e.blockId)).toEqual(["", ""]);
    expect(errors.length).toBeGreaterThan(2);
  });

  it("gives the page's thrown messages", () => {
    const bad = (blocks: unknown[], extra = {}) => ({ ...form, blocks, ...extra }) as unknown as FormSchema;
    expect(() => prepareSubmission(bad([{ id: "a", type: "nope", label: "A" }]), {})).toThrow('Block "a" has unknown type "nope".');
    const newer = bad([], { schemaVersion: 3 });
    let thrown = "";
    try {
      prepareSubmission(newer, {});
    } catch (error) {
      thrown = (error as Error).message;
    }
    expect(page.body).toContain(`\`${thrown}\``);
    expect(() => prepareSubmission(form, {}, { validators: [{ field: "nope", validate: () => null }] })).toThrow(TypeError);
    expect(() => core.validateSubmission(form, {}, { pageId: "x" })).toThrow('Cannot validate page "x": this form has no page with that id.');
  });

  it("lists exactly the fields of a successful result", () => {
    const result = run({});
    const table = /A successful result has these fields:\s+\|[^\n]*\n\|[^\n]*\n((?:\|[^\n]*\n)+)/.exec(page.body.replace(/\r\n/g, "\n"))![1];
    expect([...table.matchAll(/^\| `(\w+)`/gm)].map((m) => m[1]).sort()).toEqual(Object.keys(result).sort());
  });

  it("says what it says about the stored version", () => {
    const form2 = { ...form, formVersionId: "new" } as FormSchema;
    const result = prepareSubmission(form2, { ...when, formId: "f", formVersionId: "old", answers: complete });
    expect(result).toMatchObject({ ok: true, versionMismatch: true, submission: { formVersionId: "new", answeredFormVersionId: "old" } });
    // A body without a formId is still accepted, as another version; one without a formVersionId isn't.
    expect(prepareSubmission(form, { ...when, answers: complete })).toMatchObject({ ok: true, versionMismatch: true, submission: { answeredFormVersionId: "v" } });
    for (const formVersionId of [undefined, "", "  ", 3, "x".repeat(257)]) {
      expect(prepareSubmission(form, { ...when, formId: "f", formVersionId, answers: complete }), String(formVersionId)).toMatchObject({ ok: false });
    }
    // The schema's own version is accepted whatever its length.
    const long = { ...form, formVersionId: "x".repeat(300) } as FormSchema;
    expect(prepareSubmission(long, { ...when, formId: "f", formVersionId: long.formVersionId, answers: complete })).toMatchObject({ ok: true, versionMismatch: false });
  });
});

describe("the CSS reference", () => {
  const SLUG = "integrate/reference/css";
  const fresh = cssReference();
  if (process.env.DOCS_WRITE_REFERENCE) fs.writeFileSync(path.join(CONTENT_DIR, `${SLUG}.css.json`), `${JSON.stringify(fresh, null, 2)}\n`);

  it("matches the installed package's classNames, stylesheet and README", () => {
    expect(readCss(SLUG)).toEqual(fresh);
  });

  it("has every class classNames has, each with the package's description", () => {
    expect(fresh.classes.map((c) => [c.key, c.name])).toEqual(Object.entries(react.classNames));
    expect(fresh.classes.filter((c) => !c.doc).map((c) => c.key)).toEqual([]);
  });

  it("has every public custom property the stylesheet reads, and only those", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms", "dist", "styles.css"), "utf8");
    const used = [...new Set([...css.matchAll(/var\((--zf-[\w-]+)/g)].map((m) => m[1]))].sort();
    expect(fresh.properties.map((p) => p.name).sort()).toEqual(used);
  });

  it("lists the data attributes the stylesheet answers to, with their values", () => {
    const table = [...walk(getPage(SLUG)!.tree)].find((n) => n.type === "table" && textOf(n.children![0].children![0]) === "Attribute")!;
    const rows = (table.children ?? []).slice(1).map((row) => {
      const [attribute, values] = (row.children ?? []).map(textOf);
      return { attribute, values: [...values.matchAll(/"([\w-]+)"/g)].map((m) => m[1]).sort() };
    });
    const byAttribute = (a: { attribute: string }, b: { attribute: string }) => a.attribute.localeCompare(b.attribute);
    expect(rows.sort(byAttribute)).toEqual(fresh.hooks.map((h) => ({ attribute: h.attribute, values: [...h.values].sort() })).sort(byAttribute));
  });
});
