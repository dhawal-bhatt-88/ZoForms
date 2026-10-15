/*
 * Score formulas (docs/GROUPS-AND-PAGES-CONTRACT.md §17.7, §17.8).
 *
 * The author types a score's formula as text, using short question names:
 * `(mood + sleep) * days`. This module is the one parser for that text, shared
 * by the editor (live checks) and the API (save). It also writes a stored tree
 * back as text (§17.7), finds and renames names in text that may have errors
 * (the editor's guards), generates question names (§17.8), and walks trees.
 *
 * It knows nothing about blocks: the caller says what each name refers to
 * (`NameLookup`). Every loop here is iterative, so a long formula — which makes
 * a deep tree — can't overflow the stack.
 */

export type FormulaOp = "+" | "-" | "*" | "/";

/** An exported formula (§17.1): numbers, references to questions by block id, and two-argument operators. */
export type FormulaNode =
  | { num: number }
  | { ref: string }
  | { op: FormulaOp; args: [FormulaNode, FormulaNode] };

/** The most terms (names and numbers, counting repeats) a formula may have (§17.7). */
export const FORMULA_MAX_TERMS = 300;

/** What a name in a formula refers to, from the scored group's point of view (§17.2). */
export type NameTarget =
  | { kind: "ok"; id: string }
  /** No question with that name within reach of the group. */
  | { kind: "missing" }
  /** A question inside a repeating group nested in the group. */
  | { kind: "repeating" }
  /** A question within reach whose type can't be scored. */
  | { kind: "unscorable" };

/** Resolves a name, already lower-cased, for one scored group. */
export type NameLookup = (name: string) => NameTarget;

export type FormulaParse =
  | { ok: true; formula: FormulaNode; terms: number }
  | { ok: false; error: string };

/* ---------- reading the text ---------- */

type Token =
  | { kind: "num"; text: string }
  | { kind: "name"; text: string }
  | { kind: "op"; text: FormulaOp }
  | { kind: "open" | "close"; text: string }
  | { kind: "bad"; text: string };

const OPERATORS = "+-*/";
const NUMBER = /^[0-9]+(?:\.[0-9]+)?$/;
const NAME_TOKEN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** True for the characters that end a word: spaces, brackets and operators. */
function separates(ch: string): boolean {
  return /\s/.test(ch) || ch === "(" || ch === ")" || OPERATORS.includes(ch);
}

/**
 * Brackets and operators stand alone; anything else runs to the next space,
 * bracket or operator. Spaces are optional everywhere (§17.7), so `q1+q2`
 * reads as three tokens, while `2q1` is one word, which isn't allowed.
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
    } else if (OPERATORS.includes(ch)) {
      tokens.push({ kind: "op", text: ch as FormulaOp });
      i += 1;
    } else {
      let j = i;
      while (j < text.length && !separates(text[j])) j += 1;
      const word = text.slice(i, j);
      i = j;
      if (NUMBER.test(word)) tokens.push({ kind: "num", text: word });
      else if (NAME_TOKEN.test(word)) tokens.push({ kind: "name", text: word });
      else tokens.push({ kind: "bad", text: word });
    }
  }
  return tokens;
}

const isOperand = (t: Token) => t.kind === "num" || t.kind === "name";
const endsOperand = (t: Token) => isOperand(t) || t.kind === "close";
const startsOperand = (t: Token) => isOperand(t) || t.kind === "open";
const PRECEDENCE: Record<FormulaOp, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/**
 * Parse a score's formula text (§17.7) for one scored group, whose names
 * `lookup` resolves. Returns the tree, with names replaced by block ids, or the
 * first error of the §17.7 table except the length limit: the rules are
 * checked in the table's order, each across the whole text, so a text with
 * several problems always reports the same one.
 *
 * Any length parses. The 300-term limit is a save rule on top of this
 * (`checkFormulaText`), so the parser itself can be tested on long input.
 */
export function parseFormulaText(text: string, lookup: NameLookup): FormulaParse {
  const fail = (error: string): FormulaParse => ({ ok: false, error });
  if (!text.trim()) return fail("Enter a formula, e.g. q1 + q2.");
  const tokens = tokenize(text);

  const bad = tokens.find((t) => t.kind === "bad");
  if (bad) return fail(`"${bad.text}" isn't allowed. Use question names, numbers, + - * / and brackets.`);

  // Two operands side by side. Named by the last operand before the gap and the
  // first after it; a side without one is an empty or operator-only bracket,
  // which a later rule reports. Each search stops at the first operand, so
  // this stays linear in the length of the text.
  for (let k = 0; k + 1 < tokens.length; k += 1) {
    if (!endsOperand(tokens[k]) || !startsOperand(tokens[k + 1])) continue;
    let b = k;
    while (b >= 0 && !isOperand(tokens[b])) b -= 1;
    let a = k + 1;
    while (a < tokens.length && !isOperand(tokens[a])) a += 1;
    if (b >= 0 && a < tokens.length) return fail(`Add an operator between ${tokens[b].text} and ${tokens[a].text}.`);
  }

  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.kind !== "op") continue;
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    if (!prev || prev.kind === "open") return fail("Start with a question name, a number or a bracket.");
    if (prev.kind === "op") return fail(`Add a name or number after ${prev.text}.`);
    if (!next || next.kind === "close" || next.kind === "op") return fail(`Add a name or number after ${t.text}.`);
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

  // Each name is resolved once; the three name rules are then checked in turn.
  const targets = new Map<string, NameTarget>();
  const names = tokens.filter((t) => t.kind === "name");
  for (const t of names) {
    const key = t.text.toLowerCase();
    if (!targets.has(key)) targets.set(key, lookup(key));
  }
  const firstOf = (kind: NameTarget["kind"]) => names.find((t) => targets.get(t.text.toLowerCase())!.kind === kind);
  const missing = firstOf("missing");
  if (missing) return fail(`There's no question named "${missing.text}" in this group.`);
  const repeating = firstOf("repeating");
  if (repeating) return fail(`"${repeating.text}" is in a repeating group, so this score can't use it.`);
  const unscorable = firstOf("unscorable");
  if (unscorable) {
    return fail(
      `"${unscorable.text}" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`,
    );
  }
  if (!names.length) return fail("Use at least one question name.");

  // The text is now well formed: build the tree with an operator stack, so `*`
  // and `/` bind before `+` and `-` and equal operators go left to right.
  const operands: FormulaNode[] = [];
  const pending: (FormulaOp | "(")[] = [];
  const reduce = () => {
    const op = pending.pop() as FormulaOp;
    const right = operands.pop()!;
    const left = operands.pop()!;
    operands.push({ op, args: [left, right] });
  };
  let terms = 0;
  for (const t of tokens) {
    if (t.kind === "num") {
      operands.push({ num: Number(t.text) });
      terms += 1;
    } else if (t.kind === "name") {
      operands.push({ ref: (targets.get(t.text.toLowerCase()) as { id: string }).id });
      terms += 1;
    } else if (t.kind === "op") {
      for (;;) {
        const top = pending[pending.length - 1];
        if (top === undefined || top === "(" || PRECEDENCE[top] < PRECEDENCE[t.text]) break;
        reduce();
      }
      pending.push(t.text);
    } else if (t.kind === "open") {
      pending.push("(");
    } else if (t.kind === "close") {
      while (pending[pending.length - 1] !== "(") reduce();
      pending.pop();
    }
  }
  while (pending.length) reduce();
  return { ok: true, formula: operands[0], terms };
}

/** The "too long" error (§17.7), for text and for a tree sent without text. */
export const FORMULA_TOO_LONG = `This formula is too long. Use at most ${FORMULA_MAX_TERMS} question names and numbers.`;

/**
 * `parseFormulaText` with the length limit (§17.7): what the editor shows and
 * the save checks. The limit is the last rule of the table.
 */
export function checkFormulaText(text: string, lookup: NameLookup): FormulaParse {
  const parsed = parseFormulaText(text, lookup);
  if (parsed.ok && parsed.terms > FORMULA_MAX_TERMS) return { ok: false, error: FORMULA_TOO_LONG };
  return parsed;
}

/**
 * Every name in the text, lower-cased, in the order first met — even in text
 * with other errors. The editor's guards use it: a question whose name appears
 * here is in use by the formula.
 */
export function formulaNamesInText(text: string): string[] {
  const names: string[] = [];
  for (const t of tokenize(text)) {
    if (t.kind !== "name") continue;
    const name = t.text.toLowerCase();
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The text with every use of the name `from` (matched ignoring case) written
 * as `to` (§17.9). Nothing else changes: spacing, brackets, the case of other
 * names and anything invalid stay exactly as typed.
 */
export function renameInFormulaText(text: string, from: string, to: string): string {
  return renameNamesInFormulaText(text, new Map([[from, to]]));
}

/**
 * The text with several names renamed at once (`from` → `to`, `from` matched
 * ignoring case), in one pass, so `a` → `a_2` and `a_2` → `a_3` can't run into
 * each other. Nothing else changes.
 */
export function renameNamesInFormulaText(text: string, renames: ReadonlyMap<string, string>): string {
  const byKey = new Map([...renames].map(([from, to]) => [from.toLowerCase(), to]));
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (separates(text[i])) {
      out += text[i];
      i += 1;
      continue;
    }
    let j = i;
    while (j < text.length && !separates(text[j])) j += 1;
    const word = text.slice(i, j);
    const to = NAME_TOKEN.test(word) ? byKey.get(word.toLowerCase()) : undefined;
    out += to ?? word;
    i = j;
  }
  return out;
}

/* ---------- trees ---------- */

/**
 * A post-order fold over a well-formed tree, without recursion: `leaf` for
 * numbers and references, `node` for an operator with its two folded arguments.
 */
export function foldFormula<R>(
  root: FormulaNode,
  leaf: (node: { num: number } | { ref: string }) => R,
  node: (op: FormulaOp, left: R, right: R) => R,
): R {
  type Frame = { node: Extract<FormulaNode, { op: FormulaOp }>; next: number; out: R[] };
  if (!("op" in root)) return leaf(root);
  const stack: Frame[] = [{ node: root, next: 0, out: [] }];
  for (;;) {
    const top = stack[stack.length - 1];
    if (top.next < 2) {
      const child = top.node.args[top.next++];
      if ("op" in child) stack.push({ node: child, next: 0, out: [] });
      else top.out.push(leaf(child));
      continue;
    }
    stack.pop();
    const result = node(top.node.op, top.out[0], top.out[1]);
    if (!stack.length) return result;
    stack[stack.length - 1].out.push(result);
  }
}

/** The block ids a well-formed tree refers to, in reading order, each once. */
export function formulaRefs(root: FormulaNode): string[] {
  const refs = new Set<string>();
  foldFormula(root, (leaf) => ("ref" in leaf ? void refs.add(leaf.ref) : undefined), () => undefined);
  return [...refs];
}

/** How many terms (numbers and references, counting repeats) a well-formed tree has. */
export function formulaTerms(root: FormulaNode): number {
  return foldFormula(root, () => 1, (_op, left, right) => left + right);
}

/** The tree with each reference mapped through `ids`; a reference missing from `ids` is kept. */
export function mapFormulaRefs(root: FormulaNode, ids: ReadonlyMap<string, string>): FormulaNode {
  return foldFormula<FormulaNode>(
    root,
    (leaf) => ("ref" in leaf ? { ref: ids.get(leaf.ref) ?? leaf.ref } : { num: leaf.num }),
    (op, left, right) => ({ op, args: [left, right] }),
  );
}

/**
 * What is wrong with a stored or exported tree's shape (§17.6), or null. Any
 * value may be passed: it is walked without recursion, so a hand-made deep
 * tree can't overflow the stack. Reads after the score's name in a message.
 */
export function formulaShapeProblem(raw: unknown): string | null {
  const stack: unknown[] = [raw];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      return "its formula isn't valid: every part must be an object with a num, a ref, or an op and its args.";
    }
    const keys = Object.keys(node).sort().join(",");
    const value = node as Record<string, unknown>;
    if (keys === "num") {
      if (typeof value.num !== "number" || !Number.isFinite(value.num)) {
        return `its formula isn't valid: ${JSON.stringify(value.num) ?? String(value.num)} isn't a finite number.`;
      }
    } else if (keys === "ref") {
      if (typeof value.ref !== "string") return "its formula isn't valid: a ref must be a block id.";
    } else if (keys === "args,op") {
      if (typeof value.op !== "string" || !OPERATORS.includes(value.op) || value.op.length !== 1) {
        return `its formula isn't valid: ${JSON.stringify(value.op)} isn't one of + - * /.`;
      }
      if (!Array.isArray(value.args) || value.args.length !== 2) {
        return "its formula isn't valid: an operator needs exactly two args.";
      }
      stack.push(value.args[1], value.args[0]);
    } else {
      return "its formula isn't valid: every part must be an object with a num, a ref, or an op and its args.";
    }
  }
  return null;
}

/**
 * A number as formula text: digits, and a decimal point only when needed,
 * never an exponent — `String(1e21)` would be "1e+21", which the parser doesn't
 * read. The digits are those of the shortest exact form, so the text reads
 * back as the same number.
 */
function numberText(n: number): string {
  const plain = String(n);
  const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(plain);
  if (!m) return plain;
  const digits = m[1] + (m[2] ?? "");
  const point = 1 + Number(m[3]); // where the decimal point goes, counted from the first digit
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Text for a well-formed tree (§17.7), for a score stored with a tree but no
 * text: names for references, single spaces around operators, and brackets only
 * where needed — around a part of lower precedence, and around the right-hand
 * part of an operator of the same precedence, so reading the text back gives
 * the same tree. A negative number has no text of its own (there is no unary
 * minus) and is written `(0 - 2)`. Null when a reference has no name.
 */
export function formulaToText(root: FormulaNode, nameOf: (id: string) => string | undefined): string | null {
  type Part = { text: string; precedence: number } | null;
  const leafPrecedence = 3;
  const part = foldFormula<Part>(
    root,
    (leaf) => {
      if ("ref" in leaf) {
        const name = nameOf(leaf.ref);
        return name ? { text: name, precedence: leafPrecedence } : null;
      }
      const text = leaf.num < 0 ? `(0 - ${numberText(-leaf.num)})` : numberText(leaf.num);
      return { text, precedence: leafPrecedence };
    },
    (op, left, right) => {
      if (!left || !right) return null;
      const p = PRECEDENCE[op];
      const l = left.precedence < p ? `(${left.text})` : left.text;
      const r = right.precedence <= p ? `(${right.text})` : right.text;
      return { text: `${l} ${op} ${r}`, precedence: p };
    },
  );
  return part?.text ?? null;
}

/* ---------- question names (§17.8) ---------- */

/** What a question name may look like (§17.8). */
export const NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const NAME_CUT = 32;

/**
 * Contract §17.8: the name generated for a question with `label`, numbered
 * `number` (§4), avoiding every name in `taken` (compared ignoring case). The
 * one generator: the editor and the save both use it.
 */
export function generateQuestionName(label: string, taken: Iterable<string>, number: number): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  let base = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents: "Sí" → "si"
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(base)) base = `q_${base}`;
  if (base.length > NAME_CUT) {
    const cut = base.slice(0, NAME_CUT);
    const at = cut.lastIndexOf("_");
    base = at > 0 ? cut.slice(0, at) : cut;
  }
  if (!base) base = `q${number}`;
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** `name` with the first free `_2`, `_3`, … appended, avoiding `taken` (§17.8 step 6). */
export function suffixedName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  for (let n = 2; ; n += 1) {
    const candidate = `${name}_${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
