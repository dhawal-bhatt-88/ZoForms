import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAnswerable, prepareSubmission, type Block, type FormSchema } from "@zoworkhq/forms/core";
import { CONTENT_DIR, getPage } from "./content";
import { textOf, walk, type MdNode } from "./mdast";

/*
 * "Answers and their states" (docs brief, CP3): every row of its value table,
 * and each rule it states, run through the real prepareSubmission on the form
 * of the question page the row links to, a real download.
 */

const page = getPage("integrate/concepts/answers")!;

/** The form a row's question page renders, with nothing required, so one answer is a whole body. */
function formFor(slug: string): FormSchema {
  const schema = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, `${slug}.form.json`), "utf8")) as FormSchema;
  // Required and complete-answer checks don't change what an answer is stored as.
  const loosen = (blocks: Block[]): Block[] =>
    blocks.map((block) => {
      const b = { ...block } as Record<string, unknown>;
      delete b.required;
      delete b.completeRequired;
      if (Array.isArray(b.columns)) b.columns = (b.columns as Record<string, unknown>[]).map(({ required: _, ...column }) => column);
      if (Array.isArray(b.blocks)) b.blocks = loosen(b.blocks as Block[]);
      return b as unknown as Block;
    });
  return { ...schema, blocks: loosen(schema.blocks) };
}

const firstQuestion = (blocks: readonly Block[]): Block | undefined => {
  for (const block of blocks) {
    if (isAnswerable(block)) return block;
    const inner = "blocks" in block && Array.isArray(block.blocks) ? firstQuestion(block.blocks as Block[]) : undefined;
    if (inner) return inner;
  }
  return undefined;
};

/** What prepareSubmission stores for one answer to a form's first question. */
function stores(schema: FormSchema, value: unknown) {
  const id = firstQuestion(schema.blocks)!.id;
  const result = prepareSubmission(schema, {
    idempotencyKey: "demo-key-1",
    submittedAt: "2026-10-30T09:15:00.000Z",
    answers: { [id]: { state: "answered", value } },
  });
  if (result.ok === false) return { errors: result.errors.map((e) => e.message) };
  return result.submission.answers[id];
}

const rows = (() => {
  const found = [...walk(page.tree)].find((n) => n.type === "table" && textOf(n.children![0].children![0]) === "Question type");
  return (found?.children ?? []).slice(1).map((row: MdNode) => {
    const [type, sent, stored] = row.children ?? [];
    const link = [...walk(type)].find((n) => n.type === "link") as (MdNode & { url?: string }) | undefined;
    return { type: textOf(type), slug: link?.url?.replace(/^\/docs\//, "") ?? "", sent: JSON.parse(textOf(sent)) as unknown, stored: JSON.parse(textOf(stored)) as unknown };
  });
})();

describe("the value formats on the answers page", () => {
  it("cover every question page", () => {
    const pages = fs.readdirSync(path.join(CONTENT_DIR, "build", "question-types")).filter((f) => f.endsWith(".form.json"));
    expect(rows.map((r) => `${r.slug.split("/").pop()}.form.json`).sort()).toEqual(pages.sort());
  });

  it.each(rows.map((r) => [r.type, r] as const))("%s: what the body sends is stored as the page says", (_, row) => {
    expect(stores(formFor(row.slug), row.sent)).toEqual({ state: "answered", value: row.stored });
  });
});

describe("the rules on the answers page", () => {
  const short = formFor("build/question-types/short-answer");
  const number = formFor("build/question-types/number");
  const checkboxes = formFor("build/question-types/checkboxes");
  const matrix = formFor("build/question-types/matrix");

  it("blank answers are empty, for every kind of value", () => {
    expect(page.body).toContain("An answered value that is an empty list, an empty object, or text that is empty or only spaces counts as no answer");
    expect(stores(short, "   ")).toEqual({ state: "empty" });
    expect(stores(checkboxes, [])).toEqual({ state: "empty" });
    expect(stores(matrix, {})).toEqual({ state: "empty" });
  });

  it("text isn't trimmed", () => {
    expect(page.body).toContain('`" Demo "` is stored as `" Demo "`');
    expect(stores(short, " Demo ")).toEqual({ state: "answered", value: " Demo " });
  });

  it("a plain decimal string is a number, and the page's examples of anything else are refused", () => {
    expect(page.body).toContain("such as `\"3\"`, which is stored as the number `3`");
    expect(stores(number, "3")).toEqual({ state: "answered", value: 3 });
    for (const bad of ["0x10", "Infinity", true]) expect(stores(number, bad)).toEqual({ errors: ["Enter a valid number."] });
  });

  it("an empty answer keeps no value, and extra keys go", () => {
    const id = firstQuestion(short.blocks)!.id;
    const result = prepareSubmission(short, {
      idempotencyKey: "demo-key-1",
      submittedAt: "2026-10-30T09:15:00.000Z",
      answers: { [id]: { state: "empty", value: "left over", note: "extra" } },
    });
    expect(result.ok && result.submission.answers[id]).toEqual({ state: "empty" });
  });
});
