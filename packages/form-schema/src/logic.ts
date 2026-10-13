/*
 * Custom condition logic (docs/GROUPS-AND-PAGES-CONTRACT.md §15).
 *
 * The author types how an item's conditions combine as text, using condition
 * numbers: `1 OR (2 AND (3 OR 4))`. This module is the one parser for that text,
 * shared by the editor (live checks) and the API (save). It also turns the
 * parsed tree into what the artifact exports (§15.4), turns a stored tree back
 * into text (§15.6), and backs the editor's delete guard and renumbering.
 *
 * It depends on nothing else in the package. Every tree walk here is
 * iterative, so deep nesting can't overflow the stack.
 */

/** An exported logic tree (§15.1): leaves are condition ids. */
export type LogicNode = { all: LogicItem[] } | { any: LogicItem[] };
export type LogicItem = string | LogicNode;

/** A parsed logic tree: leaves are condition numbers, 1…n in `enableWhen` order. */
export type NumberedNode = { all: NumberedItem[] } | { any: NumberedItem[] };
export type NumberedItem = number | NumberedNode;

export type LogicParse = { ok: true; tree: NumberedItem } | { ok: false; error: string };

/** What an item exports for its logic (§15.4): flat AND, flat OR, or a tree. */
export type ArtifactLogic = { enableBehavior?: "any"; enableLogic?: LogicNode };

type Kind = "all" | "any";
type Tree<L> = L | { all: Tree<L>[] } | { any: Tree<L>[] };
type Node<L> = { all: Tree<L>[] } | { any: Tree<L>[] };

/* ---------- reading the text ---------- */

type Token =
  | { kind: "num"; text: string }
  | { kind: "op"; text: string; op: "AND" | "OR" }
  | { kind: "open" | "close"; text: string }
  | { kind: "bad"; text: string };

/**
 * Brackets stand alone; anything else runs to the next space or bracket. So
 * `(1 AND 2)OR 3` reads as brackets, numbers and words, while `1AND2` is one
 * token, which isn't allowed (§15.3: a space is required between a number and a word).
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === "(" || ch === ")") {
      tokens.push({ kind: ch === "(" ? "open" : "close", text: ch });
      i += 1;
    } else {
      let j = i;
      while (j < text.length && !/[\s()]/.test(text[j])) j += 1;
      const word = text.slice(i, j);
      i = j;
      if (/^[0-9]+$/.test(word)) tokens.push({ kind: "num", text: word });
      else if (/^(and|or)$/i.test(word)) tokens.push({ kind: "op", text: word, op: word.toUpperCase() as "AND" | "OR" });
      else tokens.push({ kind: "bad", text: word });
    }
  }
  return tokens;
}

const endsOperand = (t: Token) => t.kind === "num" || t.kind === "close";
const startsOperand = (t: Token) => t.kind === "num" || t.kind === "open";

/** "3", "3 and 4", "2, 3 and 4". */
function listNumbers(numbers: readonly number[]): string {
  if (numbers.length === 1) return String(numbers[0]);
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/**
 * Parse an item's logic text (§15.3). Returns the tree, with condition numbers
 * as leaves, or the first error of the §15.5 table. The rules are checked in
 * the table's order, each across the whole text, so a text with several
 * problems always reports the same one.
 *
 * The tree is as written, apart from a bracketed part with no operator, which
 * is its content. The §15.3 building rules (merging, dropping repeats) are
 * applied by `logicTreeToArtifact`.
 */
export function parseLogicText(text: string, conditionCount: number): LogicParse {
  const fail = (error: string): LogicParse => ({ ok: false, error });
  if (!text.trim()) return fail("Enter how the conditions combine, e.g. 1 AND 2.");
  const tokens = tokenize(text);

  const bad = tokens.find((t) => t.kind === "bad");
  if (bad) return fail(`"${bad.text}" isn't allowed. Use condition numbers, AND, OR and brackets.`);

  // Two operands side by side. Named by the last number before the gap and the
  // first after it; a side without one is an empty or operator-only bracket,
  // which a later rule reports.
  for (let k = 0; k + 1 < tokens.length; k += 1) {
    if (!endsOperand(tokens[k]) || !startsOperand(tokens[k + 1])) continue;
    const before = tokens.slice(0, k + 1).reverse().find((t) => t.kind === "num");
    const after = tokens.slice(k + 1).find((t) => t.kind === "num");
    if (before && after) return fail(`Add AND or OR between ${before.text} and ${after.text}.`);
  }

  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.kind !== "op") continue;
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    if (!prev || prev.kind === "open") return fail("Start with a condition number.");
    if (prev.kind === "op") return fail(`Add a condition after ${prev.op}.`);
    if (!next || next.kind === "close" || next.kind === "op") return fail(`Add a condition after ${t.op}.`);
  }

  for (let k = 0; k + 1 < tokens.length; k += 1) {
    if (tokens[k].kind === "open" && tokens[k + 1].kind === "close") return fail("Brackets can't be empty.");
  }

  let depth = 0;
  let strayClose = false;
  for (const t of tokens) {
    if (t.kind === "open") depth += 1;
    else if (t.kind === "close") {
      if (depth > 0) depth -= 1;
      else strayClose = true;
    }
  }
  if (depth > 0) return fail("A bracket isn't closed.");
  if (strayClose) return fail("There's a closing bracket without an opening one.");

  // The text is now well formed: operands and operators alternate at every level.
  type Frame = { items: NumberedItem[]; op?: "AND" | "OR" };
  const close = (f: Frame): NumberedItem =>
    f.items.length === 1 ? f.items[0] : f.op === "OR" ? { any: f.items } : { all: f.items };
  const stack: Frame[] = [{ items: [] }];
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.kind === "num") top.items.push(Number(t.text));
    else if (t.kind === "op") {
      if (top.op && top.op !== t.op) return fail("Add brackets to show whether AND or OR comes first.");
      top.op = t.op;
    } else if (t.kind === "open") stack.push({ items: [] });
    else if (t.kind === "close") {
      const done = stack.pop()!;
      stack[stack.length - 1].items.push(close(done));
    }
  }

  for (const t of tokens) {
    if (t.kind !== "num") continue;
    const value = Number(t.text);
    if ((t.text.length > 1 && t.text.startsWith("0")) || value < 1 || value > conditionCount) {
      return fail(`There's no condition ${t.text}.`);
    }
  }

  const used = new Set(tokens.flatMap((t) => (t.kind === "num" ? [Number(t.text)] : [])));
  const unused: number[] = [];
  for (let n = 1; n <= conditionCount; n += 1) if (!used.has(n)) unused.push(n);
  if (unused.length === 1) return fail(`Condition ${unused[0]} isn't used.`);
  if (unused.length > 1) return fail(`Conditions ${listNumbers(unused)} aren't used.`);

  return { ok: true, tree: close(stack[0]) };
}

/**
 * Every whole number in the text, by value, in the order first met — even in
 * text with other errors (`1AND2` holds 1 and 2). The editor's delete guard uses
 * it: a condition whose number appears here can't be deleted (§15.6).
 */
export function conditionNumbersInText(text: string): number[] {
  const numbers: number[] = [];
  for (const run of text.match(/[0-9]+/g) ?? []) {
    const n = Number(run);
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/**
 * After condition `deleted` goes, every whole number above it is lowered by
 * one (§15.6), written without leading zeros. Nothing else changes: spacing,
 * case, brackets and anything invalid stay exactly as typed.
 */
export function renumberAfterDelete(text: string, deleted: number): string {
  const gone = BigInt(deleted);
  return text.replace(/[0-9]+/g, (run) => (BigInt(run) > gone ? (BigInt(run) - 1n).toString() : run));
}

/* ---------- trees ---------- */

function isNode<L>(item: Tree<L>): item is Node<L> {
  return typeof item === "object" && item !== null;
}
function kindOf<L>(node: Node<L>): Kind {
  return "all" in node ? "all" : "any";
}
function itemsOf<L>(node: Node<L>): Tree<L>[] {
  return "all" in node ? node.all : node.any;
}
function makeNode<L>(kind: Kind, items: Tree<L>[]): Node<L> {
  return kind === "all" ? { all: items } : { any: items };
}

/** A post-order fold over a well-formed tree, without recursion. */
function fold<L, R>(root: Tree<L>, leaf: (value: L) => R, node: (kind: Kind, children: R[]) => R): R {
  if (!isNode(root)) return leaf(root);
  type Frame = { node: Node<L>; items: Tree<L>[]; next: number; out: R[] };
  const stack: Frame[] = [{ node: root, items: itemsOf(root), next: 0, out: [] }];
  for (;;) {
    const top = stack[stack.length - 1];
    if (top.next < top.items.length) {
      const item = top.items[top.next++];
      if (isNode(item)) stack.push({ node: item, items: itemsOf(item), next: 0, out: [] });
      else top.out.push(leaf(item));
      continue;
    }
    stack.pop();
    const result = node(kindOf(top.node), top.out);
    if (!stack.length) return result;
    stack[stack.length - 1].out.push(result);
  }
}

/**
 * The §15.3 building rules: a node with one item is that item, a node with
 * the same operator as its parent is merged into it, and a repeated condition
 * within one node is kept once.
 */
function simplify(tree: NumberedItem): NumberedItem {
  return fold<number, NumberedItem>(
    tree,
    (n) => n,
    (kind, children) => {
      const items: NumberedItem[] = [];
      for (const child of children) {
        const merged = isNode(child) && kindOf(child) === kind ? itemsOf(child) : [child];
        for (const item of merged) if (isNode(item) || !items.includes(item)) items.push(item);
      }
      return items.length === 1 ? items[0] : makeNode(kind, items);
    },
  );
}

/**
 * What an item exports for a parsed, valid tree (§15.3, §15.4), with numbers
 * mapped to `conditionIds` (in `enableWhen` order): `{}` for flat AND,
 * `{ enableBehavior: "any" }` for flat OR, `{ enableLogic }` for anything else.
 */
export function logicTreeToArtifact(tree: NumberedItem, conditionIds: readonly string[]): ArtifactLogic {
  const simple = simplify(tree);
  if (conditionIds.length < 2 || !isNode(simple)) return {};
  const items = itemsOf(simple);
  if (items.length === conditionIds.length && items.every((item) => !isNode(item))) {
    return kindOf(simple) === "any" ? { enableBehavior: "any" } : {};
  }
  return {
    enableLogic: fold<number, LogicItem>(simple, (n) => conditionIds[n - 1], (kind, children) => makeNode(kind, children)) as LogicNode,
  };
}

/**
 * Text for a tree (§15.6), used for stored content that has a tree but no
 * text: numbers as they are, words in upper case, every nested node in brackets.
 */
export function logicTreeToText(tree: NumberedItem): string {
  return fold<number, { text: string; nested: boolean }>(
    tree,
    (n) => ({ text: String(n), nested: false }),
    (kind, children) => ({
      text: children.map((c) => (c.nested ? `(${c.text})` : c.text)).join(kind === "all" ? " AND " : " OR "),
      nested: true,
    }),
  ).text;
}

/**
 * A stored or exported `enableLogic` checked against the §15.5 integrity rules,
 * and turned into a numbered tree when it passes. `conditionIds` are the item's
 * condition ids in order. Errors read after `Block "<name>": `.
 */
export function logicTreeFromIds(
  raw: unknown,
  conditionIds: readonly string[],
): { ok: true; tree: NumberedItem } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  const shapeError = 'its enableLogic isn\'t valid: every part must be an object with exactly one key, "all" or "any", holding a list.';
  const used = new Set<string>();
  const nodeItems = (value: unknown): unknown[] | string => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return shapeError;
    const keys = Object.keys(value);
    if (keys.length !== 1 || (keys[0] !== "all" && keys[0] !== "any")) return shapeError;
    const items = (value as Record<string, unknown>)[keys[0]];
    if (!Array.isArray(items)) return shapeError;
    if (!items.length) return "its enableLogic isn't valid: a list can't be empty.";
    return items;
  };

  type Frame = { kind: Kind; items: unknown[]; next: number; out: NumberedItem[] };
  const rootItems = nodeItems(raw);
  if (typeof rootItems === "string") return fail(rootItems);
  const stack: Frame[] = [{ kind: Object.keys(raw as object)[0] as Kind, items: rootItems, next: 0, out: [] }];
  let tree: NumberedItem | undefined;
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (top.next < top.items.length) {
      const item = top.items[top.next++];
      if (typeof item === "string") {
        const index = conditionIds.indexOf(item);
        if (index < 0) return fail(`its enableLogic uses ${JSON.stringify(item)}, which isn't the id of one of its conditions.`);
        used.add(item);
        top.out.push(index + 1);
      } else if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const items = nodeItems(item);
        if (typeof items === "string") return fail(items);
        stack.push({ kind: Object.keys(item)[0] as Kind, items, next: 0, out: [] });
      } else {
        return fail('its enableLogic isn\'t valid: every entry must be a condition id or another "all" or "any" part.');
      }
      continue;
    }
    stack.pop();
    const node = makeNode(top.kind, top.out);
    if (stack.length) stack[stack.length - 1].out.push(node);
    else tree = node;
  }
  const missing = conditionIds.findIndex((id) => !used.has(id));
  if (missing >= 0) return fail(`its enableLogic doesn't use condition ${missing + 1}.`);
  return { ok: true, tree: tree! };
}
