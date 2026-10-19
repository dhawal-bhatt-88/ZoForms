import { describe, expect, it } from "vitest";
import {
  type Block,
  type FormulaNode,
  type GroupBlock,
  type NameLookup,
  FORMULA_MAX_TERMS,
  FormArtifact,
  FormSchema,
  applyImport,
  buildArtifact,
  checkFormulaText,
  fillQuestionNames,
  findBlock,
  formProblems,
  formulaNamesInText,
  formulaTerms,
  formulaTextError,
  formulaToText,
  generateQuestionName,
  groupFromTemplate,
  insertBlockIntoTree,
  moveBlockInTree,
  namesAfterInsert,
  normalizeScores,
  optionListProblems,
  parseFormulaText,
  remapBlockIds,
  renameInFormulaText,
  renameQuestion,
  repeatsOnScoreBlockers,
  resolveNameClashes,
  scoreDeletionBlockers,
  scoreableQuestions,
  scoreTypeChangeBlockers,
  scoreUseMessage,
  structureBreaks,
  walkBlocks,
  withArtifactScores,
} from "./index";

/* ---------- the parser, on its own ---------- */

const IDS: Record<string, string> = { q1: "b1", q2: "b2", q3: "b3", mood: "b4", sleep: "b5", days: "b6" };
const lookup: NameLookup = (name) =>
  name in IDS
    ? { kind: "ok", id: IDS[name] }
    : name === "rep"
      ? { kind: "repeating" }
      : name === "txt"
        ? { kind: "unscorable" }
        : { kind: "missing" };
const NAMES = new Map(Object.entries(IDS).map(([name, id]) => [id, name]));
const nameOf = (id: string) => NAMES.get(id);

const R = (name: string): FormulaNode => ({ ref: IDS[name] });
const N = (num: number): FormulaNode => ({ num });
const op = (o: "+" | "-" | "*" | "/", a: FormulaNode, b: FormulaNode): FormulaNode => ({ op: o, args: [a, b] });

function tree(text: string): FormulaNode {
  const parsed = parseFormulaText(text, lookup);
  if (!parsed.ok) throw new Error(`"${text}" didn't parse: ${parsed.error}`);
  return parsed.formula;
}
const error = (text: string) => {
  const parsed = checkFormulaText(text, lookup);
  return parsed.ok ? null : parsed.error;
};
const sum = (terms: number, name = "q1") => Array.from({ length: terms }, () => name).join(" + ");

describe("formula text: the §17.7 error table", () => {
  it.each([
    ["", "Enter a formula, e.g. q1 + q2."],
    ["   ", "Enter a formula, e.g. q1 + q2."],
    ["q1 % q2", `"%" isn't allowed. Use question names, numbers, + - * / and brackets.`],
    ["2q1 + q2", `"2q1" isn't allowed. Use question names, numbers, + - * / and brackets.`],
    ["q1 + 1.", `"1." isn't allowed. Use question names, numbers, + - * / and brackets.`],
    ["q1 + é", `"é" isn't allowed. Use question names, numbers, + - * / and brackets.`],
    ["q1 q2", "Add an operator between q1 and q2."],
    ["2 q1", "Add an operator between 2 and q1."],
    ["q1 (q2 + q3)", "Add an operator between q1 and q2."],
    ["(q1)(q2)", "Add an operator between q1 and q2."],
    ["q1 +", "Add a name or number after +."],
    ["q1 + * q2", "Add a name or number after +."],
    ["(q1 -) + q2", "Add a name or number after -."],
    ["* q1", "Start with a question name, a number or a bracket."],
    ["-q1", "Start with a question name, a number or a bracket."],
    ["q1 * (-2)", "Start with a question name, a number or a bracket."],
    ["()", "Brackets can't be empty."],
    ["q1 + ()", "Brackets can't be empty."],
    ["(q1 + q2", "A bracket isn't closed."],
    ["q1 + q2)", "There's a closing bracket without an opening one."],
    ["q1 + q9", `There's no question named "q9" in this group.`],
    ["q1 + REP", `"REP" is in a repeating group, so this score can't use it.`],
    ["q1 + txt", `"txt" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`],
    ["2 + 3", "Use at least one question name."],
    [sum(FORMULA_MAX_TERMS + 1), "This formula is too long. Use at most 300 question names and numbers."],
  ])("%j → %s", (text, message) => {
    expect(error(text)).toBe(message);
  });

  it("checks the rules in the table's order, each across the whole text", () => {
    expect(error("q9 q1 %")).toBe(`"%" isn't allowed. Use question names, numbers, + - * / and brackets.`);
    expect(error("q9 q1 +")).toBe("Add an operator between q9 and q1.");
    expect(error("(q9 + ")).toBe("Add a name or number after +.");
    expect(error("(q9")).toBe("A bracket isn't closed.");
    expect(error("rep + txt + q9")).toBe(`There's no question named "q9" in this group.`);
    expect(error("txt + rep")).toBe(`"rep" is in a repeating group, so this score can't use it.`);
  });

  it("matches names ignoring case, and allows spaces anywhere or nowhere", () => {
    expect(tree("Q1+q2")).toEqual(op("+", R("q1"), R("q2")));
    expect(tree("  ( MOOD )*2 ")).toEqual(op("*", R("mood"), N(2)));
  });
});

describe("formula text: precedence and left to right", () => {
  it.each<[string, FormulaNode]>([
    ["q1 + q2 * 2", op("+", R("q1"), op("*", R("q2"), N(2)))],
    ["q1 * q2 + 2", op("+", op("*", R("q1"), R("q2")), N(2))],
    ["q1 - q2 - q3", op("-", op("-", R("q1"), R("q2")), R("q3"))],
    ["q1 / q2 / q3", op("/", op("/", R("q1"), R("q2")), R("q3"))],
    ["q1 + q2 + q3", op("+", op("+", R("q1"), R("q2")), R("q3"))],
    ["q1 - q2 + q3", op("+", op("-", R("q1"), R("q2")), R("q3"))],
    ["q1 * q2 / q3 * 2", op("*", op("/", op("*", R("q1"), R("q2")), R("q3")), N(2))],
    ["(q1 + q2) * 2", op("*", op("+", R("q1"), R("q2")), N(2))],
    ["q1 - (q2 - q3)", op("-", R("q1"), op("-", R("q2"), R("q3")))],
    ["((q1))", R("q1")],
    ["(mood + sleep) * days", op("*", op("+", R("mood"), R("sleep")), R("days"))],
    ["0 - q1 - 0.5", op("-", op("-", N(0), R("q1")), N(0.5))],
    ["4 - q1", op("-", N(4), R("q1"))],
  ])("%s", (text, expected) => {
    expect(tree(text)).toEqual(expected);
  });
});

describe("formula text from a tree", () => {
  it("round-trips: text → tree → generated text → the same tree", () => {
    const deepLeft = `${"(".repeat(40)}q1${" + q2)".repeat(40)}`;
    const deepRight = `q1 - ${Array.from({ length: 30 }, () => "(q2 - ").join("")}q3${")".repeat(30)}`;
    const texts = [
      "q1 + q2",
      "q1 + q2 * 2",
      "q1 - (q2 - q3)",
      "q1 / (q2 / q3)",
      "q1 + (q2 + q3)",
      "(q1 + q2) * (q3 - 2)",
      "((((q1 + q2))))",
      "(((q1 + (q2 * (q3 - (mood / 2))))))",
      "q1 * q2 + q3 * mood",
      "(q1 + q2) / 2",
      "0.5 * q1 - 10",
      "q1 - q2 + q3",
      "(mood + sleep) * days",
      deepLeft,
      deepRight,
    ];
    for (const text of texts) {
      const first = tree(text);
      const generated = formulaToText(first, nameOf)!;
      expect(tree(generated), `${text} → ${generated}`).toEqual(first);
    }
  });

  it("writes names, single spaces around operators and brackets only where needed", () => {
    expect(formulaToText(tree("((q1+q2))*2"), nameOf)).toBe("(q1 + q2) * 2");
    expect(formulaToText(tree("q1+(q2*2)"), nameOf)).toBe("q1 + q2 * 2");
    expect(formulaToText(tree("q1-(q2-q3)"), nameOf)).toBe("q1 - (q2 - q3)");
    expect(formulaToText(tree("(q1-q2)-q3"), nameOf)).toBe("q1 - q2 - q3");
  });

  it("writes numbers without exponents, and a negative number as (0 - n)", () => {
    expect(formulaToText(op("+", R("q1"), N(-2)), nameOf)).toBe("q1 + (0 - 2)");
    expect(formulaToText(op("*", R("q1"), N(1e21)), nameOf)).toBe("q1 * 1000000000000000000000");
    expect(formulaToText(op("*", R("q1"), N(1e-7)), nameOf)).toBe("q1 * 0.0000001");
    expect(formulaToText(op("*", R("q1"), N(1.5e-7)), nameOf)).toBe("q1 * 0.00000015");
    expect(tree(formulaToText(op("*", R("q1"), N(1.5e-7)), nameOf)!)).toEqual(op("*", R("q1"), N(1.5e-7)));
  });

  it("gives null when a reference has no name", () => {
    expect(formulaToText(op("+", R("q1"), { ref: "nobody" }), nameOf)).toBeNull();
  });
});

describe("long formulas", () => {
  it("parses a 10,000-term formula, and walks its tree, without overflowing the stack", () => {
    const text = sum(10_000);
    const parsed = parseFormulaText(text, lookup);
    expect(parsed.ok && parsed.terms).toBe(10_000);
    const formula = (parsed as { formula: FormulaNode }).formula;
    expect(formulaTerms(formula)).toBe(10_000);
    expect(formulaToText(formula, nameOf)).toBe(text);
    // Brackets nested 10,000 deep, too.
    expect(parseFormulaText(`${"(".repeat(10_000)}q1${")".repeat(10_000)}`, lookup).ok).toBe(true);
    // The save refuses it: the limit is on top of the parser.
    expect(error(text)).toBe("This formula is too long. Use at most 300 question names and numbers.");
  });

  it.each([
    [299, null],
    [300, null],
    [301, "This formula is too long. Use at most 300 question names and numbers."],
  ])("%i terms → %s", (terms, message) => {
    expect(error(sum(terms))).toBe(message);
    // Numbers count as terms too, and so do repeats of one name.
    expect(error(`q1${" + 2".repeat(terms - 1)}`)).toBe(message);
  });
});

describe("names in text", () => {
  it("finds names in text with other errors", () => {
    expect(formulaNamesInText("Q1 + (q2 %% 2q3) q2")).toEqual(["q1", "q2"]);
  });
  it("renames a name, ignoring case, and changes nothing else", () => {
    expect(renameInFormulaText("Q1+ q12*(q1 )-2q1", "q1", "mood")).toBe("mood+ q12*(mood )-2q1");
  });
});

/* ---------- question names (§17.8) ---------- */

describe("question names: the §17.8 table", () => {
  it.each([
    ["Age", [], 1, "age"],
    ["Little interest or pleasure in doing things", [], 1, "little_interest_or_pleasure_in"],
    ["1. Feeling nervous", [], 1, "q_1_feeling_nervous"],
    ["焦虑", [], 7, "q7"],
    ["Age", ["age"], 1, "age_2"],
    ["Age", ["AGE", "age_2"], 1, "age_3"],
    ["q7", ["q7"], 7, "q7_2"],
    ["Sí, señor", [], 1, "si_senor"],
    ["  --How   are you?--  ", [], 1, "how_are_you"],
    ["Supercalifragilisticexpialidociousness", [], 1, "supercalifragilisticexpialidocio"],
    ["Over the last two weeks how often", [], 1, "over_the_last_two_weeks_how"],
    ["abcdefghij_klmnopqrstu_vwxyz_abcdef", [], 1, "abcdefghij_klmnopqrstu_vwxyz"],
  ])("%j (taken %j, question %i) → %s", (label, taken, number, name) => {
    expect(generateQuestionName(label, taken, number)).toBe(name);
  });
});

/* ---------- forms ---------- */

const choice = (id: string, name: string | undefined, scores: (number | undefined)[] = [0, 1, 2], label = id) => ({
  id,
  type: "choice",
  label,
  ...(name ? { name } : {}),
  required: false,
  options: scores.map((score, i) => ({ code: `o${i}`, label: `O${i}`, ...(score === undefined ? {} : { score }) })),
});
const number = (id: string, name?: string, label = id) => ({ id, type: "number", label, ...(name ? { name } : {}), required: false });
const short = (id: string, name?: string) => ({ id, type: "short", label: id, ...(name ? { name } : {}), required: false });
const score = (formulaText: string, extra: Record<string, unknown> = {}) => ({
  id: "total",
  label: "Total score",
  formulaText,
  unanswered: "no-score",
  ...extra,
});

/** A scored group "PHQ" holding two choices, a nested plain group and a nested repeat; a question outside it. */
function phqRaw(scores: unknown[] = [score("q1 + q2 + days")]) {
  return {
    title: "T",
    blocks: [
      {
        id: "g",
        type: "group",
        label: "PHQ",
        scores,
        blocks: [
          choice("b1", "q1"),
          choice("b2", "q2"),
          { id: "inner", type: "group", label: "Inner", blocks: [number("b3", "days"), short("note", "note")] },
          { id: "visits", type: "group", label: "Visits", repeats: true, repeatLabel: "visit", blocks: [number("b4", "count")] },
        ],
      },
      number("out", "outside"),
    ],
  };
}
const parse = (raw: unknown) => FormSchema.parse(raw);
const phq = (scores?: unknown[]) => parse(phqRaw(scores)).blocks;
/** The save's messages for `blocks`, after the save has normalised them. */
const saveMessages = (blocks: readonly Block[]) => formProblems({ blocks: normalizeScores(blocks) }).map((p) => p.message);
const groupOf = (blocks: readonly Block[], id = "g") => findBlock(blocks, id)!.block as GroupBlock;
/** Group `id`'s trees as the download derives them from the text. */
const derived = (blocks: readonly Block[], id = "g") => groupOf(withArtifactScores(blocks), id).scores!.map((s) => s.formula);
/** True when no score anywhere holds a tree: stored content keeps text only. */
const noTrees = (blocks: readonly Block[]) =>
  walkBlocks(blocks).every((e) => !(e.block.scores ?? []).some((s) => typeof s === "object" && s !== null && "formula" in s));

/** The ids of the questions group `id`'s formulas can use, as the editor lists them. */
const reachIds = (blocks: readonly Block[], id: string) => scoreableQuestions(blocks, id).map((q) => q.block.id);

describe("reach (§17.2)", () => {
  it("includes nested plain groups, and excludes nested repeats and anything outside", () => {
    expect(reachIds(phq(), "g")).toEqual(["b1", "b2", "b3"]);
    // "note" is within reach but can't be scored; "count" is behind a nested repeat; "outside" is outside.
    expect(formulaTextError(phq(), "g", "note")).toBe(
      `"note" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`,
    );
    expect(formulaTextError(phq(), "g", "count")).toBe(`"count" is in a repeating group, so this score can't use it.`);
    expect(formulaTextError(phq(), "g", "outside")).toBe(`There's no question named "outside" in this group.`);
  });

  it("includes a scored repeating group's own questions, but not a repeat nested in it", () => {
    const blocks = parse({
      title: "T",
      blocks: [
        {
          id: "r",
          type: "group",
          label: "Patients",
          repeats: true,
          repeatLabel: "patient",
          scores: [score("age")],
          blocks: [
            number("age", "age"),
            { id: "p", type: "group", label: "Plain", blocks: [number("w", "weight")] },
            { id: "r2", type: "group", label: "Payments", repeats: true, repeatLabel: "payment", blocks: [number("amount", "amount")] },
          ],
        },
      ],
    }).blocks;
    expect(reachIds(blocks, "r")).toEqual(["age", "w"]);
    expect(reachIds(blocks, "r2")).toEqual(["amount"]);
  });
});

describe("the save: text, trees, ids and names (§17.7–§17.9)", () => {
  it("keeps text only, ignoring any tree sent; the download derives the tree from the text", () => {
    const blocks = normalizeScores(phq([score("q1 + q2 * 2", { formula: { ref: "out" } })]));
    expect(noTrees(blocks)).toBe(true);
    expect(groupOf(blocks).scores![0].formulaText).toBe("q1 + q2 * 2");
    expect(derived(blocks)).toEqual([{ op: "+", args: [{ ref: "b1" }, { op: "*", args: [{ ref: "b2" }, { num: 2 }] }] }]);
    expect(saveMessages(phq([score("q1 + q2 * 2", { formula: { ref: "out" } })]))).toEqual([]);
  });

  it("drops the tree sent with text that doesn't parse, and refuses the text", () => {
    const blocks = normalizeScores(phq([score("q1 +", { formula: { ref: "b1" } })]));
    expect(groupOf(blocks).scores![0].formula).toBeUndefined();
    expect(saveMessages(blocks)).toEqual([`Group "PHQ", score "Total score": Add a name or number after +.`]);
  });

  it("replaces a tree sent without text by text: names, spaces, brackets only where needed", () => {
    const formula = { op: "*", args: [{ op: "+", args: [{ ref: "b1" }, { ref: "b2" }] }, { op: "-", args: [{ ref: "b3" }, { num: 2 }] }] };
    const blocks = normalizeScores(phq([{ id: "total", label: "Total score", formula, unanswered: "zero" }]));
    expect(groupOf(blocks).scores![0]).toEqual({ id: "total", label: "Total score", formulaText: "(q1 + q2) * (days - 2)", unanswered: "zero" });
    expect(derived(blocks)).toEqual([formula]);
  });

  it("keeps an invalid tree sent without text only so the save rules refuse it", () => {
    const blocks = normalizeScores(phq([{ id: "total", label: "Total score", formula: { ref: "out" }, unanswered: "zero" }]));
    expect(groupOf(blocks).scores![0].formula).toEqual({ ref: "out" });
    expect(formProblems({ blocks })).toHaveLength(1);
  });

  it("generates names first, so a tree on unnamed questions gets text", () => {
    const raw = phqRaw([{ id: "total", label: "Total score", formula: { op: "+", args: [{ ref: "b1" }, { ref: "b3" }] }, unanswered: "no-score" }]);
    const g = raw.blocks[0] as { blocks: { name?: string; blocks?: { name?: string }[] }[] };
    delete g.blocks[0].name;
    delete g.blocks[2].blocks![0].name;
    const blocks = normalizeScores(parse(raw).blocks);
    expect(findBlock(blocks, "b1")!.block.name).toBe("b1");
    expect(groupOf(blocks).scores![0].formulaText).toBe("b1 + b3");
  });

  it("fills a missing score id, and keeps the previous one for the same score sent again", () => {
    const sent = phq([{ label: "Total score", formulaText: "q1", unanswered: "no-score" }, { label: "Other", formulaText: "q2", unanswered: "zero" }]);
    const first = normalizeScores(sent);
    const [a, b] = groupOf(first).scores!;
    expect(a.id).toMatch(/^s_[a-z0-9]{8}$/);
    expect(b.id).toMatch(/^s_[a-z0-9]{8}$/);
    expect(a.id).not.toBe(b.id);
    const again = normalizeScores(sent, first);
    expect(groupOf(again).scores!.map((s) => s.id)).toEqual([a.id, b.id]);
    // A different label at that position is a different score.
    const relabelled = normalizeScores(phq([{ label: "Renamed", formulaText: "q1", unanswered: "no-score" }]), first);
    expect(groupOf(relabelled).scores![0].id).not.toBe(a.id);
  });

  it("names every question within reach that has none, from its label, at save", () => {
    const raw = phqRaw();
    const g = raw.blocks[0] as { blocks: Record<string, unknown>[] };
    g.blocks.push({ ...choice("b9", undefined), label: "Little interest or pleasure in doing things" }, { ...number("b10"), label: "焦虑" });
    const blocks = normalizeScores(parse(raw).blocks);
    expect(findBlock(blocks, "b9")!.block.name).toBe("little_interest_or_pleasure_in");
    expect(findBlock(blocks, "b10")!.block.name).toBe("q7"); // question 7 in the form (§4): the repeat's question counts
    expect(findBlock(blocks, "b4")!.block.name).toBe("count"); // behind a repeat: kept, not checked
    expect(findBlock(blocks, "out")!.block.name).toBe("outside");
  });
});

describe("names for new questions (§17.8, decision B)", () => {
  const withNew = () => {
    const raw = phqRaw();
    (raw.blocks[0] as { blocks: Record<string, unknown>[] }).blocks.push(choice("new", undefined, [0, 1], "Multiple choice"));
    return parse(raw).blocks;
  };

  it("leaves a new question unnamed while its placeholder label stands", () => {
    const blocks = fillQuestionNames(withNew(), { skip: new Set(["new"]) });
    expect(findBlock(blocks, "new")!.block.name).toBeUndefined();
  });

  it("names it from the real label once the author leaves the label field", () => {
    const relabelled = fillQuestionNames(withNew(), { skip: new Set(["new"]) }).map((b) =>
      b.id === "g" ? { ...b, blocks: (b as GroupBlock).blocks.map((c) => (c.id === "new" ? { ...c, label: "Sleep quality" } : c)) } : b,
    ) as Block[];
    const named = fillQuestionNames(relabelled, { only: new Set(["new"]) });
    expect(findBlock(named, "new")!.block.name).toBe("sleep_quality");
    // Only that one: nothing else is touched.
    const others = (blocks: Block[]) => walkBlocks(blocks).filter((e) => e.block.id !== "new" && !e.block.blocks).map((e) => e.block);
    expect(others(named)).toEqual(others(relabelled));
  });

  it("names it at save if the author never changed the label", () => {
    expect(findBlock(normalizeScores(withNew()), "new")!.block.name).toBe("multiple_choice");
  });

  it("never regenerates a name: a label edit leaves it alone", () => {
    const blocks = phq().map((b) =>
      b.id === "g" ? { ...b, blocks: (b as GroupBlock).blocks.map((c) => (c.id === "b1" ? { ...c, label: "Changed" } : c)) } : b,
    ) as Block[];
    expect(findBlock(normalizeScores(blocks), "b1")!.block.name).toBe("q1");
  });
});

describe("the save refuses every §17.6 rule, naming the group and the score", () => {
  const prefix = `Group "PHQ", score "Total score": `;

  it("accepts a valid form", () => {
    expect(saveMessages(phq())).toEqual([]);
  });

  it.each<[string, unknown, string]>([
    ["an id outside the pattern", score("q1", { id: "bad id" }), `${prefix}Its id "bad id" isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`],
    ["an id that isn't text", score("q1", { id: 7 }), `${prefix}Its id 7 isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`],
    ["a blank label", score("q1", { label: "  " }), `Group "PHQ", score 1: It needs a label.`],
    ["a missing label", { id: "total", formulaText: "q1", unanswered: "no-score" }, `Group "PHQ", score 1: It needs a label.`],
    ["an unknown unanswered", score("q1", { unanswered: "skip" }), `${prefix}Its unanswered setting must be "no-score" or "zero", not "skip".`],
    ["a missing unanswered", { id: "total", label: "Total score", formulaText: "q1" }, `${prefix}Its unanswered setting must be "no-score" or "zero", not missing.`],
    ["decimals above 4", score("q1", { decimals: 5 }), `${prefix}Its decimal places must be a whole number from 0 to 4.`],
    ["decimals not whole", score("q1", { decimals: 1.5 }), `${prefix}Its decimal places must be a whole number from 0 to 4.`],
    ["decimals as text", score("q1", { decimals: "2" }), `${prefix}Its decimal places must be a whole number from 0 to 4.`],
    ["showToRespondent not a boolean", score("q1", { showToRespondent: "yes" }), `${prefix}Its showToRespondent setting must be true or false.`],
    ["a score that isn't an object", "q1 + q2", `Group "PHQ", score 1: It must be an object with a label, a formula and how to treat unanswered questions.`],
    ["no formula at all", { id: "total", label: "Total score", unanswered: "no-score" }, `${prefix}Enter a formula, e.g. q1 + q2.`],
    ["formula text that isn't text", score("q1", { formulaText: 3 }), `${prefix}Its formula text must be text.`],
  ])("%s", (_, entry, message) => {
    expect(saveMessages(phq([entry]))).toEqual([message]);
  });

  it("refuses a duplicate id within the group", () => {
    expect(saveMessages(phq([score("q1"), score("q2", { label: "Other" })]))).toEqual([
      `Group "PHQ", score "Other": Its id "total" is also used by score 1. Score ids must be unique within a group.`,
    ]);
  });

  it("refuses scores that aren't a list, and scores on a page", () => {
    expect(saveMessages(phq("q1" as unknown as unknown[]))).toEqual([`Group "PHQ": Its scores must be a list.`]);
    const paged = parse({ title: "T", blocks: [{ id: "p", type: "page", title: "One", scores: [score("x")], blocks: [number("x", "x")] }] }).blocks;
    expect(saveMessages(paged)).toEqual([
      `Page "One": a page can't have scores — only groups can. Put its questions in a group on the page and score that instead.`,
    ]);
  });

  const tree = (formula: unknown) => ({ id: "total", label: "Total score", formula, unanswered: "no-score" });
  it.each<[string, unknown, string]>([
    ["a node with two kinds", { num: 1, ref: "b1" }, "Its formula isn't valid: every part must be an object with a num, a ref, or an op and its args."],
    ["a node that isn't an object", ["b1"], "Its formula isn't valid: every part must be an object with a num, a ref, or an op and its args."],
    ["a num that isn't a number", { op: "+", args: [{ ref: "b1" }, { num: "2" }] }, `Its formula isn't valid: "2" isn't a finite number.`],
    ["an op outside + - * /", { op: "^", args: [{ ref: "b1" }, { num: 2 }] }, `Its formula isn't valid: "^" isn't one of + - * /.`],
    ["args not exactly two", { op: "+", args: [{ ref: "b1" }, { ref: "b2" }, { ref: "b3" }] }, "Its formula isn't valid: an operator needs exactly two args."],
    ["a ref to no block", { ref: "nope" }, `Its formula uses "nope", which isn't the id of a question in this form.`],
    ["a ref outside the group", { ref: "out" }, `Its formula uses "out", which isn't a question in this group.`],
    ["a ref to the group itself", { ref: "inner" }, `Its formula uses "Inner", which isn't a question in this group.`],
    ["a ref into a nested repeat", { ref: "b4" }, `Its formula uses "b4", which is in a repeating group, so this score can't use it.`],
    ["a ref to a type that can't be scored", { ref: "note" }, `Its formula uses "note", which can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`],
    ["no refs", { op: "+", args: [{ num: 1 }, { num: 2 }] }, "Use at least one question name."],
  ])("refuses a stored tree with %s", (_, formula, detail) => {
    expect(saveMessages(phq([tree(formula)]))).toEqual([`${prefix}${detail}`]);
  });

  it("refuses formula text errors word for word (§17.7)", () => {
    expect(saveMessages(phq([score("q1 + outside")]))).toEqual([`${prefix}There's no question named "outside" in this group.`]);
    expect(saveMessages(phq([score("q1 + count")]))).toEqual([`${prefix}"count" is in a repeating group, so this score can't use it.`]);
    expect(saveMessages(phq([score("q1 + note")]))).toEqual([
      `${prefix}"note" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`,
    ]);
    expect(saveMessages(phq([score("")]))).toEqual([`${prefix}Enter a formula, e.g. q1 + q2.`]);
  });

  it("refuses a referenced question whose type was changed to one that can't be scored", () => {
    const changed = phq().map((b) =>
      b.id === "g" ? { ...b, blocks: (b as GroupBlock).blocks.map((c) => (c.id === "b1" ? { ...c, type: "short", options: undefined } : c)) } : b,
    ) as Block[];
    expect(saveMessages(changed)).toEqual([
      `${prefix}"q1" can't be scored. Use number, scale, rating, choice, dropdown, checkbox, multiselect or matrix questions.`,
    ]);
  });

  it.each([
    [299, []],
    [300, []],
    [301, [`${prefix}This formula is too long. Use at most 300 question names and numbers.`]],
  ])("applies the 300-term limit to text: %i terms", (terms, messages) => {
    expect(saveMessages(phq([score(sum(terms))]))).toEqual(messages);
  });

  it.each([
    [299, true],
    [300, true],
    [301, false],
  ])("applies the 300-term limit to a tree sent without text: %i terms", (terms, ok) => {
    let formula: FormulaNode = { ref: "b1" };
    for (let k = 1; k < terms; k += 1) formula = { op: "+", args: [formula, { ref: "b2" }] };
    const blocks = normalizeScores(phq([tree(formula)]));
    expect(formProblems({ blocks }).map((p) => p.message)).toEqual(
      ok ? [] : [`${prefix}This formula is too long. Use at most 300 question names and numbers.`],
    );
    expect(groupOf(blocks).scores![0].formulaText === undefined).toBe(!ok);
    expect(noTrees(blocks)).toBe(ok);
  });

  it("exports a 300-term formula nested 5 groups deep: the artifact builds, serializes and parses", () => {
    let g: Record<string, unknown> = {
      id: "s", type: "group", label: "Scored", scores: [score(sum(300, "a").replace(/a \+ a/g, "a + b"))],
      blocks: [number("qa", "a"), number("qb", "b")],
    };
    for (let k = 0; k < 5; k += 1) g = { id: `n${k}`, type: "group", label: `N${k}`, blocks: [g] };
    const blocks = normalizeScores(parse({ title: "T", blocks: [g] }).blocks);
    expect(saveMessages(blocks)).toEqual([]);
    expect(noTrees(blocks)).toBe(true);
    const artifact = buildArtifact({ title: "T", blocks }, { formId: "f", formVersionId: "v" });
    const formula = (findBlock(artifact.blocks, "s")!.block as GroupBlock).scores![0].formula!;
    expect(formulaTerms(formula)).toBe(300);
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
  });

  it("refuses a referenced question with an option that has no score, naming the question and the score", () => {
    const raw = phqRaw();
    (raw.blocks[0] as { blocks: unknown[] }).blocks[1] = choice("b2", "q2", [0, undefined, 2], "Feeling down");
    expect(saveMessages(parse(raw).blocks)).toEqual([
      `Block "PHQ › Feeling down": Option 2 ("O1") has no score, but the score "Total score" of "PHQ" uses this question. Give every option a score.`,
    ]);
    // An unreferenced question may leave its scores out.
    expect(saveMessages(phq([score("q1 + days")]).map((b) => b))).toEqual([]);
  });

  it("refuses a referenced matrix with a column that has no score; its rows need none", () => {
    const raw = phqRaw([score("m")]);
    (raw.blocks[0] as { blocks: unknown[] }).blocks.push({
      id: "m",
      type: "matrix",
      label: "Grid",
      name: "m",
      required: false,
      options: [{ code: "r1", label: "R1" }, { code: "r2", label: "R2" }],
      columns: [{ code: "c1", label: "C1", score: 0 }, { code: "c2", label: "C2" }],
    });
    expect(saveMessages(parse(raw).blocks)).toEqual([
      `Block "PHQ › Grid": Column 2 ("C2") has no score, but the score "Total score" of "PHQ" uses this question. Give every column a score.`,
    ]);
  });

  it("refuses an option score that isn't a number, anywhere", () => {
    const block = parse({ title: "T", blocks: [{ ...choice("x", undefined), options: [{ code: "a", label: "A", score: "1" }] }] }).blocks[0];
    expect(optionListProblems(block).map((p) => p.rule)).toEqual([`the score of option 1 ("A") must be a number.`]);
  });

  it("refuses names outside the pattern, and names used twice within one scored group's reach", () => {
    const raw = phqRaw();
    const blocks = (raw.blocks[0] as { blocks: Record<string, unknown>[] }).blocks;
    blocks[0].name = "Q 1";
    (blocks[2].blocks as Record<string, unknown>[])[1].name = "q2";
    expect(saveMessages(parse(raw).blocks)).toEqual([
      `Group "PHQ", score "Total score": There's no question named "q1" in this group.`,
      `Block "PHQ › b1": Its name "Q 1" isn't allowed. A name starts with a lower-case letter and uses only a–z, 0–9 and "_", up to 64 characters.`,
      `Block "PHQ › Inner › note": Its name "q2" is also used by "b2", and the scores of "PHQ" can use both. Give each question its own name.`,
    ]);
  });

  it("allows the same name in two scored groups that don't share a question", () => {
    const blocks = parse({
      title: "T",
      blocks: [
        { id: "a", type: "group", label: "A", scores: [score("x")], blocks: [number("x1", "x")] },
        { id: "b", type: "group", label: "B", scores: [score("x")], blocks: [number("x2", "x")] },
      ],
    }).blocks;
    expect(saveMessages(blocks)).toEqual([]);
  });
});

describe("the artifact", () => {
  const content = () => {
    const raw = phqRaw([score("q1 + q2 * 2 + days", { decimals: 2, showToRespondent: true })]);
    const g = raw.blocks[0] as { blocks: unknown[] };
    g.blocks.push(
      { id: "rank", type: "ranking", label: "Rank", required: false, options: [{ code: "a", label: "A", score: 1 }] },
      {
        id: "m",
        type: "matrix",
        label: "Grid",
        name: "m",
        required: false,
        options: [{ code: "r1", label: "R1", score: 9 }],
        columns: [{ code: "c1", label: "C1", score: 0 }, { code: "c2", label: "C2", score: 1 }],
      },
    );
    return { ...raw, blocks: normalizeScores(parse(raw).blocks) };
  };

  it("carries scores and option scores, and no names or formula text", () => {
    const artifact = buildArtifact(content(), { formId: "f", formVersionId: "v" });
    const g = artifact.blocks[0] as GroupBlock;
    expect(g.scores).toEqual([
      {
        id: "total",
        label: "Total score",
        formula: {
          op: "+",
          args: [{ op: "+", args: [{ ref: "b1" }, { op: "*", args: [{ ref: "b2" }, { num: 2 }] }] }, { ref: "b3" }],
        },
        unanswered: "no-score",
        decimals: 2,
        showToRespondent: true,
      },
    ]);
    const json = JSON.stringify(artifact);
    expect(json).not.toContain('"name"');
    expect(json).not.toContain("formulaText");
    expect((findBlock(artifact.blocks, "b1")!.block.options ?? []).map((o) => o.score)).toEqual([0, 1, 2]);
    expect((findBlock(artifact.blocks, "m")!.block.columns ?? []).map((o) => o.score)).toEqual([0, 1]);
    // Where a score means nothing — a matrix's rows, a ranking — it is left out.
    expect(findBlock(artifact.blocks, "m")!.block.options![0]).toEqual({ code: "r1", label: "R1" });
    expect(findBlock(artifact.blocks, "rank")!.block.options![0]).toEqual({ code: "a", label: "A" });
  });

  it("refuses a name or formula text in an artifact, and anything §17.6 refuses", () => {
    const good = buildArtifact(content(), { formId: "f", formVersionId: "v" });
    const withName = JSON.parse(JSON.stringify(good));
    withName.blocks[0].blocks[0].name = "q1";
    expect(FormArtifact.safeParse(withName).error?.issues[0].message).toBe('Block "PHQ › b1": the question name is never part of the artifact.');
    const withText = JSON.parse(JSON.stringify(good));
    withText.blocks[0].scores[0].formulaText = "q1";
    expect(FormArtifact.safeParse(withText).error?.issues[0].message).toBe(
      'Group "PHQ", score "Total score": The formula text is never part of the artifact.',
    );
    const noId = JSON.parse(JSON.stringify(good));
    delete noId.blocks[0].scores[0].id;
    expect(FormArtifact.safeParse(noId).error?.issues[0].message).toBe('Group "PHQ", score "Total score": It has no id.');
  });
});

describe("guards (§17.9)", () => {
  it("refuses deleting a question a formula uses, with the contract's message", () => {
    const blockers = scoreDeletionBlockers(phq(), "b1");
    expect(blockers.map((u) => [u.group.id, u.score.id])).toEqual([["g", "total"]]);
    expect(scoreUseMessage(blockers[0])).toBe('Used in the score "Total score" of "PHQ". Remove it from the formula first.');
    // A nested group holding one is refused too; the scored group itself goes with its scores.
    expect(scoreDeletionBlockers(phq(), "inner").map((u) => u.group.id)).toEqual(["g"]);
    expect(scoreDeletionBlockers(phq(), "g")).toEqual([]);
    expect(scoreDeletionBlockers(phq(), "note")).toEqual([]);
  });

  it("counts a name in text with other errors as in use", () => {
    expect(scoreDeletionBlockers(phq([score("q1 + (")]), "b1")).toHaveLength(1);
  });

  it("refuses changing a used question to a type that can't be scored, but not to one that can", () => {
    expect(scoreTypeChangeBlockers(phq(), "b1", "short")).toHaveLength(1);
    expect(scoreTypeChangeBlockers(phq(), "b1", "ranking")).toHaveLength(1);
    expect(scoreTypeChangeBlockers(phq(), "b1", "dropdown")).toEqual([]);
    expect(scoreTypeChangeBlockers(phq(), "note", "short")).toEqual([]);
  });

  it("refuses moving a used question out of reach: out of the group, or into a nested repeat", () => {
    const blocks = phq();
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "b1", null, 0)).score.map((b) => b.id)).toEqual(["g"]);
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "b3", "visits", 0)).score.map((b) => b.id)).toEqual(["g"]);
    // Within reach is fine: into the nested plain group, or reordered.
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "b1", "inner", 0)).score).toEqual([]);
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "b2", "g", 0)).score).toEqual([]);
    // An unused question can leave.
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "note", null, 0)).score).toEqual([]);
  });

  it("refuses turning on Repeats for a nested plain group that holds a used question", () => {
    expect(repeatsOnScoreBlockers(phq(), "inner").map((b) => b.id)).toEqual(["g"]);
    expect(repeatsOnScoreBlockers(phq([score("q1 + q2")]), "inner")).toEqual([]);
    // The scored group itself can repeat: its own questions stay within reach.
    expect(repeatsOnScoreBlockers(phq(), "g")).toEqual([]);
  });

  it("rewrites every formula text that uses a renamed question, ignoring case, and counts them", () => {
    const blocks = phq([score("Q1 + q2 + days"), score("q1 * 2", { id: "double", label: "Double" }), score("q2", { id: "two", label: "Two" })]);
    const { blocks: next, updated } = renameQuestion(blocks, "b1", "q1", "mood");
    expect(updated).toBe(2);
    expect(groupOf(next).scores!.map((s) => s.formulaText)).toEqual(["mood + q2 + days", "mood * 2", "q2"]);
    expect(findBlock(next, "b1")!.block.name).toBe("mood");
    expect(saveMessages(next)).toEqual([]);
  });

  it("gives a moved question a suffix when its name is taken, leaving formulas that meant the other alone", () => {
    const blocks = parse({
      title: "T",
      blocks: [
        { id: "a", type: "group", label: "A", scores: [score("age * 2", { id: "a1" })], blocks: [number("ageA", "age")] },
        // A question that kept its name after leaving a scored group's reach.
        { id: "b", type: "group", label: "B", blocks: [number("ageB", "age"), number("other")] },
      ],
    }).blocks;
    const after = moveBlockInTree(blocks, "ageB", "a", 1);
    expect(structureBreaks(blocks, after).score).toEqual([]);
    const { blocks: resolved, renamed } = resolveNameClashes(blocks, after, new Set(["ageB"]));
    expect(renamed).toEqual([{ id: "ageB", from: "age", to: "age_2" }]);
    expect(findBlock(resolved, "ageB")!.block.name).toBe("age_2");
    expect(findBlock(resolved, "ageA")!.block.name).toBe("age");
    expect(groupOf(resolved, "a").scores![0].formulaText).toBe("age * 2");
    expect(saveMessages(resolved)).toEqual([]);
    expect(derived(normalizeScores(resolved), "a")).toEqual([{ op: "*", args: [{ ref: "ageA" }, { num: 2 }] }]);
  });

  it("rewrites the formulas of a group that moves along with its renamed question", () => {
    const blocks = parse({
      title: "T",
      blocks: [
        { id: "o", type: "group", label: "Outer", scores: [score("age + 1", { id: "o1" })], blocks: [number("ageO", "age")] },
        { id: "t", type: "group", label: "T", scores: [score("age * 3", { id: "t1" })], blocks: [number("ageT", "age")] },
      ],
    }).blocks;
    const after = moveBlockInTree(blocks, "t", "o", 1);
    const { blocks: resolved } = resolveNameClashes(blocks, after, new Set(walkBlocks([findBlock(blocks, "t")!.block]).map((e) => e.block.id)));
    expect(findBlock(resolved, "ageT")!.block.name).toBe("age_2");
    expect(groupOf(resolved, "t").scores![0].formulaText).toBe("age_2 * 3");
    expect(groupOf(resolved, "o").scores![0].formulaText).toBe("age + 1");
    expect(saveMessages(resolved)).toEqual([]);
  });
});

describe("templates (§17.9)", () => {
  const template = () => {
    const [group] = normalizeScores(
      parse({
        title: "T",
        blocks: [
          {
            id: "tg",
            type: "group",
            label: "Mood check",
            scores: [score("age * 2 + mood", { id: "m" })],
            blocks: [number("tAge", "age"), number("tMood", "mood")],
          },
        ],
      }).blocks,
    ) as GroupBlock[];
    return { id: "tpl", version: 1, name: "Mood check", content: group };
  };

  it("remaps every ref: a group with scores inserted twice gives two valid copies", () => {
    let blocks: Block[] = [];
    const copies: GroupBlock[] = [];
    for (let k = 0; k < 2; k += 1) {
      const copy = groupFromTemplate(template(), walkBlocks(blocks).map((e) => e.block.id));
      copies.push(copy);
      blocks = insertBlockIntoTree(blocks, null, blocks.length, copy);
    }
    expect(saveMessages(blocks)).toEqual([]);
    expect(noTrees(blocks)).toBe(true);
    for (const copy of copies) {
      const [age, mood] = copy.blocks.map((b) => b.id);
      expect(derived(blocks, copy.id)).toEqual([{ op: "+", args: [{ op: "*", args: [{ ref: age }, { num: 2 }] }, { ref: mood }] }]);
      expect(copy.scores![0].formulaText).toBe("age * 2 + mood");
    }
    expect(copies[0].blocks[0].id).not.toBe(copies[1].blocks[0].id);
  });

  it("remapBlockIds remaps the refs of any tree it meets, and keeps text", () => {
    const content = template().content;
    const withTree = { ...content, scores: [{ ...content.scores![0], formula: derived([content], "tg")[0] }] } as GroupBlock;
    const { blocks, ids } = remapBlockIds([withTree]);
    const g = blocks[0] as GroupBlock;
    expect(g.scores![0].formula).toEqual({ op: "+", args: [{ op: "*", args: [{ ref: ids.get("tAge")! }, { num: 2 }] }, { ref: ids.get("tMood")! }] });
    expect(g.scores![0].formulaText).toBe("age * 2 + mood");
  });

  it("inside an outer scored group, clashing names get suffixes and the copy's own formula texts follow", () => {
    let blocks = parse({
      title: "T",
      blocks: [{ id: "o", type: "group", label: "Outer", scores: [score("age + 1", { id: "o1" })], blocks: [number("oAge", "age")] }],
    }).blocks as Block[];
    const copies: string[] = [];
    for (let k = 0; k < 2; k += 1) {
      const copy = groupFromTemplate(template(), walkBlocks(blocks).map((e) => e.block.id));
      copies.push(copy.id);
      const after = insertBlockIntoTree(blocks, "o", 1 + k, copy);
      blocks = namesAfterInsert(blocks, after, copy);
    }
    const [first, second] = copies.map((id) => groupOf(blocks, id));
    expect(first.blocks.map((b) => b.name)).toEqual(["age_2", "mood"]);
    expect(first.scores![0].formulaText).toBe("age_2 * 2 + mood");
    expect(second.blocks.map((b) => b.name)).toEqual(["age_3", "mood_2"]);
    expect(second.scores![0].formulaText).toBe("age_3 * 2 + mood_2");
    // The outer group's formula still means its own question.
    expect(groupOf(blocks, "o").scores![0].formulaText).toBe("age + 1");
    expect(saveMessages(blocks)).toEqual([]);
    const saved = normalizeScores(blocks);
    expect(derived(saved, "o")).toEqual([{ op: "+", args: [{ ref: "oAge" }, { num: 1 }] }]);
    expect(derived(saved, copies[1])).toEqual([{
      op: "+",
      args: [{ op: "*", args: [{ ref: second.blocks[0].id }, { num: 2 }] }, { ref: second.blocks[1].id }],
    }]);
  });
});

describe("import keeps scores (§17.9)", () => {
  it("Replace all keeps the score of every option whose code is in the file; Add brings none", () => {
    const existing = [
      { code: "a", label: "A", score: 1 },
      { code: "b", label: "B", score: 2 },
    ];
    const preview = [
      { line: 1, code: "b", label: "Bee", generated: false, flags: [] },
      { line: 2, code: "c", label: "C", generated: false, flags: [] },
      { line: 3, code: "A", label: "Big A", generated: false, flags: [] },
    ];
    expect(applyImport(existing, preview, "replace")).toEqual([
      { code: "b", label: "Bee", score: 2 },
      { code: "c", label: "C" },
      { code: "A", label: "Big A" },
    ]);
    expect(applyImport(existing, preview.slice(1, 2), "add")).toEqual([...existing, { code: "c", label: "C" }]);
  });
});
