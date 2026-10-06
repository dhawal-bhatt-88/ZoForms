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

/**
 * Blocks that only present content (contract §1, §4): never answered, never
 * required, not numbered, never a condition source. Like groups, they carry no
 * `required` at all.
 */
export const PRESENTATIONAL_TYPES = ["divider", "heading", "title", "label", "hidden"] as const;
export type PresentationalType = (typeof PRESENTATIONAL_TYPES)[number];

export function isPresentationalType(type: string): type is PresentationalType {
  return (PRESENTATIONAL_TYPES as readonly string[]).includes(type);
}

/** Every other leaf block — the ones that can be required. */
export const QuestionType = BlockType.exclude([...PRESENTATIONAL_TYPES]);

/**
 * How `enableWhen` combines. Absent means "all". An explicit "all" is accepted
 * but normalised away, so only "any" or absence is ever stored (contract §1).
 */
const enableBehavior = z
  .enum(["all", "any"])
  .optional()
  .transform((b): "any" | undefined => (b === "any" ? "any" : undefined));

/**
 * Help text. Cleared help text means none: an empty string is normalised away,
 * so `description: ""` is never stored or exported.
 */
const helpText = z
  .string()
  .optional()
  .transform((d) => (d === "" ? undefined : d));

const shownWhen = {
  /** Show this block only when these conditions hold. Absent = always shown. */
  enableWhen: z.array(Condition).optional(),
  enableBehavior,
};

export const QuestionBlock = z.object({
  id: z.string(),
  type: QuestionType,
  label: z.string().min(1),
  description: helpText,
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  /** for choice / checkbox / dropdown / multiselect / ranking / matrix (rows) */
  options: z.array(z.string()).optional(),
  /** for matrix (columns) */
  columns: z.array(z.string()).optional(),
  /** Unused by question types (headings are presentational); kept so their shape is unchanged. */
  level: z.number().int().min(1).max(3).optional(),
  /** static content: text copy, or the URL for image/video/audio/embed */
  content: z.string().optional(),
  /** linear scale bounds */
  min: z.number().optional(),
  max: z.number().optional(),
  ...shownWhen,
});
export type QuestionBlock = z.infer<typeof QuestionBlock>;

export const PresentationalBlock = z.object({
  id: z.string(),
  type: z.enum(PRESENTATIONAL_TYPES),
  label: z.string().min(1),
  description: helpText,
  /** heading level 1–3 */
  level: z.number().int().min(1).max(3).optional(),
  /** title/label copy */
  content: z.string().optional(),
  ...shownWhen,
});
// Question-only fields are declared `never`, so code can read them off any leaf.
type QuestionOnlyKey = Exclude<keyof QuestionBlock, keyof z.infer<typeof PresentationalBlock>>;
export type PresentationalBlock = z.infer<typeof PresentationalBlock> & {
  [K in QuestionOnlyKey]?: never;
};

/** A question or presentational block — anything that isn't a group. */
export type LeafBlock = QuestionBlock | PresentationalBlock;

/*
 * Groups — docs/GROUPS-AND-PAGES-CONTRACT.md §1. A group holds other blocks,
 * including groups, to any depth. It has none of a leaf's own fields — no value,
 * no `required`, no help text, no options — and those keys are stripped if sent.
 * The type declares each of them as `never`, so code can read any of them off
 * any block, group or not, and simply get undefined for a group.
 */
type NoLeafFields = {
  [K in Exclude<keyof QuestionBlock, "id" | "type" | "label" | "enableWhen" | "enableBehavior">]?: never;
};

export interface GroupBlock extends NoLeafFields {
  id: string;
  type: "group";
  label: string;
  enableWhen?: Condition[];
  enableBehavior?: "any";
  blocks: Block[];
}

/*
 * Pages — contract §1, §2. A page is one step of a paged form. It holds blocks,
 * groups included, and may only sit at the root: if any root item is a page,
 * every root item is. Like a group it has no value, `required` or help text.
 * It is named by `title`, not `label`: read any block's name with `blockName`.
 */
export interface PageBlock extends NoLeafFields {
  id: string;
  type: "page";
  title: string;
  /**
   * WORKAROUND — a page has NO `label` at runtime; it is named by `title`.
   *
   * Declared as a required `never` (not an optional one) purely so that
   * `block.label` on the `Block` union still types as `string`. An optional
   * `never` would make it `string | undefined`, which breaks code written
   * before pages existed that must not be touched in Phase 7: the AI service
   * (apps/api/src/ai/ai.service.ts) and the responses page.
   *
   * RUNTIME RISK: this is a lie to the type checker. Any code that reads
   * `block.label` on a block that turns out to be a page gets `undefined`,
   * with no compile error to warn about it. The AI service and the responses
   * page do exactly that for a paged form's top-level blocks. In-scope code
   * reads names with `blockName`. See KNOWN-ISSUES.md: revisit this when
   * those features come back into scope, and make this `label?: never`.
   */
  label: never;
  enableWhen?: Condition[];
  enableBehavior?: "any";
  blocks: Block[];
}

/** Something that holds blocks: a group or a page. */
export type ContainerBlock = GroupBlock | PageBlock;

/** Any block's `type`: a leaf block type, "group" or "page". */
export type AnyBlockType = BlockType | "group" | "page";
interface GroupBlockInput {
  id: string;
  type: "group";
  label: string;
  enableWhen?: z.input<typeof Condition>[];
  enableBehavior?: "all" | "any";
  blocks: BlockInput[];
}
interface PageBlockInput {
  id: string;
  type: "page";
  title: string;
  enableWhen?: z.input<typeof Condition>[];
  enableBehavior?: "all" | "any";
  blocks: BlockInput[];
}

/**
 * Any entry in a `blocks` array: a leaf block, a group or a page. Pages parse
 * anywhere, so the save rules can reject a misplaced one by name (§2.2).
 */
export type Block = LeafBlock | GroupBlock | PageBlock;
export type BlockInput =
  // Split like the parser (image/video/audio vs the rest): TypeScript can't distribute a
  // ~26-member type union across two object types when checking assignability.
  | z.input<typeof SourceBlock>
  | z.input<typeof OtherQuestionBlock>
  | z.input<typeof PresentationalBlock>
  | GroupBlockInput
  | PageBlockInput;

// Lazy, so a group's children can themselves be groups. Annotated explicitly
// because TypeScript can't infer a type that refers to itself.
const childBlocks: z.ZodType<Block[], z.ZodTypeDef, BlockInput[]> = z.lazy(() => z.array(Block));

export const GroupBlock = z.object({
  id: z.string(),
  type: z.literal("group"),
  // Blank labels parse, so the save rules can reject them with a message that
  // names the group, rather than a generic schema error.
  label: z.string(),
  ...shownWhen,
  blocks: childBlocks,
});

export const PageBlock = z.object({
  id: z.string(),
  type: z.literal("page"),
  // Blank titles parse too, for the same reason as blank group labels.
  title: z.string(),
  ...shownWhen,
  blocks: childBlocks,
});

/*
 * Parsed separately from the other questions only so an image's, a video's or
 * an audio clip's source is stored trimmed (contract §9, §10, §11); its shape
 * and TypeScript type are QuestionBlock's.
 */
const SOURCE_BLOCK_TYPES = ["image", "video", "audio"] as const;
const SourceBlock = QuestionBlock.extend({
  type: z.enum(SOURCE_BLOCK_TYPES),
  /** The source; validity is `isValidImageSource` / `parseVideoSource` / `parseAudioSource`. */
  content: z
    .string()
    .optional()
    .transform((src) => src?.trim()),
});
const OtherQuestionBlock = QuestionBlock.extend({ type: QuestionType.exclude([...SOURCE_BLOCK_TYPES]) });

// A discriminated union reports errors from the one branch matching `type`, so
// a bad leaf keeps its precise message instead of a generic "invalid input".
const BlockUnion = z.discriminatedUnion("type", [
  GroupBlock,
  PageBlock,
  SourceBlock,
  OtherQuestionBlock,
  PresentationalBlock,
]);
/*
 * A parsed page has no `label`, while PageBlock declares a phantom
 * `label: never` (see PageBlock.label), so the union is cast to `Block`. These
 * compile-time checks keep what the cast would otherwise hide: every member's
 * parsed shape matches its TypeScript type, and so does every input.
 */
type Parsed = z.output<typeof BlockUnion>;
type Expect<T extends true> = T;
type Assignable<A, B> = [A] extends [B] ? true : false;
export type _BlockShapesMatch = [
  Expect<Assignable<Exclude<Parsed, { type: "page" }>, Block>>,
  Expect<Assignable<Extract<Parsed, { type: "page" }>, Omit<PageBlock, "label">>>,
  Expect<Assignable<BlockInput, z.input<typeof BlockUnion>>>,
];
export const Block = BlockUnion as unknown as z.ZodType<Block, z.ZodTypeDef, BlockInput>;

export function isGroup(block: Block): block is GroupBlock {
  return block.type === "group";
}

export function isPage(block: Block): block is PageBlock {
  return block.type === "page";
}

/** A group or a page: something with `blocks` inside. */
export function isContainer(block: Block): block is ContainerBlock {
  return isGroup(block) || isPage(block);
}

/** A block's name as the author sees it: a page's title, anything else's label. */
export function blockName(block: Block): string {
  return isPage(block) ? block.title : block.label;
}

/** A form is paged if and only if its root contains pages (contract §1). */
export function isPaged(blocks: readonly Block[]): boolean {
  return blocks.some(isPage);
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

/**
 * Paged-form navigation (contract §1). Stored as the author left it, whether or
 * not the form currently has pages, so the choices come back if pages are added
 * again. Only exported for paged forms — see `artifactNavigation`.
 */
export const ProgressStyle = z.enum(["caption", "bar"]);
export type ProgressStyle = z.infer<typeof ProgressStyle>;

export const Navigation = z.object({
  /** "Step 2 of 5" above each page title. Default true. */
  showProgress: z.boolean().optional(),
  /**
   * "caption": the "Step 2 of 5" text only; "bar": a segmented bar above it
   * as well. Default "caption"; only used when showProgress is on. The
   * client's app can override it (contract §8).
   */
  progressStyle: ProgressStyle.optional(),
  /** A review step before submit. Default false. */
  reviewPage: z.boolean().optional(),
});
export type Navigation = z.infer<typeof Navigation>;

/** What `navigation` means when the author hasn't set a field. */
export const NAVIGATION_DEFAULTS = {
  showProgress: true,
  progressStyle: "caption",
  reviewPage: false,
} as const satisfies Required<Navigation>;

/**
 * Where a respondent's unfinished answers are kept (docs/DRAFTS-CONTRACT.md §2):
 * "session" — the tab only (the default); "device" — encrypted on the
 * respondent's device; "server" — by the host app's backend, at page changes,
 * so paged forms only. The host app must be set up for device and server;
 * otherwise the renderer falls back to session.
 */
export const DraftMode = z.enum(["session", "device", "server"]);
export type DraftMode = z.infer<typeof DraftMode>;
export const Drafts = z.object({ mode: DraftMode });
export type Drafts = z.infer<typeof Drafts>;

/** The mode when the author hasn't chosen one. */
export const DEFAULT_DRAFT_MODE: DraftMode = "session";

export const FormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  settings: FormSettings.optional(),
  blocks: z.array(Block).default([]),
  navigation: Navigation.optional(),
  drafts: Drafts.optional(),
});
export type FormSchema = z.infer<typeof FormSchema>;

/** Whether a form with these blocks can use `mode`: "server" saves at page changes, so it needs pages. */
export function draftModeAvailable(mode: DraftMode, blocks: readonly Block[]): boolean {
  return mode !== "server" || isPaged(blocks);
}

/** The save rule for `drafts`: a message when the chosen mode can't be used on this form, else null. */
export function draftsProblem(form: Pick<FormSchema, "blocks" | "drafts">): string | null {
  const mode = form.drafts?.mode ?? DEFAULT_DRAFT_MODE;
  if (draftModeAvailable(mode, form.blocks)) return null;
  return "Save progress \"On the app's server\" needs a form with pages, because it saves at each page change. Add pages, or choose another Save progress option.";
}

/** `drafts` as the editor stores it: nothing for the default mode (as with `navigationWithoutDefaults`). */
export function draftsWithoutDefault(drafts: Drafts | undefined): Drafts | undefined {
  return drafts && drafts.mode !== DEFAULT_DRAFT_MODE ? { mode: drafts.mode } : undefined;
}

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
    /** Schema format. 2 = groups and pages may appear (contract §1). Stamped at export. */
    schemaVersion: z.literal(2),
  })
  .merge(FormSchema.omit({ title: true, navigation: true, drafts: true }))
  .extend({
    /** Present exactly when the form is paged, with every field explicit. */
    navigation: z
      .object({ showProgress: z.boolean(), progressStyle: ProgressStyle, reviewPage: z.boolean() })
      .optional(),
    /** Present only when the mode isn't the default "session" (drafts contract §2). */
    drafts: Drafts.optional(),
  })
  .superRefine((artifact, ctx) => {
    if (artifact.drafts?.mode === DEFAULT_DRAFT_MODE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["drafts"], message: 'drafts is omitted for the default "session" mode' });
    }
    const problem = draftsProblem(artifact);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["drafts", "mode"], message: problem });
    if (isPaged(artifact.blocks) !== (artifact.navigation !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["navigation"],
        message: "navigation must be present exactly when the form has pages",
      });
    }
  });
export type FormArtifact = z.infer<typeof FormArtifact>;

/**
 * `navigation` as the editor stores it: fields equal to their default are
 * dropped (undefined when nothing is left), so switching a setting back leaves
 * the form unchanged. Meaning is unaffected: the artifact fills defaults in.
 */
export function navigationWithoutDefaults(navigation: Navigation | undefined): Navigation | undefined {
  const kept: Navigation = {};
  for (const key of Object.keys(NAVIGATION_DEFAULTS) as (keyof Navigation)[]) {
    const value = navigation?.[key];
    if (value !== undefined && value !== NAVIGATION_DEFAULTS[key]) Object.assign(kept, { [key]: value });
  }
  return Object.keys(kept).length ? kept : undefined;
}

/**
 * The navigation a form exports: every field explicit, with the author's
 * values or the defaults, for a paged form; nothing for a form without pages.
 */
export function artifactNavigation(
  form: Pick<FormSchema, "blocks" | "navigation">,
): Required<Navigation> | undefined {
  if (!isPaged(form.blocks)) return undefined;
  return {
    showProgress: form.navigation?.showProgress ?? NAVIGATION_DEFAULTS.showProgress,
    progressStyle: form.navigation?.progressStyle ?? NAVIGATION_DEFAULTS.progressStyle,
    reviewPage: form.navigation?.reviewPage ?? NAVIGATION_DEFAULTS.reviewPage,
  };
}

/**
 * The export artifact for stored form content: the content, the identity of
 * the form and version it came from, schemaVersion 2, navigation resolved by
 * `artifactNavigation`, and `drafts` only when its mode isn't "session". The
 * only way the API builds one.
 */
export function buildArtifact(
  content: unknown,
  identity: { formId: string; formVersionId: string },
): FormArtifact {
  const { navigation: stored, drafts: storedDrafts, ...form } = FormSchema.parse(content);
  const navigation = artifactNavigation({ blocks: form.blocks, navigation: stored });
  const drafts = draftsWithoutDefault(storedDrafts);
  return FormArtifact.parse({
    ...form,
    ...identity,
    schemaVersion: 2,
    ...(navigation ? { navigation } : {}),
    ...(drafts ? { drafts } : {}),
  });
}

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
  // Built loosely, then checked as a whole: which fields apply depends on `type`.
  const block: Record<string, unknown> = { id, type, label: BLOCK_META[type].question };
  // Presentational blocks have no `required` at all (contract §1).
  if (!isPresentationalType(type)) block.required = false;
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
  return { ...block, ...overrides } as LeafBlock;
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

/** The title a new page gets (contract §2.5). */
export const DEFAULT_PAGE_TITLE = "Untitled page";

/**
 * Create an empty page. It must be given at least one block before the form
 * can be saved. Pass every id in the form (`allBlockIds`) as `taken`.
 */
export function newPage(taken?: Iterable<string>, title = DEFAULT_PAGE_TITLE): PageBlock {
  // No `label` at runtime: see PageBlock.label.
  return { id: newBlockId(taken), type: "page", title, blocks: [] } as unknown as PageBlock;
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
  return isContainer(block) ? undefined : SOURCE_OPERATORS[block.type];
}

/**
 * The fixed set of answers a condition on `source` may use: the source's own
 * options for choice-type questions, the country list for country questions,
 * or null when any answer of the right kind is allowed.
 */
export function conditionAnswerOptions(source: Block): readonly string[] | null {
  if (isContainer(source)) return null;
  if (OPTION_SOURCE_TYPES.includes(source.type)) return source.options ?? [];
  if (source.type === "country") return COUNTRY_OPTIONS;
  return null;
}

/**
 * Collects an answer, so it is numbered (contract §4). Groups, pages,
 * presentational blocks and `hidden` fields are not.
 */
export function isAnswerable(block: Block): boolean {
  return (
    !isContainer(block) && !isPresentationalType(block.type) && !STATIC_TYPES.includes(block.type)
  );
}

/* ---------- the block tree ---------- */

/** One block as met in reading order, with where it sits in the tree. */
export interface TreeEntry {
  block: Block;
  /** Enclosing pages and groups, outermost first. Empty at the root. */
  ancestors: ContainerBlock[];
  /** Nesting depth: 0 at the root. */
  depth: number;
  /** Position in reading order across the whole tree, from 0. */
  order: number;
  /** Indices from the root: [2, 0] is the first child of the third root block. */
  path: number[];
}

/**
 * THE walk over a form's blocks: depth-first, pre-order — a page or group is
 * visited before its children, which is the contract's reading order (§3.2).
 * Every rule, guard and count that must see inside pages and groups goes
 * through this. Nothing else in the builder recurses over the tree.
 */
export function walkBlocks(blocks: readonly Block[]): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const visit = (list: readonly Block[], ancestors: ContainerBlock[], parentPath: number[]) => {
    list.forEach((block, index) => {
      const path = [...parentPath, index];
      entries.push({ block, ancestors, depth: ancestors.length, order: entries.length, path });
      if (isContainer(block)) visit(block.blocks, [...ancestors, block], path);
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
 * Question numbers, 1…n in reading order across the whole tree, pages
 * included. Only answerable questions are numbered; numbers never shift when
 * something is hidden.
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
 * rebuild only the chain of pages and groups from the root down to the edited
 * list — a single path, found by walkBlocks — so they aren't another walk of
 * the tree.
 */

/** Replace the children of the page or group at `parentPath` ([] = the root list). */
function editChildren(
  blocks: readonly Block[],
  parentPath: readonly number[],
  edit: (children: Block[]) => Block[],
): Block[] {
  const spine: ContainerBlock[] = [];
  let level: readonly Block[] = blocks;
  for (const index of parentPath) {
    const container = level[index];
    if (!container || !isContainer(container)) {
      throw new Error(`No page or group at path [${parentPath.join(", ")}]`);
    }
    spine.push(container);
    level = container.blocks;
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

/** The path of a page's or group's children list: [] for the root (`parentId` null). */
function childrenPath(blocks: readonly Block[], parentId: string | null): number[] {
  if (parentId === null) return [];
  const entry = entryOrThrow(blocks, parentId);
  if (!isContainer(entry.block)) throw new Error(`Block "${parentId}" is not a page or group`);
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

/** Insert `block` into page or group `parentId` (null = the root) at `index`. */
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

/** Remove the block with `id` — for a page or group, together with everything inside it. */
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
 * Move the block with `id` — a group with its whole subtree — into page or
 * group `toParentId` (null = the root) at `toIndex`, counted among that
 * container's children after the block has been taken out. Refuses to move a
 * container into itself or into one of its own descendants.
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
      throw new Error(`Can't move "${blockName(moving)}" into itself.`);
    }
  }
  return insertBlockIntoTree(removeBlockFromTree(blocks, id), toParentId, toIndex, moving);
}

/* ---------- pages ---------- */

/**
 * The result of a page edit that a rule can refuse: the new tree, or why not
 * and which blocks are in the way (for the editor's jump links).
 */
export type PageEdit =
  | { ok: true; blocks: Block[] }
  | { ok: false; message: string; dependents: Block[] };

function refuse(message: string, dependents: Block[] = []): PageEdit {
  return { ok: false, message, dependents };
}

/** The root index of page `pageId`; throws if it isn't a page at the root. */
function rootPageIndex(blocks: readonly Block[], pageId: string): number {
  const at = blocks.findIndex((b) => b.id === pageId);
  if (at < 0 || !isPage(blocks[at])) throw new Error(`No page with id "${pageId}" at the top level`);
  return at;
}

/**
 * "Make paged": wrap every root block of a form without pages into one page,
 * titled "Untitled page". Pass every id in the form as `taken` (defaults to them).
 */
export function makePaged(blocks: readonly Block[], taken: Iterable<string> = allBlockIds(blocks)): Block[] {
  if (isPaged(blocks)) throw new Error("This form already has pages.");
  return [{ ...newPage(taken), blocks: [...blocks] }];
}

/** Insert `page` directly after page `afterPageId`. */
export function insertPageAfter(blocks: readonly Block[], afterPageId: string, page: PageBlock): Block[] {
  const at = rootPageIndex(blocks, afterPageId);
  const next = [...blocks];
  next.splice(at + 1, 0, page);
  return next;
}

/** Where "Page only" puts a page's contents: the previous page, or the next if it's the first. */
export function pageContentsDestination(blocks: readonly Block[], pageId: string): PageBlock | undefined {
  const at = rootPageIndex(blocks, pageId);
  const destination = blocks[at > 0 ? at - 1 : at + 1];
  return destination && isPage(destination) ? destination : undefined;
}

/**
 * A page becoming the first page must have no conditions: nothing comes before
 * it, so no condition on it can hold (contract §3.2). Says why and what to do.
 */
function firstPageRefusal(action: string, page: PageBlock): PageEdit {
  return refuse(
    `${action}: "${page.title}" would become the first page, and the first page can't have conditions — it is always shown. Remove the conditions on "${page.title}" first.`,
    [page],
  );
}

/**
 * Delete a page but keep its contents: they move to the end of the previous
 * page, or to the start of the next page if it was the first. The page's own
 * conditions go with it. Refused when it is the only page (remove paging
 * instead), or when the move would break the ordering rule.
 */
export function deletePageKeepingContents(blocks: readonly Block[], pageId: string): PageEdit {
  const at = rootPageIndex(blocks, pageId);
  const page = blocks[at] as PageBlock;
  const action = `Can't delete "${page.title}" and keep its contents`;
  const destination = pageContentsDestination(blocks, pageId);
  if (!destination) return refuse(`${action}: it's the only page. Remove pages instead.`);
  const intoPrevious = at > 0;
  if (!intoPrevious && destination.enableWhen?.length) return firstPageRefusal(action, destination);
  const merged: PageBlock = {
    ...destination,
    blocks: intoPrevious ? [...destination.blocks, ...page.blocks] : [...page.blocks, ...destination.blocks],
  };
  const next = [...blocks];
  next[intoPrevious ? at - 1 : at + 1] = merged;
  next.splice(at, 1);
  const broken = moveBreaks(blocks, next);
  if (broken.length) {
    return refuse(
      `${action} — these questions would end up before a question their conditions depend on:`,
      broken,
    );
  }
  return { ok: true, blocks: next };
}

/**
 * Delete a page with everything inside it. Refused while anything outside it
 * depends on something inside it, or when it is the only page.
 */
export function deletePageWithContents(blocks: readonly Block[], pageId: string): PageEdit {
  const page = blocks[rootPageIndex(blocks, pageId)] as PageBlock;
  const action = `Can't delete "${page.title}" and its contents`;
  if (blocks.filter(isPage).length === 1) return refuse(`${action}: it's the only page. Remove pages instead.`);
  const blockers = deletionBlockers(blocks, pageId);
  if (blockers.length) {
    return refuse(
      `${action} — these questions outside it have conditions that depend on something inside it:`,
      blockers,
    );
  }
  return { ok: true, blocks: removeBlockFromTree(blocks, pageId) };
}

/**
 * "Remove paging": only when exactly one page remains. Its contents become the
 * form's root blocks.
 */
export function removePaging(blocks: readonly Block[]): Block[] {
  if (blocks.length !== 1 || !isPage(blocks[0])) {
    throw new Error("Pages can only be removed when exactly one page is left.");
  }
  return [...blocks[0].blocks];
}

/**
 * Move a page, with everything in it, one place up (-1) or down (1). Refused at
 * either end, when a conditional page would become the first page, or when it
 * would break the ordering rule.
 */
export function movePage(blocks: readonly Block[], pageId: string, direction: -1 | 1): PageEdit {
  const at = rootPageIndex(blocks, pageId);
  const page = blocks[at] as PageBlock;
  const to = at + direction;
  const action = `Can't move "${page.title}" ${direction === -1 ? "up" : "down"}`;
  if (to < 0 || to >= blocks.length || !isPage(blocks[to])) {
    return refuse(`${action}: it's already the ${direction === -1 ? "first" : "last"} page.`);
  }
  const next = [...blocks];
  [next[at], next[to]] = [next[to], next[at]];
  const first = next[0] as PageBlock;
  if (first.enableWhen?.length) return firstPageRefusal(action, first);
  const broken = moveBreaks(blocks, next);
  if (broken.length) {
    return refuse(
      `${action} — these questions would end up before a question their conditions depend on:`,
      broken,
    );
  }
  return { ok: true, blocks: next };
}

/* ---------- save rules ---------- */

export type ConditionProblem = {
  blockId: string;
  /** The full message, naming the block — what the API returns. */
  message: string;
  /** The same message without the block's name — for showing inline, on that block. */
  detail: string;
};

/** Anything a save message can name, before or after parsing: it may have no usable name. */
export type NamedNode = { type?: unknown; label?: unknown; title?: unknown };

function nodeName(node: NamedNode | undefined): string | null {
  const name = node?.type === "page" ? node.title : node?.label;
  return typeof name === "string" && name.trim() ? name : null;
}

/** One step of a path: the block's name, or a stand-in when it has none. */
function pathSegment(node: NamedNode, index: number): string {
  const name = nodeName(node);
  if (name) return name;
  if (node.type === "page") return `Page ${index + 1} (untitled)`;
  if (node.type === "group") return "(unlabelled group)";
  return `block ${index + 1}`;
}

/**
 * How a save message names a block: its kind and its path of names, page title
 * first — e.g. `Block "Medication › Dosage › How often?"`. `chain` is the
 * block's pages and groups, outermost first, then the block; `indices` gives
 * each one's position in its parent's list. Unnamed blocks are placed by
 * position instead ("An unlabelled group inside …"). Shared by the save rules
 * and the API's schema errors, so both name blocks the same way.
 */
export function describeBlockPath(chain: readonly NamedNode[], indices: readonly number[]): string {
  const block = chain[chain.length - 1];
  const index = indices[indices.length - 1];
  const parents = chain.slice(0, -1).map((node, k) => pathSegment(node, indices[k]));
  const within = parents.join(" › ");
  const name = nodeName(block);
  if (!name) {
    if (block.type === "group") {
      return within ? `An unlabelled group inside "${within}"` : "An unlabelled group at the top level";
    }
    if (block.type === "page") {
      return within ? `An untitled page inside "${within}"` : `Page ${index + 1} (untitled)`;
    }
    return within ? `Block ${index + 1} inside "${within}"` : `Block ${index + 1}`;
  }
  const kind = block.type === "page" ? "Page" : block.type === "group" ? "Group" : "Block";
  return `${kind} "${[...parents, name].join(" › ")}"`;
}

function subject(entry: TreeEntry): string {
  return describeBlockPath([...entry.ancestors, entry.block], entry.path);
}

/* ---------- display blocks: text, image, video and audio (contract §9–§11) ---------- */

type UrlLike = {
  protocol: string;
  origin: string;
  host: string;
  hostname: string;
  pathname: string;
  username: string;
  password: string;
  searchParams: { get(name: string): string | null };
};
// The global URL exists in every browser and in Node; this package compiles without DOM types.
const URLImpl = (globalThis as unknown as { URL: new (input: string, base?: string) => UrlLike }).URL;
const PLACEHOLDER_BASE = "https://base.invalid";

/**
 * Contract §9: the source, trimmed, when it is valid, otherwise null. Valid is
 * either an absolute `https://` URL (prefix checked case-insensitively; it must
 * parse to the https protocol, with no `user@` or `user:pass@` credentials), or
 * a root-relative path that, resolved against a fixed placeholder base, keeps
 * that base's origin — which rejects `//cdn…`, `/\evil.com` and
 * `/<tab>/evil.com`. Validity is this resolution rule, not a string prefix
 * alone; the renderer implements the same rule and test table. Images use it
 * directly; video files (§10) and audio files (§11) build on it.
 */
function validSource(raw: string | undefined): string | null {
  const src = (raw ?? "").trim();
  try {
    if (/^https:\/\//i.test(src)) {
      const url = new URLImpl(src);
      return url.protocol === "https:" && url.username === "" && url.password === "" ? src : null;
    }
    if (src.startsWith("/")) {
      return new URLImpl(src, PLACEHOLDER_BASE).origin === new URLImpl(PLACEHOLDER_BASE).origin ? src : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Whether an image source is valid (contract §9). */
export function isValidImageSource(raw: string | undefined): boolean {
  return validSource(raw) !== null;
}

/** A recognised video source (contract §10). */
export type VideoSource =
  /** `id`: 11 characters of A–Z a–z 0–9 _ -. `start`: whole seconds, never 0. */
  | { kind: "youtube"; id: string; start?: number }
  /** `id`: digits only. `hash`: an unlisted video's hash, alphanumeric. */
  | { kind: "vimeo"; id: string; hash?: string }
  /** `src`: the trimmed source, absolute https or root-relative. */
  | { kind: "file"; src: string };

const YOUTUBE_SHORT_HOST = "youtu.be";
const YOUTUBE_HOSTS: readonly string[] = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];
const VIMEO_PLAYER_HOST = "player.vimeo.com";
/** Hosts that only ever mean a player link: never a video file (§10). */
const PLAYER_HOSTS: readonly string[] = [
  YOUTUBE_SHORT_HOST,
  ...YOUTUBE_HOSTS,
  "vimeo.com",
  "www.vimeo.com",
  VIMEO_PLAYER_HOST,
];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PATH = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})$/;
const YOUTUBE_SHORT_PATH = /^\/([A-Za-z0-9_-]{11})$/;
const VIMEO_PATH = /^\/(\d+)(?:\/([A-Za-z0-9]+))?$/;
const VIMEO_PLAYER_PATH = /^\/video\/(\d+)$/;
const VIMEO_HASH = /^[A-Za-z0-9]+$/;
const BARE_SECONDS = /^\d+$/;
const HMS = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
const VIDEO_FILE_EXTENSION = /\.(?:mp4|webm)$/i;

/**
 * A YouTube start time in whole seconds, from `90` or `NhNmNs` with any parts
 * present (`90s`, `1m30s`, `1h2m3s`). Null when missing or malformed; 0 is valid.
 */
function parseStart(value: string | null): number | null {
  if (value === null || value === "") return null;
  let seconds: number;
  if (BARE_SECONDS.test(value)) seconds = Number(value);
  else {
    const match = HMS.exec(value);
    if (!match || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) return null;
    const [, h = "0", m = "0", s = "0"] = match;
    seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function parseYouTube(url: UrlLike): VideoSource | null {
  let id: string | null;
  if (url.host === YOUTUBE_SHORT_HOST) id = YOUTUBE_SHORT_PATH.exec(url.pathname)?.[1] ?? null;
  else if (url.pathname === "/watch") {
    const v = url.searchParams.get("v");
    id = v !== null && YOUTUBE_ID.test(v) ? v : null;
  } else id = YOUTUBE_PATH.exec(url.pathname)?.[1] ?? null;
  if (id === null) return null;
  // The first valid of t= then start= (so t=abc&start=20 is 20, t=0&start=20 is
  // none). A start of 0 is omitted; a malformed one drops the start, not the video.
  const start = parseStart(url.searchParams.get("t")) ?? parseStart(url.searchParams.get("start"));
  return start !== null && start > 0 ? { kind: "youtube", id, start } : { kind: "youtube", id };
}

function parseVimeo(url: UrlLike): VideoSource | null {
  const match = (url.host === VIMEO_PLAYER_HOST ? VIMEO_PLAYER_PATH : VIMEO_PATH).exec(url.pathname);
  if (!match) return null;
  const [, id, pathHash] = match;
  // A path hash wins over ?h=; a malformed ?h= is ignored and the video kept.
  const queryHash = url.searchParams.get("h");
  const hash = pathHash ?? (queryHash !== null && VIMEO_HASH.test(queryHash) ? queryHash : undefined);
  return hash === undefined ? { kind: "vimeo", id } : { kind: "vimeo", id, hash };
}

/**
 * Contract §10: what a video block's source is, recognised by parsing the URL —
 * never by substring search — or null when it isn't recognised.
 *  - https only; the host must match exactly, with no port and no credentials;
 *    the path must match exactly, with no trailing slash;
 *  - YouTube and Vimeo hosts are exclusive: a link on one is a player link or
 *    nothing, never a video file;
 *  - a video file is a valid source per §9 whose path ends in .mp4 or .webm.
 * The renderer implements the same rule and shares the same test table.
 */
export function parseVideoSource(raw: string | undefined): VideoSource | null {
  const src = validSource(raw);
  if (src === null) return null;
  const url = new URLImpl(src, PLACEHOLDER_BASE);
  if (!src.startsWith("/") && PLAYER_HOSTS.includes(url.hostname)) {
    // `host` keeps a non-default port; `:443` is dropped by parsing. Credentials
    // never get this far: validSource rejects them.
    if (url.host !== url.hostname) return null;
    if (url.host === YOUTUBE_SHORT_HOST || YOUTUBE_HOSTS.includes(url.host)) return parseYouTube(url);
    return parseVimeo(url);
  }
  return VIDEO_FILE_EXTENSION.test(url.pathname) ? { kind: "file", src } : null;
}

const AUDIO_FILE_EXTENSION = /\.(?:mp3|m4a|ogg|wav)$/i;

/**
 * Contract §11: an audio block's source, trimmed, when it is recognised,
 * otherwise null. Recognised is a valid source per §9 (absolute `https://`
 * with no credentials, or root-relative) whose path, before any `?` or `#`,
 * ends in .mp3, .m4a, .ogg or .wav, in any case. The path is read from the
 * parsed URL, so a file name in the query or fragment never counts. No player
 * links or streaming services. The renderer implements the same rule and
 * shares the same test table.
 */
export function parseAudioSource(raw: string | undefined): string | null {
  const src = validSource(raw);
  if (src === null) return null;
  return AUDIO_FILE_EXTENSION.test(new URLImpl(src, PLACEHOLDER_BASE).pathname) ? src : null;
}

/** A block's path of names, page title first, e.g. "About you › Logo". */
function pathText(entry: TreeEntry): string {
  const chain = [...entry.ancestors, entry.block];
  return chain.map((node, k) => pathSegment(node, entry.path[k])).join(" › ");
}

/**
 * The save rule for a display block's own content, or null when it's fine: an
 * image needs a valid source, a video or an audio clip a recognised one, a
 * text block some text. Shared by the save rules and the editor's inline
 * message, so both say exactly the same thing.
 */
export function displayBlockProblem(entry: TreeEntry): ConditionProblem | null {
  const { block } = entry;
  if (block.type === "audio" && parseAudioSource(block.content) === null) {
    const rule =
      "add the address of an .mp3, .m4a, .ogg or .wav file (https:// or a path on your app's server such as /audio/welcome.mp3).";
    return {
      blockId: block.id,
      message: `Audio "${pathText(entry)}": ${rule}`,
      detail: rule.charAt(0).toUpperCase() + rule.slice(1),
    };
  }
  if (block.type === "video" && !parseVideoSource(block.content)) {
    const rule =
      "paste a YouTube or Vimeo link, or the address of an .mp4 or .webm file (https:// or a path on your app's server such as /videos/intro.mp4).";
    return {
      blockId: block.id,
      message: `Video "${pathText(entry)}": ${rule}`,
      detail: rule.charAt(0).toUpperCase() + rule.slice(1),
    };
  }
  if (block.type === "image" && !isValidImageSource(block.content)) {
    const detail = "Add an image address starting with https:// or a path on your app's server such as /images/logo.png.";
    return {
      blockId: block.id,
      message: `Image "${pathText(entry)}": add an image address starting with https:// or a path on your app's server such as /images/logo.png.`,
      detail,
    };
  }
  if (block.type === "text" && !(block.content ?? "").trim()) {
    return {
      blockId: block.id,
      message: `Text block "${pathText(entry)}" is empty — add some text or delete it.`,
      detail: "This text block is empty — add some text or delete it.",
    };
  }
  return null;
}

/**
 * Every way the form breaks the save rules, each naming the offending block by
 * its path. Empty means valid. The API rejects a save with any problem; the
 * editor shows them inline. Covers the whole tree:
 *
 *  - block ids unique across the tree, pages and groups included (contract §2.4);
 *  - a page only at the root, and no mixed root: if any root item is a page,
 *    every root item is (§2.2, §2.3);
 *  - a group has a non-blank label, a page a non-blank title, and each at
 *    least one block (§2.5, §2.6);
 *  - every condition refers to a block in the form that comes BEFORE its
 *    dependent in reading order (§3.2) — so a container can never depend on its
 *    own contents, cycles are impossible, and the first page has no conditions;
 *  - the source is a type that can be a source (§3.3), with an operator and an
 *    answer that type supports.
 */
export function formProblems(form: { blocks: readonly Block[] }): ConditionProblem[] {
  return collectProblems(form, true);
}

/**
 * The save problems on one block other than its own content rule
 * (`displayBlockProblem`) — what the editor's Logic section lists. A display
 * block's content message is shown once, inline under the field it is about,
 * not again here. The save itself still checks everything (`formProblems`).
 */
export function problemsBesideContent(form: { blocks: readonly Block[] }, blockId: string): ConditionProblem[] {
  return collectProblems(form, false).filter((p) => p.blockId === blockId);
}

function collectProblems(form: { blocks: readonly Block[] }, withContent: boolean): ConditionProblem[] {
  const entries = walkBlocks(form.blocks);
  const problems: ConditionProblem[] = [];
  const add = (entry: TreeEntry, detail: string) =>
    problems.push({ blockId: entry.block.id, message: `${subject(entry)}: ${detail}`, detail });
  const paged = isPaged(form.blocks);

  const position = new Map<string, number>();
  for (const entry of entries) {
    const { block } = entry;
    if (position.has(block.id)) {
      add(entry, `another block has the same id "${block.id}". Block ids must be unique.`);
    } else position.set(block.id, entry.order);

    if (isPage(block)) {
      if (entry.depth > 0) {
        add(entry, "a page can only be at the top level of the form, not inside a group or another page.");
      }
      if (!block.title.trim()) add(entry, "a page needs a title.");
      if (block.blocks.length === 0) add(entry, "a page must contain at least one block.");
    } else if (isGroup(block)) {
      if (!block.label.trim()) add(entry, "a group needs a label.");
      if (block.blocks.length === 0) add(entry, "a group must contain at least one block.");
    }
    if (paged && entry.depth === 0 && !isPage(block)) {
      add(entry, "this form has pages, so every block must be inside a page.");
    }
    const display = withContent ? displayBlockProblem(entry) : null;
    if (display) problems.push(display);
  }

  const firstPage = paged && isPage(form.blocks[0]) ? form.blocks[0] : undefined;
  for (const entry of entries) {
    const conditions = entry.block.enableWhen ?? [];
    if (entry.block === firstPage && conditions.length) {
      add(entry, "the first page can't have conditions — it is always shown.");
      continue;
    }
    for (const c of conditions) {
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
  const sourceName = blockName(source);
  if (from > dependent.order) {
    if (sourceEntry.ancestors.some((a) => a.id === dependent.block.id)) {
      const noun = isPage(dependent.block) ? "page" : "group";
      return `a condition depends on "${sourceName}", which is inside this ${noun}. A ${noun} can't depend on its own questions.`;
    }
    return `a condition depends on "${sourceName}", which comes after it. A condition can only use a question that comes before it.`;
  }
  const allowed = sourceOperators(source);
  if (!allowed) {
    return `"${sourceName}" is a ${source.type} block, which can't be used in a condition.`;
  }
  if (!allowed.includes(c.operator)) {
    return `the operator "${c.operator}" can't be used with "${sourceName}" (a ${source.type} question). Allowed: ${allowed.join(", ")}.`;
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
    return `the answer "${c.answer}" isn't one of the options of "${sourceName}".`;
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
 * Deleting `id` — with everything inside it, for a page or group — would leave
 * these blocks depending on something that no longer exists. A condition
 * between two deleted blocks doesn't count: both go.
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
