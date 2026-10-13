import { describe, expect, it } from "vitest";
import {
  type Block,
  type Condition,
  CODE_PATTERN,
  FormArtifact,
  FormSchema,
  buildArtifact,
  conditionNumbersInText,
  formProblems,
  idsFromPrevious,
  logicTreeToArtifact,
  logicTreeToText,
  newConditionId,
  normalizeConditions,
  parseLogicText,
  problemsBesideContent,
  renumberAfterDelete,
  walkBlocks,
} from "./index";
import { opts } from "./test-utils/options";

/* ---------- fixtures ---------- */

const IDS = ["c1", "c2", "c3", "c4"];
const identity = { formId: "f", formVersionId: "v" };

/** The tree for `text`, failing the test if it doesn't parse. */
function tree(text: string, count = 4) {
  const parsed = parseLogicText(text, count);
  if (!parsed.ok) throw new Error(`"${text}" didn't parse: ${parsed.error}`);
  return parsed.tree;
}
const exported = (text: string, count = 4) => logicTreeToArtifact(tree(text, count), IDS.slice(0, count));
const error = (text: string, count = 4) => {
  const parsed = parseLogicText(text, count);
  return parsed.ok ? null : parsed.error;
};

const yesNo = (id: string, label = id) => ({ id, type: "choice", label, required: false, options: opts("Yes", "No") });
const short = (id: string, label = id) => ({ id, type: "short", label, required: false });
const yes = (question: string, id?: string): Condition => ({ ...(id ? { id } : {}), question, operator: "=", answer: "yes" });

/** Four yes/no sources and a question `d` that depends on all of them. */
function form(dependent: Record<string, unknown>) {
  return FormSchema.parse({
    title: "t",
    blocks: [yesNo("q1"), yesNo("q2"), yesNo("q3"), yesNo("q4"), { ...short("d", "Diet"), ...dependent }],
  });
}
const four = (ids: (string | undefined)[] = IDS) => ["q1", "q2", "q3", "q4"].map((q, i) => yes(q, ids[i]));
const messages = (f: { blocks: Block[] }) => formProblems(f).map((p) => p.message);
const blockById = (blocks: readonly Block[], id: string) => walkBlocks(blocks).find((e) => e.block.id === id)!.block;

/* ---------- §15.7: the shared test table ---------- */

describe("§15.7 valid text → exported", () => {
  it.each<[string, number, object]>([
    ["1 AND 2 AND 3 AND 4", 4, {}],
    ["1 or 2 or 3 or 4", 4, { enableBehavior: "any" }],
    ["1 OR (2 AND (3 OR 4))", 4, { enableLogic: { any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] } }],
    ["(1 AND 2) OR (1 AND 3) OR 4", 4, { enableLogic: { any: [{ all: ["c1", "c2"] }, { all: ["c1", "c3"] }, "c4"] } }],
    ["((1 AND 2)) AND (3 AND 4)", 4, {}],
    ["(1 AND 2)OR(3 AND 4)", 4, { enableLogic: { any: [{ all: ["c1", "c2"] }, { all: ["c3", "c4"] }] } }],
    ["(2) AND 1", 2, {}],
  ])("%s", (text, count, shape) => {
    expect(exported(text, count)).toEqual(shape);
  });
});

describe("§15.7 invalid text → message", () => {
  it.each([
    ["1 AND 2 OR 3 AND 4", "Add brackets to show whether AND or OR comes first."],
    ["1 AND (2 OR 3", "A bracket isn't closed."],
    ["1 AND 2) OR 3", "There's a closing bracket without an opening one."],
    ["1 AND 2 AND 3", "Condition 4 isn't used."],
    ["1 AND 2 AND 3 AND 5", "There's no condition 5."],
    ["1 AND 02 AND 3 AND 4", "There's no condition 02."],
    ["1 XOR 2", '"XOR" isn\'t allowed. Use condition numbers, AND, OR and brackets.'],
    ["1 2 AND 3 AND 4", "Add AND or OR between 1 and 2."],
    ["1 AND () AND 3", "Brackets can't be empty."],
    ["1AND2 AND 3 AND 4", '"1AND2" isn\'t allowed. Use condition numbers, AND, OR and brackets.'],
  ])("%s", (text, message) => {
    expect(error(text)).toBe(message);
  });
});

/* ---------- the rest of the §15.5 table ---------- */

describe("§15.5 messages", () => {
  it("empty or blank text", () => {
    expect(error("")).toBe("Enter how the conditions combine, e.g. 1 AND 2.");
    expect(error("   ")).toBe("Enter how the conditions combine, e.g. 1 AND 2.");
  });

  it("a missing operator names the numbers either side, inside brackets too", () => {
    expect(error("1 (2 OR 3) AND 4")).toBe("Add AND or OR between 1 and 2.");
    expect(error("(1 AND 2) 3 AND 4")).toBe("Add AND or OR between 2 and 3.");
    expect(error("(1 AND 2) (3 AND 4)")).toBe("Add AND or OR between 2 and 3.");
  });

  it("a missing condition: after an operator, or at the start of the text or a bracket", () => {
    expect(error("1 AND")).toBe("Add a condition after AND.");
    expect(error("1 or")).toBe("Add a condition after OR.");
    expect(error("AND 1")).toBe("Start with a condition number.");
    expect(error("1 AND OR 2")).toBe("Add a condition after AND.");
    expect(error("(OR 1) AND 2")).toBe("Start with a condition number.");
    expect(error("1 AND (2 OR) AND 3")).toBe("Add a condition after OR.");
  });

  it("empty brackets, with spaces inside too", () => {
    expect(error("1 AND ( ) AND 3")).toBe("Brackets can't be empty.");
    expect(error("(())")).toBe("Brackets can't be empty.");
  });

  it("no such condition: zero, too high, leading zeros, the first in the text", () => {
    expect(error("0 AND 1 AND 2 AND 3 AND 4")).toBe("There's no condition 0.");
    expect(error("1 AND 9 AND 7 AND 2 AND 3 AND 4")).toBe("There's no condition 9.");
    expect(error("1 AND 2 AND 3 AND 004")).toBe("There's no condition 004.");
    expect(error("1 AND 2 AND 3 AND 99999999999999999999")).toBe("There's no condition 99999999999999999999.");
  });

  it("unused conditions: one, two, three or more", () => {
    expect(error("1 AND 2 AND 3")).toBe("Condition 4 isn't used.");
    expect(error("1 AND 2")).toBe("Conditions 3 and 4 aren't used.");
    expect(error("1 OR 1")).toBe("Conditions 2, 3 and 4 aren't used.");
  });

  it("words in any case, repeats and redundant brackets are fine", () => {
    expect(error("1 aNd 2 AnD 3 and 4")).toBeNull();
    expect(error("(1 AND 2) OR (1 AND 3) OR 4")).toBeNull();
    expect(error("((((1)))) AND (2) AND 3 AND 4")).toBeNull();
    expect(error("  1   AND\t2 AND 3 AND 4  ")).toBeNull();
  });
});

describe("error order: the first problem in table order wins, wherever it is in the text", () => {
  it("an unclosed bracket before an unused condition", () => {
    expect(error("1 AND (2", 4)).toBe("A bracket isn't closed.");
    expect(error("1 AND (2 OR 3", 4)).toBe("A bracket isn't closed.");
  });

  it("an unknown token before mixed operators", () => {
    expect(error("1 AND 2 OR 3 AND x")).toBe('"x" isn\'t allowed. Use condition numbers, AND, OR and brackets.');
  });

  it("an unknown token before a missing operator earlier in the text", () => {
    expect(error("1 2 AND 3 XOR 4")).toBe('"XOR" isn\'t allowed. Use condition numbers, AND, OR and brackets.');
  });

  it("an unclosed bracket before a stray closing one that comes first", () => {
    expect(error(") 1 AND 2 AND 3 AND 4 (")).toBe("A bracket isn't closed.");
    expect(error(")1 AND 2 AND 3 AND (4")).toBe("A bracket isn't closed.");
  });

  it("mixed operators before a number that isn't a condition, before unused conditions", () => {
    expect(error("1 AND 2 OR 9")).toBe("Add brackets to show whether AND or OR comes first.");
    expect(error("1 AND 5")).toBe("There's no condition 5.");
  });

  it("a missing operator before a missing condition", () => {
    expect(error("1 2 AND")).toBe("Add AND or OR between 1 and 2.");
  });
});

/* ---------- conditionNumbersInText and renumberAfterDelete ---------- */

describe("conditionNumbersInText", () => {
  it("lists every number in valid text, once each, in the order met", () => {
    expect(conditionNumbersInText("3 OR (1 AND 3) OR 2")).toEqual([3, 1, 2]);
    expect(conditionNumbersInText("10 AND 1")).toEqual([10, 1]);
  });

  it("finds numbers in text with other errors", () => {
    expect(conditionNumbersInText("1 AND (2")).toEqual([1, 2]);
    expect(conditionNumbersInText("1AND2 OR 3")).toEqual([1, 2, 3]);
    expect(conditionNumbersInText("x02y")).toEqual([2]);
    expect(conditionNumbersInText("")).toEqual([]);
  });
});

describe("renumberAfterDelete", () => {
  it("lowers every number above the deleted one", () => {
    expect(renumberAfterDelete("1 OR 3", 2)).toBe("1 OR 2");
    expect(renumberAfterDelete("4 AND (1 OR 3)", 2)).toBe("3 AND (1 OR 2)");
  });

  it("leaves lower numbers untouched", () => {
    expect(renumberAfterDelete("1 AND 2", 3)).toBe("1 AND 2");
  });

  it("treats 10 as one number", () => {
    expect(renumberAfterDelete("10 AND 1", 3)).toBe("9 AND 1");
    expect(renumberAfterDelete("1 AND 10", 1)).toBe("1 AND 9");
  });

  it("keeps spacing, case and brackets exactly", () => {
    expect(renumberAfterDelete("(1  and 4)OR\t3", 2)).toBe("(1  and 3)OR\t2");
  });

  it("changes only the numbers in invalid text", () => {
    expect(renumberAfterDelete("1AND3 xor ((4", 2)).toBe("1AND2 xor ((3");
  });

  it("writes a lowered number without leading zeros, and leaves lower ones as typed", () => {
    expect(renumberAfterDelete("01 AND 03", 2)).toBe("01 AND 2");
  });
});

/* ---------- trees ---------- */

describe("logicTreeToText", () => {
  it("numbers in order, words in upper case, every nested node in brackets", () => {
    expect(logicTreeToText({ any: [1, { all: [2, { any: [3, 4] }] }] })).toBe("1 OR (2 AND (3 OR 4))");
    expect(logicTreeToText({ all: [1, 2] })).toBe("1 AND 2");
  });

  it.each([
    "1 AND 2 AND 3 AND 4",
    "1 or 2 or 3 or 4",
    "1 OR (2 AND (3 OR 4))",
    "(1 AND 2) OR (1 AND 3) OR 4",
    "((1 AND 2)) AND (3 AND 4)",
    "(1 AND 2)OR(3 AND 4)",
    "1 AND (2 AND (3 AND 4))",
  ])("round trip: the text it generates for %s parses back to the same tree", (text) => {
    const t = tree(text);
    expect(tree(logicTreeToText(t))).toEqual(t);
  });
});

describe("export in its simplest form (§15.3, §15.4)", () => {
  it("all-AND exports nothing, all-OR exports enableBehavior any", () => {
    expect(exported("4 AND 3 AND 2 AND 1")).toEqual({});
    expect(exported("1 OR 2 OR 3 OR 4")).toEqual({ enableBehavior: "any" });
  });

  it("merges nesting with the same operator", () => {
    expect(exported("1 AND (2 AND (3 AND 4))")).toEqual({});
    expect(exported("(1 OR 2) OR (3 OR 4)")).toEqual({ enableBehavior: "any" });
    expect(exported("1 OR (2 AND (3 AND 4))")).toEqual({ enableLogic: { any: ["c1", { all: ["c2", "c3", "c4"] }] } });
  });

  it("keeps a repeated id once within one node", () => {
    expect(exported("1 AND 1 AND 2 AND 3 AND 4")).toEqual({});
    expect(exported("(1 AND 2 AND 1) OR 3", 3)).toEqual({ enableLogic: { any: [{ all: ["c1", "c2"] }, "c3"] } });
    expect(exported("(1 AND 1) OR 2", 2)).toEqual({ enableBehavior: "any" });
  });

  it("survives very deep brackets without overflowing the stack", () => {
    const deep = "(".repeat(20000) + "1 OR (2 AND 3)" + ")".repeat(20000);
    expect(exported(deep, 3)).toEqual({ enableLogic: { any: ["c1", { all: ["c2", "c3"] }] } });
    expect(conditionNumbersInText(deep)).toEqual([1, 2, 3]);
  });
});

/* ---------- condition ids ---------- */

describe("newConditionId", () => {
  it("is c_ and 8 lower-case base-36 characters, within the code pattern", () => {
    for (let i = 0; i < 50; i += 1) {
      const id = newConditionId();
      expect(id).toMatch(/^c_[0-9a-z]{8}$/);
      expect(id).toMatch(CODE_PATTERN);
    }
  });

  it("avoids the ids it is given", () => {
    const taken = Array.from({ length: 20 }, () => newConditionId());
    expect(taken).not.toContain(newConditionId(taken));
  });
});

/* ---------- normalizeConditions: ids and text for stored content ---------- */

describe("normalizeConditions", () => {
  const normalized = (dependent: Record<string, unknown>) => blockById(normalizeConditions(form(dependent).blocks), "d");

  it("fills missing ids, keeping the ones already there", () => {
    const d = normalized({ enableWhen: four(["keep", undefined, undefined, "c_kept0001"]), enableLogicText: "1 AND 2 AND 3 AND 4" });
    const ids = d.enableWhen!.map((c) => c.id!);
    expect(ids[0]).toBe("keep");
    expect(ids[3]).toBe("c_kept0001");
    expect(ids[1]).toMatch(/^c_[0-9a-z]{8}$/);
    expect(new Set(ids).size).toBe(4);
    expect(d.enableWhen!.map((c) => c.question)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("generates text for content saved before logic text: flat AND and flat OR", () => {
    expect(normalized({ enableWhen: four() }).enableLogicText).toBe("1 AND 2 AND 3 AND 4");
    const any = normalized({ enableWhen: four(), enableBehavior: "any" });
    expect(any.enableLogicText).toBe("1 OR 2 OR 3 OR 4");
    expect("enableBehavior" in any && any.enableBehavior !== undefined).toBe(false);
  });

  it("generates text from a stored tree, then drops the tree", () => {
    const d = normalized({ enableWhen: four(), enableLogic: { any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] } });
    expect(d.enableLogicText).toBe("1 OR (2 AND (3 OR 4))");
    expect(d.enableLogic).toBeUndefined();
  });

  it("ignores a tree or enableBehavior sent with text: the text is the logic", () => {
    const d = normalized({ enableWhen: four(), enableLogicText: "1 AND (2 OR 3 OR 4)", enableBehavior: "any", enableLogic: { any: IDS } });
    expect(d.enableLogicText).toBe("1 AND (2 OR 3 OR 4)");
    expect(d.enableBehavior).toBeUndefined();
    expect(d.enableLogic).toBeUndefined();
  });

  it("keeps the text exactly as typed, empty included", () => {
    expect(normalized({ enableWhen: four(), enableLogicText: "  ((1 and 2))AND (3 AND 4) " }).enableLogicText).toBe("  ((1 and 2))AND (3 AND 4) ");
    expect(normalized({ enableWhen: four(), enableLogicText: "" }).enableLogicText).toBe("");
  });

  it("drops the text, tree and enableBehavior from an item with one condition or none", () => {
    const one = normalized({ enableWhen: [yes("q1")], enableLogicText: "1 AND 2", enableBehavior: "any" });
    expect(one.enableLogicText).toBeUndefined();
    expect(one.enableBehavior).toBeUndefined();
    expect(one.enableWhen).toHaveLength(1);
    const none = normalized({ enableWhen: [], enableLogicText: "1", enableLogic: { all: ["c1"] } });
    expect(none.enableLogicText).toBeUndefined();
    expect(none.enableLogic).toBeUndefined();
  });

  it("never reorders enableWhen", () => {
    const d = normalized({ enableWhen: four().reverse(), enableLogicText: "4 AND 3 AND 2 AND 1" });
    expect(d.enableWhen!.map((c) => c.question)).toEqual(["q4", "q3", "q2", "q1"]);
  });

  it("reaches groups, pages and repeating groups", () => {
    const f = FormSchema.parse({
      title: "t",
      blocks: [
        { id: "p1", type: "page", title: "One", blocks: [yesNo("q1"), yesNo("q2")] },
        {
          id: "p2", type: "page", title: "Two", enableWhen: [yes("q1"), yes("q2")], enableBehavior: "any",
          blocks: [{
            id: "r", type: "group", label: "R", repeats: true, repeatLabel: "item", enableWhen: [yes("q1"), yes("q2")],
            blocks: [yesNo("q3"), { ...short("in"), enableWhen: [yes("q1"), yes("q3")] }],
          }],
        },
      ],
    });
    const blocks = normalizeConditions(f.blocks);
    expect(blockById(blocks, "p2").enableLogicText).toBe("1 OR 2");
    expect(blockById(blocks, "r").enableLogicText).toBe("1 AND 2");
    expect(blockById(blocks, "in").enableLogicText).toBe("1 AND 2");
    for (const e of walkBlocks(blocks)) for (const c of e.block.enableWhen ?? []) expect(c.id).toMatch(/^c_/);
  });

  it("leaves an invalid stored tree for the save rules", () => {
    const d = normalized({ enableWhen: four(), enableLogic: { any: ["c1", "c9"] } });
    expect(d.enableLogicText).toBeUndefined();
    expect(d.enableLogic).toEqual({ any: ["c1", "c9"] });
  });
});

describe("idsFromPrevious: a save keeps the ids conditions already have", () => {
  const stored = normalizeConditions(form({ enableWhen: four(["s1", "s2", "s3", "s4"]), enableLogicText: "1 AND 2 AND 3 AND 4" }).blocks);
  const resave = (dependent: Record<string, unknown>) =>
    blockById(normalizeConditions(form(dependent).blocks, idsFromPrevious(stored)), "d").enableWhen!.map((c) => c.id);

  it("the same condition, sent without its id, gets its stored id back", () => {
    expect(resave({ enableWhen: four([]), enableLogicText: "1 AND 2 AND 3 AND 4" })).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("a changed or new condition gets a new random id", () => {
    const changed = four([]);
    changed[1] = { question: "q2", operator: "=", answer: "no" };
    const ids = resave({ enableWhen: [...changed, yes("q1")], enableLogicText: "1 AND 2 AND 3 AND 4 AND 5" });
    expect(ids[0]).toBe("s1");
    expect(ids[1]).toMatch(/^c_[0-9a-z]{8}$/);
    expect(ids.slice(2, 4)).toEqual(["s3", "s4"]);
    expect(ids[4]).toMatch(/^c_[0-9a-z]{8}$/);
  });

  it("never takes an id another condition of the item already has", () => {
    expect(resave({ enableWhen: four([undefined, "s1", undefined, undefined]), enableLogicText: "1 AND 2 AND 3 AND 4" })[0]).toMatch(/^c_/);
  });
});

/* ---------- save rules ---------- */

describe("save rules for logic and condition ids", () => {
  it("refuses a text error with the table's message, naming the block", () => {
    expect(messages(form({ enableWhen: four(), enableLogicText: "1 AND (2 OR 3" }))).toEqual(['Block "Diet": A bracket isn\'t closed.']);
    expect(messages(form({ enableWhen: four(), enableLogicText: "" }))).toEqual([
      'Block "Diet": Enter how the conditions combine, e.g. 1 AND 2.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogicText: "1 AND 2 OR 3 AND 4" }))).toEqual([
      'Block "Diet": Add brackets to show whether AND or OR comes first.',
    ]);
  });

  it("accepts valid text, and content with no text (its text is generated at save)", () => {
    expect(messages(form({ enableWhen: four(), enableLogicText: "1 OR (2 AND (3 OR 4))" }))).toEqual([]);
    expect(messages(form({ enableWhen: four(), enableBehavior: "any" }))).toEqual([]);
  });

  it("doesn't show the text error in the Logic section's list: it sits under the field", () => {
    const f = form({ enableWhen: four(), enableLogicText: "1 AND" });
    expect(problemsBesideContent(f, "d")).toEqual([]);
  });

  it("refuses a malformed or repeated condition id", () => {
    expect(messages(form({ enableWhen: four(["c1", "bad id", "c3", "c4"]), enableLogicText: "1 AND 2 AND 3 AND 4" }))).toEqual([
      'Block "Diet": condition 2\'s id "bad id" isn\'t allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.',
    ]);
    expect(messages(form({ enableWhen: four(["c1", "c2", "c1", "-x"]), enableLogicText: "1 AND 2 AND 3 AND 4" }))).toEqual([
      'Block "Diet": conditions 1 and 3 have the same id "c1".',
      `Block "Diet": condition 4's id "-x" isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`,
    ]);
  });

  it("allows the same condition id on two different items", () => {
    const f = FormSchema.parse({
      title: "t",
      blocks: [yesNo("q1"), { ...short("a"), enableWhen: [yes("q1", "c1")] }, { ...short("b"), enableWhen: [yes("q1", "c1")] }],
    });
    expect(messages(f)).toEqual([]);
  });

  it("refuses an invalid tree stored without text", () => {
    expect(messages(form({ enableWhen: four(), enableLogic: { any: ["c1", "c9"] } }))).toEqual([
      'Block "Diet": its enableLogic uses "c9", which isn\'t the id of one of its conditions.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogic: { any: IDS }, enableBehavior: "any" }))).toEqual([
      'Block "Diet": its enableLogic and enableBehavior can\'t both be set.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogic: { any: ["c1", "c2", "c3"] } }))).toEqual([
      'Block "Diet": its enableLogic doesn\'t use condition 4.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogic: { any: [] } }))).toEqual([
      'Block "Diet": its enableLogic isn\'t valid: a list can\'t be empty.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogic: { all: IDS, any: IDS } }))).toEqual([
      'Block "Diet": its enableLogic isn\'t valid: every part must be an object with exactly one key, "all" or "any", holding a list.',
    ]);
    expect(messages(form({ enableWhen: four(), enableLogic: { all: ["c1", 2, "c3", "c4"] } }))).toEqual([
      'Block "Diet": its enableLogic isn\'t valid: every entry must be a condition id or another "all" or "any" part.',
    ]);
  });

  it("keeps the existing per-condition checks for every condition, whatever the logic", () => {
    const f = FormSchema.parse({
      title: "t",
      blocks: [
        yesNo("q1"),
        { ...short("d", "Diet"), enableWhen: [yes("q1", "c1"), yes("later", "c2"), { id: "c3", question: "q1", operator: ">", answer: 1 }], enableLogicText: "1 OR (2 AND 3)" },
        yesNo("later", "Later"),
      ],
    });
    expect(messages(f)).toEqual([
      'Block "Diet": a condition depends on "Later", which comes after it. A condition can only use a question that comes before it.',
      'Block "Diet": the operator ">" can\'t be used with "q1" (a choice question). Allowed: exists, =, !=.',
    ]);
  });
});

/* ---------- the artifact ---------- */

describe("buildArtifact and condition logic", () => {
  const artifactBlock = (dependent: Record<string, unknown>) =>
    buildArtifact({ title: "t", blocks: form(dependent).blocks }, identity).blocks[4];

  it("exports the tree, never the text", () => {
    const d = artifactBlock({ enableWhen: four(), enableLogicText: "1 OR (2 AND (3 OR 4))" });
    expect(d.enableLogic).toEqual({ any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] });
    expect("enableLogicText" in d).toBe(false);
    expect("enableBehavior" in d).toBe(false);
    expect(Object.keys(d).slice(-2)).toEqual(["enableWhen", "enableLogic"]);
  });

  it("exports flat logic in its simplest form", () => {
    const and = artifactBlock({ enableWhen: four(), enableLogicText: "((1 AND 2)) AND (3 AND 4)" });
    expect("enableLogic" in and || "enableBehavior" in and).toBe(false);
    expect(artifactBlock({ enableWhen: four(), enableLogicText: "1 or 2 or 3 or 4" }).enableBehavior).toBe("any");
  });

  it("gives conditions without ids c1, c2, … by position, skipping ids the item has, the same every time", () => {
    const stored = { enableWhen: four([undefined, "c1", undefined, "keep"]), enableBehavior: "any" };
    const first = artifactBlock(stored);
    expect(first.enableWhen!.map((c) => c.id)).toEqual(["c2", "c1", "c3", "keep"]);
    expect(first.enableBehavior).toBe("any");
    expect(artifactBlock(stored)).toEqual(first);
  });

  it("exports content saved before logic text with its old meaning", () => {
    const tree = { any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] };
    expect(artifactBlock({ enableWhen: four(), enableLogic: tree }).enableLogic).toEqual(tree);
    expect(artifactBlock({ enableWhen: four() }).enableBehavior).toBeUndefined();
  });

  it("refuses to export text that doesn't parse", () => {
    expect(() => artifactBlock({ enableWhen: four(), enableLogicText: "1 AND" })).toThrow('Block "Diet": Add a condition after AND.');
  });

  it("an item with one condition has no logic in the artifact", () => {
    const d = artifactBlock({ enableWhen: [yes("q1")], enableLogicText: "1", enableBehavior: "any" });
    expect(["enableLogic", "enableBehavior", "enableLogicText"].some((k) => k in d)).toBe(false);
  });

  it("FormArtifact refuses what the renderer would refuse", () => {
    const base = { title: "t", ...identity, schemaVersion: 2 };
    const art = (d: Record<string, unknown>) => FormArtifact.safeParse({ ...base, blocks: [yesNo("q1"), yesNo("q2"), { ...short("d"), ...d }] }).success;
    const two = [yes("q1", "c1"), yes("q2", "c2")];
    expect(art({ enableWhen: two, enableLogic: { any: ["c1", { all: ["c2", "c1"] }] } })).toBe(true);
    expect(art({ enableWhen: two, enableLogicText: "1 AND 2" })).toBe(false);
    expect(art({ enableWhen: [yes("q1"), yes("q2", "c2")] })).toBe(false);
    expect(art({ enableWhen: two, enableLogic: { any: ["c1", "c2"] }, enableBehavior: "any" })).toBe(false);
    expect(art({ enableWhen: [yes("q1", "c1")], enableLogic: { any: ["c1"] } })).toBe(false);
    expect(art({ enableWhen: two, enableLogic: { any: ["c1"] } })).toBe(false);
  });
});
