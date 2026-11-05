import { z } from "zod";
import {
  type LogicNode,
  logicTreeFromIds,
  logicTreeToArtifact,
  logicTreeToText,
  parseLogicText,
} from "./logic";
import type { FormulaNode } from "./formula";
import {
  artifactScoreProblems,
  scoreBreaks,
  scoreProblems,
  withArtifactScores,
} from "./scoring";

export * from "./logic";
export * from "./formula";

/**
 * The form schema — the single source of truth for what a form *is*.
 *
 * The builder writes this, the API validates it, and the download built from
 * it is what the `@zoworkhq/zoforms` renderer reads. It is stored as JSONB in
 * `FormVersion.schema`. Keep this the keystone: everything that touches a
 * form's structure imports from here.
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
  "date",
  "time",
  "scale",
  "matrix",
  "grid",
  "rating",
  "ranking",
  // layout blocks (structure / static content)
  "heading",
  "text",
  "divider",
  "title",
  "label",
  // media blocks
  "image",
  "video",
  "audio",
  // advanced blocks
  "hidden",
  "country",
]);
export type BlockType = z.infer<typeof BlockType>;

/* ---------- conditional logic (enableWhen) — the @zoworkhq/zoforms contract ---------- */

export const ConditionOperator = z.enum(["exists", "=", "!=", ">", "<", ">=", "<=", "contains"]);
export type ConditionOperator = z.infer<typeof ConditionOperator>;

/** "Show this block only when <question> <operator> <answer>". */
export const Condition = z
  .object({
    /**
     * The condition's own id (contract §15.1): unique within its item, never
     * shown to authors, referenced by `enableLogic`. Optional here only because
     * content saved before ids existed has none; `normalizeConditions` fills
     * them, and the save rules and the artifact require them.
     */
    id: z.string().optional(),
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

/**
 * Every other leaf block — the ones that can be required — except a grid,
 * which has its own shape (`GridBlock`) and is required column by column.
 */
export const QuestionType = BlockType.exclude([...PRESENTATIONAL_TYPES, "grid"]);

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

/**
 * A group's (or, wrongly, a page's) `repeats`. `false` never reaches this —
 * `withoutIdleRepeatSettings` drops it — so it is stored as `true` or not at all.
 */
const repeats = z
  .boolean()
  .optional()
  .transform((r): true | undefined => (r === true ? true : undefined));

const shownWhen = {
  /** Show this block only when these conditions hold. Absent = always shown. */
  enableWhen: z.array(Condition).optional(),
  enableBehavior,
  /**
   * How the conditions combine, as a tree of condition ids (contract §15.1).
   * Only in the artifact, derived from `enableLogicText` by `buildArtifact`;
   * stored content keeps it only when it came without text and isn't valid,
   * so the save rules can refuse it by name. Checked by `logicTreeFromIds`,
   * which walks it without recursion, so any value parses here.
   */
  enableLogic: z.custom<LogicNode>((value) => value !== undefined).optional(),
  /**
   * The author's logic text, exactly as typed (contract §15.6): never trimmed,
   * and an empty string is kept so the save rules can refuse it. Stored content
   * only — never in the artifact.
   */
  enableLogicText: z.string().optional(),
};

/* ---------- coded options (contract §13) ---------- */

/** What a code may look like (contract §13.2). */
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CODE_MAX = 64;

/**
 * One option of a list: a stable `code`, stored in answers and conditions, and
 * the `label` respondents see (contract §13.1). Both are trimmed. A missing,
 * empty or whitespace-only code is filled when its list is parsed (`fillCodes`).
 */
export const Option = z.object(
  {
    code: z
      .string()
      .optional()
      .transform((c) => (c ?? "").trim()),
    label: z.string().transform((l) => l.trim()),
    /**
     * What choosing the option is worth in a score (contract §17.1): a finite
     * number, used on the options of choice, dropdown, checkbox and multiselect
     * and on a matrix's columns. Any value parses, so the save rules can refuse
     * a bad one by name (`optionListProblems`).
     */
    score: z.custom<number>((v) => v !== undefined).optional(),
  },
  { invalid_type_error: "each option must be an object with a code and a label" },
);
export type Option = z.infer<typeof Option>;

/** A list of options, its empty codes filled (contract §13.3) as part of parsing. */
const optionList = z.array(Option).transform((list) => fillCodes(list));

/**
 * Contract §13.3: the code generated for `label`, the option at 1-based
 * `position` in its list, avoiding every code in `taken` (compared ignoring
 * case). The one generator: the editor (on leaving a label field), the import
 * preview and the save all use it, through `fillCodes`.
 */
export function generateCode(label: string, taken: Iterable<string>, position: number): string {
  return generateCodeAvoiding(label, new Set([...taken].map((c) => c.toLowerCase())), position);
}

/** `generateCode` against an already lower-cased set, so filling a long list stays linear. */
function generateCodeAvoiding(label: string, used: ReadonlySet<string>, position: number): string {
  const trimSeparators = (s: string) => s.replace(/^[._-]+|[._-]+$/g, "");
  let base = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents: "Sí" → "Si"
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/_+/g, "_");
  base = trimSeparators(trimSeparators(base).slice(0, CODE_MAX));
  if (!base) base = `option_${position}`;
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = base.slice(0, CODE_MAX - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Fill every empty code in `options`, in list order (contract §13.3). Codes
 * already in the list — typed or saved — and `reserved` (for an import that
 * adds to a list, its existing codes) are taken first, so a generated code
 * never takes one. Codes are trimmed first; a code is never regenerated.
 * Anything else an entry carries — a grid column's type, options and
 * required — is kept as it is.
 */
export function fillCodes<T extends Option>(options: readonly T[], reserved: Iterable<string> = []): T[] {
  const trimmed = options.map((o) => ({ ...o, code: o.code.trim() }));
  const used = new Set([...reserved, ...trimmed.map((o) => o.code).filter(Boolean)].map((c) => c.toLowerCase()));
  return trimmed.map((o, i) => {
    if (o.code) return o;
    const code = generateCodeAvoiding(o.label, used, i + 1);
    used.add(code.toLowerCase());
    return { ...o, code };
  });
}

/**
 * Placeholder options for a new block or a new row — "Option 1", "Option 2"
 * … — with empty codes (contract §13.3), so each code is made from the label
 * the author types, not from the placeholder.
 */
export function placeholderOptions(noun: string, count: number, existing: readonly Option[] = []): Option[] {
  const labels = new Set(existing.map((o) => o.label.trim().toLowerCase()));
  const added: Option[] = [];
  for (let n = existing.length + 1; added.length < count; n += 1) {
    const label = `${noun} ${n}`;
    if (!labels.has(label.toLowerCase())) added.push({ code: "", label });
  }
  return added;
}

/**
 * Fill the code of the option at `index` if it is empty (contract §13.3): the
 * editor does this when the author leaves its label field, and when it is
 * picked as a condition answer. The other codes in the list are reserved. A
 * code that is already there is never changed. As with `fillCodes`, the rest
 * of each entry (a grid column's type, options, required) is kept.
 */
export function fillCodeAt<T extends Option>(options: readonly T[], index: number): T[] {
  const next = [...options];
  const option = options[index];
  if (!option || option.code.trim()) return next;
  const taken = options.flatMap((o, k) => (k !== index && o.code.trim() ? [o.code.trim()] : []));
  next[index] = { ...option, code: generateCode(option.label, taken, index + 1) };
  return next;
}

export const QuestionBlock = z.object({
  id: z.string(),
  type: QuestionType,
  label: z.string().min(1),
  /**
   * The short name score formulas use (contract §17.8). Stored content only —
   * never in the artifact. Any value parses, so the save rules can refuse a bad
   * one by name; only a question within reach of a scored group is checked.
   */
  name: z.custom<string>((v) => v !== undefined).optional(),
  description: helpText,
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  /**
   * Matrix: every row must be answered. Ranking: every option must be ranked.
   * Implies `required`: the renderer requires an answer when either is set.
   * Only ever `true` when present, and only on those two types.
   */
  completeRequired: z
    .boolean()
    .optional()
    .transform((c): true | undefined => (c === true ? true : undefined)),
  /** for choice / checkbox / dropdown / multiselect / ranking, and matrix rows (contract §13.1) */
  options: optionList.optional(),
  /** for matrix: its columns (contract §13.1) */
  columns: optionList.optional(),
  /** Unused by question types (headings are presentational); kept so their shape is unchanged. */
  level: z.number().int().min(1).max(3).optional(),
  /** static content: text copy, or the URL for image/video/audio */
  content: z.string().optional(),
  /** video only: a .vtt captions file, used when the source is a video file (contract §10; `captionsProblem`). */
  captions: z.string().optional(),
  /** a linear scale's first and last points, or a number's limits (see `rangeSettingsProblems`) */
  min: z.number().optional(),
  max: z.number().optional(),
  ...shownWhen,
});
// `rows` is a grid's own field (contract §14.1) and `scores` a group's (§17.1), declared
// `never` so code can read them off any block.
export type QuestionBlock = z.infer<typeof QuestionBlock> & { rows?: never; scores?: never };

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

/* ---------- grid (contract §14) ---------- */

/** The column types a grid has (contract §14.1), in the order the inspector offers them. */
export const GRID_COLUMN_TYPES = ["radio", "dropdown", "text"] as const;
export type GridColumnType = (typeof GRID_COLUMN_TYPES)[number];

/** How the builder names each column type. */
export const GRID_COLUMN_TYPE_LABELS: Record<GridColumnType, string> = {
  radio: "Radio",
  dropdown: "Dropdown",
  text: "Short text",
};

/** A column's `required`: stored only when true, so turning it on and off again is no change. */
const columnRequired = z
  .boolean()
  .optional()
  .transform((r): true | undefined => (r === true ? true : undefined));

/*
 * One column of a grid: a coded entry (its code and label follow §13.2, among
 * the grid's columns) with a type. A radio or dropdown column has its own
 * coded list of options, which may be missing or empty here so the save rules
 * can refuse it by name. A text column has no options: any sent are dropped.
 * An unknown type fails parsing; the message reads after the column's name,
 * which the API puts in front of it (`describeSchemaError`).
 */
const columnFields = { code: Option.shape.code, label: Option.shape.label };
export const GridColumn = z.discriminatedUnion(
  "type",
  [
    z.object({ ...columnFields, type: z.literal("radio"), options: optionList.optional(), required: columnRequired }),
    z.object({ ...columnFields, type: z.literal("dropdown"), options: optionList.optional(), required: columnRequired }),
    z.object({ ...columnFields, type: z.literal("text"), required: columnRequired }),
  ],
  {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
        const type = (ctx.data as { type?: unknown } | null)?.type;
        const choices = GRID_COLUMN_TYPES.map((t) => `"${t}"`).join(", ").replace(/, (?=[^,]*$)/, " or ");
        return {
          message:
            type === undefined
              ? `has no type. A grid column's type is ${choices}.`
              : `has the type ${JSON.stringify(type)}, which a grid column can't have. A grid column's type is ${choices}.`,
        };
      }
      // Only the union's own issues reach here; a member's fields report through their own schemas.
      if (issue.code === z.ZodIssueCode.invalid_type) {
        return { message: "isn't an object with a code, a label and a type." };
      }
      return { message: ctx.defaultError };
    },
  },
);
export type GridColumn = z.infer<typeof GridColumn>;
/** A radio or dropdown column: one with its own options. */
export type ChoiceGridColumn = Extract<GridColumn, { type: "radio" | "dropdown" }>;

export function isChoiceColumn(column: GridColumn): column is ChoiceGridColumn {
  return column.type === "radio" || column.type === "dropdown";
}

/**
 * A grid (contract §14): fixed rows and typed columns, every cell its own
 * input. Rows are a coded list; so are the columns, by code and label. There
 * is no grid-level `required` (each column has its own), so it is dropped if
 * sent, and so are the question fields a grid doesn't have. Empty codes in the
 * rows, the columns and each column's options are filled as part of parsing
 * (§13.3), like any coded list. Rows and columns may be missing or empty here,
 * so the save rules can refuse that by name.
 */
export const GridBlock = z.object({
  id: z.string(),
  type: z.literal("grid"),
  label: z.string().min(1),
  /** As a question's (contract §17.8): a grid within reach of a scored group has a name, though it can't be scored. */
  name: QuestionBlock.shape.name,
  description: helpText,
  ...shownWhen,
  rows: optionList.optional(),
  columns: z
    .array(GridColumn)
    .transform((columns) => fillCodes(columns))
    .optional(),
});
type GridOnly = z.infer<typeof GridBlock>;
// Question fields a grid doesn't have are declared `never`, so code can read them off any leaf.
export type GridBlock = GridOnly & { [K in Exclude<keyof QuestionBlock, keyof GridOnly>]?: never };

export function isGrid(block: Block): block is GridBlock {
  return block.type === "grid";
}

/** A question or presentational block — anything that isn't a group. */
export type LeafBlock = QuestionBlock | GridBlock | PresentationalBlock;

/**
 * Where a form or group came from, when it was made from a template: the
 * template's id, its version at the time, and its name then. Provenance only —
 * the content is a copy, and nothing follows the template afterwards. Stored
 * content only: never in the artifact (`buildArtifact` strips it) and never
 * sent to respondents. Builder-only, so it isn't in the contract.
 */
export const TemplateRef = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string(),
});
export type TemplateRef = z.infer<typeof TemplateRef>;

/* ---------- scores (contract §17) ---------- */

/** How a score treats an unanswered question (contract §17.3). The builder's default is "no-score". */
export const SCORE_UNANSWERED = ["no-score", "zero"] as const;
export type ScoreUnanswered = (typeof SCORE_UNANSWERED)[number];

/**
 * One score on a group (contract §17.1). `formulaText` is the author's text
 * and the source of truth (§17.7): stored content holds the text only, which
 * the save parses and checks, and the artifact carries only the `formula` tree
 * derived from it (`withArtifactScores`). A `formula` here is a tree sent
 * through the API, before the save turns it into text (`normalizeScores`),
 * or the artifact's. `id` is missing only before the save fills it (§17.9).
 */
export type Score = {
  id?: string;
  label: string;
  formulaText?: string;
  formula?: FormulaNode;
  unanswered: ScoreUnanswered;
  decimals?: number;
  showToRespondent?: boolean;
};
type ScoreInput = { [K in keyof Score]?: unknown };

/** Any value but undefined parses, typed as `T`: the save rules check it and refuse it by name. */
const loose = <T>() => z.custom<T>((v) => v !== undefined);

/*
 * A score's fields all parse whatever their value, so the save rules can name
 * the group and the score (contract §17.6). Parsed as an object, so its keys
 * come out in this order and unknown keys are dropped, like every other part
 * of the content (`sameContent`). The formula is any value, checked without
 * recursion (`formulaShapeProblem`), so a deep tree can't overflow the stack.
 */
const ScoreEntry = z.object({
  id: loose<string>().optional(),
  label: loose<string>(),
  /** Exactly as typed: never trimmed, and an empty string is kept so the save rules can refuse it. */
  formulaText: loose<string>().optional(),
  formula: loose<FormulaNode>().optional(),
  unanswered: loose<ScoreUnanswered>(),
  decimals: loose<number>().optional(),
  showToRespondent: loose<boolean>().optional(),
}) as unknown as z.ZodType<Score, z.ZodTypeDef, ScoreInput>;

/**
 * A group's scores. Anything that isn't a list of objects with a label and an
 * `unanswered` is kept as sent, so the save rules can refuse it by name.
 */
const scoresField = z
  .union([z.array(ScoreEntry), loose<Score[]>()])
  .optional() as unknown as z.ZodType<Score[] | undefined, z.ZodTypeDef, unknown>;

/*
 * Groups — docs/GROUPS-AND-PAGES-CONTRACT.md §1. A group holds other blocks,
 * including groups, to any depth. It has none of a leaf's own fields — no value,
 * no `required`, no help text, no options — and those keys are stripped if sent.
 * The type declares each of them as `never`, so code can read any of them off
 * any block, group or not, and simply get undefined for a group.
 */
type NoLeafFields = {
  [K in Exclude<
    keyof QuestionBlock,
    "id" | "type" | "label" | "enableWhen" | "enableBehavior" | "enableLogic" | "enableLogicText" | "scores"
  >]?: never;
};

export interface GroupBlock extends NoLeafFields {
  id: string;
  type: "group";
  label: string;
  /**
   * A repeating group (contract §12): the respondent fills `blocks` once per
   * entry. Only ever `true` when present; the three settings below exist only
   * while it is (see `withoutIdleRepeatSettings`).
   */
  repeats?: true;
  /** The singular noun for one entry, used mid-sentence: "Add another patient". */
  repeatLabel?: string;
  /** Fewest entries; a whole number, 0 or more. Absent means 1. */
  minOccurs?: number;
  /** Most entries; a whole number, 1 or more and at least `minOccurs`. Absent means at most 1,000. */
  maxOccurs?: number;
  enableWhen?: Condition[];
  enableBehavior?: "any";
  enableLogic?: LogicNode;
  enableLogicText?: string;
  /** Scores calculated from the group's questions (contract §17). */
  scores?: Score[];
  /** Set when the group was inserted from a group template (see `TemplateRef`). */
  templateRef?: TemplateRef;
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
   * A page has no `label`; it is named by `title`. Declared as an optional
   * `never` so that `block.label` on the `Block` union types as
   * `string | undefined`: code that may meet a page reads names with `blockName`.
   */
  label?: never;
  /** Pages never repeat (contract §12.1). Kept when sent only so the save rules can reject it by name. */
  repeats?: true;
  enableWhen?: Condition[];
  enableBehavior?: "any";
  enableLogic?: LogicNode;
  enableLogicText?: string;
  /** Pages never carry scores (contract §17.1). Kept when sent only so the save rules can reject it by name. */
  scores?: Score[];
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
  repeats?: boolean;
  repeatLabel?: string;
  minOccurs?: number;
  maxOccurs?: number;
  enableWhen?: z.input<typeof Condition>[];
  enableBehavior?: "all" | "any";
  enableLogic?: LogicNode;
  enableLogicText?: string;
  scores?: unknown;
  templateRef?: TemplateRef;
  blocks: BlockInput[];
}
interface PageBlockInput {
  id: string;
  type: "page";
  title: string;
  repeats?: boolean;
  enableWhen?: z.input<typeof Condition>[];
  enableBehavior?: "all" | "any";
  enableLogic?: LogicNode;
  enableLogicText?: string;
  scores?: unknown;
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
  | z.input<typeof GridBlock>
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
  repeats,
  // Any string or number parses, as a blank label does, so the save rules can
  // reject a bad one by name (`repeatSettingsProblems`).
  repeatLabel: z.string().optional(),
  minOccurs: z.number().optional(),
  maxOccurs: z.number().optional(),
  ...shownWhen,
  scores: scoresField,
  templateRef: TemplateRef.optional(),
  blocks: childBlocks,
});

export const PageBlock = z.object({
  id: z.string(),
  type: z.literal("page"),
  // Blank titles parse too, for the same reason as blank group labels.
  title: z.string(),
  repeats,
  ...shownWhen,
  scores: scoresField,
  blocks: childBlocks,
});

/**
 * Contract §6, §12.1: repeat settings on a group that doesn't repeat do
 * nothing, so they're dropped before parsing — never stored, exported or
 * rejected, whatever their value. `repeats: false` goes too, so turning Repeats
 * on and off again leaves the form unchanged. On a page only `repeats: true` is
 * kept, so the save rules can refuse it by name; a page's other repeat settings
 * are dropped the same way.
 */
function withoutIdleRepeatSettings(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const node = raw as Record<string, unknown>;
  if (node.type !== "group" && node.type !== "page") return withoutIdleCompleteRequired(withoutStrayCaptions(node));
  if (node.type === "group" && node.repeats === true) return raw;
  const { repeats, repeatLabel: _label, minOccurs: _min, maxOccurs: _max, ...rest } = node;
  // Anything but true or false is left for the parser to reject.
  return repeats === false || repeats === undefined ? rest : { ...rest, repeats };
}

/** `captions` belongs to a video (contract §10); on any other block it is dropped, never stored or exported. */
function withoutStrayCaptions(node: Record<string, unknown>): Record<string, unknown> {
  if (node.type === "video" || !("captions" in node)) return node;
  const { captions: _captions, ...rest } = node;
  return rest;
}

/** The question types `completeRequired` applies to, and how the inspector names it. */
export const COMPLETE_REQUIRED_LABELS: Partial<Record<BlockType, string>> = {
  matrix: "Answer every row",
  ranking: "Rank every option",
};

/**
 * `completeRequired` means something only on a matrix (every row answered) or
 * a ranking (every option ranked), as the renderer applies it. Anywhere else
 * the renderer would still treat it as "required", without saying so, so it is
 * dropped there; `false` is dropped everywhere, so turning it on and off again
 * leaves the form unchanged.
 */
function withoutIdleCompleteRequired(node: Record<string, unknown>): Record<string, unknown> {
  if (!("completeRequired" in node)) return node;
  const { completeRequired, ...rest } = node;
  const applies = typeof node.type === "string" && node.type in COMPLETE_REQUIRED_LABELS;
  // Anything but true or false on a matrix or ranking is left for the parser to reject.
  return applies && completeRequired !== false && completeRequired !== undefined ? node : rest;
}

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
  /** A video's captions file, stored trimmed and left out when blank (contract §10). */
  captions: z
    .string()
    .optional()
    .transform((src) => src?.trim() || undefined),
});
const OtherQuestionBlock = QuestionBlock.extend({ type: QuestionType.exclude([...SOURCE_BLOCK_TYPES]) });

// A discriminated union reports errors from the one branch matching `type`, so
// a bad leaf keeps its precise message instead of a generic "invalid input".
const BlockUnion = z.discriminatedUnion("type", [
  GroupBlock,
  PageBlock,
  SourceBlock,
  OtherQuestionBlock,
  GridBlock,
  PresentationalBlock,
]);
/*
 * `z.preprocess` types its input as `unknown`, so the union is cast to name
 * `BlockInput`. These compile-time checks keep what the cast would otherwise
 * hide: every member's parsed shape matches its TypeScript type, and so does
 * every input.
 */
type Parsed = z.output<typeof BlockUnion>;
type Expect<T extends true> = T;
type Assignable<A, B> = [A] extends [B] ? true : false;
export type _BlockShapesMatch = [
  Expect<Assignable<Parsed, Block>>,
  Expect<Assignable<BlockInput, z.input<typeof BlockUnion>>>,
];
export const Block = z.preprocess(withoutIdleRepeatSettings, BlockUnion) as z.ZodType<
  Block,
  z.ZodTypeDef,
  BlockInput
>;

export function isGroup(block: Block): block is GroupBlock {
  return block.type === "group";
}

/** A group with `repeats: true` (contract §12). Pages never repeat. */
export function isRepeatingGroup(block: Block): block is GroupBlock & { repeats: true } {
  return isGroup(block) && block.repeats === true;
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

/**
 * Not strict: content saved before `settings` (theme, submit label and the
 * hosted settings) was removed may still carry it. It parses, and `settings`
 * is dropped.
 */
export const FormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  blocks: z.array(Block).default([]),
  navigation: Navigation.optional(),
  drafts: Drafts.optional(),
  /** Set when the form was created from a form template (see `TemplateRef`). */
  templateRef: TemplateRef.optional(),
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
 * consumers (@zoworkhq/zoforms) always receive them.
 *
 * They live here rather than on `FormSchema` because `FormSchema` describes
 * stored, editable form *content*, which legitimately has no identity yet
 * (templates, a form seeded by `emptyForm`). Identity belongs to the
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
  .merge(FormSchema.omit({ title: true, navigation: true, drafts: true, templateRef: true }))
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
    // Contract §15.5: what the renderer refuses at mount, it never receives.
    for (const entry of walkBlocks(artifact.blocks)) {
      const issue = artifactLogicProblem(entry.block);
      if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["blocks"], message: `${subject(entry)}: ${issue}` });
      if (isGroup(entry.block) && entry.block.templateRef !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["blocks"], message: `${subject(entry)}: the template reference is never part of the artifact.` });
      }
    }
    // Contract §17.6, §17.8: the scoring rules the renderer checks at mount, and no builder-only names or text.
    for (const message of artifactScoreProblems(artifact.blocks)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["blocks"], message });
    }
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
  // A template reference is builder provenance, never exported (see `TemplateRef`).
  const { navigation: stored, drafts: storedDrafts, templateRef: _ref, ...form } = FormSchema.parse(content);
  const navigation = artifactNavigation({ blocks: form.blocks, navigation: stored });
  const drafts = draftsWithoutDefault(storedDrafts);
  // Content saved before condition ids existed gets c1, c2, … by position, so
  // downloading the same version twice gives the same file.
  // Scores carry only their tree, derived from the text; question names stay in the builder (§17.7, §17.8).
  const blocks = withArtifactScores(
    withArtifactLogic(normalizeConditions(withoutTemplateRefs(form.blocks), positionalConditionId)),
  );
  return FormArtifact.parse({
    ...form,
    blocks,
    ...identity,
    schemaVersion: 2,
    ...(navigation ? { navigation } : {}),
    ...(drafts ? { drafts } : {}),
  });
}

/**
 * The blocks without any `templateRef`, at any depth: for the artifact, for
 * what respondents are sent, and for a template's own content.
 */
export function withoutTemplateRefs(blocks: readonly Block[]): Block[] {
  return blocks.map((block) => {
    if (!isContainer(block)) return block;
    const { templateRef: _ref, ...rest } = block as GroupBlock;
    return { ...rest, blocks: withoutTemplateRefs(block.blocks) } as Block;
  });
}

/* ---------- condition logic (contract §15) ---------- */

/**
 * Picks an id for `condition`, at `position` (from 1) in `block`'s conditions,
 * which has none. The result must not be in `taken`.
 */
export type ConditionIdFiller = (
  taken: ReadonlySet<string>,
  position: number,
  block: Block,
  condition: Condition,
) => string;

/**
 * The save's filler: a condition sent without an id keeps the id the same
 * condition has in `previous` (the form's current blocks) — same block, same
 * position, same question, operator and answer — so sending the same content
 * twice is no change. Any other condition gets a new random id.
 */
export function idsFromPrevious(previous: readonly Block[]): ConditionIdFiller {
  const before = new Map(walkBlocks(previous).map((e) => [e.block.id, e.block.enableWhen ?? []]));
  return (taken, position, block, condition) => {
    const old = before.get(block.id)?.[position - 1];
    const same =
      old?.id !== undefined &&
      !taken.has(old.id) &&
      old.question === condition.question &&
      old.operator === condition.operator &&
      old.answer === condition.answer;
    return same ? old.id! : newConditionId(taken);
  };
}

/** The artifact's filler: `c<position>`, or the next free `c<n>` after it. */
const positionalConditionId: ConditionIdFiller = (taken, position) => {
  let n = position;
  while (taken.has(`c${n}`)) n += 1;
  return `c${n}`;
};

/**
 * Every item's conditions brought to the stored shape (contract §15.6), on
 * any page, in any group or repeating group:
 * - a condition without an id gets one (random by default; see `newConditionId`).
 *   An empty, malformed or repeated id is left for the save rules to refuse;
 * - with fewer than 2 conditions, `enableLogicText`, `enableLogic` and
 *   `enableBehavior` are dropped: there is nothing to combine;
 * - with 2 or more and text, the text is the logic: any `enableLogic` or
 *   `enableBehavior` sent with it is dropped;
 * - with 2 or more and no text (content saved before logic text existed, or
 *   sent through the API), text is made from what is stored: `1 AND 2 AND …`,
 *   `1 OR 2 OR …` for `enableBehavior: "any"`, or `logicTreeToText` of a valid
 *   `enableLogic`. An invalid one is kept for the save rules to refuse.
 *
 * The editor applies this on load and the API at save. It is not part of
 * parsing because random ids would make every `sameContent` compare unequal.
 */
export function normalizeConditions(
  blocks: readonly Block[],
  fillId: ConditionIdFiller = (taken) => newConditionId(taken),
): Block[] {
  return blocks.map((block) => {
    const own = normalizeItemConditions(block, fillId);
    return isContainer(own) ? ({ ...own, blocks: normalizeConditions(own.blocks, fillId) } as Block) : own;
  });
}

function normalizeItemConditions(block: Block, fillId: ConditionIdFiller): Block {
  const has = (key: string) => key in block;
  if (!block.enableWhen?.length) {
    if (!has("enableBehavior") && !has("enableLogic") && !has("enableLogicText")) return block;
    const { enableBehavior: _b, enableLogic: _l, enableLogicText: _t, ...rest } = block;
    return rest as Block;
  }
  const taken = new Set(block.enableWhen.flatMap((c) => (c.id === undefined ? [] : [c.id])));
  const enableWhen = block.enableWhen.map((c, i): Condition => {
    if (c.id !== undefined) return c;
    const id = fillId(taken, i + 1, block, c);
    taken.add(id);
    const { id: _missing, ...fields } = c;
    return { id, ...fields };
  });
  const { enableBehavior, enableLogic, enableLogicText, ...rest } = block;
  const next = { ...rest, enableWhen } as Block;
  if (enableWhen.length < 2) return next;
  if (enableLogicText !== undefined) return { ...next, enableLogicText } as Block;
  if (enableLogic !== undefined) {
    const tree = enableBehavior === undefined ? logicTreeFromIds(enableLogic, enableWhen.map((c) => c.id!)) : null;
    if (!tree?.ok) return { ...next, enableBehavior, enableLogic } as Block;
    return { ...next, enableLogicText: logicTreeToText(tree.tree) } as Block;
  }
  const numbers = enableWhen.map((_, i) => i + 1);
  return { ...next, enableLogicText: numbers.join(enableBehavior === "any" ? " OR " : " AND ") } as Block;
}

/**
 * The save rule for an item's logic (contract §15.5), or null: the first text
 * error, word for word from the contract's table, or — for a tree stored
 * without text — what is wrong with the tree.
 */
export function logicProblem(block: Block): string | null {
  const conditions = block.enableWhen ?? [];
  if (conditions.length < 2) return null;
  if (block.enableLogicText !== undefined) {
    const parsed = parseLogicText(block.enableLogicText, conditions.length);
    return parsed.ok ? null : parsed.error;
  }
  if (block.enableLogic === undefined) return null;
  if (block.enableBehavior !== undefined) return "its enableLogic and enableBehavior can't both be set.";
  const tree = logicTreeFromIds(block.enableLogic, conditions.map((c) => c.id ?? ""));
  return tree.ok ? null : tree.error;
}

/**
 * Problems with an item's condition ids (contract §15.1): malformed or
 * repeated, and — with `requireIds` — missing. The save fills missing ids
 * first (`normalizeConditions`), so only the artifact check requires them.
 */
export function conditionIdProblems(conditions: readonly Condition[], requireIds = false): string[] {
  const problems: string[] = [];
  const first = new Map<string, number>();
  conditions.forEach((c, i) => {
    const n = i + 1;
    if (c.id === undefined) {
      if (requireIds) problems.push(`condition ${n} has no id.`);
      return;
    }
    if (!CODE_PATTERN.test(c.id)) {
      problems.push(
        `condition ${n}'s id ${JSON.stringify(c.id)} isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`,
      );
    }
    const seen = first.get(c.id);
    if (seen !== undefined) problems.push(`conditions ${seen} and ${n} have the same id ${JSON.stringify(c.id)}.`);
    else first.set(c.id, n);
  });
  return problems;
}

/**
 * Stored items with their logic as exported (contract §15.4): the text is
 * replaced by nothing (flat AND), `enableBehavior: "any"` (flat OR) or
 * `enableLogic`. Expects `normalizeConditions` output; text that doesn't parse
 * can't be exported, so it throws, naming the block.
 */
function withArtifactLogic(blocks: readonly Block[]): Block[] {
  return blocks.map((block) => {
    let own = block;
    const conditions = block.enableWhen ?? [];
    if (conditions.length >= 2 && block.enableLogicText !== undefined) {
      const parsed = parseLogicText(block.enableLogicText, conditions.length);
      if (!parsed.ok) throw new Error(`Block "${blockName(block)}": ${parsed.error}`);
      const { enableLogicText: _t, enableBehavior: _b, enableLogic: _l, ...rest } = block;
      own = { ...rest, ...logicTreeToArtifact(parsed.tree, conditions.map((c) => c.id!)) } as Block;
    }
    return isContainer(own) ? ({ ...own, blocks: withArtifactLogic(own.blocks) } as Block) : own;
  });
}

/** What the artifact must never carry on an item (contract §15.5 integrity checks), or null. */
function artifactLogicProblem(block: Block): string | null {
  if (block.enableLogicText !== undefined) return "the logic text is never part of the artifact.";
  const conditions = block.enableWhen ?? [];
  const ids = conditionIdProblems(conditions, true);
  if (ids.length) return ids[0];
  if (block.enableLogic === undefined) return null;
  if (conditions.length < 2) return "enableLogic needs at least 2 conditions.";
  return logicProblem(block);
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
  date: { label: "Date", question: "Date" },
  time: { label: "Time", question: "Time" },
  scale: { label: "Linear scale", question: "Rate from 1 to 5" },
  matrix: { label: "Matrix", question: "Matrix question" },
  grid: { label: "Grid", question: "Grid question" },
  rating: { label: "Rating", question: "How would you rate this?" },
  ranking: { label: "Ranking", question: "Rank these in order" },
  heading: { label: "Heading", question: "Section heading" },
  text: { label: "Text", question: "Text" },
  divider: { label: "Divider", question: "Divider" },
  title: { label: "Title", question: "Title" },
  label: { label: "Label", question: "Label" },
  image: { label: "Image", question: "Image" },
  video: { label: "Video", question: "Video" },
  audio: { label: "Audio", question: "Audio" },
  hidden: { label: "Hidden field", question: "Hidden field" },
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
  return randomId("b_", taken);
}

/**
 * A fresh condition id (contract §15.1): `c_` and 8 random lower-case base-36
 * characters, not in `taken` (pass the item's other condition ids). Random, so
 * an id is never reused within the item without keeping any history.
 */
export function newConditionId(taken: Iterable<string> = []): string {
  return randomId("c_", taken);
}

/**
 * A fresh score id (contract §17.1, §17.9): `s_` and 8 random characters, not
 * in `taken` (pass the group's other score ids). Never shown to authors.
 */
export function newScoreId(taken: Iterable<string> = []): string {
  return randomId("s_", taken);
}

function randomId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  // getRandomValues works in browsers (secure context or not) and Node 19+.
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?(a: Uint8Array): Uint8Array } })
    .crypto;
  for (;;) {
    const bytes = new Uint8Array(8);
    if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const id = prefix + Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
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
  // Presentational blocks have no `required` at all (contract §1); a grid has one per column (§14.1).
  if (!isPresentationalType(type) && type !== "grid") block.required = false;
  // Placeholders start with empty codes; each is generated from the label the author types (§13.3).
  // A matrix's options are its rows, so they are placeholdered as rows, as a grid's are.
  if (OPTION_TYPES.includes(type)) block.options = placeholderOptions(type === "matrix" ? "Row" : "Option", 3);
  if (type === "matrix") block.columns = placeholderOptions("Column", 3);
  if (type === "grid") {
    block.rows = placeholderOptions("Row", 3);
    block.columns = addGridColumn([]);
  }
  if (type === "scale") {
    block.min = 1;
    block.max = 5;
  }
  if (type === "heading") block.level = 2;
  if (type === "text") block.content = "Add some descriptive text here.";
  if (type === "title") block.content = "Section title";
  if (type === "label") block.content = "Label";
  if (type === "image" || type === "video" || type === "audio") {
    block.content = "";
  }
  return { ...block, ...overrides } as LeafBlock;
}

/*
 * Editing a grid's columns (contract §14.6). Each returns a new list and
 * leaves its input untouched; every column it doesn't change comes back as
 * the same object, so its type, options and required are kept.
 */

/** The list with one more column at the end: short text, "Column n", an empty code, not required. */
export function addGridColumn(columns: readonly GridColumn[]): GridColumn[] {
  const [{ label }] = placeholderOptions("Column", 1, columns);
  return [...columns, { code: "", label, type: "text" }];
}

/** The column at `index` moved one place up (-1) or down (1); unchanged at either end. */
export function moveGridColumn(columns: readonly GridColumn[], index: number, direction: -1 | 1): GridColumn[] {
  const next = [...columns];
  const to = index + direction;
  if (!next[index] || to < 0 || to >= next.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** The column at `index` with a new code, label or required; nothing else about it changes. */
export function updateGridColumn(
  columns: readonly GridColumn[],
  index: number,
  change: { code?: string; label?: string; required?: true | undefined },
): GridColumn[] {
  return columns.map((column, k) => (k === index ? { ...column, ...change } : column));
}

/**
 * `column` as type `type` (contract §14.6): between radio and dropdown its
 * options are kept; a text column turned into either gets the placeholder
 * options a new choice block starts with, codes empty; a choice column turned
 * into text loses its options — the editor asks first (`columnTypeChangeWarning`).
 */
export function withColumnType(column: GridColumn, type: GridColumnType): GridColumn {
  if (column.type === type) return column;
  const { code, label } = column;
  const required = column.required ? { required: column.required } : {};
  if (type === "text") return { code, label, type, ...required };
  const options = isChoiceColumn(column) ? column.options : placeholderOptions("Option", 3);
  return { code, label, type, ...(options ? { options } : {}), ...required };
}

/**
 * What the editor asks before changing column `index` to `type`, or null when
 * nothing would be lost: only a choice column turned into short text loses its
 * options.
 */
export function columnTypeChangeWarning(column: GridColumn, index: number, type: GridColumnType): string | null {
  if (type !== "text" || !isChoiceColumn(column)) return null;
  const n = column.options?.length ?? 0;
  if (n === 0) return null;
  const name = column.label.trim() || `Column ${index + 1}`;
  return `Change "${name}" to short text? Its ${n} ${n === 1 ? "option" : "options"} will be removed.`;
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

/** What turning "Repeats" on writes (contract §12.1); the author can change both. */
export const REPEAT_DEFAULTS = { repeatLabel: "item", minOccurs: 1 } as const;

/** The most entries a repeating group takes with no `maxOccurs`: the renderer's default (contract §12.1). */
export const REPEAT_DEFAULT_MAX = 1000;

/**
 * The title a new page gets (contract §2.5): "Page n", where n is the number of
 * pages once it is added, raised to the next number no other page's title uses.
 * Pass the form's root blocks as they are before the page is added.
 */
export function newPageTitle(blocks: readonly Block[]): string {
  const pages = blocks.filter(isPage);
  const used = new Set(pages.map((p) => p.title.trim().toLowerCase()));
  let n = pages.length + 1;
  while (used.has(`page ${n}`)) n += 1;
  return `Page ${n}`;
}

/**
 * Create an empty page. It must be given at least one block before the form
 * can be saved. Pass every id in the form (`allBlockIds`) as `taken`, and its
 * title from `newPageTitle` unless it has one of its own.
 */
export function newPage(taken?: Iterable<string>, title = newPageTitle([])): PageBlock {
  // No `label` at runtime: see PageBlock.label.
  return { id: newBlockId(taken), type: "page", title, blocks: [] } as unknown as PageBlock;
}

/* ---------- conditional logic rules ---------- */

const EQUALITY: readonly ConditionOperator[] = ["exists", "=", "!="];
const COMPARISON: readonly ConditionOperator[] = ["exists", "=", "!=", ">", "<", ">=", "<="];
const MEMBERSHIP: readonly ConditionOperator[] = ["exists", "contains"];

/**
 * The operators each block type allows when used as a condition source. A type
 * missing from this table can't be a source at all (matrix, layout blocks, and
 * types whose answers can't be compared, e.g. long text).
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
 * The countries a country question offers. This MUST match the @zoworkhq/zoforms
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
 * The fixed set of answers a condition on `source` may use, or null when any
 * answer of the right kind is allowed. For a choice-type question these are its
 * options: a condition stores the `code` and the editor shows the `label`
 * (contract §13.4). A country question's answers are the country names
 * themselves, so each is its own code and label.
 */
export function conditionAnswerOptions(source: Block): readonly Option[] | null {
  if (isContainer(source)) return null;
  if (OPTION_SOURCE_TYPES.includes(source.type)) return source.options ?? [];
  if (source.type === "country") return COUNTRY_ANSWERS;
  return null;
}
const COUNTRY_ANSWERS: readonly Option[] = COUNTRY_OPTIONS.map((c) => ({ code: c, label: c }));

/**
 * Collects an answer, so it is numbered (contract §4). Groups, pages,
 * presentational blocks and `hidden` fields are not.
 */
export function isAnswerable(block: Block): boolean {
  return (
    !isContainer(block) && !isPresentationalType(block.type) && !STATIC_TYPES.includes(block.type)
  );
}

/**
 * Has the block-level Required setting: every answerable question except a
 * grid, whose columns are required one by one (contract §14.1).
 */
export function canBeRequired(block: Block): boolean {
  return isAnswerable(block) && !isGrid(block);
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
 * titled "Page 1". Pass every id in the form as `taken` (defaults to them).
 */
export function makePaged(blocks: readonly Block[], taken: Iterable<string> = allBlockIds(blocks)): Block[] {
  if (isPaged(blocks)) throw new Error("This form already has pages.");
  return [{ ...newPage(taken, newPageTitle(blocks)), blocks: [...blocks] }];
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
  /** For a problem with one of a group's scores (contract §17.6): that score's id, or its position from 0 when it has none. */
  score?: string | number;
  /** For a problem with one of a group's scores: that group's id (score ids are unique only within a group). */
  group?: string;
  /** For a problem with a question's name (contract §17.8). */
  field?: "name";
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

const CAPTIONS_FILE_EXTENSION = /\.vtt$/i;

/**
 * Contract §10: a video file's captions address, trimmed, when it is
 * recognised, otherwise null. Recognised is a valid source per §9 (absolute
 * `https://` with no credentials, or root-relative) whose path, before any `?`
 * or `#`, ends in .vtt, in any case. The renderer implements the same rule
 * and shares the same test table.
 */
export function parseCaptionsSource(raw: string | undefined): string | null {
  const src = validSource(raw);
  if (src === null) return null;
  return CAPTIONS_FILE_EXTENSION.test(new URLImpl(src, PLACEHOLDER_BASE).pathname) ? src : null;
}

/**
 * The save rule for a video's captions, or null when it's fine: a captions
 * address that isn't recognised, on a video whose source is a video file. On
 * YouTube, Vimeo or an unrecognised source the Captions field is hidden, so a
 * stored value is kept and not checked (the renderer ignores it there).
 * Shared by the save rules and the editor's inline message under Captions.
 */
export function captionsProblem(entry: TreeEntry): ConditionProblem | null {
  const { block } = entry;
  if (block.type !== "video" || !(block.captions ?? "").trim()) return null;
  if (parseVideoSource(block.content)?.kind !== "file" || parseCaptionsSource(block.captions) !== null) return null;
  const rule =
    "add the address of a .vtt captions file (https:// or a path on your app's server such as /captions/intro.vtt), or leave Captions empty.";
  return {
    blockId: block.id,
    message: `Video "${pathText(entry)}": ${rule}`,
    detail: rule.charAt(0).toUpperCase() + rule.slice(1),
  };
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

/* ---------- coded option lists (contract §13.6) ---------- */

/**
 * Which list of a block: its options (a matrix's rows), a matrix's or a grid's
 * columns, or a grid's rows. With `column`, "options" is that grid column's
 * own options.
 */
export type OptionListName = "options" | "columns" | "rows";
export type OptionListRef = { list: OptionListName; column?: number };

/** How a message names a grid column: by its label, or by position when it has none. */
export function gridColumnName(column: { label?: unknown }, index: number): string {
  const label = typeof column.label === "string" ? column.label.trim() : "";
  return label ? `column "${label}"` : `column ${index + 1}`;
}

/**
 * The coded lists a block carries, with how messages name one entry of each.
 * A grid has three kinds (contract §14.1): its rows, its columns (by code and
 * label) and each radio or dropdown column's options, which are named
 * `within` that column.
 */
export function optionLists(block: Block): (OptionListRef & {
  noun: string;
  options: readonly Option[] | undefined;
  /** For a column's options: the column, as messages name it. */
  within?: string;
})[] {
  if (isContainer(block)) return [];
  if (isGrid(block)) {
    return [
      { list: "rows", noun: "row", options: block.rows },
      { list: "columns", noun: "column", options: block.columns },
      ...(block.columns ?? []).flatMap((column, k) =>
        isChoiceColumn(column)
          ? [{ list: "options" as const, column: k, noun: "option", options: column.options, within: gridColumnName(column, k) }]
          : [],
      ),
    ];
  }
  if (!OPTION_TYPES.includes(block.type)) return [];
  if (block.type !== "matrix") return [{ list: "options", noun: "option", options: block.options }];
  return [
    { list: "options", noun: "row", options: block.options },
    { list: "columns", noun: "column", options: block.columns },
  ];
}

/** Whether two list references name the same list. */
export function sameOptionList(a: OptionListRef, b: OptionListRef): boolean {
  return a.list === b.list && a.column === b.column;
}

/** The list `ref` names on `block`, or an empty list when it has none. */
export function optionListAt(block: Block, ref: OptionListRef): readonly Option[] {
  const found = optionLists(block).find((l) => sameOptionList(l, ref));
  return found?.options ?? [];
}

/**
 * `block` with the list `ref` names replaced by `options`; everything else —
 * every other column, with its type, options and required — is kept. A grid's
 * columns must be columns: an entry without a column type is refused, so a
 * plain option can never replace one by mistake.
 */
export function withOptionList<T extends Option>(block: Block, ref: OptionListRef, options: readonly T[]): Block {
  if (isGrid(block)) {
    if (ref.list === "rows") return { ...block, rows: [...options] };
    if (ref.list === "columns") {
      if (!options.every((o) => GRID_COLUMN_TYPES.includes((o as { type?: GridColumnType }).type!))) {
        throw new Error("A grid's columns can only be replaced by columns, each with its type.");
      }
      return { ...block, columns: [...options] as unknown as GridColumn[] };
    }
    const k = ref.column;
    const column = k === undefined ? undefined : block.columns?.[k];
    if (!column || !isChoiceColumn(column)) throw new Error(`No radio or dropdown column at ${k}.`);
    return { ...block, columns: block.columns!.map((c, i) => (i === k ? { ...column, options: [...options] } : c)) };
  }
  if (ref.list === "rows" || ref.column !== undefined) throw new Error(`Only a grid has ${ref.list === "rows" ? "rows" : "column options"}.`);
  return { ...block, [ref.list]: [...options] } as Block;
}

export type OptionProblem = OptionListRef & {
  /** The option at fault, from 0; absent when the whole list is. */
  index?: number;
  field?: "code" | "label" | "score";
  /** Reads after the block's name in a save message. */
  rule: string;
  /** The same text, to show inline. */
  detail: string;
};

/**
 * The save rules for a block's coded lists (contract §13.6): each list has an
 * option, every option a label, a valid code, and no code or label used twice
 * (ignoring case; labels also ignoring surrounding whitespace). A matrix's rows
 * and columns are checked as separate lists, and so are a grid's rows, its
 * columns and each column's options; a problem in a column's options names the
 * column. An empty code is not a problem: it is generated (§13.3). Shared by
 * the save and the editor's inline messages.
 */
export function optionListProblems(block: Block): OptionProblem[] {
  const found: Omit<OptionProblem, "detail">[] = [];
  for (const { list, column, noun, options, within } of optionLists(block)) {
    const ref = column === undefined ? { list } : { list, column };
    // Inside a column, the rule follows the column's name: `in column "Frequency", option 2 needs a label.`
    const inside = (rule: string) => (within ? `in ${within}, ${rule}` : rule);
    if (!options?.length) {
      found.push({ ...ref, rule: within ? `${within} needs at least one ${noun}.` : `it needs at least one ${noun}.` });
      continue;
    }
    const codes = new Map<string, number>();
    const labels = new Map<string, number>();
    options.forEach((o, index) => {
      const code = o.code.trim();
      const label = o.label.trim();
      // A score is a finite number wherever it is given (contract §17.1); a missing one is a scoring rule (§17.6).
      if (o.score !== undefined && !(typeof o.score === "number" && Number.isFinite(o.score))) {
        found.push({
          ...ref, index, field: "score",
          rule: inside(`the score of ${noun} ${index + 1}${label ? ` ("${label}")` : ""} must be a number.`),
        });
      }
      if (!label) {
        found.push({ ...ref, index, field: "label", rule: inside(`${noun} ${index + 1}${code ? ` (code "${code}")` : ""} needs a label.`) });
      } else {
        const first = labels.get(label.toLowerCase());
        if (first === undefined) labels.set(label.toLowerCase(), index);
        else {
          found.push({
            ...ref, index, field: "label",
            rule: inside(`the label "${label}" is used by more than one ${noun}. Labels must be unique, ignoring case.`),
          });
        }
      }
      if (!code) return;
      if (!CODE_PATTERN.test(code)) {
        found.push({
          ...ref, index, field: "code",
          rule: inside(`the code "${code}" of ${noun} "${label}" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`),
        });
        return;
      }
      const first = codes.get(code.toLowerCase());
      if (first === undefined) codes.set(code.toLowerCase(), index);
      else {
        found.push({
          ...ref, index, field: "code",
          rule: inside(`the code "${code}" is used by more than one ${noun} ("${options[first].label.trim()}" and "${label}"). Codes must be unique, ignoring case.`),
        });
      }
    });
  }
  return found.map((p) => ({ ...p, detail: p.rule.charAt(0).toUpperCase() + p.rule.slice(1) }));
}

/* ---------- repeating groups (contract §12) ---------- */

export type RepeatSetting = "repeatLabel" | "minOccurs" | "maxOccurs";

/**
 * The save rules for a repeating group's own settings (contract §6), one per
 * field at fault. `rule` reads mid-sentence, after the group's name in a save
 * message; `detail` is the same text to show under that field. Empty for a
 * group that doesn't repeat: its settings are dropped, never checked.
 */
export function repeatSettingsProblems(
  block: Block,
): { field: RepeatSetting; rule: string; detail: string }[] {
  if (!isRepeatingGroup(block)) return [];
  const found: { field: RepeatSetting; rule: string }[] = [];
  if (!block.repeatLabel?.trim()) {
    found.push({ field: "repeatLabel", rule: 'a repeating group needs a name for one entry, such as "patient".' });
  }
  const min = block.minOccurs;
  const minValid = min === undefined || (Number.isInteger(min) && min >= 0);
  const max = block.maxOccurs;
  if (!minValid) {
    found.push({ field: "minOccurs", rule: "the minimum number of entries must be a whole number, 0 or more." });
  } else if (max === undefined && (min ?? REPEAT_DEFAULTS.minOccurs) > REPEAT_DEFAULT_MAX) {
    // The renderer refuses it: a blank maximum means 1,000, and that is below the minimum.
    found.push({
      field: "minOccurs",
      rule: `the minimum number of entries (${min}) can't be more than 1,000 without a maximum. Set Maximum entries, or lower the minimum.`,
    });
  }
  if (max !== undefined) {
    if (!(Number.isInteger(max) && max >= 1)) {
      found.push({
        field: "maxOccurs",
        rule: "the maximum number of entries must be a whole number, 1 or more, or left blank for at most 1,000.",
      });
    } else if (minValid && max < (min ?? REPEAT_DEFAULTS.minOccurs)) {
      found.push({
        field: "maxOccurs",
        rule: `the maximum number of entries (${max}) can't be less than the minimum (${min ?? REPEAT_DEFAULTS.minOccurs}).`,
      });
    }
  }
  return found.map((p) => ({ ...p, detail: p.rule.charAt(0).toUpperCase() + p.rule.slice(1) }));
}

/* ---------- linear scale and number settings (contract §6, builder only) ---------- */

/** What the renderer uses when a scale has no `min` or `max`. */
export const SCALE_DEFAULTS = { min: 1, max: 5 } as const;
/** The most points the renderer shows: it stops after this many. */
export const SCALE_MAX_POINTS = 20;

export type RangeSetting = "min" | "max";

/**
 * The save rules for a linear scale's Min and Max and a number's Minimum and
 * Maximum (contract §6, builder only: the renderer never throws for these, it
 * draws no points, or only the first 20). One per field at fault; `rule` reads
 * after the block's name in a save message, `detail` is the same text shown
 * under that field. A scale's Min and Max must be whole numbers, Min no more
 * than Max, with at most `SCALE_MAX_POINTS` points; a number's Minimum must be
 * no more than its Maximum (either may be blank, and decimals are fine).
 */
export function rangeSettingsProblems(block: Block): { field: RangeSetting; rule: string; detail: string }[] {
  const found: { field: RangeSetting; rule: string }[] = [];
  if (block.type === "scale") {
    const min = block.min ?? SCALE_DEFAULTS.min;
    const max = block.max ?? SCALE_DEFAULTS.max;
    if (!Number.isInteger(min)) found.push({ field: "min", rule: "Min must be a whole number, such as 0 or 1." });
    if (!Number.isInteger(max)) found.push({ field: "max", rule: "Max must be a whole number, such as 5 or 10." });
    if (!found.length) {
      const points = max - min + 1;
      if (min > max) {
        found.push({ field: "max", rule: `Max (${max}) can't be less than Min (${min}).` });
      } else if (points > SCALE_MAX_POINTS) {
        found.push({
          field: "max",
          rule: `a scale can have at most ${SCALE_MAX_POINTS} points; ${min} to ${max} has ${points}. Lower Max or raise Min.`,
        });
      }
    }
  } else if (block.type === "number") {
    const { min, max } = block;
    if (min !== undefined && max !== undefined && min > max) {
      found.push({ field: "max", rule: `Maximum (${max}) can't be less than Minimum (${min}).` });
    }
  }
  return found.map((p) => ({ ...p, detail: p.rule.charAt(0).toUpperCase() + p.rule.slice(1) }));
}

/** The repeating groups enclosing an entry, outermost first — never the block itself (contract §12.3). */
export function repeatChain(entry: TreeEntry): GroupBlock[] {
  return entry.ancestors.filter(isRepeatingGroup);
}

/**
 * The prefix rule (contract §3.7, §12.3): a condition's source is allowed only
 * if every repeating group enclosing the source also encloses the dependent —
 * so the source's chain of repeating groups is a prefix of the dependent's,
 * and the dependent's own entry decides which entry's answer is read. Returns
 * the outermost repeating group that encloses `source` but not `dependent`, or
 * undefined when the rule holds. It applies alongside the ordering rule.
 *
 * THE prefix check: the save rules, the editor's source picker and its guards
 * all use it.
 */
export function prefixRuleBreaker(source: TreeEntry, dependent: TreeEntry): GroupBlock | undefined {
  // By id, so entries from separate walks of the same tree compare correctly.
  return repeatChain(source).find((group) => !dependent.ancestors.some((a) => a.id === group.id));
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
 *    answer that type supports;
 *  - the source is not inside a repeating group that doesn't also enclose the
 *    dependent (the prefix rule, §3.7);
 *  - only groups repeat, and a repeating group's settings are valid (§6, §12.1);
 *  - a linear scale's Min and Max, and a number's Minimum and Maximum, are valid
 *    (§6, builder only: `rangeSettingsProblems`);
 *  - every coded list has options, each with a label and a valid code, none
 *    repeated (§13.6). Empty codes are already filled when the form is parsed
 *    (§13.3), and a condition on a coded source must use one of its codes.
 */
export function formProblems(form: { blocks: readonly Block[] }): ConditionProblem[] {
  return collectProblems(form, true);
}

/**
 * The save problems on one block other than its own field rules — a display
 * block's content (`displayBlockProblem`), a video's captions (`captionsProblem`), a repeating group's settings
 * (`repeatSettingsProblems`), its option lists (`optionListProblems`) and a scale's or
 * number's range (`rangeSettingsProblems`). This is what the editor's Logic section lists:
 * those messages are shown once, inline under the field they are about, not
 * again here. The save itself still checks everything (`formProblems`).
 */
export function problemsBesideContent(form: { blocks: readonly Block[] }, blockId: string): ConditionProblem[] {
  return collectProblems(form, false).filter((p) => p.blockId === blockId);
}

/**
 * How deep groups may nest at save (contract §6, builder only): a group inside
 * this many others is fine, one more is refused. Pages don't count. The
 * renderer's own limit is 100; storing much deeper fails in the database.
 */
export const MAX_GROUP_DEPTH = 20;

function collectProblems(form: { blocks: readonly Block[] }, withFieldRules: boolean): ConditionProblem[] {
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
      if (block.repeats) {
        add(entry, "a page can't repeat — only groups can. Put its questions in a repeating group on the page instead.");
      }
      if (block.scores !== undefined) {
        add(entry, "a page can't have scores — only groups can. Put its questions in a group on the page and score that instead.");
      }
    } else if (isGroup(block)) {
      if (!block.label.trim()) add(entry, "a group needs a label.");
      if (block.blocks.length === 0) add(entry, "a group must contain at least one block.");
      // Named once, on the outermost group too deep: the ones inside it go with it.
      if (entry.ancestors.filter(isGroup).length === MAX_GROUP_DEPTH) {
        add(entry, `groups can be nested at most ${MAX_GROUP_DEPTH} deep, and this group is inside ${MAX_GROUP_DEPTH} others. Move it up a level.`);
      }
      if (withFieldRules) for (const { rule } of repeatSettingsProblems(block)) add(entry, rule);
    }
    if (paged && entry.depth === 0 && !isPage(block)) {
      add(entry, "this form has pages, so every block must be inside a page.");
    }
    const display = withFieldRules ? displayBlockProblem(entry) : null;
    if (display) problems.push(display);
    const captions = withFieldRules ? captionsProblem(entry) : null;
    if (captions) problems.push(captions);
    if (withFieldRules) for (const { rule } of optionListProblems(block)) add(entry, rule);
    if (withFieldRules) for (const { rule } of rangeSettingsProblems(block)) add(entry, rule);
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
    for (const detail of conditionIdProblems(conditions)) add(entry, detail);
    // The logic text's own message is shown under its field (contract §15.6), so
    // it is a field rule, like a display block's content.
    const logic = withFieldRules ? logicProblem(entry.block) : null;
    if (logic) add(entry, logic);
  }
  // Scores, question names and option scores (contract §17.6–§17.8): each is shown
  // under its own field in the editor, so they are field rules too.
  if (withFieldRules) problems.push(...scoreProblems(entries));
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
  const across = prefixRuleBreaker(sourceEntry, dependent);
  if (across) {
    const noun = isPage(dependent.block) ? "page" : isGroup(dependent.block) ? "group" : "block";
    const one = across.repeatLabel?.trim() || "entry";
    const name = nodeName(across) ?? "(unlabelled group)";
    // A page can't go inside a group, so it is only told to change the condition.
    const fix = isPage(dependent.block)
      ? "Base the condition on a different question."
      : `Move the ${noun} into "${name}", or base the condition on a different question.`;
    return `its condition uses "${sourceName}", which is inside the repeating group "${name}". This ${noun} isn't inside "${name}", so it can't tell which ${one}'s answer to use. ${fix}`;
  }
  if (!allowed.includes(c.operator)) {
    return `the operator "${c.operator}" can't be used with "${sourceName}" (a ${source.type} question). Allowed: ${allowed.join(", ")}.`;
  }
  if (ORDERING.includes(c.operator) && !(typeof c.answer === "number" && Number.isFinite(c.answer))) {
    return `the operator "${c.operator}" needs a number as its answer, but got ${JSON.stringify(c.answer)}.`;
  }
  const answers = conditionAnswerOptions(source);
  // Codes compare exactly as stored: the number 44054006 is not the code "44054006" (§13.6).
  if (
    answers &&
    c.answer !== undefined &&
    !(typeof c.answer === "string" && answers.some((o) => o.code === c.answer))
  ) {
    return OPTION_SOURCE_TYPES.includes(source.type)
      ? `the answer ${JSON.stringify(c.answer)} isn't the code of any option of "${sourceName}".`
      : `the answer "${c.answer}" isn't one of the options of "${sourceName}".`;
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
 * The code to store when option `index` of `sourceId` is picked as a condition
 * answer (contract §13.3, §13.4). An option whose code is still empty gets one
 * now, so the condition has something to store; `blocks` comes back with it.
 */
export function answerCode(
  blocks: readonly Block[],
  sourceId: string,
  index: number,
): { blocks: Block[]; code: string } {
  const source = findBlock(blocks, sourceId)?.block;
  const options = source && !isContainer(source) ? source.options : undefined;
  if (!options?.[index]) return { blocks: [...blocks], code: "" };
  const filled = fillCodeAt(options, index);
  const code = filled[index].code;
  if (code === options[index].code) return { blocks: [...blocks], code };
  return { blocks: updateBlockInTree(blocks, sourceId, (b) => ({ ...b, options: filled }) as Block), code };
}

/**
 * An option's code changed from `from` to `to` (contract §13.8): every
 * condition in the form on `sourceId` whose answer is `from` now uses `to` —
 * on any page, in any group or repeating group, since conditions name their
 * source by id. Returns the new tree and how many conditions changed.
 */
export function renameOptionCode(
  blocks: readonly Block[],
  sourceId: string,
  from: string,
  to: string,
): { blocks: Block[]; updated: number } {
  let updated = 0;
  let next = [...blocks];
  if (!from || from === to) return { blocks: next, updated };
  for (const dependent of dependentsOf(blocks, sourceId, (c) => c.answer === from)) {
    next = updateBlockInTree(next, dependent.id, (b) => ({
      ...b,
      enableWhen: (b.enableWhen ?? []).map((c) => {
        if (c.question !== sourceId || c.answer !== from) return c;
        updated += 1;
        return { ...c, answer: to };
      }),
    }) as Block);
  }
  return { blocks: next, updated };
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

/**
 * Blocks with a condition whose source is inside a repeating group that
 * doesn't enclose them — the prefix rule (contract §3.7), checked with
 * `prefixRuleBreaker`.
 */
export function prefixBrokenDependents(blocks: readonly Block[]): Block[] {
  const entries = walkBlocks(blocks);
  const byId = new Map<string, TreeEntry>();
  for (const entry of entries) if (!byId.has(entry.block.id)) byId.set(entry.block.id, entry);
  return entries
    .filter((entry) =>
      (entry.block.enableWhen ?? []).some((c) => {
        const source = byId.get(c.question);
        return !!source && source !== entry && !!prefixRuleBreaker(source, entry);
      }),
    )
    .map((entry) => entry.block);
}

/**
 * What an edit of the tree's structure (`before` → `after`) would newly break,
 * by rule: `order` — a condition's source no longer comes before it — and
 * `prefix` — a source now sits in a repeating group its dependent isn't in.
 * Only breakage the edit causes counts, so an already-broken form can still be
 * rearranged. Both empty means the edit is allowed.
 *
 * Backs the editor's guards on moves (drag, arrows, "Move to…", in both
 * directions and between repeats), on removing a group but keeping its
 * contents, and on turning "Repeats" on (contract §12.8). Page edits use
 * `moveBreaks` alone: a page never repeats, so they can't change which
 * repeating groups enclose a block.
 */
export function structureBreaks(
  before: readonly Block[],
  after: readonly Block[],
): { order: Block[]; prefix: Block[]; score: Block[] } {
  const alreadyBroken = new Set(prefixBrokenDependents(before).map((b) => b.id));
  return {
    order: moveBreaks(before, after),
    prefix: prefixBrokenDependents(after).filter((b) => !alreadyBroken.has(b.id)),
    // `score`: a scored group whose formula would use a question out of its reach (contract §17.9).
    score: scoreBreaks(before, after),
  };
}

/**
 * Turning "Repeats" on for group `groupId` would leave these blocks — outside
 * it — with a condition on a question inside it, so it is refused while any
 * exist (contract §12.8). Turning it off never breaks a condition.
 */
export function repeatsOnBlockers(blocks: readonly Block[], groupId: string): Block[] {
  const after = updateBlockInTree(blocks, groupId, (b) => (isGroup(b) ? { ...b, repeats: true } : b));
  return structureBreaks(blocks, after).prefix;
}

/* ---------- importing options from a file (contract §13.9) ---------- */

/** One row read from an import file, before codes are generated. `line` is where it starts (1-based). */
export type ImportRow = { line: number; code: string; label: string };

export type ParsedImport =
  | {
      ok: true;
      rows: ImportRow[];
      /** Not a refusal: shown beside the preview, e.g. when the file looks semicolon-separated. */
      hint?: string;
    }
  | { ok: false; message: string };

/**
 * Read an option file (contract §13.9). Runs in the browser; the file is never
 * uploaded. A leading byte-order mark is ignored, and so are blank rows.
 *
 * `.txt`: each non-blank line is one label.
 *
 * `.csv`, per RFC 4180: values are separated by commas and rows by CRLF, LF or
 * CR. A value that starts with `"` is quoted: it may hold commas, line breaks
 * and doubled quotes (`""` is one `"`), and ends at the next lone `"`, which
 * must be followed by a comma or the end of the row. Beyond the RFC:
 *  - a quote inside a value that does *not* start with one (`5" screen`) is an
 *    ordinary character, kept as written — the way spreadsheet apps read it;
 *  - text after a closing quote (`"a"b`) refuses the file, naming the line;
 *  - a quoted value never closed refuses the file, naming the line it opens on.
 * A row with one value is a label; two values are a code and a label; more
 * than two refuses the file. A first row of exactly `label` or `code,label`
 * (ignoring case and spaces) is a header and skipped. Values are trimmed.
 * When every row is a single value containing `;`, the file probably uses
 * semicolons as separators, and a hint says so.
 */
export function parseOptionFile(text: string, kind: "csv" | "txt"): ParsedImport {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (kind === "txt") {
    const rows: ImportRow[] = [];
    body.split(/\r\n|\n|\r/).forEach((raw, k) => {
      const label = raw.trim();
      if (label) rows.push({ line: k + 1, code: "", label });
    });
    return { ok: true, rows };
  }

  const records = splitCsv(body);
  if (!records.ok) return records;
  const rows: ImportRow[] = [];
  let first = true;
  let singleWithSemicolon = 0;
  for (const { line, fields } of records.records) {
    if (fields.every((f) => !f.trim())) continue; // a blank row
    if (fields.length > 2) {
      return {
        ok: false,
        message: `Line ${line} has ${fields.length} columns. A file can have one column (labels) or two (code, then label).`,
      };
    }
    const values = fields.map((f) => f.trim());
    const header = values.map((v) => v.toLowerCase().replace(/\s+/g, "")).join(",");
    const isHeader = first && (header === "label" || header === "code,label");
    first = false;
    if (isHeader) continue;
    if (values.length === 1) {
      if (values[0].includes(";")) singleWithSemicolon += 1;
      rows.push({ line, code: "", label: values[0] });
    } else {
      rows.push({ line, code: values[0], label: values[1] });
    }
  }
  if (rows.length > 0 && singleWithSemicolon === rows.length) {
    return {
      ok: true,
      rows,
      hint: 'This file looks semicolon-separated, so each row was read as one label. If the semicolons separate a code from a label, save the file as comma-separated (in Excel: "CSV UTF-8") and choose it again.',
    };
  }
  return { ok: true, rows };
}

/** RFC 4180 records, each with the line it starts on, or a refusal naming a line. */
function splitCsv(
  text: string,
): { ok: true; records: { line: number; fields: string[] }[] } | { ok: false; message: string } {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let value = "";
  let started = false; // has the current value begun (a character, or a quoted part)?
  let line = 1; // the physical line being read
  let recordLine = 1; // the line the current record starts on
  let i = 0;
  const endValue = () => {
    fields.push(value);
    value = "";
    started = false;
  };
  const endRecord = () => {
    endValue();
    records.push({ line: recordLine, fields });
    fields = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' && !started) {
      // A quoted value: only when the quote opens the value.
      const opensOn = line;
      started = true;
      i += 1;
      let closed = false;
      while (i < text.length) {
        const c = text[i];
        if (c === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        if (c === "\r" || c === "\n") {
          const pair = c === "\r" && text[i + 1] === "\n";
          value += pair ? "\r\n" : c;
          i += pair ? 2 : 1;
          line += 1;
          continue;
        }
        value += c;
        i += 1;
      }
      if (!closed) {
        return { ok: false, message: `Line ${opensOn}: a quoted value is never closed. Check the quotes on that line.` };
      }
      const next = text[i];
      if (next !== undefined && next !== "," && next !== "\r" && next !== "\n") {
        return {
          ok: false,
          message: `Line ${line}: there is text after a closing quote. Put the whole value inside the quotes, and write a quote inside it as "".`,
        };
      }
      continue;
    }
    if (ch === ",") {
      endValue();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }
    value += ch; // a stray quote inside an unquoted value lands here: kept as written
    started = true;
    i += 1;
  }
  if (started || fields.length) endRecord();
  return { ok: true, records };
}

export type ImportMode = "add" | "replace";

/** One row of the import preview: its code (as given, or generated) and label, and what is wrong with it. */
export type ImportPreviewRow = { line: number; code: string; label: string; generated: boolean; flags: string[] };

/**
 * The import preview (contract §13.9): each row's code — as given, or
 * generated (§13.3) with the file's codes reserved first and, for "add", the
 * list's existing codes too — and its flags: a missing label, an invalid code,
 * a code or label used twice in the file, and, for "add", one already in the
 * list. Apply is allowed only when no row is flagged (`canApplyImport`).
 */
export function previewImport(
  rows: readonly ImportRow[],
  existing: readonly Option[],
  mode: ImportMode,
): ImportPreviewRow[] {
  const keep = mode === "add" ? existing : [];
  const filled = fillCodes(
    rows.map((r) => ({ code: r.code, label: r.label.trim() })),
    keep.map((o) => o.code.trim()).filter(Boolean),
  );
  const existingCodes = new Map(keep.map((o) => [o.code.trim().toLowerCase(), o.label.trim()]));
  const existingLabels = new Set(keep.map((o) => o.label.trim().toLowerCase()));
  const seenCodes = new Map<string, number>();
  const seenLabels = new Map<string, number>();
  return rows.map((row, k) => {
    const { code, label } = filled[k];
    const flags: string[] = [];
    if (!label) flags.push("No label.");
    if (!CODE_PATTERN.test(code)) {
      flags.push(`The code "${code}" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`);
    } else {
      const lower = code.toLowerCase();
      if (seenCodes.has(lower)) flags.push(`The code "${code}" is also on line ${seenCodes.get(lower)}.`);
      else if (existingCodes.has(lower)) flags.push(`The code "${code}" is already used by the option "${existingCodes.get(lower)}".`);
      if (!seenCodes.has(lower)) seenCodes.set(lower, row.line);
    }
    if (label) {
      const lower = label.toLowerCase();
      if (seenLabels.has(lower)) flags.push(`The label "${label}" is also on line ${seenLabels.get(lower)}.`);
      else if (existingLabels.has(lower)) flags.push(`The label "${label}" is already an option.`);
      if (!seenLabels.has(lower)) seenLabels.set(lower, row.line);
    }
    return { line: row.line, code, label, generated: !row.code.trim(), flags };
  });
}

/** Whether an import preview can be applied: it has rows and none is flagged. */
export function canApplyImport(preview: readonly ImportPreviewRow[]): boolean {
  return preview.length > 0 && preview.every((r) => r.flags.length === 0);
}

/** The list after applying an unflagged preview: appended in file order, or replacing the list. */
export function applyImport(existing: readonly Option[], preview: readonly ImportPreviewRow[], mode: ImportMode): Option[] {
  const imported = preview.map(({ code, label }) => ({ code, label }));
  if (mode === "add") return [...existing, ...imported];
  // Replace all keeps the score of every option whose code is in the file, matched as
  // conditions match (`replaceBlockers`), so it keeps its score as it keeps its conditions (contract §17.9).
  const scores = new Map(existing.flatMap((o) => (o.score === undefined ? [] : [[o.code, o.score] as const])));
  return imported.map((o) => {
    const score = scores.get(o.code);
    return score === undefined ? o : { ...o, score };
  });
}

/**
 * Replacing a block's options with `codes` would leave these blocks with a
 * condition on a code that is gone, so "Replace all" is refused while any exist
 * (contract §13.9). Codes that appear in the new list keep their conditions.
 */
export function replaceBlockers(blocks: readonly Block[], sourceId: string, codes: readonly string[]): Block[] {
  const kept = new Set(codes);
  return dependentsOf(blocks, sourceId, (c) => typeof c.answer === "string" && !kept.has(c.answer));
}

/* ---------- templates (builder only) ---------- */

// Last: templates.ts uses this module, and only inside functions, so the cycle is safe.
export * from "./templates";
// The same holds for scoring.ts, which this module also calls, only from inside functions.
export * from "./scoring";

/* ---------- author preferences (builder only) ---------- */

export * from "./preferences";
