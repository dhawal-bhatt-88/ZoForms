import { z } from "zod";

/**
 * The form schema — the single source of truth for what a form *is*.
 *
 * The builder writes this, the public runtime reads it, and the API validates
 * it. It is stored as JSONB in `FormVersion.schema`. Keep this the keystone:
 * everything that touches a form's structure imports from here.
 */

export const BlockType = z.enum([
  // question blocks (collect an answer)
  "short",
  "long",
  "choice",
  "checkbox",
  "dropdown",
  "multiselect",
  "number",
  "email",
  "phone",
  "link",
  "file",
  "date",
  "time",
  "scale",
  "matrix",
  "rating",
  "payment",
  "signature",
  "ranking",
  // layout blocks (structure / static content)
  "heading",
  "text",
  "divider",
  "title",
  "label",
  // embed blocks
  "image",
  "video",
  "audio",
  "embed",
  // advanced blocks
  "hidden",
  "recaptcha",
  "country",
]);
export type BlockType = z.infer<typeof BlockType>;

export const Block = z.object({
  id: z.string(),
  type: BlockType,
  label: z.string().min(1),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  /** for choice / checkbox / dropdown / multiselect / ranking / matrix (rows) */
  options: z.array(z.string()).optional(),
  /** for matrix (columns) */
  columns: z.array(z.string()).optional(),
  /** heading level 1–3 */
  level: z.number().int().min(1).max(3).optional(),
  /** static content: text/title/label copy, or the URL for image/video/audio/embed */
  content: z.string().optional(),
  /** linear scale bounds */
  min: z.number().optional(),
  max: z.number().optional(),
});
export type Block = z.infer<typeof Block>;

export const FormTheme = z.object({
  accent: z.string().optional(),
  background: z.string().optional(),
  text: z.string().optional(),
  buttonText: z.string().optional(),
  font: z.enum(["sans", "serif", "mono", "rounded"]).optional(),
  radius: z.enum(["none", "sm", "md", "lg", "full"]).optional(),
  width: z.enum(["narrow", "normal", "wide"]).optional(),
});
export type FormTheme = z.infer<typeof FormTheme>;

export const FormSettings = z.object({
  submitLabel: z.string().optional(),
  redirectUrl: z.string().optional(),
  theme: FormTheme.optional(),
});
export type FormSettings = z.infer<typeof FormSettings>;

export type ResolvedTheme = {
  accent: string;
  background: string;
  text: string;
  mutedText: string;
  buttonText: string;
  surface: string;
  border: string;
  fontFamily: string;
  radius: string;
  cardRadius: string;
  maxWidth: string;
};

/** Relative luminance (0=black, 1=white) of a #rrggbb / #rgb color. */
function luminance(hex: string): number {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Turn a (partial) theme into concrete CSS values the runtime + preview can apply. */
export function resolveTheme(theme?: FormTheme): ResolvedTheme {
  const fonts = {
    sans: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
    serif: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', monospace",
    rounded: "ui-rounded, 'SF Pro Rounded', 'Hanken Grotesk', system-ui, sans-serif",
  } as const;
  const radii = { none: "0px", sm: "6px", md: "12px", lg: "20px", full: "9999px" } as const;
  const widths = { narrow: "480px", normal: "640px", wide: "820px" } as const;

  const background = theme?.background || "#F6F7F9";
  const dark = luminance(background) < 0.45;
  const radius = radii[theme?.radius || "md"];
  return {
    accent: theme?.accent || "#6D5EFA",
    background,
    text: theme?.text || (dark ? "#F4F4F5" : "#1B1D22"),
    mutedText: dark ? "rgba(244,244,245,0.62)" : "#6B7280",
    buttonText: theme?.buttonText || "#FFFFFF",
    // Card surface adapts so themed text stays legible on dark backgrounds.
    surface: dark ? "#1C1F26" : "#FFFFFF",
    border: dark ? "rgba(255,255,255,0.14)" : "#ECEDF0",
    fontFamily: fonts[theme?.font || "sans"],
    radius,
    // The big form card must never become a blob at pill radius.
    cardRadius: radius === "9999px" ? "28px" : radius,
    maxWidth: widths[theme?.width || "normal"],
  };
}

export const FormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  settings: FormSettings.optional(),
  blocks: z.array(Block).default([]),
});
export type FormSchema = z.infer<typeof FormSchema>;

/** Block types that carry a list of options. */
export const OPTION_TYPES: BlockType[] = [
  "choice",
  "checkbox",
  "dropdown",
  "multiselect",
  "ranking",
  "matrix",
];

/** Layout / display blocks that never collect an answer (skipped in validation). */
export const STATIC_TYPES: BlockType[] = [
  "heading",
  "text",
  "divider",
  "title",
  "label",
  "image",
  "video",
  "audio",
  "embed",
  "recaptcha",
];

/** Human label + default question text for each block type. */
export const BLOCK_META: Record<BlockType, { label: string; question: string }> = {
  short: { label: "Short answer", question: "Short answer" },
  long: { label: "Long answer", question: "Long answer" },
  choice: { label: "Multiple choice", question: "Multiple choice" },
  checkbox: { label: "Checkboxes", question: "Checkboxes" },
  dropdown: { label: "Dropdown", question: "Dropdown" },
  multiselect: { label: "Multi-select", question: "Select all that apply" },
  number: { label: "Number", question: "Number" },
  email: { label: "Email", question: "Email address" },
  phone: { label: "Phone number", question: "Phone number" },
  link: { label: "Link", question: "Website / URL" },
  file: { label: "File upload", question: "Upload a file" },
  date: { label: "Date", question: "Date" },
  time: { label: "Time", question: "Time" },
  scale: { label: "Linear scale", question: "Rate from 1 to 5" },
  matrix: { label: "Matrix", question: "Matrix question" },
  rating: { label: "Rating", question: "How would you rate this?" },
  payment: { label: "Payment", question: "Payment" },
  signature: { label: "Signature", question: "Signature" },
  ranking: { label: "Ranking", question: "Rank these in order" },
  heading: { label: "Heading", question: "Section heading" },
  text: { label: "Text", question: "Text" },
  divider: { label: "Divider", question: "Divider" },
  title: { label: "Title", question: "Title" },
  label: { label: "Label", question: "Label" },
  image: { label: "Image", question: "Image" },
  video: { label: "Video", question: "Video" },
  audio: { label: "Audio", question: "Audio" },
  embed: { label: "Embed anything", question: "Embed" },
  hidden: { label: "Hidden field", question: "Hidden field" },
  recaptcha: { label: "reCAPTCHA", question: "Spam protection" },
  country: { label: "Respondent's country", question: "Country" },
};

/** An empty starting form. */
export function emptyForm(title = "Untitled form"): FormSchema {
  return { title, blocks: [] };
}

/** Create a fresh block of a given type with sensible defaults. */
export function newBlock(type: BlockType, overrides?: Partial<Block>): Block {
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
  if (type === "matrix") block.columns = ["Column 1", "Column 2", "Column 3"];
  if (type === "scale") {
    block.min = 1;
    block.max = 5;
  }
  if (type === "heading") block.level = 2;
  if (type === "text") block.content = "Add some descriptive text here.";
  if (type === "title") block.content = "Section title";
  if (type === "label") block.content = "Label";
  if (type === "image" || type === "video" || type === "audio" || type === "embed") {
    block.content = "";
  }
  return { ...block, ...overrides };
}

/** Validate an incoming submission against a form's blocks. Returns cleaned values or throws. */
export function validateSubmission(
  form: FormSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const block of form.blocks) {
    if (STATIC_TYPES.includes(block.type)) continue;
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
