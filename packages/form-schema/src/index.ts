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

/** A question or presentational block — anything that isn't a group. */
export const LeafBlock = z.object({
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
export type LeafBlock = z.infer<typeof LeafBlock>;

/*
 * Groups — docs/GROUPS-AND-PAGES-CONTRACT.md §1. A group holds other blocks,
 * including groups, to any depth. It has none of a leaf's own fields — no value,
 * no `required`, no help text, no options — and those keys are stripped if sent.
 * The type declares each of them as `never`, so code can read any of them off
 * any block, group or not, and simply get undefined for a group.
 */
type NoLeafFields = {
  [K in Exclude<keyof LeafBlock, "id" | "type" | "label" | "enableWhen" | "enableBehavior">]?: never;
};

export interface GroupBlock extends NoLeafFields {
  id: string;
  type: "group";
  label: string;
  enableWhen?: Condition[];
  enableBehavior?: "all" | "any";
  blocks: Block[];
}

/** Any block's `type`: a leaf block type, or "group". */
export type AnyBlockType = BlockType | "group";
interface GroupBlockInput {
  id: string;
  type: "group";
  label: string;
  enableWhen?: z.input<typeof Condition>[];
  enableBehavior?: "all" | "any";
  blocks: BlockInput[];
}

/** Any entry in a `blocks` array: a leaf block or a group. */
export type Block = LeafBlock | GroupBlock;
export type BlockInput = z.input<typeof LeafBlock> | GroupBlockInput;

// Lazy, so a group's children can themselves be groups. Annotated explicitly
// because TypeScript can't infer a type that refers to itself.
const childBlocks: z.ZodType<Block[], z.ZodTypeDef, BlockInput[]> = z.lazy(() => z.array(Block));

export const GroupBlock = z.object({
  id: z.string(),
  type: z.literal("group"),
  // Blank labels parse, so the save rules can reject them with a message that
  // names the group, rather than a generic schema error.
  label: z.string(),
  enableWhen: z.array(Condition).optional(),
  enableBehavior: z.enum(["all", "any"]).optional(),
  blocks: childBlocks,
});

// A discriminated union reports errors from the one branch matching `type`, so
// a bad leaf keeps its precise message instead of a generic "invalid input".
export const Block: z.ZodType<Block, z.ZodTypeDef, BlockInput> = z.discriminatedUnion("type", [
  GroupBlock,
  LeafBlock,
]);

export function isGroup(block: Block): block is GroupBlock {
  return block.type === "group";
}

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
    /** Schema format. 2 = groups may appear (contract §1). Stamped at export. */
    schemaVersion: z.literal(2),
  })
  .merge(FormSchema.omit({ title: true }));
export type FormArtifact = z.infer<typeof FormArtifact>;

/** Block types that carry a list of options. */
export const OPTION_TYPES: readonly AnyBlockType[] = [
  "choice",
  "checkbox",
  "dropdown",
  "multiselect",
  "ranking",
  "matrix",
];

/**
 * Layout / display blocks that never collect an answer (skipped in validation).
 * Typed to accept a group's type too, so any block's type can be checked
 * against it; groups aren't in it.
 */
export const STATIC_TYPES: readonly AnyBlockType[] = [
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
  overrides?: Partial<LeafBlock>,
  taken?: Iterable<string>,
): LeafBlock {
  const id = newBlockId(taken);
  const block: LeafBlock = {
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

/** The label a new group gets (contract §2.5). */
export const DEFAULT_GROUP_LABEL = "Untitled group";

/**
 * Create an empty group. It must be given at least one block before the form
 * can be saved. Pass every id in the form (`allBlockIds`) as `taken`.
 */
export function newGroup(taken?: Iterable<string>, label = DEFAULT_GROUP_LABEL): GroupBlock {
  return { id: newBlockId(taken), type: "group", label, blocks: [] };
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
export const SOURCE_OPERATORS: Partial<Record<AnyBlockType, readonly ConditionOperator[]>> = {
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
export const OPTION_SOURCE_TYPES: readonly AnyBlockType[] = [
  "choice",
  "dropdown",
  "checkbox",
  "multiselect",
  "ranking",
];

/** Sources compared as numbers. */
export const NUMERIC_SOURCE_TYPES: readonly AnyBlockType[] = ["number", "scale", "rating"];

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
 * The operators `block` allows as a condition source, or undefined when it can't
 * be one. Groups never can (contract §3.3); nor can any type missing from
 * SOURCE_OPERATORS.
 */
export function sourceOperators(block: Block): readonly ConditionOperator[] | undefined {
  return isGroup(block) ? undefined : SOURCE_OPERATORS[block.type];
}

/**
 * The fixed set of answers a condition on `source` may use: the source's own
 * options for choice-type questions, the country list for country questions,
 * or null when any answer of the right kind is allowed.
 */
export function conditionAnswerOptions(source: Block): readonly string[] | null {
  if (isGroup(source)) return null;
  if (OPTION_SOURCE_TYPES.includes(source.type)) return source.options ?? [];
  if (source.type === "country") return COUNTRY_OPTIONS;
  return null;
}

/**
 * Collects an answer, so it is numbered (contract §4). Groups, presentational
 * blocks and `hidden` fields are not.
 */
export function isAnswerable(block: Block): boolean {
  return !isGroup(block) && !STATIC_TYPES.includes(block.type) && block.type !== "hidden";
}

/* ---------- the block tree ---------- */

/** One block as met in reading order, with where it sits in the tree. */
export interface TreeEntry {
  block: Block;
  /** Enclosing groups, outermost first. Empty at the root. */
  ancestors: GroupBlock[];
  /** Nesting depth: 0 at the root. */
  depth: number;
  /** Position in reading order across the whole tree, from 0. */
  order: number;
  /** Indices from the root: [2, 0] is the first child of the third root block. */
  path: number[];
}

/**
 * THE walk over a form's blocks: depth-first, pre-order — a group is visited
 * before its children, which is the contract's reading order (§3.2). Every rule,
 * guard and count that must see inside groups goes through this. Nothing else
 * in the builder recurses over the tree.
 */
export function walkBlocks(blocks: readonly Block[]): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const visit = (list: readonly Block[], ancestors: GroupBlock[], parentPath: number[]) => {
    list.forEach((block, index) => {
      const path = [...parentPath, index];
      entries.push({ block, ancestors, depth: ancestors.length, order: entries.length, path });
      if (isGroup(block)) visit(block.blocks, [...ancestors, block], path);
    });
  };
  visit(blocks, [], []);
  return entries;
}

/** Every id in the tree — what `newBlockId` must avoid. */
export function allBlockIds(blocks: readonly Block[]): string[] {
  return walkBlocks(blocks).map((entry) => entry.block.id);
}

/** Where `id` sits, or undefined if it isn't in the tree. */
export function findBlock(blocks: readonly Block[], id: string): TreeEntry | undefined {
  return walkBlocks(blocks).find((entry) => entry.block.id === id);
}

/**
 * Question numbers, 1…n in reading order across the whole tree. Only answerable
 * questions are numbered; numbers never shift when something is hidden.
 */
export function questionNumbers(blocks: readonly Block[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const { block } of walkBlocks(blocks)) {
    if (isAnswerable(block)) numbers.set(block.id, numbers.size + 1);
  }
  return numbers;
}

/*
 * Tree edits. Each returns a new tree and leaves its input untouched. They
 * rebuild only the chain of groups from the root down to the edited list — a
 * single path, found by walkBlocks — so they aren't another walk of the tree.
 */

/** Replace the children of the group at `parentPath` ([] = the root list). */
function editChildren(
  blocks: readonly Block[],
  parentPath: readonly number[],
  edit: (children: Block[]) => Block[],
): Block[] {
  const spine: GroupBlock[] = [];
  let level: readonly Block[] = blocks;
  for (const index of parentPath) {
    const group = level[index];
    if (!group || !isGroup(group)) throw new Error(`No group at path [${parentPath.join(", ")}]`);
    spine.push(group);
    level = group.blocks;
  }
  let rebuilt = edit([...level]);
  for (let k = spine.length - 1; k >= 0; k -= 1) {
    const siblings = [...(k === 0 ? blocks : spine[k - 1].blocks)];
    siblings[parentPath[k]] = { ...spine[k], blocks: rebuilt };
    rebuilt = siblings;
  }
  return rebuilt;
}

function entryOrThrow(blocks: readonly Block[], id: string): TreeEntry {
  const entry = findBlock(blocks, id);
  if (!entry) throw new Error(`No block with id "${id}"`);
  return entry;
}

/** The path of a group's children list: [] for the root (`parentId` null). */
function childrenPath(blocks: readonly Block[], parentId: string | null): number[] {
  if (parentId === null) return [];
  const entry = entryOrThrow(blocks, parentId);
  if (!isGroup(entry.block)) throw new Error(`Block "${parentId}" is not a group`);
  return entry.path;
}

/** Apply `update` to the block with `id`, wherever it is. */
export function updateBlockInTree(
  blocks: readonly Block[],
  id: string,
  update: (block: Block) => Block,
): Block[] {
  const { path } = entryOrThrow(blocks, id);
  const at = path[path.length - 1];
  return editChildren(blocks, path.slice(0, -1), (children) => {
    children[at] = update(children[at]);
    return children;
  });
}

/** Insert `block` into group `parentId` (null = the root) at `index`. */
export function insertBlockIntoTree(
  blocks: readonly Block[],
  parentId: string | null,
  index: number,
  block: Block,
): Block[] {
  return editChildren(blocks, childrenPath(blocks, parentId), (children) => {
    children.splice(Math.max(0, Math.min(index, children.length)), 0, block);
    return children;
  });
}

/** Remove the block with `id` — for a group, together with everything inside it. */
export function removeBlockFromTree(blocks: readonly Block[], id: string): Block[] {
  const { path } = entryOrThrow(blocks, id);
  const at = path[path.length - 1];
  return editChildren(blocks, path.slice(0, -1), (children) => {
    children.splice(at, 1);
    return children;
  });
}

/**
 * Delete a group but keep its contents: its children take its place in its
 * parent, in their order. Reading order is otherwise unchanged, so this can't
 * break a condition. The group's own conditions go with it.
 */
export function unwrapGroup(blocks: readonly Block[], groupId: string): Block[] {
  const { block, path } = entryOrThrow(blocks, groupId);
  if (!isGroup(block)) throw new Error(`Block "${groupId}" is not a group`);
  const at = path[path.length - 1];
  return editChildren(blocks, path.slice(0, -1), (children) => {
    children.splice(at, 1, ...block.blocks);
    return children;
  });
}

/**
 * Move the block with `id` — a group with its whole subtree — into group
 * `toParentId` (null = the root) at `toIndex`, counted among that group's
 * children after the block has been taken out. Refuses to move a group into
 * itself or into one of its own descendants.
 */
export function moveBlockInTree(
  blocks: readonly Block[],
  id: string,
  toParentId: string | null,
  toIndex: number,
): Block[] {
  const moving = entryOrThrow(blocks, id).block;
  if (toParentId !== null) {
    const target = entryOrThrow(blocks, toParentId);
    if (target.block.id === id || target.ancestors.some((a) => a.id === id)) {
      throw new Error(`Can't move "${moving.label}" into itself.`);
    }
  }
  return insertBlockIntoTree(removeBlockFromTree(blocks, id), toParentId, toIndex, moving);
}

/* ---------- save rules ---------- */

export type ConditionProblem = {
  blockId: string;
  /** The full message, naming the block — what the API returns. */
  message: string;
  /** The same message without the block's name — for showing inline, on that block. */
  detail: string;
};

/** How a message names a block: by label, never by id. */
function subject(entry: TreeEntry): string {
  const { block, ancestors } = entry;
  if (!isGroup(block)) return `Block "${block.label}"`;
  if (block.label.trim()) return `Group "${block.label}"`;
  const parent = ancestors[ancestors.length - 1];
  return parent ? `An unlabelled group inside "${parent.label}"` : "An unlabelled group at the top level";
}

/**
 * Every way the form breaks the save rules, each naming the offending block.
 * Empty means valid. The API rejects a save with any problem; the editor shows
 * them inline. Covers the whole tree:
 *
 *  - block ids unique across the tree, groups included (contract §2.4);
 *  - a group has a non-blank label and at least one block (§2.5, §2.6);
 *  - every condition refers to a block in the form that comes BEFORE its
 *    dependent in reading order (§3.2) — so a group can never depend on its own
 *    contents, and cycles are impossible;
 *  - the source is a type that can be a source (§3.3), with an operator and an
 *    answer that type supports.
 */
export function formProblems(form: { blocks: readonly Block[] }): ConditionProblem[] {
  const entries = walkBlocks(form.blocks);
  const problems: ConditionProblem[] = [];
  const add = (entry: TreeEntry, detail: string) =>
    problems.push({ blockId: entry.block.id, message: `${subject(entry)}: ${detail}`, detail });

  const position = new Map<string, number>();
  for (const entry of entries) {
    const { block } = entry;
    if (position.has(block.id)) {
      add(entry, `another block has the same id "${block.id}". Block ids must be unique.`);
    } else position.set(block.id, entry.order);

    if (isGroup(block)) {
      if (!block.label.trim()) add(entry, "a group needs a label.");
      if (block.blocks.length === 0) add(entry, "a group must contain at least one block.");
    }
  }

  for (const entry of entries) {
    for (const c of entry.block.enableWhen ?? []) {
      const detail = conditionProblem(entries, position, entry, c);
      if (detail) add(entry, detail);
    }
  }
  return problems;
}

function conditionProblem(
  entries: readonly TreeEntry[],
  position: ReadonlyMap<string, number>,
  dependent: TreeEntry,
  c: Condition,
): string | null {
  if (c.question === dependent.block.id) return "a condition can't depend on the block itself.";
  const from = position.get(c.question);
  if (from === undefined) {
    return `a condition refers to a question that isn't in this form (id "${c.question}").`;
  }
  const sourceEntry = entries[from];
  const source = sourceEntry.block;
  if (from > dependent.order) {
    if (sourceEntry.ancestors.some((a) => a.id === dependent.block.id)) {
      return `a condition depends on "${source.label}", which is inside this group. A group can't depend on its own questions.`;
    }
    return `a condition depends on "${source.label}", which comes after it. A condition can only use a question that comes before it.`;
  }
  const allowed = sourceOperators(source);
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

/* ---------- dependency guards ---------- */

/**
 * Blocks anywhere in the tree (other than the source) with a condition on
 * `sourceId`, optionally only those with a matching condition. Backs the
 * delete, type-change and option-change guards.
 */
export function dependentsOf(
  blocks: readonly Block[],
  sourceId: string,
  matching: (c: Condition) => boolean = () => true,
): Block[] {
  return walkBlocks(blocks)
    .map((entry) => entry.block)
    .filter(
      (b) =>
        b.id !== sourceId &&
        (b.enableWhen ?? []).some((c) => c.question === sourceId && matching(c)),
    );
}

/**
 * Deleting `id` — with everything inside it, for a group — would leave these
 * blocks depending on something that no longer exists. A condition between two
 * deleted blocks doesn't count: both go.
 */
export function deletionBlockers(blocks: readonly Block[], id: string): Block[] {
  const target = findBlock(blocks, id);
  if (!target) return [];
  const deleted = new Set(
    walkBlocks([target.block]).map((entry) => entry.block.id),
  );
  return walkBlocks(blocks)
    .map((entry) => entry.block)
    .filter(
      (b) => !deleted.has(b.id) && (b.enableWhen ?? []).some((c) => deleted.has(c.question)),
    );
}

/** Blocks with a condition whose source doesn't come before them in reading order. */
export function misorderedDependents(blocks: readonly Block[]): Block[] {
  const entries = walkBlocks(blocks);
  const position = new Map(entries.map((entry) => [entry.block.id, entry.order]));
  return entries
    .filter((entry) =>
      (entry.block.enableWhen ?? []).some((c) => {
        const from = position.get(c.question);
        return from !== undefined && from >= entry.order && c.question !== entry.block.id;
      }),
    )
    .map((entry) => entry.block);
}

/**
 * The blocks a rearrangement (`before` → `after`) would newly put out of order.
 * Only breakage the move causes counts, so an already-broken form can still be
 * rearranged. Empty means the move is allowed.
 */
export function moveBreaks(before: readonly Block[], after: readonly Block[]): Block[] {
  const alreadyBroken = new Set(misorderedDependents(before).map((b) => b.id));
  return misorderedDependents(after).filter((b) => !alreadyBroken.has(b.id));
}
