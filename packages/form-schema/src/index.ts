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

/** Block types that carry a list of options. */
export const OPTION_TYPES: BlockType[] = ["choice", "checkbox", "dropdown"];

/** Human label + default question text for each block type. */
export const BLOCK_META: Record<BlockType, { label: string; question: string }> = {
  short: { label: "Short answer", question: "Short answer" },
  long: { label: "Long answer", question: "Long answer" },
  choice: { label: "Multiple choice", question: "Multiple choice" },
  checkbox: { label: "Checkboxes", question: "Checkboxes" },
  dropdown: { label: "Dropdown", question: "Dropdown" },
  number: { label: "Number", question: "Number" },
  email: { label: "Email", question: "Email address" },
  phone: { label: "Phone", question: "Phone number" },
  date: { label: "Date", question: "Date" },
  rating: { label: "Rating", question: "How would you rate this?" },
  file: { label: "File upload", question: "Upload a file" },
  payment: { label: "Payment", question: "Payment" },
  signature: { label: "Signature", question: "Signature" },
  heading: { label: "Heading", question: "Section heading" },
};

/** An empty starting form. */
export function emptyForm(title = "Untitled form"): FormSchema {
  return { title, blocks: [] };
}

/** Create a fresh block of a given type with sensible defaults. */
export function newBlock(type: BlockType): Block {
  const id = "b_" + Math.random().toString(36).slice(2, 10);
  const block: Block = {
    id,
    type,
    label: BLOCK_META[type].question,
    required: false,
  };
  if (OPTION_TYPES.includes(type)) {
    block.options = ["Option 1", "Option 2", "Option 3"];
  }
  return block;
}

/** Validate an incoming submission against a form's blocks. Returns cleaned values or throws. */
export function validateSubmission(
  form: FormSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const block of form.blocks) {
    if (block.type === "heading") continue;
    const v = values[block.id];
    const empty =
      v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (block.required && empty) {
      throw new Error(`"${block.label}" is required`);
    }
    if (!empty) cleaned[block.id] = v;
  }
  return cleaned;
}
