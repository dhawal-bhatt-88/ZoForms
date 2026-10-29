import { describe, expect, it } from "vitest";
import {
  allBlockIds,
  deletionBlockers,
  dependentsOf,
  findBlock,
  FormArtifact,
  formProblems,
  FormSchema,
  insertBlockIntoTree,
  isAnswerable,
  isPresentationalType,
  moveBlockInTree,
  moveBreaks,
  newBlock,
  newBlockId,
  newGroup,
  questionNumbers,
  removeBlockFromTree,
  sameContent,
  unwrapGroup,
  updateBlockInTree,
  walkBlocks,
  MAX_GROUP_DEPTH,
  type Block,
  type Condition,
  type GroupBlock,
  type LeafBlock,
} from "./index";
import { templateProblems } from "./templates";
import { opts } from "./test-utils/options";

/* ---------- fixtures ---------- */

// Presentational blocks carry no `required`; every other leaf defaults to false.
const leaf = (id: string, type: LeafBlock["type"] = "short", extra: Partial<LeafBlock> = {}): LeafBlock =>
  ({
    id,
    type,
    label: id.toUpperCase(),
    ...(isPresentationalType(type) ? {} : { required: false }),
    ...extra,
  }) as LeafBlock;
const choice = (id: string) => leaf(id, "choice", { options: opts("Yes", "No") });
const group = (id: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock => ({
  id,
  type: "group",
  label: id.toUpperCase(),
  blocks,
  ...extra,
});
const on = (question: string, operator: Condition["operator"] = "exists", answer?: string | number): Condition =>
  answer === undefined ? { question, operator } : { question, operator, answer };
const when = <T extends Block>(block: T, ...enableWhen: Condition[]): T => ({ ...block, enableWhen });

const ids = (blocks: readonly Block[]) => walkBlocks(blocks).map((e) => e.block.id);
const problemsOf = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);

/** Five levels deep: root › L1 › L2 › L3 › L4, with a question at the bottom. */
const deep = (): Block[] => [
  leaf("q1"),
  group("l1", [leaf("q2"), group("l2", [group("l3", [leaf("q3"), group("l4", [leaf("q4")])])])]),
  leaf("q5"),
];

/* ---------- shape ---------- */

describe("group schema", () => {
  it("parses groups five levels deep and round-trips them", () => {
    const parsed = FormSchema.parse({ title: "t", blocks: deep() });
    expect(ids(parsed.blocks)).toEqual(["q1", "l1", "q2", "l2", "l3", "q3", "l4", "q4", "q5"]);
    const l4 = findBlock(parsed.blocks, "l4")!;
    expect(l4.depth).toBe(3);
    expect((l4.block as GroupBlock).blocks[0].id).toBe("q4");
  });

  it("keeps a group to the contract's shape: no required, no help text", () => {
    const parsed = FormSchema.parse({
      title: "t",
      blocks: [{ id: "g", type: "group", label: "G", required: true, description: "x", options: ["a"], blocks: [leaf("a")] }],
    });
    expect(Object.keys(parsed.blocks[0])).toEqual(["id", "type", "label", "blocks"]);
    // Leaves keep their existing shape, required default included.
    expect((parsed.blocks[0] as GroupBlock).blocks[0]).toMatchObject({ id: "a", required: false });
  });

  it("accepts conditions and 'any' on a group", () => {
    const parsed = FormSchema.parse({
      title: "t",
      blocks: [choice("c"), when(group("g", [leaf("a")], { enableBehavior: "any" }), on("c", "=", "yes"))],
    });
    expect(parsed.blocks[1]).toMatchObject({ enableBehavior: "any", enableWhen: [{ question: "c", operator: "=", answer: "yes" }] });
  });

  it("reports a bad block inside a group at its own path, not as a generic union error", () => {
    // Raw input: the blank label is the point, so it can't go through the typed helpers.
    const result = FormSchema.safeParse({
      title: "t",
      blocks: [
        { id: "g", type: "group", label: "G", blocks: [
          { id: "h", type: "group", label: "H", blocks: [{ id: "x", type: "short", label: "" }] },
        ] },
      ],
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    expect(issue.path).toEqual(["blocks", 0, "blocks", 0, "blocks", 0, "label"]);
  });

  it("rejects an unknown block type", () => {
    const result = FormSchema.safeParse({ title: "t", blocks: [{ id: "x", type: "carousel", label: "C" }] });
    expect(result.success).toBe(false);
  });

  it("stamps schemaVersion 2 on the artifact, and only 2", () => {
    const base = { title: "t", formId: "f", formVersionId: "v", blocks: deep() };
    expect(FormArtifact.parse({ ...base, schemaVersion: 2 }).schemaVersion).toBe(2);
    expect(FormArtifact.safeParse(base).success).toBe(false);
    expect(FormArtifact.safeParse({ ...base, schemaVersion: 1 }).success).toBe(false);
    expect(Object.keys(FormArtifact.parse({ ...base, schemaVersion: 2 })).slice(0, 4)).toEqual([
      "title",
      "formId",
      "formVersionId",
      "schemaVersion",
    ]);
  });

  it("compares nested content ignoring key order", () => {
    const a = { title: "t", blocks: [group("g", [leaf("a")])] };
    const shuffled = { blocks: [{ blocks: [{ required: false, label: "A", type: "short", id: "a" }], label: "G", type: "group", id: "g" }], title: "t" };
    expect(sameContent(a, shuffled)).toBe(true);
    const changed = { title: "t", blocks: [group("g", [leaf("a", "short", { label: "Changed" })])] };
    expect(sameContent(a, changed)).toBe(false);
  });

  it("gives presentational blocks no required, like groups — even if one is sent", () => {
    const parsed = FormSchema.parse({
      title: "t",
      blocks: ["divider", "heading", "title", "label", "hidden"].map((type) => ({
        id: type, type, label: type, required: true,
      })),
    });
    for (const block of parsed.blocks) expect(block, block.type).not.toHaveProperty("required");
  });

  it("keeps required defaulting to false for every other leaf, the untouched types included", () => {
    const types = ["short", "long", "text", "image", "video", "audio", "choice", "matrix"];
    const parsed = FormSchema.parse({ title: "t", blocks: types.map((type) => ({ id: type, type, label: type })) });
    for (const block of parsed.blocks) expect(block, block.type).toHaveProperty("required", false);
  });

  it("creates presentational blocks without required, questions with required: false", () => {
    for (const type of ["divider", "heading", "title", "label", "hidden"] as const) {
      expect(newBlock(type), type).not.toHaveProperty("required");
    }
    expect(newBlock("short")).toHaveProperty("required", false);
    expect(newBlock("text")).toHaveProperty("required", false);
  });

  it("gives a new group the contract's default label", () => {
    expect(newGroup()).toMatchObject({ type: "group", label: "Untitled group", blocks: [] });
  });
});

/* ---------- walker ---------- */

describe("walkBlocks", () => {
  it("visits depth-first, pre-order: a group before its children", () => {
    expect(ids(deep())).toEqual(["q1", "l1", "q2", "l2", "l3", "q3", "l4", "q4", "q5"]);
  });

  it("gives each block its order, depth, ancestors and path", () => {
    const q4 = walkBlocks(deep()).find((e) => e.block.id === "q4")!;
    expect(q4.order).toBe(7);
    expect(q4.depth).toBe(4);
    expect(q4.ancestors.map((a) => a.id)).toEqual(["l1", "l2", "l3", "l4"]);
    expect(q4.path).toEqual([1, 1, 0, 1, 0]);
  });

  it("collects every id in the tree, so new ids can't collide with nested ones", () => {
    const all = allBlockIds(deep());
    expect(all).toContain("q4");
    expect(all).toHaveLength(9);
    expect(all).not.toContain(newBlockId(all));
  });
});

/* ---------- numbering ---------- */

describe("questionNumbers", () => {
  it("numbers answerable questions 1…n across groups, skipping groups and presentational blocks", () => {
    const blocks: Block[] = [
      leaf("intro", "heading"),
      leaf("a"),
      group("g", [leaf("b", "email"), leaf("div", "divider"), group("h", [leaf("ref", "hidden"), leaf("c", "number")])]),
      leaf("note", "label"),
      leaf("d", "choice", { options: opts("x") }),
    ];
    expect([...questionNumbers(blocks)]).toEqual([["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  });

  it("treats groups, presentational blocks and hidden fields as not answerable", () => {
    expect(isAnswerable(group("g", [leaf("a")]))).toBe(false);
    for (const type of ["heading", "title", "label", "divider", "text", "hidden"] as const) {
      expect(isAnswerable(leaf("x", type))).toBe(false);
    }
    expect(isAnswerable(leaf("x", "short"))).toBe(true);
    expect(isAnswerable(leaf("x", "matrix"))).toBe(true);
  });
});

/* ---------- save rules ---------- */

describe("formProblems over the tree", () => {
  it("accepts conditions that point back in reading order, across and into groups", () => {
    expect(
      problemsOf(
        choice("c"),
        when(group("g", [leaf("a"), when(leaf("b"), on("a"))]), on("c", "=", "yes")),
        group("h", [group("i", [when(leaf("d"), on("b"))])]),
        when(leaf("e"), on("d")),
      ),
    ).toEqual([]);
  });

  it("rejects a source that comes later in reading order, even deep inside a later group", () => {
    const [message] = problemsOf(when(leaf("a"), on("q4")), ...deep());
    expect(message).toMatch(/^Block "A": a condition depends on "Q4", which comes after it\./);
  });

  it("rejects a group depending on its own contents", () => {
    const [message] = problemsOf(when(group("g", [group("h", [leaf("inner")])]), on("inner")));
    expect(message).toBe(
      'Group "G": a condition depends on "INNER", which is inside this group. A group can\'t depend on its own questions.',
    );
  });

  describe("nesting depth (contract §6, builder only)", () => {
    /** `levels` groups, each inside the one before: g1 › g2 › … with a question at the bottom. */
    const nested = (levels: number): GroupBlock => {
      let inner: Block = leaf("bottom");
      for (let level = levels; level >= 1; level--) inner = group(`g${level}`, [inner]);
      return inner as GroupBlock;
    };
    // Named by its path, as every structure rule names a block.
    const path = Array.from({ length: 21 }, (_, i) => `G${i + 1}`).join(" › ");
    const tooDeep = `Group "${path}": groups can be nested at most 20 deep, and this group is inside 20 others. Move it up a level.`;

    it("accepts groups nested 20 deep", () => {
      expect(MAX_GROUP_DEPTH).toBe(20);
      expect(problemsOf(nested(20))).toEqual([]);
    });

    it("refuses 21, naming the group that is too deep", () => {
      expect(problemsOf(nested(21))).toEqual([tooDeep]);
    });

    it("names only the outermost group too deep, however deep it goes", () => {
      expect(problemsOf(nested(60))).toEqual([tooDeep]);
    });

    it("doesn't count a page as a level", () => {
      expect(problemsOf({ id: "p", type: "page", title: "Page 1", blocks: [nested(20)] })).toEqual([]);
      expect(formProblems({ blocks: [{ id: "p", type: "page", title: "Page 1", blocks: [nested(21)] }] }).map((p) => p.detail)).toEqual([
        "groups can be nested at most 20 deep, and this group is inside 20 others. Move it up a level.",
      ]);
    });

    it("refuses a group template nested too deep", () => {
      expect(templateProblems("group", { title: "T", blocks: [nested(21)] })).toEqual([tooDeep]);
      expect(templateProblems("group", { title: "T", blocks: [nested(20)] })).toEqual([]);
    });
  });

  it("rejects a group as a condition source", () => {
    const [message] = problemsOf(group("g", [leaf("a")]), when(leaf("b"), on("g")));
    expect(message).toMatch(/^Block "B": "G" is a group block, which can't be used in a condition\./);
  });

  it("rejects duplicate ids anywhere in the tree, group ids included", () => {
    expect(problemsOf(leaf("x"), group("g", [group("h", [leaf("x")])]))[0]).toMatch(/same id "x"/);
    expect(problemsOf(group("x", [leaf("a")]), leaf("x"))[0]).toMatch(/same id "x"/);
  });

  it("rejects a blank group label, naming where the group is", () => {
    expect(problemsOf(group("g", [leaf("a")], { label: "  " }))).toEqual([
      "An unlabelled group at the top level: a group needs a label.",
    ]);
    expect(problemsOf(group("outer", [group("g", [leaf("a")], { label: "" })]))).toEqual([
      'An unlabelled group inside "OUTER": a group needs a label.',
    ]);
  });

  it("rejects an empty group at any depth", () => {
    expect(problemsOf(group("g", []))).toEqual(['Group "G": a group must contain at least one block.']);
    const nested = group("l1", [group("l2", [group("l3", [group("l4", [])])])]);
    expect(problemsOf(nested)).toEqual(['Group "L1 › L2 › L3 › L4": a group must contain at least one block.']);
  });

  it("keeps the existing condition rules for questions inside groups", () => {
    const [message] = problemsOf(group("g", [choice("c"), when(leaf("b"), on("c", "=", "Maybe"))]));
    expect(message).toBe('Block "G › B": the answer "Maybe" isn\'t the code of any option of "C".');
  });

  it("gives each problem a detail without the block's name, for inline display", () => {
    const [problem] = formProblems({ blocks: [group("g", [])] });
    expect(problem).toEqual({
      blockId: "g",
      message: 'Group "G": a group must contain at least one block.',
      detail: "a group must contain at least one block.",
    });
  });
});

/* ---------- guards ---------- */

describe("dependency guards over the tree", () => {
  it("finds dependents anywhere in the tree (delete, type change and option guards)", () => {
    const blocks = [choice("c"), group("l1", [group("l2", [group("l3", [when(leaf("deep"), on("c", "=", "yes"))])])])];
    expect(dependentsOf(blocks, "c").map((b) => b.id)).toEqual(["deep"]);
    const renamingYes = (c: Condition) => c.answer === "yes";
    expect(dependentsOf(blocks, "c", renamingYes).map((b) => b.id)).toEqual(["deep"]);
  });

  it("refuses deleting a group with its questions while something outside depends on one of them", () => {
    const blocks = [group("g", [group("h", [leaf("src")])]), when(leaf("out"), on("src"))];
    expect(deletionBlockers(blocks, "g").map((b) => b.id)).toEqual(["out"]);
  });

  it("allows deleting a group whose questions are only used inside it", () => {
    const blocks = [group("g", [leaf("src"), when(leaf("in"), on("src"))]), leaf("out")];
    expect(deletionBlockers(blocks, "g")).toEqual([]);
  });

  it("removes a group with everything inside it", () => {
    expect(ids(removeBlockFromTree(deep(), "l2"))).toEqual(["q1", "l1", "q2", "q5"]);
  });

  it("unwraps a group in place, keeping its children in order", () => {
    const blocks = [leaf("a"), group("g", [leaf("b"), group("h", [leaf("c")]), leaf("d")]), leaf("e")];
    const result = unwrapGroup(blocks, "g");
    expect(result.map((b) => b.id)).toEqual(["a", "b", "h", "d", "e"]);
    expect(ids(result)).toEqual(["a", "b", "h", "c", "d", "e"]);
  });

  it("unwraps a nested group into its parent, not the root", () => {
    const result = unwrapGroup(deep(), "l3");
    expect(ids(result)).toEqual(["q1", "l1", "q2", "l2", "q3", "l4", "q4", "q5"]);
    expect(findBlock(result, "q3")!.ancestors.map((a) => a.id)).toEqual(["l1", "l2"]);
  });

  it("never changes reading order when unwrapping, so it can't break a condition", () => {
    const blocks = [choice("c"), group("g", [when(leaf("a"), on("c")), leaf("b")]), when(leaf("z"), on("a"))];
    expect(moveBreaks(blocks, unwrapGroup(blocks, "g"))).toEqual([]);
  });

  it("moves a group with its whole subtree", () => {
    const moved = moveBlockInTree(deep(), "l2", null, 0);
    expect(ids(moved)).toEqual(["l2", "l3", "q3", "l4", "q4", "q1", "l1", "q2", "q5"]);
  });

  it("moves blocks into, out of and between groups", () => {
    const blocks = [leaf("a"), group("g", [leaf("b")]), group("h", [leaf("c")])];
    expect(ids(moveBlockInTree(blocks, "a", "g", 1))).toEqual(["g", "b", "a", "h", "c"]);
    expect(ids(moveBlockInTree(blocks, "b", null, 3))).toEqual(["a", "g", "h", "c", "b"]);
    expect(ids(moveBlockInTree(blocks, "b", "h", 0))).toEqual(["a", "g", "h", "b", "c"]);
  });

  it("refuses to move a group into itself or its own descendant", () => {
    expect(() => moveBlockInTree(deep(), "l1", "l1", 0)).toThrow(/into itself/);
    expect(() => moveBlockInTree(deep(), "l1", "l4", 0)).toThrow(/into itself/);
  });

  it("catches a move that breaks the ordering rule only through a nested descendant", () => {
    // D depends on a question four levels down inside G. Moving D above G — or G
    // below D — puts the source after its dependent, though neither D nor G is
    // itself a source.
    const blocks: Block[] = [
      group("g", [group("g2", [group("g3", [group("g4", [leaf("src")])])])]),
      when(leaf("d"), on("src")),
    ];
    expect(moveBreaks(blocks, moveBlockInTree(blocks, "d", null, 0)).map((b) => b.id)).toEqual(["d"]);
    expect(moveBreaks(blocks, moveBlockInTree(blocks, "g", null, 1)).map((b) => b.id)).toEqual(["d"]);
    // Moving the dependent into the same deep group, after its source, is fine.
    expect(moveBreaks(blocks, moveBlockInTree(blocks, "d", "g4", 1))).toEqual([]);
  });

  it("catches moving a source below the group whose contents depend on it", () => {
    // A question inside a group depends on a root question; moving the source
    // below the group breaks it.
    const blocks: Block[] = [leaf("src"), group("g", [when(leaf("inner"), on("src"))])];
    expect(moveBreaks(blocks, moveBlockInTree(blocks, "src", null, 1)).map((b) => b.id)).toEqual(["inner"]);
    expect(moveBreaks(blocks, moveBlockInTree(blocks, "src", "g", 0))).toEqual([]);
  });

  it("inserts into a nested group and updates a nested block without touching the input", () => {
    const original = deep();
    const inserted = insertBlockIntoTree(original, "l4", 0, leaf("new"));
    expect(findBlock(inserted, "new")!.ancestors.map((a) => a.id)).toEqual(["l1", "l2", "l3", "l4"]);
    const renamed = updateBlockInTree(original, "q4", (b) => ({ ...b, label: "Renamed" }));
    expect(findBlock(renamed, "q4")!.block.label).toBe("Renamed");
    expect(findBlock(original, "q4")!.block.label).toBe("Q4");
    expect(ids(original)).toEqual(["q1", "l1", "q2", "l2", "l3", "q3", "l4", "q4", "q5"]);
  });
});
