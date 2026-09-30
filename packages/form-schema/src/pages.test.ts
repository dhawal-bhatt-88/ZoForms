import { describe, expect, it } from "vitest";
import {
  allBlockIds,
  artifactNavigation,
  blockName,
  buildArtifact,
  deletePageKeepingContents,
  deletePageWithContents,
  deletionBlockers,
  describeBlockPath,
  findBlock,
  FormArtifact,
  formProblems,
  FormSchema,
  insertPageAfter,
  isAnswerable,
  isPaged,
  isPresentationalType,
  makePaged,
  moveBlockInTree,
  moveBreaks,
  movePage,
  navigationWithoutDefaults,
  newPage,
  pageContentsDestination,
  questionNumbers,
  removePaging,
  sameContent,
  sourceOperators,
  updateBlockInTree,
  walkBlocks,
  type Block,
  type Condition,
  type GroupBlock,
  type LeafBlock,
  type PageBlock,
  type PageEdit,
} from "./index";

/* ---------- fixtures ---------- */

const leaf = (id: string, type: LeafBlock["type"] = "short", extra: Partial<LeafBlock> = {}): LeafBlock =>
  ({
    id,
    type,
    label: id.toUpperCase(),
    ...(isPresentationalType(type) ? {} : { required: false }),
    ...extra,
  }) as LeafBlock;
const choice = (id: string) => leaf(id, "choice", { options: ["Yes", "No"] });
const group = (id: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock => ({
  id,
  type: "group",
  label: id.toUpperCase(),
  blocks,
  ...extra,
});
const page = (id: string, blocks: Block[], extra: Partial<PageBlock> = {}): PageBlock =>
  ({ id, type: "page", title: id.toUpperCase(), blocks, ...extra }) as unknown as PageBlock;
const on = (question: string, operator: Condition["operator"] = "exists", answer?: string | number): Condition =>
  answer === undefined ? { question, operator } : { question, operator, answer };
const when = <T extends Block>(block: T, ...enableWhen: Condition[]): T => ({ ...block, enableWhen });

const ids = (blocks: readonly Block[]) => walkBlocks(blocks).map((e) => e.block.id);
/** The tree, one entry per block, two spaces of indent per level. */
const shape = (blocks: readonly Block[]) =>
  walkBlocks(blocks).map((e) => `${"  ".repeat(e.depth)}${e.block.id}`).join(",");
const problemsOf = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
const ok = (edit: PageEdit) => {
  if (!edit.ok) throw new Error(`refused: ${edit.message}`);
  return edit.blocks;
};
const refusal = (edit: PageEdit) => {
  if (edit.ok) throw new Error("expected a refusal");
  return { message: edit.message, dependents: edit.dependents.map((b) => b.id) };
};

/** Three pages: P1 has the source; P2 is conditional on it; P3 has nested groups. */
const threePages = (): Block[] => [
  page("p1", [leaf("name"), choice("meds")]),
  when(page("p2", [leaf("drug")]), on("meds", "=", "Yes")),
  page("p3", [group("g", [leaf("dose"), group("h", [leaf("freq")])]), leaf("notes")]),
];

/* ---------- shape and parsing ---------- */

describe("page schema", () => {
  it("parses a page with nested groups, and walks into it", () => {
    const form = FormSchema.parse({ title: "t", blocks: threePages() });
    expect(shape(form.blocks)).toBe("p1,  name,  meds,p2,  drug,p3,  g,    dose,    h,      freq,  notes");
  });

  it("strips required, help text and label from a page", () => {
    const form = FormSchema.parse({
      title: "t",
      blocks: [{ id: "p", type: "page", title: "P", label: "L", required: true, description: "d", blocks: [leaf("a")] }],
    });
    expect(form.blocks[0]).toEqual({ id: "p", type: "page", title: "P", blocks: [leaf("a")] });
  });

  it("parses a page anywhere, so the rules can reject a misplaced one by name", () => {
    expect(FormSchema.safeParse({ title: "t", blocks: [group("g", [page("p", [leaf("a")])])] }).success).toBe(true);
  });

  it("isPaged: the root contains a page", () => {
    expect(isPaged(threePages())).toBe(true);
    expect(isPaged([group("g", [leaf("a")])])).toBe(false);
  });

  it("blockName: a page's title, anything else's label", () => {
    expect(blockName(page("p", []))).toBe("P");
    expect(blockName(group("g", []))).toBe("G");
    expect(blockName(leaf("a"))).toBe("A");
  });

  it("a page is not answerable, not numbered and not a condition source", () => {
    const p = page("p", [leaf("a")]);
    expect(isAnswerable(p)).toBe(false);
    expect(sourceOperators(p)).toBeUndefined();
  });

  it("numbers questions 1…n continuously across pages and groups", () => {
    const numbers = questionNumbers(threePages());
    expect([...numbers]).toEqual([
      ["name", 1], ["meds", 2], ["drug", 3], ["dose", 4], ["freq", 5], ["notes", 6],
    ]);
  });

  it("finds, updates and moves blocks inside pages", () => {
    const blocks = threePages();
    expect(findBlock(blocks, "freq")?.ancestors.map((a) => a.id)).toEqual(["p3", "g", "h"]);
    const renamed = updateBlockInTree(blocks, "freq", (b) => ({ ...b, label: "How often?" }) as Block);
    expect(findBlock(renamed, "freq")?.block.label).toBe("How often?");
    expect(blocks).toEqual(threePages()); // untouched
    const moved = moveBlockInTree(blocks, "notes", "p1", 0);
    expect(shape(moved)).toBe("p1,  notes,  name,  meds,p2,  drug,p3,  g,    dose,    h,      freq");
  });

  it("deletion guard sees inside pages", () => {
    expect(deletionBlockers(threePages(), "p1").map((b) => b.id)).toEqual(["p2"]);
  });
});

describe("enableBehavior normalisation", () => {
  it('stores only "any" or nothing: an explicit "all" is dropped', () => {
    const form = FormSchema.parse({
      title: "t",
      blocks: [
        choice("a"),
        { ...when(leaf("b"), on("a")), enableBehavior: "all" },
        { ...when(group("g", [leaf("c")]), on("a")), enableBehavior: "any" },
        { ...page("p", [leaf("d")]), enableBehavior: "all" },
      ],
    });
    const stored = JSON.parse(JSON.stringify(form));
    expect("enableBehavior" in stored.blocks[1]).toBe(false);
    expect(stored.blocks[2].enableBehavior).toBe("any");
    expect("enableBehavior" in stored.blocks[3]).toBe(false);
  });

  it('an explicit "all" is the same content as none', () => {
    const base = { title: "t", blocks: [choice("a"), when(leaf("b"), on("a"))] };
    const explicit = { title: "t", blocks: [choice("a"), { ...when(leaf("b"), on("a")), enableBehavior: "all" }] };
    expect(sameContent(base, explicit)).toBe(true);
  });
});

/* ---------- save rules ---------- */

describe("page save rules", () => {
  it("a valid paged form has no problems", () => {
    expect(problemsOf(...threePages())).toEqual([]);
  });

  it("rejects a page inside a group or another page, naming it by path", () => {
    expect(problemsOf(page("p1", [group("g", [page("inner", [leaf("a")])])]))).toEqual([
      'Page "P1 › G › INNER": a page can only be at the top level of the form, not inside a group or another page.',
    ]);
    expect(problemsOf(page("p1", [page("inner", [leaf("a")])]))).toEqual([
      'Page "P1 › INNER": a page can only be at the top level of the form, not inside a group or another page.',
    ]);
  });

  it("rejects a mixed root, naming every block outside a page", () => {
    expect(problemsOf(leaf("a"), page("p", [leaf("b")]), group("g", [leaf("c")]))).toEqual([
      'Block "A": this form has pages, so every block must be inside a page.',
      'Group "G": this form has pages, so every block must be inside a page.',
    ]);
  });

  it("rejects a blank page title", () => {
    expect(problemsOf(page("p1", [leaf("a")]), page("p2", [leaf("b")], { title: "  " }))).toEqual([
      "Page 2 (untitled): a page needs a title.",
    ]);
  });

  it("rejects an empty page", () => {
    expect(problemsOf(page("p1", [leaf("a")]), page("p2", []))).toEqual([
      'Page "P2": a page must contain at least one block.',
    ]);
  });

  it("a page can't be a condition source", () => {
    expect(problemsOf(page("p1", [leaf("a")]), page("p2", [when(leaf("b"), on("p1"))]))).toEqual([
      'Block "P2 › B": "P1" is a page block, which can\'t be used in a condition.',
    ]);
  });

  it("the first page can't have conditions", () => {
    expect(problemsOf(when(page("p1", [choice("a")]), on("a")), page("p2", [leaf("b")]))).toEqual([
      'Page "P1": the first page can\'t have conditions — it is always shown.',
    ]);
  });

  it("the ordering rule applies across pages", () => {
    // P1's question depends on P2's: the source comes after it.
    expect(problemsOf(page("p1", [when(leaf("a"), on("b"))]), page("p2", [leaf("b")]))).toEqual([
      'Block "P1 › A": a condition depends on "B", which comes after it. A condition can only use a question that comes before it.',
    ]);
    // A page can't depend on its own questions.
    expect(problemsOf(page("p1", [leaf("a")]), when(page("p2", [choice("b")]), on("b")))).toEqual([
      'Page "P2": a condition depends on "B", which is inside this page. A page can\'t depend on its own questions.',
    ]);
  });

  it("ids are unique across pages", () => {
    expect(problemsOf(page("p1", [leaf("a")]), page("p2", [leaf("a")]))).toEqual([
      'Block "P2 › A": another block has the same id "a". Block ids must be unique.',
    ]);
  });
});

describe("error naming: the full path, page title first", () => {
  it("names a question inside groups inside a page", () => {
    const [message] = problemsOf(
      page("p1", [choice("c")]),
      page("medication", [group("dosage", [when(leaf("how", "short", { label: "How often?" }), on("c", "=", "Maybe"))])], { title: "Medication" }),
    );
    expect(message).toBe('Block "Medication › DOSAGE › How often?": the answer "Maybe" isn\'t one of the options of "C".');
  });

  it("names groups by path too, with and without pages", () => {
    expect(problemsOf(group("a", [group("b", [])]))).toEqual(['Group "A › B": a group must contain at least one block.']);
    expect(problemsOf(page("p", [group("a", [])]))).toEqual(['Group "P › A": a group must contain at least one block.']);
  });

  it('unlabelled groups keep their "inside …" wording, within the path', () => {
    expect(problemsOf(page("p", [group("a", [group("x", [leaf("q")], { label: "" })])]))).toEqual([
      'An unlabelled group inside "P › A": a group needs a label.',
    ]);
    expect(problemsOf(page("p", [group("x", [when(leaf("q"), on("nope"))], { label: "" })]))).toEqual([
      'An unlabelled group inside "P": a group needs a label.',
      'Block "P › (unlabelled group) › Q": a condition refers to a question that isn\'t in this form (id "nope").',
    ]);
  });

  it("describeBlockPath places unnamed blocks by position", () => {
    expect(describeBlockPath([{ type: "page", title: "" }, { type: "short", label: "" }], [1, 3])).toBe(
      'Block 4 inside "Page 2 (untitled)"',
    );
    expect(describeBlockPath([{ type: "group", label: "" }], [0])).toBe("An unlabelled group at the top level");
  });
});

/* ---------- navigation ---------- */

describe("navigation", () => {
  const identity = { formId: "f", formVersionId: "v" };

  it("is stored at the top level, as the author left it, paged or not", () => {
    const form = FormSchema.parse({ title: "t", blocks: [leaf("a")], navigation: { reviewPage: true } });
    expect(form.navigation).toEqual({ reviewPage: true });
  });

  it("a paged form exports every field explicitly, with defaults when unset", () => {
    const navigation = buildArtifact({ title: "t", blocks: threePages() }, identity).navigation;
    expect(navigation).toEqual({ showProgress: true, progressStyle: "caption", reviewPage: false });
    expect(Object.keys(navigation!)).toEqual(["showProgress", "progressStyle", "reviewPage"]);
    expect(artifactNavigation({ blocks: threePages(), navigation: { showProgress: false, reviewPage: true } })).toEqual({
      showProgress: false,
      progressStyle: "caption",
      reviewPage: true,
    });
  });

  it('progressStyle: stored and exported as "bar" when the author picks it', () => {
    const form = FormSchema.parse({ title: "t", blocks: threePages(), navigation: { progressStyle: "bar" } });
    expect(form.navigation).toEqual({ progressStyle: "bar" });
    expect(buildArtifact(form, identity).navigation).toEqual({ showProgress: true, progressStyle: "bar", reviewPage: false });
  });

  it("progressStyle is exported even with progress off: the renderer only uses it when progress is on", () => {
    expect(artifactNavigation({ blocks: threePages(), navigation: { showProgress: false, progressStyle: "bar" } })).toEqual({
      showProgress: false,
      progressStyle: "bar",
      reviewPage: false,
    });
  });

  it("progressStyle accepts only caption or bar", () => {
    expect(FormSchema.safeParse({ title: "t", blocks: [], navigation: { progressStyle: "caption" } }).success).toBe(true);
    expect(FormSchema.safeParse({ title: "t", blocks: [], navigation: { progressStyle: "steps" } }).success).toBe(false);
  });

  it("a form without pages exports no progressStyle either", () => {
    const artifact = buildArtifact({ title: "t", blocks: [leaf("a")], navigation: { progressStyle: "bar" } }, identity);
    expect("navigation" in artifact).toBe(false);
  });

  it("a form without pages exports no navigation, even when the author set some", () => {
    const artifact = buildArtifact({ title: "t", blocks: [leaf("a")], navigation: { reviewPage: true } }, identity);
    expect("navigation" in artifact).toBe(false);
  });

  it("the artifact is stamped: identity after the title, schemaVersion 2", () => {
    const artifact = buildArtifact({ title: "t", blocks: threePages() }, identity);
    expect(Object.keys(artifact).slice(0, 4)).toEqual(["title", "formId", "formVersionId", "schemaVersion"]);
    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.blocks[1]).toEqual(threePages()[1]);
  });

  it("FormArtifact refuses navigation on an unpaged form, or none on a paged one", () => {
    const base = { title: "t", ...identity, schemaVersion: 2 };
    const full = { showProgress: true, progressStyle: "caption", reviewPage: false };
    expect(FormArtifact.safeParse({ ...base, blocks: [leaf("a")], navigation: full }).success).toBe(false);
    expect(FormArtifact.safeParse({ ...base, blocks: threePages() }).success).toBe(false);
    expect(FormArtifact.safeParse({ ...base, blocks: threePages(), navigation: full }).success).toBe(true);
    // Every field explicit: an artifact without progressStyle is refused.
    expect(FormArtifact.safeParse({ ...base, blocks: threePages(), navigation: { showProgress: true, reviewPage: false } }).success).toBe(false);
  });

  it("navigationWithoutDefaults drops default values, so switching back is no change", () => {
    expect(navigationWithoutDefaults({ showProgress: true, progressStyle: "caption", reviewPage: false })).toBeUndefined();
    expect(navigationWithoutDefaults(undefined)).toBeUndefined();
    expect(navigationWithoutDefaults({ showProgress: true, progressStyle: "bar", reviewPage: true })).toEqual({ progressStyle: "bar", reviewPage: true });
    expect(navigationWithoutDefaults({ showProgress: false, progressStyle: "bar" })).toEqual({ showProgress: false, progressStyle: "bar" });
  });

  it("navigation counts as content, for dirty state and NO_CHANGES", () => {
    const blocks = threePages();
    expect(sameContent({ title: "t", blocks }, { title: "t", blocks, navigation: { reviewPage: true } })).toBe(false);
    expect(sameContent({ title: "t", blocks }, { title: "t", blocks, navigation: { progressStyle: "bar" } })).toBe(false);
  });
});

/* ---------- page edits ---------- */

describe("make paged / add page / remove paging", () => {
  it("makePaged wraps every root block into one Untitled page", () => {
    const before = [leaf("a"), group("g", [leaf("b")])];
    const after = makePaged(before);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ type: "page", title: "Untitled page", blocks: before });
    expect(allBlockIds(before)).not.toContain(after[0].id);
    expect(problemsOf(...after)).toEqual([]);
    expect(() => makePaged(after)).toThrow(/already has pages/);
  });

  it("insertPageAfter adds a page right after the given one", () => {
    const blocks = threePages();
    const added = insertPageAfter(blocks, "p1", newPage(allBlockIds(blocks)));
    expect(added.map((b) => (b.type === "page" ? b.title : b.id))).toEqual(["P1", "Untitled page", "P2", "P3"]);
    expect(() => insertPageAfter(blocks, "name", newPage())).toThrow();
  });

  it("removePaging unwraps the only page, and refuses with more than one", () => {
    const one = [page("p", [leaf("a"), group("g", [leaf("b")])])];
    expect(shape(removePaging(one))).toBe("a,g,  b");
    expect(() => removePaging(threePages())).toThrow(/exactly one page/);
  });
});

describe("delete page, keeping its contents", () => {
  it("moves the contents to the end of the previous page", () => {
    const after = ok(deletePageKeepingContents(threePages(), "p3"));
    expect(shape(after)).toBe("p1,  name,  meds,p2,  drug,  g,    dose,    h,      freq,  notes");
    expect(pageContentsDestination(threePages(), "p3")?.id).toBe("p2");
  });

  it("moves the first page's contents to the start of the next page", () => {
    const blocks = [page("p1", [leaf("a")]), page("p2", [leaf("b")])];
    expect(shape(ok(deletePageKeepingContents(blocks, "p1")))).toBe("p2,  a,  b");
    expect(pageContentsDestination(blocks, "p1")?.id).toBe("p2");
  });

  it("drops the page's own conditions", () => {
    const after = ok(deletePageKeepingContents(threePages(), "p2"));
    expect(shape(after)).toBe("p1,  name,  meds,  drug,p3,  g,    dose,    h,      freq,  notes");
    expect(walkBlocks(after).some((e) => e.block.enableWhen)).toBe(false);
  });

  it("refuses when Page 2 is conditional and Page 1 goes: says why, and what to do", () => {
    const r = refusal(deletePageKeepingContents(threePages(), "p1"));
    expect(r.message).toBe(
      'Can\'t delete "P1" and keep its contents: "P2" would become the first page, and the first page can\'t have conditions — it is always shown. Remove the conditions on "P2" first.',
    );
    expect(r.dependents).toEqual(["p2"]);
  });

  it("refuses for the only page", () => {
    expect(refusal(deletePageKeepingContents([page("p", [leaf("a")])], "p")).message).toMatch(/only page\. Remove pages instead/);
  });
});

describe("delete page with its contents", () => {
  it("removes the page and everything in it", () => {
    expect(shape(ok(deletePageWithContents(threePages(), "p3")))).toBe("p1,  name,  meds,p2,  drug");
  });

  it("refuses while something outside depends on something inside", () => {
    const r = refusal(deletePageWithContents(threePages(), "p1"));
    expect(r.message).toBe('Can\'t delete "P1" and its contents — these questions outside it have conditions that depend on something inside it:');
    expect(r.dependents).toEqual(["p2"]);
  });

  it("a condition wholly inside the deleted page doesn't block it", () => {
    const blocks = [page("p1", [leaf("a")]), page("p2", [choice("b"), when(leaf("c"), on("b"))])];
    expect(shape(ok(deletePageWithContents(blocks, "p2")))).toBe("p1,  a");
  });

  it("refuses for the only page", () => {
    expect(refusal(deletePageWithContents([page("p", [leaf("a")])], "p")).message).toMatch(/only page/);
  });
});

describe("move page", () => {
  it("moves a page, with everything in it, up or down", () => {
    const after = ok(movePage(threePages(), "p3", -1));
    expect(after.map((b) => b.id)).toEqual(["p1", "p3", "p2"]);
    expect(shape(after)).toContain("p3,  g,    dose,    h,      freq,  notes");
  });

  it("refuses at either end", () => {
    expect(refusal(movePage(threePages(), "p1", -1)).message).toMatch(/already the first page/);
    expect(refusal(movePage(threePages(), "p3", 1)).message).toMatch(/already the last page/);
  });

  it("refuses to put a conditional page first", () => {
    const r = refusal(movePage(threePages(), "p2", -1));
    expect(r.message).toBe(
      'Can\'t move "P2" up: "P2" would become the first page, and the first page can\'t have conditions — it is always shown. Remove the conditions on "P2" first.',
    );
    expect(refusal(movePage(threePages(), "p1", 1)).dependents).toEqual(["p2"]);
  });

  it("refuses when it would break the ordering rule", () => {
    // P3's question depends on P2's; moving P3 above P2 puts it before its source.
    const blocks = [page("p1", [leaf("a")]), page("p2", [choice("b")]), page("p3", [when(leaf("c"), on("b"))])];
    const r = refusal(movePage(blocks, "p3", -1));
    expect(r.message).toBe('Can\'t move "P3" up — these questions would end up before a question their conditions depend on:');
    expect(r.dependents).toEqual(["c"]);
    expect(moveBreaks(blocks, [blocks[0], blocks[2], blocks[1]]).map((b) => b.id)).toEqual(["c"]);
  });
});

describe("tree edits leave their input untouched", () => {
  it("every page edit is pure", () => {
    const blocks = threePages();
    const snapshot = JSON.stringify(blocks);
    deletePageKeepingContents(blocks, "p3");
    deletePageWithContents(blocks, "p3");
    movePage(blocks, "p3", -1);
    insertPageAfter(blocks, "p1", newPage());
    expect(JSON.stringify(blocks)).toBe(snapshot);
    expect(ids(blocks)).toEqual(ids(threePages()));
  });
});
