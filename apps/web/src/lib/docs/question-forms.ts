import fs from "node:fs";
import path from "node:path";
import { isAnswerable, prepareSubmission, type Block, type FieldValidator, type FormSchema } from "@zoworkhq/forms/core";
import { CONTENT_DIR } from "./content";

/*
 * The question pages' example forms, as the tests that check what those pages
 * say about answers use them: real downloads, with nothing required, so one
 * answer is a whole body.
 */

/** A page's form, e.g. "build/question-types/dropdown", with nothing required. */
export function looseForm(slug: string): FormSchema {
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

export const firstQuestion = (blocks: readonly Block[]): Block | undefined => {
  for (const block of blocks) {
    if (isAnswerable(block)) return block;
    const inner = "blocks" in block && Array.isArray(block.blocks) ? firstQuestion(block.blocks as Block[]) : undefined;
    if (inner) return inner;
  }
  return undefined;
};

/** What prepareSubmission stores for one answer to a question (the form's first by default), or the messages it gives. */
export function stores(schema: FormSchema, value: unknown, { id = firstQuestion(schema.blocks)!.id, validators }: { id?: string; validators?: FieldValidator[] } = {}) {
  const result = prepareSubmission(
    schema,
    { idempotencyKey: "demo-key-1", formVersionId: schema.formVersionId, submittedAt: "2026-10-30T09:15:00.000Z", answers: { [id]: { state: "answered", value } } },
    validators ? { validators } : undefined,
  );
  if (result.ok === false) return { errors: result.errors.map((e) => e.message) };
  return result.submission.answers[id];
}
