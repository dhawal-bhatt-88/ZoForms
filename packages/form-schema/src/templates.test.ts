import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  allBlockIds,
  buildArtifact,
  canInsertAsPage,
  cleanTemplateForm,
  findBlock,
  formFromTemplate,
  FormArtifact,
  formProblems,
  FormSchema,
  groupFromTemplate,
  insertBlockIntoTree,
  INSERT_AS_PAGE_UNAVAILABLE,
  isPresentationalType,
  logicTreeToText,
  logicWithout,
  normalizeConditions,
  outsideConditions,
  pageForTemplateGroup,
  parseLogicText,
  remapBlockIds,
  sameContent,
  templateAsForm,
  templateFromForm,
  templateProblems,
  walkBlocks,
  withoutOutsideConditions,
  withoutTemplateRefs,
  type Block,
  type Condition,
  type GroupBlock,
  type LeafBlock,
  type PageBlock,
} from "./index";
import { opts } from "./test-utils/options";

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
const repeat = (id: string, repeatLabel: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock =>
  group(id, blocks, { repeats: true, repeatLabel, minOccurs: 1, ...extra });
const page = (id: string, blocks: Block[]): PageBlock =>
  ({ id, type: "page", title: id.charAt(0).toUpperCase() + id.slice(1), blocks }) as unknown as PageBlock;
const when = (id: string, question: string, operator: Condition["operator"], answer?: string | number): Condition =>
  ({ id, question, operator, ...(answer === undefined ? {} : { answer }) }) as Condition;
const form = (blocks: Block[]) => ({ title: "Form", blocks });

/**
 * A deep group template: a repeating group inside a conditional group, another
 * repeat inside that, and conditions at every depth — flat AND, OR, and a
 * nested mix — on questions and on a group.
 */
function household(): GroupBlock {
  return group("house", [
    leaf("smoke", "choice", { options: opts("Yes", "No") }),
    group("smoking", [
      leaf("packs", "number"),
      repeat("members", "member", [
        leaf("mname"),
        leaf("mage", "number"),
        repeat("meds", "medicine", [
          leaf("drug"),
          leaf("dose", "short", {
            enableWhen: [when("c1", "drug", "exists"), when("c2", "mage", ">", 60), when("c3", "smoke", "=", "yes")],
            enableLogicText: "1 AND (2 OR 3)",
          }),
        ]),
        leaf("note", "long", {
          enableWhen: [when("c1", "mage", ">=", 18), when("c2", "packs", ">", 1)],
          enableLogicText: "1 OR 2",
        }),
      ]),
    ], { enableWhen: [when("c1", "smoke", "=", "yes")] }),
    leaf("end", "short", { enableWhen: [when("c1", "smoke", "=", "no")] }),
  ]);
}

/** Every block's id and every condition's question, in reading order. */
const ids = (blocks: readonly Block[]) => walkBlocks(blocks).map((e) => e.block.id);
const questions = (blocks: readonly Block[]) =>
  walkBlocks(blocks).flatMap((e) => (e.block.enableWhen ?? []).map((c) => c.question));
const template = (content: GroupBlock, version = 3) => ({ id: "tpl_1", version, name: "Household", content });

/* ---------- remapping ---------- */

describe("remapBlockIds", () => {
  it("gives every block in a deep tree a fresh id and remaps every condition to it", () => {
    const original = household();
    const { blocks, ids: map } = remapBlockIds([original], ["b_taken"]);
    const before = ids([original]);
    const after = ids(blocks);

    expect(after).toHaveLength(before.length);
    expect(new Set(after).size).toBe(after.length);
    for (const id of after) {
      expect(id).toMatch(/^b_[0-9a-z]{8}$/);
      expect(before).not.toContain(id);
      expect(id).not.toBe("b_taken");
    }
    // Same tree, block for block: only ids and condition sources differ, and those follow the map.
    expect(after).toEqual(before.map((id) => map.get(id)));
    expect(questions(blocks)).toEqual(questions([original]).map((q) => map.get(q)));
  });

  it("keeps condition ids, logic text, option codes, labels and everything else", () => {
    const original = household();
    const { blocks, ids: map } = remapBlockIds([original]);
    // Mapping the ids back gives the original exactly.
    const back = new Map([...map].map(([from, to]) => [to, from]));
    const restore = (block: Block): Block => {
      const next = { ...block, id: back.get(block.id)! } as Block;
      if (block.enableWhen) next.enableWhen = block.enableWhen.map((c) => ({ ...c, question: back.get(c.question)! }));
      return "blocks" in next ? ({ ...next, blocks: next.blocks.map(restore) } as Block) : next;
    };
    expect(blocks.map(restore)).toEqual([original]);
  });

  it("leaves a condition on a question outside the blocks alone, and doesn't touch its input", () => {
    const original = group("g", [leaf("q", "short", { enableWhen: [when("c1", "outside", "exists")] })]);
    const snapshot = JSON.stringify(original);
    const { blocks } = remapBlockIds([original]);
    expect(questions(blocks)).toEqual(["outside"]);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe("groupFromTemplate", () => {
  it("inserted twice into one form gives two valid, independent copies", () => {
    const tpl = template(household());
    let blocks: Block[] = [leaf("intro")];
    const first = groupFromTemplate(tpl, allBlockIds(blocks));
    blocks = insertBlockIntoTree(blocks, null, blocks.length, first);
    const second = groupFromTemplate(tpl, allBlockIds(blocks));
    blocks = insertBlockIntoTree(blocks, null, blocks.length, second);

    expect(formProblems(form(blocks))).toEqual([]);
    const a = new Set(ids([first]));
    const b = new Set(ids([second]));
    expect([...a].some((id) => b.has(id))).toBe(false);
    // Each copy's conditions use only its own questions.
    expect(questions([first]).every((q) => a.has(q))).toBe(true);
    expect(questions([second]).every((q) => b.has(q))).toBe(true);
    // Provenance on each copy's group, and nowhere else.
    expect(first.templateRef).toEqual({ id: "tpl_1", version: 3, name: "Household" });
    expect(walkBlocks(blocks).filter((e) => "templateRef" in e.block).map((e) => e.block.id)).toEqual([first.id, second.id]);
  });

  it("is valid inside a repeating group, and as a page in a paged form", () => {
    const tpl = template(household());
    const outer = repeat("visits", "visit", [leaf("when", "date")]);
    let blocks: Block[] = [outer];
    blocks = insertBlockIntoTree(blocks, "visits", 1, groupFromTemplate(tpl, allBlockIds(blocks)));
    expect(formProblems(form(blocks))).toEqual([]);

    let paged: Block[] = [page("first", [leaf("name")])];
    const g = groupFromTemplate(tpl, allBlockIds(paged));
    const p = pageForTemplateGroup(g, allBlockIds(paged));
    paged = [...paged, p];
    expect(p.title).toBe("House");
    expect(p.blocks).toEqual([g]);
    expect(new Set(allBlockIds(paged)).size).toBe(allBlockIds(paged).length);
    expect(formProblems(form(paged))).toEqual([]);
  });

  it("drops any template reference inside the template's content", () => {
    const inner = group("inner", [leaf("q")], { templateRef: { id: "other", version: 1, name: "Other" } });
    const copy = groupFromTemplate(template(group("outer", [inner])), []);
    expect(walkBlocks([copy]).filter((e) => "templateRef" in e.block)).toHaveLength(1);
    expect(copy.templateRef?.id).toBe("tpl_1");
  });
});

describe("canInsertAsPage", () => {
  it("only in a form with pages or an empty one", () => {
    expect(canInsertAsPage([])).toBe(true);
    expect(canInsertAsPage([page("p", [leaf("q")])])).toBe(true);
    expect(canInsertAsPage([leaf("q")])).toBe(false);
    expect(INSERT_AS_PAGE_UNAVAILABLE).toBe("This form has no pages. Add a page first or insert as a group.");
  });
});

describe("formFromTemplate", () => {
  it("copies the content with fresh ids and sets templateRef on the form", () => {
    const content = FormSchema.parse({
      title: "Survey",
      drafts: { mode: "device" },
      blocks: [household()],
      templateRef: { id: "older", version: 1, name: "Older" },
    });
    const made = formFromTemplate({ id: "sys_form_survey", version: 2, name: "Survey", content });
    expect(made.templateRef).toEqual({ id: "sys_form_survey", version: 2, name: "Survey" });
    expect(made.drafts).toEqual(content.drafts);
    expect(made.title).toBe("Survey");
    expect(ids(made.blocks).some((id) => ids(content.blocks).includes(id))).toBe(false);
    expect(formProblems(made)).toEqual([]);
  });
});

/* ---------- the self-contained check and the save rules ---------- */

/** As the API checks a template: as a form, parsed, conditions normalized. */
function check(kind: "form" | "group", content: unknown): string[] {
  const parsed = FormSchema.parse(templateAsForm(kind, content));
  return templateProblems(kind, { ...parsed, blocks: normalizeConditions(parsed.blocks) });
}

describe("templateProblems", () => {
  it("passes a self-contained group template, however deep", () => {
    expect(check("group", household())).toEqual([]);
  });

  it("refuses a condition on a question outside the template, at any depth", () => {
    const g = household();
    const deep = findBlock([g], "dose")!.block;
    deep.enableWhen = [...deep.enableWhen!, when("c4", "elsewhere", "exists")];
    deep.enableLogicText = "1 AND (2 OR 3) AND 4";
    expect(check("group", g)).toEqual([
      `Block "House › Smoking › Members › Meds › Dose": condition 4 refers to a question outside this template (id "elsewhere"). A template's conditions can only use questions inside it.`,
    ]);
  });

  it("refuses the root group's own conditions: outside it, or on its own questions", () => {
    const outside = group("root", [leaf("q")], { enableWhen: [when("c1", "before", "exists")] });
    expect(check("group", outside)).toEqual([
      `Group "Root": condition 1 refers to a question outside this template (id "before"). A template's conditions can only use questions inside it.`,
    ]);
    const own = group("root", [leaf("q")], { enableWhen: [when("c1", "q", "exists")] });
    expect(check("group", own)[0]).toMatch(/A group can't depend on its own questions/);
  });

  it("refuses group content that isn't exactly one group", () => {
    const parsed = FormSchema.parse({ title: "T", blocks: [leaf("q")] });
    expect(templateProblems("group", parsed)).toEqual(["A group template holds exactly one group, and nothing else."]);
    expect(templateProblems("group", { ...parsed, blocks: [group("a", [leaf("x")]), group("b", [leaf("y")])] })).toEqual([
      "A group template holds exactly one group, and nothing else.",
    ]);
    expect(check("group", page("p", [leaf("q")]))).toEqual(["A group template holds exactly one group, and nothing else."]);
  });

  it("applies every save rule a form has", () => {
    // Logic text.
    const badLogic = household();
    findBlock([badLogic], "note")!.block.enableLogicText = "1 AND";
    expect(check("group", badLogic)[0]).toMatch(/^Block "House › Smoking › Members › Note": /);
    // Integrity: a blank label, an empty group.
    expect(check("group", group("root", [group("empty", [], { label: " " })]))[0]).toMatch(/group needs a label/);
    // Codes.
    expect(check("group", group("root", [leaf("c", "choice", { options: [{ code: "x y", label: "A" }] })]))[0]).toMatch(/code/);
    // Grid.
    expect(check("group", group("root", [{ id: "g", type: "grid", label: "G", rows: opts("R"), columns: [] } as unknown as Block])).length).toBeGreaterThan(0);
    // Conditions: ordering, inside the template.
    expect(
      check("group", group("root", [leaf("a", "short", { enableWhen: [when("c1", "b", "exists")] }), leaf("b")]))[0],
    ).toMatch(/comes after it/);
    // Drafts, for a form template.
    expect(check("form", { title: "T", blocks: [leaf("q")], drafts: { mode: "server" } })[0]).toMatch(/needs a form with pages/);
  });

  it("words an outside reference in a form template the same way", () => {
    expect(check("form", form([leaf("q", "short", { enableWhen: [when("c1", "gone", "exists")] })]))).toEqual([
      `Block "Q": condition 1 refers to a question outside this template (id "gone"). A template's conditions can only use questions inside it.`,
    ]);
  });

  it("round-trips a group through templateAsForm and templateFromForm", () => {
    const g = household();
    const parsed = FormSchema.parse(templateAsForm("group", g));
    expect(templateFromForm("group", parsed)).toEqual(FormSchema.parse(form([g])).blocks[0]);
  });
});

/* ---------- saving a group from a form as a template ---------- */

describe("withoutOutsideConditions", () => {
  /** A form with a question before the group, the group using it at several depths. */
  function inForm() {
    const g = group("smoking", [
      leaf("years", "number"),
      leaf("packs", "number", {
        enableWhen: [when("c1", "age", ">=", 18), when("c2", "smokes", "=", "yes"), when("c3", "years", "exists")],
        enableLogicText: "1 AND (2 OR 3)",
      }),
      leaf("quit", "choice", {
        options: opts("Yes", "No"),
        enableWhen: [when("c1", "years", ">", 5), when("c2", "smokes", "=", "yes")],
        enableLogicText: "1 OR 2",
      }),
      leaf("why", "long", {
        enableWhen: [when("c1", "quit", "=", "yes"), when("c2", "age", ">", 30), when("c3", "packs", ">", 1)],
        enableLogicText: "(1 OR 2) AND 3",
      }),
    ], { enableWhen: [when("c1", "smokes", "=", "yes")] });
    const blocks: Block[] = [leaf("age", "number"), leaf("smokes", "choice", { options: opts("Yes", "No") }), g];
    return { blocks, g };
  }

  it("lists every outside condition, the group's own included", () => {
    const { g } = inForm();
    expect(outsideConditions([g]).map((o) => [o.block.id, o.number, o.condition.question])).toEqual([
      ["smoking", 1, "smokes"],
      ["packs", 1, "age"],
      ["packs", 2, "smokes"],
      ["quit", 2, "smokes"],
      ["why", 2, "age"],
    ]);
  });

  it("removes them from the copy, regenerates logic text from what is left, and leaves the form alone", () => {
    const { blocks, g } = inForm();
    const snapshot = JSON.stringify(blocks);
    const { group: copy, removed, rewritten } = withoutOutsideConditions(g);

    expect(removed).toHaveLength(5);
    expect(JSON.stringify(blocks)).toBe(snapshot);
    expect(copy.enableWhen).toBeUndefined();

    const get = (id: string) => findBlock([copy], id)!.block;
    // 1 AND (2 OR 3) without 1 and 2: only 3 is left, now 1; one condition has no text.
    expect(get("packs").enableWhen).toEqual([when("c3", "years", "exists")]);
    expect(get("packs").enableLogicText).toBeUndefined();
    // 1 OR 2 without 2: one left.
    expect(get("quit").enableWhen).toEqual([when("c1", "years", ">", 5)]);
    expect(get("quit").enableLogicText).toBeUndefined();
    // (1 OR 2) AND 3 without 2: 1 AND 3, renumbered 1 AND 2. Condition ids are kept.
    expect(get("why").enableWhen).toEqual([when("c1", "quit", "=", "yes"), when("c3", "packs", ">", 1)]);
    expect(get("why").enableLogicText).toBe("1 AND 2");

    expect(rewritten.map((r) => [r.block.id, r.before, r.after])).toEqual([
      ["packs", "1 AND (2 OR 3)", null],
      ["quit", "1 OR 2", null],
      ["why", "(1 OR 2) AND 3", "1 AND 2"],
    ]);
    expect(check("group", copy)).toEqual([]);
  });

  it("keeps nested logic where it can, with brackets as the generator writes them", () => {
    const g = group("g", [
      leaf("a"), leaf("b"), leaf("c"),
      leaf("d", "short", {
        enableWhen: [when("c1", "a", "exists"), when("c2", "out", "exists"), when("c3", "b", "exists"), when("c4", "c", "exists")],
        enableLogicText: "1 or (2 and 3) or (3 and 4)",
      }),
    ]);
    const { group: copy, rewritten } = withoutOutsideConditions(g);
    expect(findBlock([copy], "d")!.block.enableLogicText).toBe("1 OR 2 OR (2 AND 3)");
    expect(rewritten[0]).toMatchObject({ before: "1 or (2 and 3) or (3 and 4)", after: "1 OR 2 OR (2 AND 3)" });
    expect(check("group", copy)).toEqual([]);
  });

  it("changes nothing in a self-contained group", () => {
    const g = household();
    const result = withoutOutsideConditions(g);
    expect(result.removed).toEqual([]);
    expect(result.rewritten).toEqual([]);
    expect(result.group).toEqual(g);
  });
});

describe("logicWithout", () => {
  const without = (text: string, count: number, ...removed: number[]) => {
    const parsed = parseLogicText(text, count);
    if (!parsed.ok) throw new Error(parsed.error);
    const tree = logicWithout(parsed.tree, new Set(removed));
    return tree === null ? null : logicTreeToText(tree);
  };
  it.each([
    ["1 AND 2 AND 3", 3, [2], "1 AND 2"],
    ["1 OR (2 AND 3)", 3, [1], "1 AND 2"],
    ["1 OR (2 AND 3)", 3, [3], "1 OR 2"],
    ["(1 OR 2) AND (3 OR 4)", 4, [2, 3], "1 AND 2"],
    ["1 AND (2 OR (3 AND 4))", 4, [3], "1 AND (2 OR 3)"],
    ["1 AND (2 OR (3 AND 4))", 4, [2], "1 AND 2 AND 3"],
  ] as const)("%s without %j → %s", (text, count, removed, expected) => {
    expect(without(text, count, ...removed)).toBe(expected);
  });
  it("is null when nothing is left", () => {
    expect(without("1 AND 2", 2, 1, 2)).toBeNull();
  });
});

/* ---------- stored content: templateRef ---------- */

describe("templateRef", () => {
  const ref = { id: "t", version: 2, name: "T" };

  it("is kept in stored content, on the form and on a group, and counts as content", () => {
    const parsed = FormSchema.parse({ title: "F", templateRef: ref, blocks: [group("g", [leaf("q")], { templateRef: ref })] });
    expect(parsed.templateRef).toEqual(ref);
    expect((parsed.blocks[0] as GroupBlock).templateRef).toEqual(ref);
    expect(sameContent(parsed, { ...parsed, templateRef: undefined })).toBe(false);
    expect(normalizeConditions(parsed.blocks)[0]).toHaveProperty("templateRef", ref);
  });

  it("is never in the artifact, at any depth", () => {
    const content = {
      title: "F",
      templateRef: ref,
      blocks: [page("p", [group("g", [group("inner", [leaf("q")], { templateRef: ref })], { templateRef: ref })])],
    };
    const artifact = buildArtifact(content, { formId: "f", formVersionId: "v" });
    expect(JSON.stringify(artifact)).not.toContain("templateRef");
    expect(JSON.stringify(artifact)).not.toContain('"version":2');
  });

  it("is refused by the artifact schema if it gets there", () => {
    const artifact = buildArtifact({ title: "F", blocks: [group("g", [leaf("q")])] }, { formId: "f", formVersionId: "v" });
    const withRef = { ...artifact, blocks: [{ ...artifact.blocks[0], templateRef: ref }] };
    const result = FormArtifact.safeParse(withRef);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("the template reference is never part of the artifact");
  });

  it("withoutTemplateRefs strips it at every depth", () => {
    const blocks = [page("p", [group("g", [group("h", [leaf("q")], { templateRef: ref })], { templateRef: ref })])];
    expect(JSON.stringify(withoutTemplateRefs(blocks))).not.toContain("templateRef");
  });
});

describe("cleanTemplateForm", () => {
  it("strips template references and keeps the rest", () => {
    const content = FormSchema.parse({
      title: "F",
      templateRef: { id: "t", version: 1, name: "T" },
      navigation: { reviewPage: false },
      drafts: { mode: "device" },
      blocks: [group("g", [leaf("q")], { templateRef: { id: "t", version: 1, name: "T" } })],
    });
    const clean = cleanTemplateForm(content);
    expect(clean.templateRef).toBeUndefined();
    expect(clean.navigation).toEqual({ reviewPage: false });
    expect(clean.drafts).toEqual({ mode: "device" });
    expect(JSON.stringify(clean.blocks)).not.toContain("templateRef");
  });
});

/* ---------- the system template files ---------- */

describe("system templates (apps/api/prisma/templates)", () => {
  // The API seeds these at startup and refuses to start on a bad one; this catches it first.
  const dir = resolve(__dirname, "../../../apps/api/prisma/templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const read = (file: string) => JSON.parse(readFileSync(resolve(dir, file), "utf8"));

  it("exist, each with a unique sys_ id", () => {
    expect(files.length).toBeGreaterThan(0);
    const ids = files.map((f) => read(f).id);
    for (const id of ids) expect(id).toMatch(/^sys_[a-z0-9_]{1,60}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(files)("%s passes every template rule and is stored as cleaned", (file) => {
    const t = read(file);
    expect(["form", "group"]).toContain(t.kind);
    expect(t.name.trim()).not.toBe("");
    const parsed = FormSchema.parse(templateAsForm(t.kind, t.content));
    const normalized = { ...parsed, blocks: normalizeConditions(parsed.blocks) };
    expect(templateProblems(t.kind, normalized)).toEqual([]);
    expect(sameContent(cleanTemplateForm(parsed), parsed)).toBe(true);
    // Every coded list is coded already (contract §13), as the save would leave it.
    for (const { block } of walkBlocks(parsed.blocks)) {
      for (const option of block.options ?? []) expect(option.code).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
    }
  });
});
