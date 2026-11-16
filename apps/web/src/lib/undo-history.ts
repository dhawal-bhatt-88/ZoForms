import {
  blockName,
  isAnswerable,
  isContainer,
  isGroup,
  isPage,
  isPaged,
  type Block,
  type FormSchema,
} from "@formbuilder/form-schema";

/*
 * Undo and redo for the form editor, as whole-content snapshots.
 *
 * The editor holds the form as one immutable value and every edit replaces it
 * after the edit's guards have passed, so a step is the state before it: undo
 * puts that state back, and it is by construction a state the editor was
 * already in. Edits copy only the path they change, so a hundred snapshots
 * share almost all of their memory.
 *
 * `UndoHistory` is the two stacks and the grouping of typing into one step;
 * `describeChange` says what a step did, from the two states either side of it,
 * for the announcement and the buttons' tooltips.
 */

/** How many steps are kept; the oldest is dropped. */
export const HISTORY_LIMIT = 100;

export type HistoryStep<S> = {
  /** The state before the step. */
  before: S;
  /** The state after it: known once it has been undone, for redo. */
  after?: S;
  /** The block selected when the step began: which of several changed blocks the author was editing. */
  selected: string | null;
  /** What the step did, where the two states can't say (an import, a template). */
  what?: string;
};

export class UndoHistory<S> {
  private past: HistoryStep<S>[] = [];
  private future: HistoryStep<S>[] = [];
  /** The text field whose typing the newest step is still collecting. */
  private field: unknown = null;

  /** `same`: whether two states hold the same content, so a step between them did nothing. */
  constructor(
    private readonly same: (a: S, b: S) => boolean,
    private readonly limit = HISTORY_LIMIT,
  ) {}

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  /** The step Undo would undo. */
  get nextUndo(): HistoryStep<S> | undefined {
    return this.past[this.past.length - 1];
  }
  /** The step Redo would redo. */
  get nextRedo(): HistoryStep<S> | undefined {
    return this.future[this.future.length - 1];
  }
  /** The field the newest step is collecting typing from, if any. */
  get openField(): unknown {
    return this.field;
  }

  /**
   * A change is about to be made to `before`. With `field` (the text field
   * being typed in) it joins the step that field already opened, so all the
   * typing in one field, and whatever leaving it generates, is one step; a
   * change from anywhere else is a step of its own. Any change clears redo.
   */
  record(before: S, { field = null, selected, what }: { field?: unknown; selected: string | null; what?: string }) {
    this.future = [];
    if (this.field !== null && this.field === field) {
      if (what) this.past[this.past.length - 1].what = what;
      return;
    }
    this.closeField(before);
    this.past.push({ before, selected, what });
    if (this.past.length > this.limit) this.past.shift();
    this.field = field;
  }

  /**
   * The field being typed in was left, at `current`: its step is complete. One
   * that ends where it began (typed, then deleted) is dropped.
   */
  closeField(current: S) {
    if (this.field === null) return;
    this.field = null;
    const step = this.past[this.past.length - 1];
    if (step && this.same(step.before, current)) this.past.pop();
  }

  /** Undo from `current`: the step undone (put `step.before` back), or undefined with nothing to undo. */
  undo(current: S): HistoryStep<S> | undefined {
    this.closeField(current);
    const step = this.past.pop();
    if (!step) return undefined;
    step.after = current;
    this.future.push(step);
    return step;
  }

  /** Redo: the step redone (put `step.after` back), or undefined with nothing to redo. */
  redo(): (HistoryStep<S> & { after: S }) | undefined {
    const step = this.future.pop();
    if (!step || step.after === undefined) return undefined;
    this.past.push(step);
    return step as HistoryStep<S> & { after: S };
  }

  clear() {
    this.past = [];
    this.future = [];
    this.field = null;
  }
}

/* ---------- what a step did ---------- */

export type HistoryChange = {
  /** The action, to follow "Undone: " or "Redone: ": `delete question 'Address'`. */
  what: string;
  /** The block it was done to; null for a change to the form itself. */
  focus: string | null;
  /** That block's page or group, to select where the block itself no longer exists. */
  fallback: string | null;
};

const NAME_LIMIT = 40;
const kindOf = (b: Block) => (isPage(b) ? "page" : isGroup(b) ? "group" : isAnswerable(b) ? "question" : "block");
function quoted(b: Block): string {
  const name = blockName(b).trim();
  return name.length > NAME_LIMIT ? `'${name.slice(0, NAME_LIMIT).trimEnd()}…'` : `'${name}'`;
}
/** `question 'Address'`; an empty name gives `untitled question`. */
function named(b: Block): string {
  return blockName(b).trim() ? `${kindOf(b)} ${quoted(b)}` : `untitled ${kindOf(b)}`;
}
/** `'Address'`, for "edit options of …"; an empty name gives `an untitled question`. */
function ofNamed(b: Block): string {
  return blockName(b).trim() ? quoted(b) : `an untitled ${kindOf(b)}`;
}

type Placed = { block: Block; parent: string | null; index: number };
function place(blocks: readonly Block[]): Map<string, Placed> {
  const placed = new Map<string, Placed>();
  const visit = (list: readonly Block[], parent: string | null) =>
    list.forEach((block, index) => {
      placed.set(block.id, { block, parent, index });
      if (isContainer(block)) visit(block.blocks, block.id);
    });
  visit(blocks, null);
  return placed;
}

/** The names of a block's own fields that differ, its contents apart. */
function changedFields(a: Block, b: Block): string[] {
  if (a === b) return [];
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(
    (key) => key !== "blocks" && x[key] !== y[key] && JSON.stringify(x[key]) !== JSON.stringify(y[key]),
  );
}

const OPTION_FIELDS = new Set(["options", "columns"]);
const CONDITION_FIELDS = new Set(["enableWhen", "enableBehavior", "enableLogic", "enableLogicText"]);
// What an edit elsewhere can change in a block: a renamed question's formulas, a recoded option's conditions.
const FOLLOWING_FIELDS = new Set([...CONDITION_FIELDS, "scores", "name"]);
const only = (fields: string[], set: Set<string>) => fields.every((f) => set.has(f));

/**
 * The id that, taken out of both orders, leaves them the same: the block that
 * moved among its siblings. Two neighbours swapping places both fit; `prefer`
 * (the selected block) decides.
 */
function movedWithin(before: string[], after: string[], prefer: string | null): string | undefined {
  const fits = (id: string) => {
    const a = before.filter((x) => x !== id);
    const b = after.filter((x) => x !== id);
    return a.every((x, i) => x === b[i]);
  };
  return prefer !== null && after.includes(prefer) && fits(prefer) ? prefer : after.find(fits);
}

/**
 * What changed between two states of the form, as one action. `selected` is
 * the block selected when the change began: among several changed blocks (an
 * edit and what followed it elsewhere), it is the one the author was editing.
 */
export function describeChange(before: FormSchema, after: FormSchema, selected: string | null = null): HistoryChange {
  const form = (what: string): HistoryChange => ({ what, focus: null, fallback: null });
  return changeToBlocks(before, after, selected) ?? form(changeToForm(before, after));
}

function changeToForm(before: FormSchema, after: FormSchema): string {
  if (before.title !== after.title) return "edit form title";
  if ((before.description ?? "") !== (after.description ?? "")) return "edit form description";
  const settings = (s: FormSchema) => JSON.stringify([s.navigation ?? null, s.drafts ?? null]);
  return settings(before) !== settings(after) ? "edit form settings" : "edit the form";
}

function changeToBlocks(before: FormSchema, after: FormSchema, selected: string | null): HistoryChange | undefined {
  if (before.blocks === after.blocks) return undefined;
  const form = (what: string): HistoryChange => ({ what, focus: null, fallback: null });
  if (isPaged(before.blocks) !== isPaged(after.blocks)) return form(isPaged(after.blocks) ? "turn pages on" : "turn pages off");

  const was = place(before.blocks);
  const now = place(after.blocks);
  const about = (what: string, id: string): HistoryChange => ({ what, focus: id, fallback: (now.get(id) ?? was.get(id))?.parent ?? null });
  const prefer = (ids: string[]) => (selected !== null && ids.includes(selected) ? selected : ids[0]);

  // Added or deleted: the outermost block, which brings or takes its contents with it.
  const added = [...now.keys()].filter((id) => !was.has(id));
  const removed = [...was.keys()].filter((id) => !now.has(id));
  if (added.length && !removed.length) {
    const id = prefer(added.filter((x) => !added.includes(now.get(x)!.parent ?? "")));
    return about(`add ${named(now.get(id)!.block)}`, id);
  }
  if (removed.length && !added.length) {
    const id = prefer(removed.filter((x) => !removed.includes(was.get(x)!.parent ?? "")));
    return about(`delete ${named(was.get(id)!.block)}`, id);
  }
  if (added.length) return form("edit the form");

  // Moved: to another page or group, or among its siblings.
  const reparented = [...now.keys()].filter((id) => now.get(id)!.parent !== was.get(id)!.parent);
  if (reparented.length) {
    const id = prefer(reparented);
    return about(`move ${named(now.get(id)!.block)}`, id);
  }
  const children = (placed: Map<string, Placed>, parent: string | null) =>
    [...placed.entries()].filter(([, p]) => p.parent === parent).sort((a, b) => a[1].index - b[1].index).map(([id]) => id);
  for (const parent of [null, ...[...now.values()].filter((p) => isContainer(p.block)).map((p) => p.block.id)]) {
    const a = children(was, parent);
    const b = children(now, parent);
    if (a.some((id, i) => id !== b[i])) {
      const id = movedWithin(a, b, selected) ?? b[0];
      return about(`move ${named(now.get(id)!.block)}`, id);
    }
  }

  // Edited: the block the author was in, else the first whose change isn't only what followed another's.
  const edits = [...now.entries()]
    .map(([id, p]) => ({ id, block: p.block, fields: changedFields(was.get(id)!.block, p.block) }))
    .filter((e) => e.fields.length);
  if (!edits.length) return undefined;
  const edit =
    edits.find((e) => e.id === selected) ?? edits.find((e) => !only(e.fields, FOLLOWING_FIELDS)) ?? edits[0];
  if (only(edit.fields, OPTION_FIELDS)) return about(`edit options of ${ofNamed(edit.block)}`, edit.id);
  if (only(edit.fields, CONDITION_FIELDS)) return about(`edit conditions of ${ofNamed(edit.block)}`, edit.id);
  if (only(edit.fields, new Set(["scores"]))) return about(`edit scores of ${named(edit.block)}`, edit.id);
  return about(`edit ${named(edit.block)}`, edit.id);
}
