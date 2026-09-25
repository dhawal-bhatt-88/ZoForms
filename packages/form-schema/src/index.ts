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

/* ---------- conditional logic (enableWhen) — the @yourco/forms contract ---------- */

export const ConditionOperator = z.enum(["exists", "=", "!=", ">", "<", ">=", "<=", "contains"]);
export type ConditionOperator = z.infer<typeof ConditionOperator>;

/** "Show this block only when <question> <operator> <answer>". */
export const Condition = z
  .object({
    /** Id of the source block. */
    question: z.string(),
    operator: ConditionOperator,
    answer: z.union([z.string(), z.number()]).optional(),
  })
  .refine((c) => (c.operator === "exists") === (c.answer === undefined), {
    message: '"exists" takes no answer; every other operator requires one',
    path: ["answer"],
  });
export type Condition = z.infer<typeof Condition>;

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
  /** Show this block only when these conditions hold. Absent = always shown. */
  enableWhen: z.array(Condition).optional(),
  /** How `enableWhen` combines. Absent means "all". */
  enableBehavior: z.enum(["all", "any"]).optional(),
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
  /** advanced customization */
  logo: z.string().optional(),
  cover: z.string().optional(),
  inputBg: z.string().optional(),
  inputBorder: z.string().optional(),
  customCss: z.string().optional(),
});
export type FormTheme = z.infer<typeof FormTheme>;

export const FormSettings = z.object({
  submitLabel: z.string().optional(),
  redirectUrl: z.string().optional(),
  theme: FormTheme.optional(),
  /** Require a Cloudflare Turnstile challenge before the form can be submitted. */
  spamProtection: z.boolean().optional(),
  /** Capture in-progress answers as partial submissions before the user finishes. */
  partialSubmissions: z.boolean().optional(),
  /** Email addresses notified when a new response arrives. */
  notifyEmails: z.array(z.string()).optional(),
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
  inputBg: string;
  inputBorder: string;
  fontFamily: string;
  radius: string;
  cardRadius: string;
  maxWidth: string;
  logo: string;
  cover: string;
  customCss: string;
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
  const border = dark ? "rgba(255,255,255,0.14)" : "#ECEDF0";
  return {
    accent: theme?.accent || "#6D5EFA",
    background,
    text: theme?.text || (dark ? "#F4F4F5" : "#1B1D22"),
    mutedText: dark ? "rgba(244,244,245,0.62)" : "#6B7280",
    buttonText: theme?.buttonText || "#FFFFFF",
    // Card surface adapts so themed text stays legible on dark backgrounds.
    surface: dark ? "#1C1F26" : "#FFFFFF",
    border,
    inputBg: theme?.inputBg || (dark ? "rgba(255,255,255,0.04)" : "#FFFFFF"),
    inputBorder: theme?.inputBorder || border,
    fontFamily: fonts[theme?.font || "sans"],
    radius,
    // The big form card must never become a blob at pill radius.
    cardRadius: radius === "9999px" ? "28px" : radius,
    maxWidth: widths[theme?.width || "normal"],
    logo: theme?.logo || "",
    cover: theme?.cover || "",
    customCss: theme?.customCss || "",
  };
}

export const FormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  settings: FormSettings.optional(),
  blocks: z.array(Block).default([]),
});
export type FormSchema = z.infer<typeof FormSchema>;

/**
 * True when two schemas have the same form content. Both sides go through
 * `FormSchema`, so defaults are applied, unknown keys are stripped, and object
 * keys come out in schema-shape order — whatever order they arrived in (Postgres
 * jsonb reorders stored keys). A plain string compare is then a content compare.
 *
 * The API uses this to reject a save identical to the current version, and the
 * editor uses it for dirty-state, so the two always agree on "changed".
 */
export function sameContent(a: unknown, b: unknown): boolean {
  const pa = FormSchema.safeParse(a);
  const pb = FormSchema.safeParse(b);
  return pa.success && pb.success && JSON.stringify(pa.data) === JSON.stringify(pb.data);
}

/**
 * The exported schema artifact: form content plus the identity of the form it
 * came from and of the saved version it was exported from.
 *
 * Both identity fields are REQUIRED here, so an artifact cannot be produced
 * without them — `FormsService.getArtifact` (served by
 * `GET /v1/forms/:id/artifact`) parses through this, which is what guarantees
 * consumers (@yourco/forms) always receive them.
 *
 * They live here rather than on `FormSchema` because `FormSchema` describes
 * stored, editable form *content*, which legitimately has no identity yet
 * (templates, AI drafts, a form seeded by `emptyForm`). Identity belongs to the
 * `FormVersion` row the content is stored in, not to the content itself.
 *
 * The API stamps both and never reads them from client input: a client could
 * otherwise send a stale or forged identity.
 */
/*
 * Built as a merge rather than `FormSchema.extend(...)` so the identity fields
 * sit directly after `title` instead of being appended last: Zod emits parsed
 * keys in shape order, and that order is what lands in the downloaded JSON.
 * Deriving the rest from `FormSchema` (rather than restating it) keeps the
 * artifact automatically in step when form content gains a field.
 */
export const FormArtifact = z
  .object({
    title: FormSchema.shape.title,
    /** `Form.id` — a uuid, stable across edits and saves. */
    formId: z.string().min(1),
    /** The saved `FormVersion` row's id — changes on every save, never on download. */
    formVersionId: z.string().min(1),
  })
  .merge(FormSchema.omit({ title: true }));
export type FormArtifact = z.infer<typeof FormArtifact>;

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

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * A fresh block id, guaranteed not to be in `taken` (pass the form's current
 * ids). Random rather than positional or time-based, so it can't collide with a
 * block that was deleted or added in the same instant. Conditions reference
 * blocks by id, so ids must be unique within a form.
 */
export function newBlockId(taken: Iterable<string> = []): string {
  const used = new Set(taken);
  // getRandomValues works in browsers (secure context or not) and Node 19+.
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?(a: Uint8Array): Uint8Array } })
    .crypto;
  for (;;) {
    const bytes = new Uint8Array(8);
    if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const id = "b_" + Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
    if (!used.has(id)) return id;
  }
}

/**
 * Create a fresh block of a given type with sensible defaults. Pass the form's
 * existing block ids as `taken` so the new id can't collide with them.
 */
export function newBlock(
  type: BlockType,
  overrides?: Partial<Block>,
  taken?: Iterable<string>,
): Block {
  const id = newBlockId(taken);
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

/* ---------- conditional logic rules ---------- */

const EQUALITY: readonly ConditionOperator[] = ["exists", "=", "!="];
const COMPARISON: readonly ConditionOperator[] = ["exists", "=", "!=", ">", "<", ">=", "<="];
const MEMBERSHIP: readonly ConditionOperator[] = ["exists", "contains"];

/**
 * The operators each block type allows when used as a condition source. A type
 * missing from this table can't be a source at all (matrix, layout blocks, and
 * types whose answers can't be compared, e.g. long text or file uploads).
 */
export const SOURCE_OPERATORS: Partial<Record<BlockType, readonly ConditionOperator[]>> = {
  choice: EQUALITY,
  dropdown: EQUALITY,
  country: EQUALITY,
  short: EQUALITY,
  email: EQUALITY,
  phone: EQUALITY,
  link: EQUALITY,
  date: EQUALITY,
  time: EQUALITY,
  number: COMPARISON,
  scale: COMPARISON,
  rating: COMPARISON,
  checkbox: MEMBERSHIP,
  multiselect: MEMBERSHIP,
  ranking: MEMBERSHIP,
};

/** Sources whose condition answer must be one of the source's options. */
export const OPTION_SOURCE_TYPES: BlockType[] = [
  "choice",
  "dropdown",
  "checkbox",
  "multiselect",
  "ranking",
];

/** Sources compared as numbers. */
export const NUMERIC_SOURCE_TYPES: BlockType[] = ["number", "scale", "rating"];

/** Operators that compare magnitudes, so their answer must be a number. */
const ORDERING: readonly ConditionOperator[] = [">", "<", ">=", "<="];

/**
 * The countries a country question offers. This MUST match the @yourco/forms
 * renderer's country list exactly — same strings, same order — because a
 * condition on a country question is matched against these values.
 */
export const COUNTRY_OPTIONS: readonly string[] = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Italy",
  "Brazil",
  "Mexico",
  "Japan",
  "Singapore",
  "United Arab Emirates",
  "Other",
];

/**
 * The fixed set of answers a condition on `source` may use: the source's own
 * options for choice-type questions, the country list for country questions,
 * or null when any answer of the right kind is allowed.
 */
export function conditionAnswerOptions(source: Block): readonly string[] | null {
  if (OPTION_SOURCE_TYPES.includes(source.type)) return source.options ?? [];
  if (source.type === "country") return COUNTRY_OPTIONS;
  return null;
}

export type ConditionProblem = { blockId: string; message: string };

/**
 * Every way the form's conditions break the rules, each naming the dependent
 * block. Empty means valid. The API rejects a save with any problem; the editor
 * shows them inline.
 *
 * A condition may only use a question *above* its block, which also makes
 * cycles impossible.
 */
export function conditionProblems(form: { blocks: Block[] }): ConditionProblem[] {
  const problems: ConditionProblem[] = [];
  const position = new Map<string, number>();
  form.blocks.forEach((b, i) => {
    if (position.has(b.id)) {
      problems.push({
        blockId: b.id,
        message: `Block "${b.label}": another block has the same id "${b.id}". Block ids must be unique.`,
      });
    } else position.set(b.id, i);
  });

  form.blocks.forEach((b, i) => {
    for (const c of b.enableWhen ?? []) {
      const problem = conditionProblem(form.blocks, position, i, c);
      if (problem) problems.push({ blockId: b.id, message: `Block "${b.label}": ${problem}` });
    }
  });
  return problems;
}

function conditionProblem(
  blocks: Block[],
  position: Map<string, number>,
  at: number,
  c: Condition,
): string | null {
  if (c.question === blocks[at].id) return "a condition can't depend on the block itself.";
  const from = position.get(c.question);
  if (from === undefined) {
    return `a condition refers to a question that isn't in this form (id "${c.question}").`;
  }
  const source = blocks[from];
  if (from > at) {
    return `a condition depends on "${source.label}", which comes after it. Conditions can only use questions above them.`;
  }
  const allowed = SOURCE_OPERATORS[source.type];
  if (!allowed) {
    return `"${source.label}" is a ${source.type} block, which can't be used in a condition.`;
  }
  if (!allowed.includes(c.operator)) {
    return `the operator "${c.operator}" can't be used with "${source.label}" (a ${source.type} question). Allowed: ${allowed.join(", ")}.`;
  }
  if (ORDERING.includes(c.operator) && !(typeof c.answer === "number" && Number.isFinite(c.answer))) {
    return `the operator "${c.operator}" needs a number as its answer, but got ${JSON.stringify(c.answer)}.`;
  }
  const answers = conditionAnswerOptions(source);
  if (
    answers &&
    c.answer !== undefined &&
    !(typeof c.answer === "string" && answers.includes(c.answer))
  ) {
    return `the answer "${c.answer}" isn't one of the options of "${source.label}".`;
  }
  return null;
}

/** Blocks (other than the source) with a condition on `sourceId`, optionally only matching conditions. */
export function dependentsOf(
  blocks: Block[],
  sourceId: string,
  matching: (c: Condition) => boolean = () => true,
): Block[] {
  return blocks.filter(
    (b) =>
      b.id !== sourceId &&
      (b.enableWhen ?? []).some((c) => c.question === sourceId && matching(c)),
  );
}

/** Blocks that sit at or above a block one of their conditions depends on. */
export function misorderedDependents(blocks: Block[]): Block[] {
  const position = new Map(blocks.map((b, i) => [b.id, i]));
  return blocks.filter((b, i) =>
    (b.enableWhen ?? []).some((c) => {
      const from = position.get(c.question);
      return from !== undefined && from >= i && c.question !== b.id;
    }),
  );
}
