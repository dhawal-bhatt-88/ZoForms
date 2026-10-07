import { describe, expect, it } from "vitest";
import {
  answerCode,
  buildArtifact,
  fillCodeAt,
  fillCodes,
  findBlock,
  formProblems,
  FormSchema,
  generateCode,
  newBlock,
  optionListProblems,
  optionsFromLabels,
  placeholderOptions,
  problemsBesideContent,
  renameOptionCode,
  sameContent,
  type Block,
  type Condition,
  type LeafBlock,
  type Option,
} from "./index";
import { opts } from "./test-utils/options";

const q = (id: string, type: LeafBlock["type"], extra: Partial<LeafBlock> = {}): Block =>
  ({ id, type, label: id.toUpperCase(), required: false, ...extra }) as Block;
const when = (block: Block, ...enableWhen: Condition[]): Block => ({ ...block, enableWhen }) as Block;
const raw = (...pairs: [string, string][]): Option[] => pairs.map(([code, label]) => ({ code, label }));
const problemsOf = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
const parse = (...blocks: unknown[]) => FormSchema.parse({ title: "T", blocks });

/* ---------- the generator (contract §13.3) ---------- */

describe("generateCode: the contract's table, exactly", () => {
  // [label, codes already in the list, 1-based position, expected]
  const table: [string, string[], number, string][] = [
    ["Not applicable", [], 1, "not_applicable"],
    ["Married, separated", [], 1, "married_separated"],
    ["Sí", [], 1, "si"],
    ["F32.1 Major depressive disorder", [], 1, "f32.1_major_depressive_disorder"],
    ["--Yes--", [], 1, "yes"],
    ["<script>alert(1)</script>", [], 1, "scriptalert1script"],
    ["焦虑", ["a", "b"], 3, "option_3"],
    ["Other!", ["other"], 2, "other_2"],
  ];
  it.each(table)("%s → %s", (label, taken, position, expected) => {
    expect(generateCode(label, taken, position)).toBe(expected);
  });
});

describe("generateCode: the steps", () => {
  it("collapses whitespace and underscores, and keeps . - _ inside", () => {
    expect(generateCode("  a _  b\t\nc  ", [], 1)).toBe("a_b_c");
    expect(generateCode("LA6568-5", [], 1)).toBe("la6568-5");
    expect(generateCode("a - b", [], 1)).toBe("a_-_b");
  });

  it("removes accents from any script that decomposes, and drops what doesn't", () => {
    expect(generateCode("Ça déjà vu", [], 1)).toBe("ca_deja_vu");
    expect(generateCode("Ñandú", [], 1)).toBe("nandu");
    expect(generateCode("😀", [], 4)).toBe("option_4");
  });

  it("cuts to 64 characters, then trims trailing separators again", () => {
    expect(generateCode("a".repeat(70), [], 1)).toBe("a".repeat(64));
    expect(generateCode(`${"a".repeat(63)} b`, [], 1)).toBe("a".repeat(63));
  });

  it("uses option_{n} when nothing is left", () => {
    expect(generateCode("", [], 1)).toBe("option_1");
    expect(generateCode("!!!", [], 7)).toBe("option_7");
    expect(generateCode("___", [], 2)).toBe("option_2");
  });

  it("appends the first free _2, _3 … on a clash, ignoring case", () => {
    expect(generateCode("Yes", ["YES"], 1)).toBe("yes_2");
    expect(generateCode("Yes", ["yes", "yes_2", "Yes_3"], 1)).toBe("yes_4");
    expect(generateCode("", ["option_3"], 3)).toBe("option_3_2");
  });

  it("shortens the base so a suffixed code stays within 64 characters", () => {
    const long = "a".repeat(64);
    expect(generateCode("a".repeat(70), [long], 1)).toBe(`${"a".repeat(62)}_2`);
    const ten = [long, ...Array.from({ length: 8 }, (_, k) => `${"a".repeat(62)}_${k + 2}`)];
    expect(generateCode("a".repeat(70), ten, 1)).toBe(`${"a".repeat(61)}_10`);
    expect(generateCode("a".repeat(70), ten, 1)).toHaveLength(64);
  });
});

describe("fillCodes", () => {
  it("fills only empty codes, in list order", () => {
    expect(fillCodes(raw(["", "Yes"], ["n", "No"], ["", "Not sure"]))).toEqual(raw(["yes", "Yes"], ["n", "No"], ["not_sure", "Not sure"]));
  });

  it("reserves typed and saved codes first, even ones later in the list", () => {
    expect(fillCodes(raw(["", "Yes"], ["yes", "Yeah"]))).toEqual(raw(["yes_2", "Yes"], ["yes", "Yeah"]));
  });

  it("reserves extra codes, as an import that adds to a list does", () => {
    expect(fillCodes(raw(["", "Yes"], ["", "No"]), ["YES"])).toEqual(raw(["yes_2", "Yes"], ["no", "No"]));
  });

  it("never takes a code it generated earlier in the same list", () => {
    expect(fillCodes(raw(["", "Yes"], ["", "yes"], ["", "YES!"]))).toEqual(raw(["yes", "Yes"], ["yes_2", "yes"], ["yes_3", "YES!"]));
  });

  it("trims codes, and treats a whitespace-only code as empty", () => {
    expect(fillCodes(raw([" F32.1 ", "Depression"], ["   ", "Anxiety"]))).toEqual(raw(["F32.1", "Depression"], ["anxiety", "Anxiety"]));
  });

  it("never regenerates: an existing code stays whatever its label says", () => {
    expect(fillCodes(raw(["yes", "Absolutely"]))).toEqual(raw(["yes", "Absolutely"]));
  });

  it("fills codes straight away for real labels (templates, import)", () => {
    expect(optionsFromLabels("Yes", "No")).toEqual(opts("Yes", "No"));
  });
});

/* ---------- placeholders and the editor's triggers (contract §13.3, §13.8) ---------- */

describe("placeholders start with empty codes", () => {
  it("a new block's options and a matrix's columns", () => {
    expect(newBlock("choice").options).toEqual(raw(["", "Option 1"], ["", "Option 2"], ["", "Option 3"]));
    expect(newBlock("matrix").options).toEqual(raw(["", "Option 1"], ["", "Option 2"], ["", "Option 3"]));
    expect(newBlock("matrix").columns).toEqual(raw(["", "Column 1"], ["", "Column 2"], ["", "Column 3"]));
  });

  it("an added option takes the next free placeholder label", () => {
    expect(placeholderOptions("Option", 1, raw(["", "Option 1"], ["", "Option 2"]))).toEqual(raw(["", "Option 3"]));
    // "Option 3" was kept after "Option 2" was removed: the next free one is "Option 4".
    expect(placeholderOptions("Option", 1, raw(["", "Option 1"], ["", "Option 3"]))).toEqual(raw(["", "Option 4"]));
  });
});

describe("fillCodeAt: one option's code, on leaving its label field", () => {
  it("fills an empty code from the label, reserving the list's other codes", () => {
    expect(fillCodeAt(raw(["", "Yes"], ["yes", "Yeah"]), 0)).toEqual(raw(["yes_2", "Yes"], ["yes", "Yeah"]));
    expect(fillCodeAt(raw(["", "No"], ["", "Maybe"]), 1)).toEqual(raw(["", "No"], ["maybe", "Maybe"]));
    expect(fillCodeAt(raw(["", "No"], ["", "焦虑"]), 1)).toEqual(raw(["", "No"], ["option_2", "焦虑"]));
  });

  it("never changes a code that is already there", () => {
    expect(fillCodeAt(raw(["option_1", "Yes"]), 0)).toEqual(raw(["option_1", "Yes"]));
  });

  it("scenario: add a block, rename “Option 1” to “Yes”, leave the field — the code is yes", () => {
    const block = newBlock("choice");
    const renamed = block.options!.map((o, i) => (i === 0 ? { ...o, label: "Yes" } : o));
    const left = fillCodeAt(renamed, 0);
    expect(left[0]).toEqual({ code: "yes", label: "Yes" });
    expect(left.slice(1).every((o) => o.code === "")).toBe(true);
  });
});

describe("answerCode: picking an option as a condition answer", () => {
  it("scenario: a condition on “Option 2”, label untouched, stores option_2; renaming the label later keeps it", () => {
    const blocks: Block[] = [newBlock("choice", { id: "a" } as Partial<LeafBlock>), q("b", "short")];
    const picked = answerCode(blocks, "a", 1);
    expect(picked.code).toBe("option_2");
    expect(picked.blocks[0].options).toEqual(raw(["", "Option 1"], ["option_2", "Option 2"], ["", "Option 3"]));
    // The editor then stores the condition and, later, the author renames the label.
    let form = picked.blocks.map((b) => (b.id === "b" ? when(b, { question: "a", operator: "=", answer: picked.code }) : b));
    form = form.map((b) => (b.id === "a" ? ({ ...b, options: b.options!.map((o, i) => (i === 1 ? { ...o, label: "Sometimes" } : o)) } as Block) : b));
    expect(fillCodeAt(form[0].options!, 1)[1]).toEqual({ code: "option_2", label: "Sometimes" });
    expect(formProblems({ blocks: form })).toEqual([]);
    // And the save fills the rest without touching it.
    expect(parse(...form).blocks[0].options).toEqual(raw(["option_1", "Option 1"], ["option_2", "Sometimes"], ["option_3", "Option 3"]));
  });

  it("returns an existing code as it is, changing nothing", () => {
    const blocks: Block[] = [q("a", "choice", { options: raw(["F32.1", "Depression"]) })];
    const picked = answerCode(blocks, "a", 0);
    expect(picked.code).toBe("F32.1");
    expect(picked.blocks).toEqual(blocks);
  });
});

describe("renameOptionCode: a code change carries its conditions with it", () => {
  const form = (): Block[] => [
    { id: "p1", type: "page", title: "One", blocks: [q("dx", "choice", { options: raw(["dep", "Depression"], ["anx", "Anxiety"]) })] },
    {
      id: "p2", type: "page", title: "Two",
      enableWhen: [{ question: "dx", operator: "=", answer: "dep" }],
      blocks: [
        { id: "g", type: "group", label: "Repeat", repeats: true, repeatLabel: "visit", minOccurs: 1,
          blocks: [when(q("a", "short"), { question: "dx", operator: "=", answer: "dep" }, { question: "dx", operator: "!=", answer: "anx" })] },
        when(q("b", "short"), { question: "dx", operator: "exists" }),
        when(q("c", "short"), { question: "other", operator: "=", answer: "dep" }),
      ],
    },
  ] as unknown as Block[];

  it("rewrites every condition using the old code — on other pages, in repeating groups — and counts them", () => {
    const { blocks, updated } = renameOptionCode(form(), "dx", "dep", "F32.1");
    expect(updated).toBe(2);
    expect(findBlock(blocks, "p2")!.block.enableWhen).toEqual([{ question: "dx", operator: "=", answer: "F32.1" }]);
    expect(findBlock(blocks, "a")!.block.enableWhen).toEqual([
      { question: "dx", operator: "=", answer: "F32.1" },
      { question: "dx", operator: "!=", answer: "anx" },
    ]);
  });

  it("leaves other codes, 'is answered' conditions and other sources' conditions alone", () => {
    const { blocks } = renameOptionCode(form(), "dx", "dep", "F32.1");
    expect(findBlock(blocks, "b")!.block.enableWhen).toEqual([{ question: "dx", operator: "exists" }]);
    expect(findBlock(blocks, "c")!.block.enableWhen).toEqual([{ question: "other", operator: "=", answer: "dep" }]);
  });

  it("matches the old code exactly, and does nothing for no change or an empty old code", () => {
    expect(renameOptionCode(form(), "dx", "DEP", "x").updated).toBe(0);
    expect(renameOptionCode(form(), "dx", "dep", "dep").updated).toBe(0);
    expect(renameOptionCode(form(), "dx", "", "x").updated).toBe(0);
  });

  it("leaves the input untouched", () => {
    const before = form();
    const copy = JSON.stringify(before);
    renameOptionCode(before, "dx", "dep", "F32.1");
    expect(JSON.stringify(before)).toBe(copy);
  });
});

/* ---------- parsing: what is stored ---------- */

describe("coded options when a form is parsed (saved)", () => {
  it("fills empty or missing codes and trims codes and labels", () => {
    const form = parse(q("a", "choice", { options: [{ label: " Yes " }, { code: "", label: "No" }, { code: " maybe ", label: "Maybe" }] as Option[] }));
    expect(form.blocks[0].options).toEqual(raw(["yes", "Yes"], ["no", "No"], ["maybe", "Maybe"]));
  });

  it("fills a matrix's rows and columns as separate lists", () => {
    const form = parse(q("m", "matrix", { options: raw(["", "Same"]), columns: raw(["", "Same"]) }));
    expect(form.blocks[0].options).toEqual(raw(["same", "Same"]));
    expect(form.blocks[0].columns).toEqual(raw(["same", "Same"]));
  });

  it("refuses plain-string options with a message naming the list", () => {
    const result = FormSchema.safeParse({ title: "T", blocks: [q("a", "choice", { options: ["Yes"] as never })] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]).toMatchObject({
      path: ["blocks", 0, "options", 0],
      message: "each option must be an object with a code and a label",
    });
  });

  it("stores and exports a label as data, never interpreted", () => {
    const html = "<img src=x onerror=alert(1)>";
    const form = parse(q("a", "choice", { options: [{ code: "", label: html }, { code: "x", label: "<b>bold</b> & 'quotes'" }] as Option[] }));
    expect(form.blocks[0].options).toEqual(raw(["img_srcx_onerroralert1", html], ["x", "<b>bold</b> & 'quotes'"]));
    const artifact = buildArtifact(form, { formId: "f", formVersionId: "v" });
    expect(artifact.blocks[0].options![0].label).toBe(html);
    expect(JSON.stringify(artifact)).toContain(JSON.stringify(html));
  });

  it("treats empty codes and the codes they'd get as the same content", () => {
    const empty = { title: "T", blocks: [q("a", "choice", { options: raw(["", "Yes"], ["", "No"]) })] };
    expect(sameContent(empty, { title: "T", blocks: [q("a", "choice", { options: opts("Yes", "No") })] })).toBe(true);
    expect(sameContent(empty, { title: "T", blocks: [q("a", "choice", { options: raw(["y", "Yes"], ["", "No"]) })] })).toBe(false);
  });

  it("checks a condition after codes are filled", () => {
    const form = parse(q("a", "choice", { options: raw(["", "Yes"], ["", "No"]) }), when(q("b", "short"), { question: "a", operator: "=", answer: "yes" }));
    expect(formProblems(form)).toEqual([]);
  });
});

/* ---------- the save checks (contract §13.6) ---------- */

describe("coded list save checks", () => {
  const choice = (options: Option[] | undefined) => q("a", "choice", { label: "Diagnosis", options } as Partial<LeafBlock>);

  it("accepts every coded type with valid lists", () => {
    const blocks = (["choice", "checkbox", "multiselect", "dropdown", "ranking"] as const).map((t, i) =>
      q(`b${i}`, t, { options: opts("Yes", "No") }),
    );
    expect(problemsOf(...blocks, q("m", "matrix", { options: opts("Row"), columns: opts("Col") }))).toEqual([]);
  });

  it("refuses a missing or empty list", () => {
    expect(problemsOf(choice(undefined))).toEqual(['Block "Diagnosis": it needs at least one option.']);
    expect(problemsOf(choice([]))).toEqual(['Block "Diagnosis": it needs at least one option.']);
  });

  it("refuses a matrix without rows or without columns, naming which", () => {
    expect(problemsOf(q("m", "matrix", { label: "Grid", options: opts("Row") } as Partial<LeafBlock>))).toEqual(['Block "Grid": it needs at least one column.']);
    expect(problemsOf(q("m", "matrix", { label: "Grid", options: [], columns: opts("Col") } as Partial<LeafBlock>))).toEqual(['Block "Grid": it needs at least one row.']);
  });

  it("refuses a blank label, naming the option and its code", () => {
    expect(problemsOf(choice(raw(["yes", "Yes"], ["no", "  "])))).toEqual(['Block "Diagnosis": option 2 (code "no") needs a label.']);
    expect(problemsOf(q("m", "matrix", { label: "Grid", options: opts("Row"), columns: raw(["c", ""]) } as Partial<LeafBlock>))).toEqual([
      'Block "Grid": column 1 (code "c") needs a label.',
    ]);
  });

  it("refuses a code outside the allowed characters, naming it", () => {
    const rule = (code: string, label: string, noun = "option") =>
      `Block "Diagnosis": the code "${code}" of ${noun} "${label}" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`;
    expect(problemsOf(choice(raw(["no way", "No way"])))).toEqual([rule("no way", "No way")]);
    expect(problemsOf(choice(raw([".hidden", "Hidden"])))).toEqual([rule(".hidden", "Hidden")]);
    expect(problemsOf(choice(raw(["a".repeat(65), "Long"])))).toEqual([rule("a".repeat(65), "Long")]);
    expect(problemsOf(choice(raw(["ça", "Ça"])))).toEqual([rule("ça", "Ça")]);
    expect(problemsOf(choice(raw(["F32.1", "Depression"], ["LA6568-5", "Lab"], ["44054006", "Diabetes"], ["a".repeat(64), "Max"])))).toEqual([]);
  });

  it("refuses duplicate codes, ignoring case, naming both options", () => {
    expect(problemsOf(choice(raw(["yes", "Yes"], ["YES", "Yeah"])))).toEqual([
      'Block "Diagnosis": the code "YES" is used by more than one option ("Yes" and "Yeah"). Codes must be unique, ignoring case.',
    ]);
  });

  it("refuses duplicate labels, ignoring case and surrounding whitespace", () => {
    expect(problemsOf(choice(raw(["a", "Yes"], ["b", " yes "])))).toEqual([
      'Block "Diagnosis": the label "yes" is used by more than one option. Labels must be unique, ignoring case.',
    ]);
  });

  it("checks a matrix's rows and columns separately: the same code in both is fine", () => {
    expect(problemsOf(q("m", "matrix", { options: opts("Same"), columns: opts("Same") }))).toEqual([]);
    expect(problemsOf(q("m", "matrix", { label: "Grid", options: opts("Same"), columns: raw(["x", "A"], ["X", "B"]) } as Partial<LeafBlock>))).toEqual([
      'Block "Grid": the code "X" is used by more than one column ("A" and "B"). Codes must be unique, ignoring case.',
    ]);
  });

  it("allows the same code in two different blocks", () => {
    expect(problemsOf(q("a", "choice", { options: opts("Yes") }), q("b", "checkbox", { options: opts("Yes") }))).toEqual([]);
  });

  it("refuses a condition answer that isn't exactly one of the source's codes", () => {
    const source = q("a", "choice", { label: "Diagnosis", options: raw(["44054006", "Diabetes"], ["F32.1", "Depression"]) } as Partial<LeafBlock>);
    const on = (answer: string | number) => problemsOf(source, when(q("b", "short"), { question: "a", operator: "=", answer }));
    expect(on("44054006")).toEqual([]);
    expect(on(44054006)).toEqual(['Block "B": the answer 44054006 isn\'t the code of any option of "Diagnosis".']);
    expect(on("Diabetes")).toEqual(['Block "B": the answer "Diabetes" isn\'t the code of any option of "Diagnosis".']);
    expect(on("f32.1")).toEqual(['Block "B": the answer "f32.1" isn\'t the code of any option of "Diagnosis".']);
  });

  it("refuses an operator a coded source doesn't allow", () => {
    const one = q("a", "dropdown", { options: opts("Yes") });
    const many = q("a", "multiselect", { options: opts("Yes") });
    const on = (source: Block, operator: Condition["operator"], answer?: string | number) =>
      problemsOf(source, when(q("b", "short"), { question: "a", operator, answer }))[0];
    expect(on(one, "=", "yes")).toBeUndefined();
    expect(on(one, "!=", "yes")).toBeUndefined();
    expect(on(one, "contains", "yes")).toMatch(/operator "contains" can't be used with "A" \(a dropdown question\)\. Allowed: exists, =, !=\./);
    expect(on(one, ">", 1)).toMatch(/operator ">" can't be used/);
    expect(on(many, "contains", "yes")).toBeUndefined();
    expect(on(many, "=", "yes")).toMatch(/operator "=" can't be used with "A" \(a multiselect question\)\. Allowed: exists, contains\./);
    expect(on(many, "<=", 2)).toMatch(/operator "<=" can't be used/);
  });

  it("names the block by its path, inside pages and groups", () => {
    const blocks = [
      { id: "p1", type: "page", title: "Visit", blocks: [{ id: "g", type: "group", label: "History", blocks: [choice(raw(["x", "A"], ["x", "B"]))] }] },
    ] as unknown as Block[];
    expect(problemsOf(...blocks)).toEqual([
      'Block "Visit › History › Diagnosis": the code "x" is used by more than one option ("A" and "B"). Codes must be unique, ignoring case.',
    ]);
  });

  it("gives each problem its list, option and field, for the editor", () => {
    const m = q("m", "matrix", { options: raw(["r", ""]), columns: raw(["bad code", "A"], ["c", "a"]) });
    expect(optionListProblems(m).map(({ list, index, field }) => ({ list, index, field }))).toEqual([
      { list: "options", index: 0, field: "label" },
      { list: "columns", index: 0, field: "code" },
      { list: "columns", index: 1, field: "label" },
    ]);
    expect(optionListProblems(m)[0].detail).toBe('Row 1 (code "r") needs a label.');
  });

  it("doesn't flag an empty code: it is generated", () => {
    expect(optionListProblems(choice(raw(["", "Yes"], ["", "No"])))).toEqual([]);
  });

  it("keeps list problems out of the Logic section, but not out of the save", () => {
    const blocks = [choice(raw(["x", "A"], ["x", "B"]))];
    expect(problemsBesideContent({ blocks }, "a")).toEqual([]);
    expect(formProblems({ blocks })).toHaveLength(1);
  });
});

/* ---------- completeRequired: matrix and ranking ---------- */

describe("completeRequired", () => {
  const matrix = (extra: Record<string, unknown> = {}) => ({ id: "m", type: "matrix", label: "Grid", required: false, options: opts("Sleep"), columns: opts("Always"), ...extra });
  const ranking = (extra: Record<string, unknown> = {}) => ({ id: "r", type: "ranking", label: "Rank", required: false, options: opts("A", "B"), ...extra });

  it("is kept on a matrix and a ranking, right after required, and exported", () => {
    const form = parse(matrix({ completeRequired: true }), ranking({ completeRequired: true }));
    expect(form.blocks.map((b) => b.completeRequired)).toEqual([true, true]);
    expect(Object.keys(form.blocks[0]).slice(0, 5)).toEqual(["id", "type", "label", "required", "completeRequired"]);
    const artifact = buildArtifact(form, { formId: "f", formVersionId: "v" });
    expect(artifact.blocks.map((b) => b.completeRequired)).toEqual([true, true]);
  });

  it("is dropped on any other type, where the renderer would silently treat it as required", () => {
    const form = parse({ id: "c", type: "choice", label: "C", required: false, options: opts("Yes"), completeRequired: true }, { id: "s", type: "short", label: "S", completeRequired: true });
    expect(form.blocks.every((b) => !("completeRequired" in b))).toBe(true);
  });

  it("drops false, so turning it on and off again is no change", () => {
    expect(parse(matrix({ completeRequired: false })).blocks[0]).not.toHaveProperty("completeRequired");
    expect(sameContent({ title: "T", blocks: [matrix()] }, { title: "T", blocks: [matrix({ completeRequired: false })] })).toBe(true);
    expect(sameContent({ title: "T", blocks: [matrix()] }, { title: "T", blocks: [matrix({ completeRequired: true })] })).toBe(false);
  });

  it("refuses a value that isn't true or false on a matrix or ranking", () => {
    expect(FormSchema.safeParse({ title: "T", blocks: [ranking({ completeRequired: "yes" })] }).success).toBe(false);
  });
});
