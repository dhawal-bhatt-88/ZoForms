import { z } from "zod";

/**
 * The form schema — the single source of truth for what a form *is*.
 *
 * The builder writes this, the public runtime reads it, and the API validates
 * it. It is stored as JSONB in `FormVersion.schema`. Keep this the keystone:
 * everything that touches a form's structure imports from here.
 */

export const BlockType = z.enum([
  "short",
  "long",
  "choice",
  "checkbox",
  "dropdown",
  "number",
  "email",
  "phone",
  "date",
  "rating",
  "file",
  "payment",
  "signature",
  "heading",
]);
export type BlockType = z.infer<typeof BlockType>;

export const Block = z.object({
  id: z.string(),
  type: BlockType,
  label: z.string().min(1),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  /** for choice / checkbox / dropdown */
  options: z.array(z.string()).optional(),
});
export type Block = z.infer<typeof Block>;

export const FormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  blocks: z.array(Block).default([]),
});
export type FormSchema = z.infer<typeof FormSchema>;

/** An empty starting form. */
export function emptyForm(title = "Untitled form"): FormSchema {
  return { title, blocks: [] };
}

/** Validate an incoming submission against a form's blocks. Returns cleaned values or throws. */
export function validateSubmission(
  form: FormSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const block of form.blocks) {
    const v = values[block.id];
    if (block.required && (v === undefined || v === null || v === "")) {
      throw new Error(`"${block.label}" is required`);
    }
    if (v !== undefined) cleaned[block.id] = v;
  }
  return cleaned;
}
