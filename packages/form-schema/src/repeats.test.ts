import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  findBlock,
  formProblems,
  FormSchema,
  isPresentationalType,
  isRepeatingGroup,
  moveBlockInTree,
  prefixBrokenDependents,
  prefixRuleBreaker,
  problemsBesideContent,
  questionNumbers,
  REPEAT_DEFAULTS,
  repeatChain,
  repeatsOnBlockers,
  repeatSettingsProblems,
  sameContent,
  structureBreaks,
  unwrapGroup,
  type Block,
  type Condition,
  type GroupBlock,
  type LeafBlock,
  type PageBlock,
} from "./index";

/* ---------- fixtures ---------- */

const leaf = (id: string, type: LeafBlock["type"] = "short", extra: Partial<LeafBlock> = {}): LeafBlock =>
  ({
    id,
    type,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    ...(isPresentationalType(type) ? {} : { required: false }),
    ...extra,
  }) as LeafBlock;
const group = (id: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock => ({
  id,
  type: "group",
  label: id.charAt(0).toUpperCase() + id.slice(1),
  blocks,
  ...extra,
});
/** A repeating group with the defaults the editor writes, unless overridden. */
const repeat = (id: string, repeatLabel: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock =>
  group(id, blocks, { repeats: true, repeatLabel, minOccurs: 1, ...extra });
const page = (id: string, blocks: Block[], extra: Record<string, unknown> = {}): PageBlock =>
  ({ id, type: "page", title: id.charAt(0).toUpperCase() + id.slice(1), blocks, ...extra }) as unknown as PageBlock;
const exists = (question: string): Condition => ({ question, operator: "exists" });
const when = <T extends Block>(block: T, ...enableWhen: Condition[]): T => ({ ...block, enableWhen });

/** Make `dependentId` depend on `sourceId` (operator "exists"), wherever it is. */
function withCondition(blocks: Block[], dependentId: string, sourceId: string): Block[] {
  const attach = (list: Block[]): Block[] =>
    list.map((b) => {
      const next = b.id === dependentId ? when(b, exists(sourceId)) : b;
      return "blocks" in next && next.blocks ? ({ ...next, blocks: attach(next.blocks) } as Block) : next;
    });
  return attach(blocks);
}

/*
 * Three levels of repeats — patients › payments › line items — with questions
 * outside every repeat before and after them, a plain group inside a repeat,
 * and a sibling repeat (visits) that encloses none of the others.
 */
const clinic = (): Block[] => [
  leaf("consent"),
  repeat("patients", "patient", [
    leaf("name"),
    group("details", [leaf("age", "number")]),
    repeat("payments", "payment", [
      leaf("amount", "number"),
      repeat("items", "line item", [leaf("cost", "number"), leaf("note")]),
      leaf("receipt"),
    ]),
    leaf("followUp"),
  ]),
  repeat("visits", "visit", [leaf("visitDate", "date")]),
  leaf("summary"),
];

const problemsWith = (dependentId: string, sourceId: string) =>
  formProblems({ blocks: withCondition(clinic(), dependentId, sourceId) }).map((p) => p.message);

/* ---------- shape, stripping and export ---------- */

describe("repeating group schema", () => {
  it("keeps the repeat settings on a group that repeats, in the contract's key order", () => {
    const parsed = FormSchema.parse({
      title: "T",
      blocks: [repeat("patients", "patient", [leaf("name")], { minOccurs: 0, maxOccurs: 3 })],
    });
    expect(parsed.blocks[0]).toMatchObject({ repeats: true, repeatLabel: "patient", minOccurs: 0, maxOccurs: 3 });
    expect(Object.keys(parsed.blocks[0])).toEqual([
      "id", "type", "label", "repeats", "repeatLabel", "minOccurs", "maxOccurs", "blocks",
    ]);
  });

  it("strips the settings, and repeats: false itself, from a group that doesn't repeat", () => {
    for (const off of [{ repeats: false }, {}]) {
      const parsed = FormSchema.parse({
        title: "T",
        blocks: [group("g", [leaf("q")], { ...off, repeatLabel: "patient", minOccurs: 2, maxOccurs: 5 } as never)],
      });
      expect(parsed.blocks[0]).toEqual({ id: "g", type: "group", label: "G", blocks: [leaf("q")] });
    }
  });

  it("ignores rather than rejects idle settings of any value (contract §6)", () => {
    const parsed = FormSchema.safeParse({
      title: "T",
      blocks: [group("g", [leaf("q")], { repeatLabel: 7, minOccurs: "lots", maxOccurs: null } as never)],
    });
    expect(parsed.success).toBe(true);
    expect(formProblems(parsed.data!)).toEqual([]);
  });

  it("strips idle settings at any depth, including inside a repeat", () => {
    const parsed = FormSchema.parse({
      title: "T",
      blocks: [repeat("r", "row", [group("inner", [leaf("q")], { repeats: false, minOccurs: 4 } as never)])],
    });
    const inner = findBlock(parsed.blocks, "inner")!.block;
    expect(inner).not.toHaveProperty("repeats");
    expect(inner).not.toHaveProperty("minOccurs");
  });

  it("rejects a repeats value that isn't true or false as a schema error", () => {
    expect(FormSchema.safeParse({ title: "T", blocks: [group("g", [leaf("q")], { repeats: "yes" } as never)] }).success).toBe(false);
  });

  it("keeps repeats: true on a page so the save rules can refuse it, and drops a page's other settings", () => {
    const parsed = FormSchema.parse({
      title: "T",
      blocks: [page("p1", [leaf("q")], { repeats: true, repeatLabel: "step", minOccurs: 2 })],
    });
    expect(parsed.blocks[0]).toMatchObject({ repeats: true });
    expect(parsed.blocks[0]).not.toHaveProperty("repeatLabel");
    expect(parsed.blocks[0]).not.toHaveProperty("minOccurs");
    const off = FormSchema.parse({ title: "T", blocks: [page("p1", [leaf("q")], { repeats: false })] });
    expect(off.blocks[0]).not.toHaveProperty("repeats");
  });

  it("treats turning Repeats on and then off again as no change", () => {
    const original = { title: "T", blocks: [group("g", [leaf("q")])] };
    const onThenOff = {
      title: "T",
      blocks: [group("g", [leaf("q")], { repeats: false, ...REPEAT_DEFAULTS, maxOccurs: 3 } as never)],
    };
    const on = { title: "T", blocks: [group("g", [leaf("q")], { repeats: true, ...REPEAT_DEFAULTS })] };
    expect(sameContent(original, onThenOff)).toBe(true);
    expect(sameContent(original, on)).toBe(false);
  });

  it("exports the repeat settings, and nothing for a group that doesn't repeat", () => {
    const artifact = buildArtifact(
      {
        title: "T",
        blocks: [
          repeat("patients", "patient", [leaf("name"), repeat("payments", "payment", [leaf("amount", "number")], { minOccurs: 0 })], { maxOccurs: 3 }),
          group("plain", [leaf("q")], { repeats: false, minOccurs: 2 } as never),
        ],
      },
      { formId: "f", formVersionId: "v" },
    );
    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.blocks[0]).toMatchObject({ repeats: true, repeatLabel: "patient", minOccurs: 1, maxOccurs: 3 });
    expect(findBlock(artifact.blocks, "payments")!.block).toMatchObject({ repeats: true, repeatLabel: "payment", minOccurs: 0 });
    expect(findBlock(artifact.blocks, "payments")!.block).not.toHaveProperty("maxOccurs");
    expect(JSON.parse(JSON.stringify(artifact.blocks[1]))).toEqual({ id: "plain", type: "group", label: "Plain", blocks: [leaf("q")] });
  });

  it("numbers questions inside a repeat once, as they appear in the template", () => {
    expect([...questionNumbers(clinic()).entries()]).toEqual([
      ["consent", 1], ["name", 2], ["age", 3], ["amount", 4], ["cost", 5], ["note", 6],
      ["receipt", 7], ["followUp", 8], ["visitDate", 9], ["summary", 10],
    ]);
  });
});

/* ---------- the prefix rule ---------- */

describe("prefix rule (contract §3.7, §12.3)", () => {
  const entry = (id: string) => findBlock(clinic(), id)!;

  it("builds each block's chain of enclosing repeats, outermost first, never including itself", () => {
    const chain = (id: string) => repeatChain(entry(id)).map((g) => g.id);
    expect(chain("consent")).toEqual([]);
    expect(chain("patients")).toEqual([]);
    expect(chain("age")).toEqual(["patients"]); // the plain "details" group doesn't count
    expect(chain("payments")).toEqual(["patients"]);
    expect(chain("note")).toEqual(["patients", "payments", "items"]);
    expect(isRepeatingGroup(entry("details").block)).toBe(false);
  });

  // [dependent, source, the repeat that breaks the rule (null = allowed), why]
  const table: [string, string, string | null, string][] = [
    ["name", "consent", null, "outside any repeat"],
    ["note", "consent", null, "outside every repeat, three levels out"],
    ["patients", "consent", null, "a repeating group on a question outside it"],
    ["age", "name", null, "same instance, across a plain group"],
    ["note", "cost", null, "same instance, innermost level"],
    ["amount", "name", null, "enclosing instance (payment on its patient)"],
    ["note", "amount", null, "enclosing instance, one level out"],
    ["note", "age", null, "enclosing instance, two levels out (line item on its patient)"],
    ["payments", "name", null, "a nested repeating group on its enclosing instance"],
    ["receipt", "amount", null, "same payment, after the nested repeat"],
    ["summary", "name", "patients", "outside every repeat, on a patient's question"],
    ["summary", "note", "patients", "outside every repeat, three levels in: the outermost repeat is named"],
    ["followUp", "amount", "payments", "a patient's question on one of its payments"],
    ["receipt", "cost", "items", "a payment's question on one of its line items"],
    ["visitDate", "name", "patients", "a sibling repeat that doesn't enclose the dependent"],
    ["visits", "age", "patients", "a repeating group on a sibling repeat's question"],
  ];

  it.each(table)("%s depending on %s → %s (%s)", (dependentId, sourceId, breaker) => {
    expect(prefixRuleBreaker(entry(sourceId), entry(dependentId))?.id ?? null).toBe(breaker);
  });

  it.each(table)("save: %s depending on %s → %s (%s)", (dependentId, sourceId, breaker) => {
    const problems = problemsWith(dependentId, sourceId);
    if (breaker === null) expect(problems).toEqual([]);
    else expect(problems).toHaveLength(1);
  });

  it("names the dependent, the source and the repeating group in the save message", () => {
    expect(problemsWith("summary", "name")).toEqual([
      'Block "Summary": its condition uses "Name", which is inside the repeating group "Patients". This block isn\'t inside "Patients", so it can\'t tell which patient\'s answer to use. Move the block into "Patients", or base the condition on a different question.',
    ]);
    expect(problemsWith("receipt", "cost")).toEqual([
      'Block "Patients › Payments › Receipt": its condition uses "Cost", which is inside the repeating group "Items". This block isn\'t inside "Items", so it can\'t tell which line item\'s answer to use. Move the block into "Items", or base the condition on a different question.',
    ]);
    expect(problemsWith("visits", "age")).toEqual([
      'Group "Visits": its condition uses "Age", which is inside the repeating group "Patients". This group isn\'t inside "Patients", so it can\'t tell which patient\'s answer to use. Move the group into "Patients", or base the condition on a different question.',
    ]);
  });

  it("says 'entry' when the repeating group has no name for one entry", () => {
    const blocks = withCondition(clinic(), "summary", "name").map((b) =>
      b.id === "patients" ? ({ ...b, repeatLabel: " " } as Block) : b,
    );
    expect(formProblems({ blocks }).map((p) => p.message)).toContain(
      'Block "Summary": its condition uses "Name", which is inside the repeating group "Patients". This block isn\'t inside "Patients", so it can\'t tell which entry\'s answer to use. Move the block into "Patients", or base the condition on a different question.',
    );
  });

  it("names a page as the dependent in a paged form", () => {
    const blocks = [
      page("p1", [repeat("patients", "patient", [leaf("name")])]),
      when(page("p2", [leaf("summary")]), exists("name")),
    ];
    expect(formProblems({ blocks }).map((p) => p.message)).toEqual([
      'Page "P2": its condition uses "Name", which is inside the repeating group "Patients". This page isn\'t inside "Patients", so it can\'t tell which patient\'s answer to use. Base the condition on a different question.',
    ]);
  });

  it("checks the ordering rule first, in template order", () => {
    // A patient's question can't use a later line item's answer: it comes after it.
    expect(problemsWith("name", "cost")).toEqual([
      'Block "Patients › Name": a condition depends on "Cost", which comes after it. A condition can only use a question that comes before it.',
    ]);
    // A repeating group can't depend on its own questions.
    expect(problemsWith("payments", "amount")[0]).toContain("which is inside this group");
  });

  it("keeps the disallowed-type rule: a repeating group is never a source", () => {
    expect(problemsWith("summary", "visits")).toEqual([
      'Block "Summary": "Visits" is a group block, which can\'t be used in a condition.',
    ]);
  });

  it("allows a condition across a repeat that has been turned off", () => {
    const blocks = withCondition(clinic(), "summary", "name").map((b) =>
      b.id === "patients" ? ({ ...b, repeats: undefined } as Block) : b,
    );
    expect(formProblems({ blocks })).toEqual([]);
  });
});

/* ---------- repeat settings and the other save rules ---------- */

describe("repeating group save rules", () => {
  const problemsOf = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
  const settings = (extra: Partial<GroupBlock>) => problemsOf(repeat("patients", "patient", [leaf("name")], extra));

  it("accepts the editor's defaults, minOccurs 0, a missing minOccurs and any limit at or above the minimum", () => {
    expect(problemsOf(group("g", [leaf("q")], { repeats: true, ...REPEAT_DEFAULTS }))).toEqual([]);
    expect(settings({ minOccurs: 0 })).toEqual([]);
    expect(settings({ minOccurs: undefined })).toEqual([]);
    expect(settings({ minOccurs: 2, maxOccurs: 2 })).toEqual([]);
    expect(settings({ minOccurs: 0, maxOccurs: 1 })).toEqual([]);
  });

  it("refuses repeats: true on a page", () => {
    expect(problemsOf(page("p1", [leaf("q")], { repeats: true }))).toEqual([
      'Page "P1": a page can\'t repeat — only groups can. Put its questions in a repeating group on the page instead.',
    ]);
  });

  it("refuses a blank or missing repeatLabel", () => {
    const expected = ['Group "Patients": a repeating group needs a name for one entry, such as "patient".'];
    expect(settings({ repeatLabel: "   " })).toEqual(expected);
    expect(settings({ repeatLabel: undefined })).toEqual(expected);
  });

  it("refuses a minOccurs that isn't a whole number of 0 or more", () => {
    for (const minOccurs of [-1, 1.5]) {
      expect(settings({ minOccurs })).toEqual([
        'Group "Patients": the minimum number of entries must be a whole number, 0 or more.',
      ]);
    }
  });

  it("refuses a maxOccurs that isn't a whole number of 1 or more", () => {
    for (const maxOccurs of [0, -2, 2.5]) {
      expect(settings({ minOccurs: 0, maxOccurs })).toEqual([
        'Group "Patients": the maximum number of entries must be a whole number, 1 or more, or left blank for no limit.',
      ]);
    }
  });

  it("refuses a maxOccurs below minOccurs; a missing minOccurs counts as 1", () => {
    expect(settings({ minOccurs: 3, maxOccurs: 2 })).toEqual([
      'Group "Patients": the maximum number of entries (2) can\'t be less than the minimum (3).',
    ]);
    expect(settings({ minOccurs: undefined, maxOccurs: 1 })).toEqual([]);
  });

  it("doesn't compare against a minimum that is itself invalid", () => {
    expect(settings({ minOccurs: 4.5, maxOccurs: 2 })).toEqual([
      'Group "Patients": the minimum number of entries must be a whole number, 0 or more.',
    ]);
  });

  it("gives each settings problem its field and an inline detail", () => {
    expect(repeatSettingsProblems(repeat("r", " ", [leaf("q")], { minOccurs: -1, maxOccurs: 0 }))).toEqual([
      { field: "repeatLabel", rule: 'a repeating group needs a name for one entry, such as "patient".', detail: 'A repeating group needs a name for one entry, such as "patient".' },
      { field: "minOccurs", rule: "the minimum number of entries must be a whole number, 0 or more.", detail: "The minimum number of entries must be a whole number, 0 or more." },
      { field: "maxOccurs", rule: "the maximum number of entries must be a whole number, 1 or more, or left blank for no limit.", detail: "The maximum number of entries must be a whole number, 1 or more, or left blank for no limit." },
    ]);
    expect(repeatSettingsProblems(group("g", [leaf("q")]))).toEqual([]);
  });

  it("keeps the group rules for a repeating group: a label, and at least one block", () => {
    expect(problemsOf(repeat("r", "row", [leaf("q")], { label: " " }))).toEqual([
      "An unlabelled group at the top level: a group needs a label.",
    ]);
    expect(problemsOf(repeat("r", "row", []))).toEqual(['Group "R": a group must contain at least one block.']);
  });

  it("names a nested repeating group by its path", () => {
    expect(problemsOf(repeat("patients", "patient", [repeat("payments", "", [leaf("amount", "number")])]))).toEqual([
      'Group "Patients › Payments": a repeating group needs a name for one entry, such as "patient".',
    ]);
  });

  it("allows a repeating group anywhere a group may be: in a page, in a plain group, nested", () => {
    const blocks = [
      page("p1", [leaf("consent")]),
      page("p2", [group("household", [repeat("children", "child", [leaf("childName"), repeat("allergies", "allergy", [leaf("allergen")])])])]),
    ];
    expect(formProblems({ blocks })).toEqual([]);
  });
});

/* ---------- editor guards (contract §12.8) ---------- */

describe("repeating group guards", () => {
  const ids = (blocks: readonly Block[]) => blocks.map((b) => b.id);

  it("refuses turning Repeats on while a condition outside the group uses a question inside it", () => {
    const blocks: Block[] = [
      group("household", [leaf("adults", "number"), group("inner", [leaf("pets")])]),
      when(leaf("summary"), exists("pets")),
      when(leaf("other"), exists("adults")),
    ];
    expect(ids(repeatsOnBlockers(blocks, "household"))).toEqual(["summary", "other"]);
    expect(ids(repeatsOnBlockers(blocks, "inner"))).toEqual(["summary"]);
  });

  it("allows turning Repeats on when conditions only point into the group from inside it, or out of it", () => {
    const blocks: Block[] = [
      leaf("consent"),
      group("household", [leaf("adults", "number"), when(leaf("pets"), exists("adults")), when(leaf("car"), exists("consent"))]),
      when(group("later", [leaf("x")]), exists("consent")),
    ];
    expect(repeatsOnBlockers(blocks, "household")).toEqual([]);
  });

  it("refuses moving a source into a repeat that doesn't hold its dependents", () => {
    const blocks: Block[] = [leaf("age", "number"), repeat("patients", "patient", [leaf("name")]), when(leaf("summary"), exists("age"))];
    const after = moveBlockInTree(blocks, "age", "patients", 0);
    expect(structureBreaks(blocks, after)).toEqual({ order: [], prefix: [findBlock(after, "summary")!.block] });
  });

  it("refuses moving a dependent out of the repeat that holds its source", () => {
    const blocks: Block[] = [repeat("patients", "patient", [leaf("name"), when(leaf("nick"), exists("name"))]), leaf("end")];
    const after = moveBlockInTree(blocks, "nick", null, 2);
    expect(ids(structureBreaks(blocks, after).prefix)).toEqual(["nick"]);
    expect(structureBreaks(blocks, after).order).toEqual([]);
  });

  it("refuses moving between two repeats", () => {
    const blocks: Block[] = [
      repeat("patients", "patient", [leaf("name"), when(leaf("nick"), exists("name"))]),
      repeat("visits", "visit", [leaf("date", "date")]),
    ];
    expect(ids(structureBreaks(blocks, moveBlockInTree(blocks, "nick", "visits", 1)).prefix)).toEqual(["nick"]);
    // A source moved into a later sibling repeat leaves its dependent behind it in reading order too.
    const both = structureBreaks(blocks, moveBlockInTree(blocks, "name", "visits", 0));
    expect(ids(both.order)).toEqual(["nick"]);
    expect(ids(both.prefix)).toEqual(["nick"]);
  });

  it("counts only breakage the edit causes, so an already-broken form can still be rearranged", () => {
    const blocks: Block[] = [
      repeat("patients", "patient", [leaf("name"), repeat("payments", "payment", [leaf("amount", "number")])]),
      leaf("x"),
      when(leaf("summary"), exists("amount")),
    ];
    // Already broken before the move: "summary" uses a payment's amount from outside. It isn't counted again.
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "x", null, 0))).toEqual({ order: [], prefix: [] });
    // Moving it into "patients" (but not "payments") still breaks the rule, but it was already broken.
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "summary", "patients", 2)).prefix).toEqual([]);
  });

  it("allows moving a whole repeat with its conditions inside it, and a dependent deeper into its source's repeat", () => {
    const blocks: Block[] = [
      leaf("consent"),
      repeat("patients", "patient", [leaf("name"), when(leaf("nick"), exists("name")), group("box", [leaf("y")])]),
      group("plain", [leaf("z")]),
    ];
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "patients", "plain", 1))).toEqual({ order: [], prefix: [] });
    expect(structureBreaks(blocks, moveBlockInTree(blocks, "nick", "box", 1))).toEqual({ order: [], prefix: [] });
  });

  it("never breaks the prefix rule by removing a repeating group but keeping its contents", () => {
    const blocks = withCondition(withCondition(clinic(), "note", "amount"), "amount", "name");
    expect(structureBreaks(blocks, unwrapGroup(blocks, "payments"))).toEqual({ order: [], prefix: [] });
    expect(structureBreaks(blocks, unwrapGroup(blocks, "patients"))).toEqual({ order: [], prefix: [] });
  });

  it("lists every block breaking the prefix rule", () => {
    expect(ids(prefixBrokenDependents(withCondition(clinic(), "summary", "note")))).toEqual(["summary"]);
    expect(prefixBrokenDependents(withCondition(clinic(), "note", "name"))).toEqual([]);
  });

  it("keeps repeat-setting errors out of the Logic section's list, but not out of the save", () => {
    const blocks = [repeat("r", " ", [leaf("q")], { maxOccurs: 0 })];
    expect(problemsBesideContent({ blocks }, "r")).toEqual([]);
    expect(formProblems({ blocks })).toHaveLength(2);
    // A logic problem on the same group is still listed there.
    const withLogic = [leaf("a"), when(repeat("r", " ", [leaf("q")]), exists("q"))];
    expect(problemsBesideContent({ blocks: withLogic }, "r").map((p) => p.detail)).toEqual([
      'a condition depends on "Q", which is inside this group. A group can\'t depend on its own questions.',
    ]);
  });
});
