/*
 * Scoring in the form's tree (docs/GROUPS-AND-PAGES-CONTRACT.md §17): which
 * questions a scored group's formulas can reach, the question names formulas
 * use, the save rules for scores, what the artifact carries, and the editor's
 * guards. The formula text itself is read by `formula.ts`.
 *
 * The text is the source of truth (§17.7), and stored content holds nothing
 * else. At save, `normalizeScores` fills score ids and question names and turns
 * a tree sent without text into text; the save rules (`scoreProblems`) then
 * parse and check everything; the artifact carries only the trees, derived
 * from the text (`withArtifactScores`).
 *
 * This module and index.ts use each other, only from inside functions, so the
 * import cycle is safe (as with templates.ts).
 */
import {
  CODE_PATTERN,
  SCORE_UNANSWERED,
  blockName,
  describeBlockPath,
  isAnswerable,
  isContainer,
  isGroup,
  isPage,
  newScoreId,
  prefixRuleBreaker,
  questionNumbers,
  updateBlockInTree,
  walkBlocks,
  type AnyBlockType,
  type Block,
  type ConditionProblem,
  type GroupBlock,
  type Option,
  type Score,
  type TreeEntry,
} from "./index";
import {
  FORMULA_TOO_LONG,
  NAME_PATTERN,
  checkFormulaText,
  formulaNamesInText,
  formulaRefs,
  formulaShapeProblem,
  formulaTerms,
  formulaToText,
  generateQuestionName,
  renameInFormulaText,
  renameNamesInFormulaText,
  suffixedName,
  FORMULA_MAX_TERMS,
  type FormulaNode,
  type NameLookup,
} from "./formula";

/* ---------- what can be scored (§17.1, §17.2) ---------- */

/** The question types a formula may use (§17.2). */
export const SCORABLE_TYPES: readonly AnyBlockType[] = [
  "number",
  "scale",
  "rating",
  "choice",
  "dropdown",
  "checkbox",
  "multiselect",
  "matrix",
];

const SCORED_OPTION_TYPES: readonly AnyBlockType[] = ["choice", "dropdown", "checkbox", "multiselect"];

/** Whether a formula may use a question of this type (§17.2). */
export function canTypeBeScored(type: AnyBlockType): boolean {
  return SCORABLE_TYPES.includes(type);
}

/** Whether a formula may use this block (§17.2): an answerable question of a scorable type. */
export function canBeScored(block: Block): boolean {
  return isAnswerable(block) && canTypeBeScored(block.type);
}

/**
 * The list whose entries carry option scores (§17.1): the options of choice,
 * dropdown, checkbox and multiselect, and a matrix's columns. Null for every
 * other block — a score anywhere else is ignored.
 */
export function scoredOptionList(
  block: Block,
): { list: "options" | "columns"; noun: "option" | "column"; options: readonly Option[] } | null {
  if (isContainer(block)) return null;
  if (block.type === "matrix") return { list: "columns", noun: "column", options: block.columns ?? [] };
  if (SCORED_OPTION_TYPES.includes(block.type)) return { list: "options", noun: "option", options: block.options ?? [] };
  return null;
}

/** A group with at least one score: its formulas have a reach, and its questions names (§17.8). */
export function isScoredGroup(block: Block): block is GroupBlock & { scores: Score[] } {
  return isGroup(block) && Array.isArray(block.scores) && block.scores.length > 0;
}

/* ---------- reach (§17.2) ---------- */

/** The group's entry with the group among its own ancestors: what "encloses the group, or is it" means. */
function withSelf(group: TreeEntry): TreeEntry {
  return { ...group, ancestors: [...group.ancestors, group.block as GroupBlock] };
}

/**
 * Whether `group`'s formulas can use `question` (§17.2): an answerable question
 * inside the group, including inside its nested plain groups, with no repeating
 * group between them. The prefix rule says exactly that (`prefixRuleBreaker`):
 * every repeating group around the question must be the group itself or
 * enclose it. So a scored repeating group's own questions are within reach.
 */
export function inScoreReach(question: TreeEntry, group: TreeEntry): boolean {
  return (
    isAnswerable(question.block) &&
    question.ancestors.some((a) => a.id === group.block.id) &&
    !prefixRuleBreaker(question, withSelf(group))
  );
}

/** One walk of the tree, with each group's reach and the answerable questions behind a nested repeat. */
type ScoreContext = {
  entries: TreeEntry[];
  byId: Map<string, TreeEntry>;
  /** Questions within reach of each group (by id), in reading order. */
  reach: Map<string, TreeEntry[]>;
  /** Answerable questions inside each group but inside a nested repeating group. */
  behind: Map<string, TreeEntry[]>;
  /** The groups whose reach includes each question (by id), outermost first. */
  reachedBy: Map<string, TreeEntry[]>;
};

/**
 * The reach of every group in `blocks` — or, with `entries`, of the tree they
 * come from. Each question looks at its own ancestors, so this is linear in
 * the size of the tree times its depth.
 */
function scoreContext(blocks: readonly Block[]): ScoreContext {
  const entries = walkBlocks(blocks);
  const byId = new Map<string, TreeEntry>();
  for (const entry of entries) if (!byId.has(entry.block.id)) byId.set(entry.block.id, entry);
  const reach = new Map<string, TreeEntry[]>();
  const behind = new Map<string, TreeEntry[]>();
  const reachedBy = new Map<string, TreeEntry[]>();
  for (const entry of entries) {
    if (!isAnswerable(entry.block)) continue;
    // Walking outwards, a repeating group cuts off every group outside it.
    let repeated = false;
    const groups: TreeEntry[] = [];
    for (let k = entry.ancestors.length - 1; k >= 0; k -= 1) {
      const ancestor = entry.ancestors[k];
      if (!isGroup(ancestor)) continue;
      const target = repeated ? behind : reach;
      const list = target.get(ancestor.id) ?? [];
      list.push(entry);
      target.set(ancestor.id, list);
      if (!repeated) groups.unshift(byId.get(ancestor.id)!);
      if (ancestor.repeats === true) repeated = true;
    }
    reachedBy.set(entry.block.id, groups);
  }
  return { entries, byId, reach, behind, reachedBy };
}

/** The questions within reach of group `groupId` (§17.2), in reading order. */
export function scoreReach(blocks: readonly Block[], groupId: string): Block[] {
  return (scoreContext(blocks).reach.get(groupId) ?? []).map((e) => e.block);
}

/** A question's name, when it has one. */
function nameOf(block: Block): string | undefined {
  return typeof block.name === "string" && block.name.trim() ? block.name : undefined;
}

/** Whether a question still needs a name: none, or a blank one (§17.8). */
function needsName(block: Block): boolean {
  return block.name === undefined || (typeof block.name === "string" && !block.name.trim());
}

/** What each name means in group `groupId`'s formulas (§17.7). */
function lookupFor(ctx: ScoreContext, groupId: string): NameLookup {
  const named = new Map<string, Block>();
  for (const q of ctx.reach.get(groupId) ?? []) {
    const name = nameOf(q.block)?.toLowerCase();
    if (name !== undefined && !named.has(name)) named.set(name, q.block);
  }
  const hidden = new Set<string>();
  for (const q of ctx.behind.get(groupId) ?? []) {
    const name = nameOf(q.block)?.toLowerCase();
    if (name !== undefined) hidden.add(name);
  }
  return (name) => {
    const block = named.get(name);
    if (block) return canBeScored(block) ? { kind: "ok", id: block.id } : { kind: "unscorable" };
    return hidden.has(name) ? { kind: "repeating" } : { kind: "missing" };
  };
}

/** Rebuild `blocks`, changing each block `edit` returns a new one for. Unchanged subtrees are kept as they are. */
function mapTree(blocks: readonly Block[], edit: (block: Block) => Block): Block[] {
  let changed = false;
  const next = blocks.map((block) => {
    let own = edit(block);
    if (isContainer(own)) {
      const children = mapTree(own.blocks, edit);
      if (children !== own.blocks) own = { ...own, blocks: children } as Block;
    }
    if (own !== block) changed = true;
    return own;
  });
  return changed ? next : (blocks as Block[]);
}

/* ---------- question names (§17.8) ---------- */

/**
 * Every question within reach of a scored group that has no name gets one
 * (§17.8), unless it is in `skip` — new questions whose label hasn't been
 * written yet, which get theirs when the author leaves the label field. With
 * `only`, just those questions are named. Names already there, valid or not,
 * are kept and reserved first, in every scored group that reaches the
 * question; a generated name never takes one. A name is never regenerated.
 */
export function fillQuestionNames(
  blocks: readonly Block[],
  options: { skip?: ReadonlySet<string>; only?: ReadonlySet<string> } = {},
): Block[] {
  const ctx = scoreContext(blocks);
  const scored = (g: TreeEntry) => isScoredGroup(g.block);
  const taken = new Map<string, Set<string>>();
  for (const [groupId, questions] of ctx.reach) {
    if (!isScoredGroup(ctx.byId.get(groupId)!.block)) continue;
    taken.set(groupId, new Set(questions.flatMap((q) => (typeof q.block.name === "string" && q.block.name.trim() ? [q.block.name.toLowerCase()] : []))));
  }
  let numbers: Map<string, number> | undefined;
  const generated = new Map<string, string>();
  for (const entry of ctx.entries) {
    const groups = (ctx.reachedBy.get(entry.block.id) ?? []).filter(scored);
    if (!groups.length || !needsName(entry.block)) continue;
    if (options.skip?.has(entry.block.id) || (options.only && !options.only.has(entry.block.id))) continue;
    numbers ??= questionNumbers(blocks);
    const used = groups.flatMap((g) => [...taken.get(g.block.id)!]);
    const name = generateQuestionName(entry.block.label ?? "", used, numbers.get(entry.block.id) ?? 0);
    for (const g of groups) taken.get(g.block.id)!.add(name);
    generated.set(entry.block.id, name);
  }
  if (!generated.size) return blocks as Block[];
  return mapTree(blocks, (b) => (generated.has(b.id) ? ({ ...b, name: generated.get(b.id) } as Block) : b));
}

/**
 * Every name taken in the reach of the scored groups that reach `questionId`,
 * except the question's own: what its name must avoid (§17.8).
 */
export function namesTakenFor(blocks: readonly Block[], questionId: string): string[] {
  const ctx = scoreContext(blocks);
  const names = new Set<string>();
  for (const g of (ctx.reachedBy.get(questionId) ?? []).filter((e) => isScoredGroup(e.block))) {
    for (const q of ctx.reach.get(g.block.id) ?? []) {
      const name = nameOf(q.block);
      if (q.block.id !== questionId && name) names.add(name.toLowerCase());
    }
  }
  return [...names];
}

/** Whether a question is within reach of at least one scored group, so it has a name (§17.8, §17.9). */
export function isWithinScoreReach(blocks: readonly Block[], questionId: string): boolean {
  return (scoreContext(blocks).reachedBy.get(questionId) ?? []).some((g) => isScoredGroup(g.block));
}

/**
 * Question `id`'s name changed from `from` to `to` (§17.9): every formula text
 * of a scored group that reaches it, and uses `from`, now uses `to`, and the
 * question is named `to`. Returns the new tree and how many formula texts
 * changed. `from` is the name the formulas still use — the editor remembers it
 * while the author types, as it does for option codes.
 */
export function renameQuestion(
  blocks: readonly Block[],
  id: string,
  from: string,
  to: string,
): { blocks: Block[]; updated: number } {
  const ctx = scoreContext(blocks);
  const groups = new Set((ctx.reachedBy.get(id) ?? []).filter((g) => isScoredGroup(g.block)).map((g) => g.block.id));
  let updated = 0;
  const rewrite = !!from && from.toLowerCase() !== to.toLowerCase();
  const next = mapTree(blocks, (b) => {
    if (b.id === id) return { ...b, name: to } as Block;
    if (!rewrite || !groups.has(b.id) || !isScoredGroup(b)) return b;
    let changed = false;
    const scores = b.scores.map((s) => {
      if (typeof s?.formulaText !== "string") return s;
      const text = renameInFormulaText(s.formulaText, from, to);
      if (text === s.formulaText) return s;
      changed = true;
      updated += 1;
      return { ...s, formulaText: text };
    });
    return changed ? ({ ...b, scores } as Block) : b;
  });
  return { blocks: next, updated };
}

/**
 * After an edit that brought questions into new scored groups' reach — a move
 * (§17.9) or a template inserted (§17.9 Templates) — a name in `yielding` (the
 * moved or inserted blocks' ids) that clashes within some scored group's reach
 * gets the §17.8 suffix. The formula texts rewritten are only those in which the
 * name meant that question: the texts of scored groups that reach it now and
 * either are among `yielding` (a template copy's own) or reached it before the
 * edit (a moved question's). A clash between two questions not in `yielding`
 * was there before and is left for the save rules.
 */
export function resolveNameClashes(
  before: readonly Block[],
  after: readonly Block[],
  yielding: ReadonlySet<string>,
): { blocks: Block[]; renamed: { id: string; from: string; to: string }[] } {
  const ctx = scoreContext(after);
  const current = new Map<string, string>();
  for (const e of ctx.entries) {
    const name = nameOf(e.block);
    if (name) current.set(e.block.id, name);
  }
  const renamed: { id: string; from: string; to: string }[] = [];
  for (const [groupId, questions] of ctx.reach) {
    if (!isScoredGroup(ctx.byId.get(groupId)!.block)) continue;
    const seen = new Map<string, string>();
    for (const q of questions) {
      const name = current.get(q.block.id);
      if (!name) continue;
      const other = seen.get(name.toLowerCase());
      if (other === undefined) {
        seen.set(name.toLowerCase(), q.block.id);
        continue;
      }
      const loser = yielding.has(q.block.id) ? q.block.id : yielding.has(other) ? other : undefined;
      if (loser === undefined) continue;
      if (loser === other) seen.set(name.toLowerCase(), q.block.id);
      const taken = new Set<string>();
      for (const g of (ctx.reachedBy.get(loser) ?? []).filter((e) => isScoredGroup(e.block))) {
        for (const r of ctx.reach.get(g.block.id) ?? []) {
          const n = current.get(r.block.id);
          if (n) taken.add(n.toLowerCase());
        }
      }
      const to = suffixedName(name, taken);
      current.set(loser, to);
      renamed.push({ id: loser, from: name, to });
    }
  }
  if (!renamed.length) return { blocks: after as Block[], renamed };

  const old = scoreContext(before);
  const reachedBefore = (groupId: string, questionId: string) => {
    const g = old.byId.get(groupId);
    const q = old.byId.get(questionId);
    return !!g && !!q && inScoreReach(q, g);
  };
  const texts = new Map<string, { from: string; to: string }[]>(); // group id → renames to apply to its texts
  for (const r of renamed) {
    for (const g of (ctx.reachedBy.get(r.id) ?? []).filter((e) => isScoredGroup(e.block))) {
      if (!yielding.has(g.block.id) && !reachedBefore(g.block.id, r.id)) continue;
      texts.set(g.block.id, [...(texts.get(g.block.id) ?? []), r]);
    }
  }
  const names = new Map(renamed.map((r) => [r.id, r.to]));
  const blocks = mapTree(after, (b) => {
    let own = names.has(b.id) ? ({ ...b, name: names.get(b.id) } as Block) : b;
    const edits = texts.get(b.id);
    if (edits && isScoredGroup(own)) {
      own = {
        ...own,
        scores: own.scores.map((s) => {
          if (typeof s?.formulaText !== "string") return s;
          const text = renameNamesInFormulaText(s.formulaText, new Map(edits.map((e) => [e.from, e.to])));
          return text === s.formulaText ? s : { ...s, formulaText: text };
        }),
      } as Block;
    }
    return own;
  });
  return { blocks, renamed };
}

/* ---------- which questions formulas use (the editor's guards, §17.9) ---------- */

/** One question used by one score's formula. */
export type ScoreUse = { group: GroupBlock; score: Score; scoreIndex: number; question: Block };

/**
 * Every question each score's formula uses: by the names in its text — even
 * text with other errors, as the logic guard scans condition numbers (§15.6) —
 * matched against the names within the group's reach; or, for a score stored
 * with a tree but no text, by the tree's references.
 */
export function scoreUses(blocks: readonly Block[]): ScoreUse[] {
  return usesIn(scoreContext(blocks));
}

function usesIn(ctx: ScoreContext): ScoreUse[] {
  const uses: ScoreUse[] = [];
  for (const g of ctx.entries) {
    if (!isScoredGroup(g.block)) continue;
    const group = g.block;
    const byName = new Map<string, Block>();
    for (const q of ctx.reach.get(group.id) ?? []) {
      const name = nameOf(q.block)?.toLowerCase();
      if (name !== undefined && !byName.has(name)) byName.set(name, q.block);
    }
    group.scores.forEach((score, scoreIndex) => {
      if (typeof score !== "object" || score === null) return;
      const questions: Block[] = [];
      if (typeof score.formulaText === "string") {
        for (const name of formulaNamesInText(score.formulaText)) {
          const q = byName.get(name);
          if (q && !questions.includes(q)) questions.push(q);
        }
      } else if (score.formula !== undefined && formulaShapeProblem(score.formula) === null) {
        for (const ref of formulaRefs(score.formula)) {
          const q = ctx.byId.get(ref);
          if (q && !questions.includes(q.block)) questions.push(q.block);
        }
      }
      for (const question of questions) uses.push({ group, score, scoreIndex, question });
    });
  }
  return uses;
}

/** The scores in `uses`, each once, in order. */
function distinctScores(uses: readonly ScoreUse[]): ScoreUse[] {
  const seen = new Set<string>();
  return uses.filter((u) => {
    const key = `${u.group.id}|${u.scoreIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The scores whose formulas would lose a question if block `id` — with
 * everything inside it, for a group — were deleted (§17.9). A score on a
 * deleted group doesn't count: it goes too.
 */
export function scoreDeletionBlockers(blocks: readonly Block[], id: string): ScoreUse[] {
  const target = walkBlocks(blocks).find((e) => e.block.id === id);
  if (!target) return [];
  const deleted = new Set(walkBlocks([target.block]).map((e) => e.block.id));
  return distinctScores(scoreUses(blocks).filter((u) => deleted.has(u.question.id) && !deleted.has(u.group.id)));
}

/** The scores that use question `id`, when changing it to `type` would make it unscorable (§17.9). */
export function scoreTypeChangeBlockers(blocks: readonly Block[], id: string, type: AnyBlockType): ScoreUse[] {
  if (canTypeBeScored(type)) return [];
  return distinctScores(scoreUses(blocks).filter((u) => u.question.id === id));
}

/** `Used in the score "Total score" of "PHQ-9". Remove it from the formula first.` (§17.9) */
export function scoreUseMessage(use: ScoreUse): string {
  const label = typeof use.score.label === "string" && use.score.label.trim() ? use.score.label : `Score ${use.scoreIndex + 1}`;
  return `Used in the score "${label}" of "${blockName(use.group)}". Remove it from the formula first.`;
}

/**
 * The scored groups a change to the tree's structure (`before` → `after`)
 * would leave with a formula using a question out of their reach (§17.9): a
 * move out of the group or into a nested repeating group, or Repeats turned on
 * for a nested group that holds one. Only breakage the edit causes counts.
 */
export function scoreBreaks(before: readonly Block[], after: readonly Block[]): Block[] {
  const old = scoreContext(before);
  const now = scoreContext(after);
  const broken: Block[] = [];
  for (const use of usesIn(old)) {
    const gBefore = old.byId.get(use.group.id)!;
    const qBefore = old.byId.get(use.question.id)!;
    if (!inScoreReach(qBefore, gBefore)) continue; // already broken
    const g = now.byId.get(use.group.id);
    const q = now.byId.get(use.question.id);
    if (!g || !q || inScoreReach(q, g)) continue;
    if (!broken.includes(g.block)) broken.push(g.block);
  }
  return broken;
}

/** Turning Repeats on for group `groupId` would leave these scored groups with a formula out of reach (§17.9). */
export function repeatsOnScoreBlockers(blocks: readonly Block[], groupId: string): Block[] {
  const after = updateBlockInTree(blocks, groupId, (b) => (isGroup(b) ? { ...b, repeats: true } : b));
  return scoreBreaks(blocks, after);
}

/* ---------- the save (§17.7, §17.9) ---------- */

/**
 * The stored content's scores brought to the saved shape, before the save
 * rules run (§17.7–§17.9):
 * - a score without an id gets one: the id the same score has in `previous`
 *   (same group, same position, same label), else a new random one;
 * - every question within reach of a scored group gets a name if it has none;
 * - stored content holds a score's text only, never its tree: a tree sent with
 *   text is dropped (the save rules check the text, and the artifact derives
 *   the tree from it, `withArtifactScores`), and a valid tree sent without
 *   text is replaced by text made from it. An invalid tree is kept, so the save
 *   rules refuse it by name; it is never stored.
 *
 * Why no tree: a long sum makes a deep tree, and the database layer refuses
 * JSON nested more than 128 levels (Prisma), which a formula of about 60 terms
 * already reaches. The text has no depth, and the 300-term limit (§17.7) only
 * has to hold for the artifact.
 */
export function normalizeScores(blocks: readonly Block[], previous: readonly Block[] = []): Block[] {
  const before = new Map<string, Score[]>();
  for (const { block } of walkBlocks(previous)) if (isGroup(block) && Array.isArray(block.scores)) before.set(block.id, block.scores);

  const withIds = mapTree(blocks, (b) => {
    if (!isGroup(b) || !Array.isArray(b.scores) || !b.scores.some((s) => isObject(s) && s.id === undefined)) return b;
    const taken = new Set(b.scores.flatMap((s) => (isObject(s) && typeof s.id === "string" ? [s.id] : [])));
    const old = before.get(b.id) ?? [];
    const scores = b.scores.map((s, i) => {
      if (!isObject(s) || s.id !== undefined) return s;
      const same = old[i];
      const id = isObject(same) && typeof same.id === "string" && same.label === s.label && !taken.has(same.id) ? same.id : newScoreId(taken);
      taken.add(id);
      return { id, ...s };
    });
    return { ...b, scores } as Block;
  });

  const named = fillQuestionNames(withIds);
  const ctx = scoreContext(named);
  const names = (id: string) => {
    const q = ctx.byId.get(id);
    return q ? nameOf(q.block) : undefined;
  };
  return mapTree(named, (b) => {
    if (!isScoredGroup(b)) return b;
    const lookup = lookupFor(ctx, b.id);
    let changed = false;
    const scores = b.scores.map((s) => {
      if (!isObject(s) || s.formula === undefined) return s;
      // With text, any tree sent is ignored: the text is the formula.
      if (s.formulaText !== undefined) {
        const { formula: _sent, ...rest } = s;
        changed = true;
        return rest as Score;
      }
      // Without text, a valid tree becomes text; an invalid one stays, for the save rules to refuse.
      if (treeProblem(ctx, b.id, s.formula) !== null) return s;
      const text = formulaToText(s.formula, names);
      if (text === null || !checkFormulaText(text, lookup).ok) return s;
      const { formula: _tree, ...rest } = s;
      changed = true;
      return { ...rest, formulaText: text } as Score;
    });
    return changed ? ({ ...b, scores } as Block) : b;
  });
}

function isObject(value: unknown): value is Record<string, unknown> & Partial<Score> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** How a message names one of a group's scores: by its label, or by position. */
function scoreName(score: unknown, index: number): string {
  const label = isObject(score) && typeof score.label === "string" ? score.label.trim() : "";
  return label ? `score "${label}"` : `score ${index + 1}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What is wrong with a tree stored without text, or exported, in group
 * `groupId` (§17.6, §17.7), or null. The checks follow the text table's order:
 * the shape, then each reference (in this form, within reach, not behind a
 * nested repeat, scorable), at least one reference, the length limit.
 */
function treeProblem(ctx: ScoreContext, groupId: string, formula: unknown): string | null {
  const shape = formulaShapeProblem(formula);
  if (shape) return capitalize(shape);
  const tree = formula as FormulaNode;
  const refs = formulaRefs(tree);
  const reach = new Set((ctx.reach.get(groupId) ?? []).map((q) => q.block.id));
  const behind = new Set((ctx.behind.get(groupId) ?? []).map((q) => q.block.id));
  for (const ref of refs) {
    const q = ctx.byId.get(ref);
    if (!q) return `Its formula uses ${JSON.stringify(ref)}, which isn't the id of a question in this form.`;
    if (behind.has(ref)) return `Its formula uses "${blockName(q.block)}", which is in a repeating group, so this score can't use it.`;
    if (!reach.has(ref)) return `Its formula uses "${blockName(q.block)}", which isn't a question in this group.`;
  }
  for (const ref of refs) {
    const q = ctx.byId.get(ref)!;
    if (!canBeScored(q.block)) {
      return `Its formula uses "${blockName(q.block)}", which can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`;
    }
  }
  if (!refs.length) return "Use at least one question name.";
  if (formulaTerms(tree) > FORMULA_MAX_TERMS) return FORMULA_TOO_LONG;
  return null;
}

/**
 * The save rules for scores, question names and option scores (§17.6–§17.8),
 * in the API's words; `formProblems` includes them. Each names the group and
 * the score, or the question:
 *  - `scores` is a list of objects; each has a valid id, unique in its group
 *    (missing only before the save fills it), a label, `unanswered` "no-score"
 *    or "zero", `decimals` a whole number 0–4, `showToRespondent` a boolean;
 *  - its formula text parses (§17.7), or — stored without text — its tree is
 *    valid; either way within the 300-term limit;
 *  - every question within reach of a scored group has a valid name, unique in
 *    the reach of every scored group that reaches it (§17.8). A missing name is
 *    no problem: the save generates it;
 *  - every option (or matrix column) of a coded question a formula uses has a
 *    score (§17.6). A score that isn't a number is an option-list rule.
 *
 * With `artifact`, the rules the renderer applies at mount instead: ids are
 * required, there is no text and no names, and only the tree is checked.
 */
export function scoreProblems(entries: readonly TreeEntry[], artifact = false): ConditionProblem[] {
  const ctx = scoreContext(entries.filter((e) => e.depth === 0).map((e) => e.block));
  const problems: ConditionProblem[] = [];
  const subject = (e: TreeEntry) => describeBlockPath([...e.ancestors, e.block], e.path);

  for (const g of ctx.entries) {
    const scores = isGroup(g.block) ? (g.block.scores as unknown) : undefined;
    if (scores === undefined) continue;
    if (!Array.isArray(scores)) {
      const detail = "Its scores must be a list.";
      problems.push({ blockId: g.block.id, message: `${subject(g)}: ${detail}`, detail });
      continue;
    }
    const lookup = lookupFor(ctx, g.block.id);
    const ids = new Map<string, number>();
    (scores as unknown[]).forEach((s, i) => {
      const key: string | number = isObject(s) && typeof s.id === "string" ? s.id : i;
      const at = (detail: string) =>
        problems.push({
          blockId: g.block.id,
          message: `${subject(g)}, ${scoreName(s, i)}: ${detail}`,
          detail,
          score: key,
        });
      if (!isObject(s)) {
        at("It must be an object with a label, a formula and how to treat unanswered questions.");
        return;
      }
      if (s.id === undefined) {
        if (artifact) at("It has no id.");
      } else if (typeof s.id !== "string" || !CODE_PATTERN.test(s.id)) {
        at(`Its id ${JSON.stringify(s.id)} isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`);
      } else if (ids.has(s.id)) {
        at(`Its id "${s.id}" is also used by score ${ids.get(s.id)! + 1}. Score ids must be unique within a group.`);
      } else ids.set(s.id, i);
      if (typeof s.label !== "string" || !s.label.trim()) at("It needs a label.");
      if (!SCORE_UNANSWERED.includes(s.unanswered as never)) {
        at(`Its unanswered setting must be "no-score" or "zero", not ${JSON.stringify(s.unanswered) ?? "missing"}.`);
      }
      if (s.decimals !== undefined && !(Number.isInteger(s.decimals) && s.decimals! >= 0 && s.decimals! <= 4)) {
        at("Its decimal places must be a whole number from 0 to 4.");
      }
      if (s.showToRespondent !== undefined && typeof s.showToRespondent !== "boolean") {
        at("Its showToRespondent setting must be true or false.");
      }

      let refs: string[] = [];
      if (s.formulaText !== undefined) {
        if (artifact) {
          at("The formula text is never part of the artifact.");
        } else if (typeof s.formulaText !== "string") {
          at("Its formula text must be text.");
        } else {
          const parsed = checkFormulaText(s.formulaText, lookup);
          if (!parsed.ok) at(parsed.error);
          else refs = formulaRefs(parsed.formula);
        }
      } else if (s.formula === undefined) {
        at("Enter a formula, e.g. q1 + q2.");
      } else {
        const problem = treeProblem(ctx, g.block.id, s.formula);
        if (problem) at(problem);
        else refs = formulaRefs(s.formula);
      }

      // Every option (or matrix column) of a coded question the formula uses needs a score (§17.6).
      for (const ref of refs) {
        const q = ctx.byId.get(ref)!;
        const list = scoredOptionList(q.block);
        const missing = list?.options.findIndex((o) => o.score === undefined) ?? -1;
        if (!list || missing < 0) continue;
        if (problems.some((p) => p.blockId === q.block.id && p.score !== undefined)) continue;
        const o = list.options[missing];
        const detail = `${capitalize(list.noun)} ${missing + 1}${o.label ? ` ("${o.label}")` : ""} has no score, but the ${scoreName(s, i)} of "${blockName(g.block)}" uses this question. Give every ${list.noun} a score.`;
        problems.push({ blockId: q.block.id, message: `${subject(q)}: ${detail}`, detail, score: key });
      }
    });
  }

  // Names (§17.8): checked for every question within reach of a scored group.
  if (!artifact) {
    const flagged = new Set<string>();
    const named = (e: TreeEntry, detail: string) => {
      if (flagged.has(e.block.id)) return;
      flagged.add(e.block.id);
      problems.push({ blockId: e.block.id, message: `${subject(e)}: ${detail}`, detail, field: "name" });
    };
    for (const e of ctx.entries) {
      if (!(ctx.reachedBy.get(e.block.id) ?? []).some((g) => isScoredGroup(g.block))) continue;
      const name = e.block.name;
      if (name === undefined || (typeof name === "string" && !name.trim())) continue;
      if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
        named(e, `Its name ${JSON.stringify(name)} isn't allowed. A name starts with a lower-case letter and uses only a–z, 0–9 and "_", up to 64 characters.`);
      }
    }
    for (const g of ctx.entries) {
      if (!isScoredGroup(g.block)) continue;
      const seen = new Map<string, TreeEntry>();
      for (const q of ctx.reach.get(g.block.id) ?? []) {
        const name = nameOf(q.block);
        if (!name) continue;
        const first = seen.get(name.toLowerCase());
        if (!first) seen.set(name.toLowerCase(), q);
        else {
          named(q, `Its name "${name}" is also used by "${blockName(first.block)}", and the scores of "${blockName(g.block)}" can use both. Give each question its own name.`);
        }
      }
    }
  }
  return problems;
}

/**
 * What the artifact must never carry for scoring (§17.6, §17.8), each naming
 * the block: a question name, formula text, scores on a page, and any score
 * the renderer would refuse at mount.
 */
export function artifactScoreProblems(blocks: readonly Block[]): string[] {
  const entries = walkBlocks(blocks);
  const messages: string[] = [];
  for (const e of entries) {
    const subject = describeBlockPath([...e.ancestors, e.block], e.path);
    if (!isContainer(e.block) && e.block.name !== undefined) messages.push(`${subject}: the question name is never part of the artifact.`);
    if (isPage(e.block) && e.block.scores !== undefined) messages.push(`${subject}: a page can't have scores.`);
  }
  return [...messages, ...scoreProblems(entries, true).map((p) => p.message)];
}

/**
 * The blocks as the artifact carries them (§17.1, §17.7, §17.8): every score's
 * tree derived from its text (or, without text, as stored), with no
 * `formulaText`; no question names; and no option scores where they mean
 * nothing — on lists other than the options of choice, dropdown, checkbox and
 * multiselect and a matrix's columns. Expects content that passes the save
 * rules; text that doesn't parse can't be exported, so it throws, naming the group.
 */
export function withArtifactScores(blocks: readonly Block[]): Block[] {
  const ctx = scoreContext(blocks);
  return mapTree(blocks, (b) => {
    if (isContainer(b)) {
      if (!isScoredGroup(b)) return b;
      const lookup = lookupFor(ctx, b.id);
      const scores = b.scores.map((s, i) => {
        if (!isObject(s) || typeof s.formulaText !== "string") return s;
        const parsed = checkFormulaText(s.formulaText, lookup);
        if (!parsed.ok) throw new Error(`Group "${blockName(b)}", ${scoreName(s, i)}: ${parsed.error}`);
        const { formulaText: _text, formula: _stored, ...rest } = s;
        return { ...rest, formula: parsed.formula } as Score;
      });
      return { ...b, scores } as Block;
    }
    const scored = scoredOptionList(b)?.list;
    const strip = (options: readonly Option[] | undefined) =>
      options?.some((o) => o.score !== undefined) ? options.map(({ score: _s, ...o }) => o) : options;
    let own: Block = b;
    if (b.name !== undefined) {
      const { name: _name, ...rest } = b;
      own = rest as Block;
    }
    if (own.type === "grid") {
      const rows = strip(own.rows);
      const columns = own.columns?.map((c) => ("options" in c && c.options ? { ...c, options: strip(c.options)! } : c));
      return { ...own, ...(rows ? { rows } : {}), ...(columns ? { columns } : {}) } as Block;
    }
    if (scored !== "options" && own.options) own = { ...own, options: strip(own.options) } as Block;
    if (scored !== "columns" && own.columns) own = { ...own, columns: strip(own.columns) } as Block;
    return own;
  });
}
