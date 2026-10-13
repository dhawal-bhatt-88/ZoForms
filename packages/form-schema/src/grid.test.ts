import { describe, expect, it } from "vitest";
import {
  addGridColumn,
  BLOCK_META,
  buildArtifact,
  canBeRequired,
  columnTypeChangeWarning,
  conditionAnswerOptions,
  fillCodeAt,
  fillCodes,
  formProblems,
  FormSchema,
  GridColumn,
  gridColumnName,
  isAnswerable,
  isChoiceColumn,
  moveGridColumn,
  newBlock,
  optionListAt,
  optionListProblems,
  problemsBesideContent,
  questionNumbers,
  removeGridColumn,
  sameContent,
  sourceOperators,
  updateGridColumn,
  withColumnType,
  withOptionList,
  type Block,
  type Condition,
  type GridBlock,
  type GridColumn as TGridColumn,
  type GroupBlock,
  type LeafBlock,
  type Option,
  type PageBlock,
} from "./index";
import { opts } from "./test-utils/options";

/* ---------- fixtures ---------- */

const raw = (...pairs: [string, string][]): Option[] => pairs.map(([code, label]) => ({ code, label }));
const q = (id: string, type: LeafBlock["type"], extra: Partial<LeafBlock> = {}): Block =>
  ({ id, type, label: id.toUpperCase(), required: false, ...extra }) as Block;
const when = (block: Block, ...enableWhen: Condition[]): Block => ({ ...block, enableWhen }) as Block;
const group = (id: string, blocks: Block[], extra: Partial<GroupBlock> = {}): GroupBlock => ({
  id, type: "group", label: id.toUpperCase(), blocks, ...extra,
});
const page = (id: string, blocks: Block[]): PageBlock =>
  ({ id, type: "page", title: id.toUpperCase(), blocks }) as unknown as PageBlock;
const parse = (...blocks: unknown[]) => FormSchema.parse({ title: "T", blocks });
const problemsOf = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);

/**
 * "Substance use": a radio, a dropdown and a text column, plus a second radio
 * — two of them required. Every code filled, so it saves as it is.
 */
const COLUMNS: TGridColumn[] = [
  { code: "first_age", label: "Age at first use", type: "text", required: true },
  { code: "frequency", label: "Frequency", type: "dropdown", options: opts("Daily", "Weekly", "Rarely") },
  { code: "recent", label: "Used in the last 30 days?", type: "radio", options: opts("Yes", "No"), required: true },
  { code: "help", label: "Sought help?", type: "radio", options: opts("Yes", "No", "Not sure") },
];
const grid = (extra: Partial<GridBlock> = {}): GridBlock => ({
  id: "g",
  type: "grid",
  label: "Substance use",
  rows: opts("Alcohol", "Cannabis", "Tobacco"),
  columns: COLUMNS,
  ...extra,
});

/** What must survive every column edit: each column's type, options and required. */
const kept = (c: TGridColumn) => ({ type: c.type, options: isChoiceColumn(c) ? c.options : undefined, required: c.required });
const expectKept = (after: readonly TGridColumn[], expected: readonly TGridColumn[]) =>
  expect(after.map(kept)).toEqual(expected.map(kept));

/* ---------- shape, defaults, normalisation ---------- */

describe("a new grid (contract §14.6)", () => {
  const block = newBlock("grid") as GridBlock;

  it("is labelled like other new questions and has three rows and one text column, codes empty", () => {
    expect(BLOCK_META.grid).toEqual({ label: "Grid", question: "Grid question" });
    expect(block.label).toBe("Grid question");
    expect(block.rows).toEqual(raw(["", "Row 1"], ["", "Row 2"], ["", "Row 3"]));
    expect(block.columns).toEqual([{ code: "", label: "Column 1", type: "text" }]);
  });

  it("has no grid-level required, options or completeRequired", () => {
    expect("required" in block).toBe(false);
    expect("options" in block).toBe(false);
    expect("completeRequired" in block).toBe(false);
  });

  it("can be saved as it is: its codes are generated then", () => {
    const form = parse(block);
    expect(formProblems(form)).toEqual([]);
    expect(form.blocks[0].rows).toEqual(raw(["row_1", "Row 1"], ["row_2", "Row 2"], ["row_3", "Row 3"]));
    expect(form.blocks[0].columns).toEqual([{ code: "column_1", label: "Column 1", type: "text" }]);
  });

  it("is an answerable, numbered question without a block-level Required", () => {
    expect(isAnswerable(block)).toBe(true);
    expect(canBeRequired(block)).toBe(false);
    expect(canBeRequired(newBlock("matrix"))).toBe(true);
    expect(canBeRequired(newBlock("text"))).toBe(false);
    expect(questionNumbers([q("a", "short"), block, q("b", "short")])).toEqual(
      new Map([["a", 1], [block.id, 2], ["b", 3]]),
    );
  });
});

describe("a grid when it is parsed (saved)", () => {
  it("stores the contract's shape (§14.1), in its key order", () => {
    const form = parse({ ...grid(), description: "In your life so far" });
    expect(JSON.stringify(form.blocks[0])).toBe(
      JSON.stringify({
        id: "g", type: "grid", label: "Substance use", description: "In your life so far",
        rows: opts("Alcohol", "Cannabis", "Tobacco"),
        columns: [
          { code: "first_age", label: "Age at first use", type: "text", required: true },
          { code: "frequency", label: "Frequency", type: "dropdown", options: opts("Daily", "Weekly", "Rarely") },
          { code: "recent", label: "Used in the last 30 days?", type: "radio", options: opts("Yes", "No"), required: true },
          { code: "help", label: "Sought help?", type: "radio", options: opts("Yes", "No", "Not sure") },
        ],
      }),
    );
  });

  it("drops grid-level required and completeRequired, question-only fields and empty help text", () => {
    const form = parse({ ...grid(), required: true, completeRequired: true, options: opts("x"), placeholder: "p", description: "" });
    expect(Object.keys(JSON.parse(JSON.stringify(form.blocks[0])))).toEqual(["id", "type", "label", "rows", "columns"]);
  });

  it("drops a text column's options, and a column's required: false", () => {
    const form = parse(grid({ columns: [
      { code: "a", label: "A", type: "text", options: opts("x"), required: false } as unknown as TGridColumn,
      { code: "b", label: "B", type: "radio", options: opts("x"), required: false },
    ] }));
    expect(form.blocks[0].columns).toEqual([
      { code: "a", label: "A", type: "text" },
      { code: "b", label: "B", type: "radio", options: opts("x") },
    ]);
  });

  it("trims codes and labels in all three lists", () => {
    const form = parse(grid({
      rows: raw([" alc ", " Alcohol "]),
      columns: [{ code: " f ", label: " Frequency ", type: "radio", options: raw([" d ", " Daily "]) }],
    }));
    expect(form.blocks[0].rows).toEqual(raw(["alc", "Alcohol"]));
    expect(form.blocks[0].columns).toEqual([{ code: "f", label: "Frequency", type: "radio", options: raw(["d", "Daily"]) }]);
  });

  it("refuses an unknown column type, a missing one, and a column that isn't an object", () => {
    const issue = (column: unknown) => {
      const result = FormSchema.safeParse({ title: "T", blocks: [{ ...grid(), columns: [COLUMNS[0], column] }] });
      expect(result.success).toBe(false);
      return result.error!.issues[0];
    };
    expect(issue({ code: "n", label: "Count", type: "number" })).toMatchObject({
      path: ["blocks", 0, "columns", 1, "type"],
      code: "invalid_union_discriminator",
      message: 'has the type "number", which a grid column can\'t have. A grid column\'s type is "radio", "dropdown" or "text".',
    });
    expect(issue({ code: "n", label: "Count" })).toMatchObject({
      message: 'has no type. A grid column\'s type is "radio", "dropdown" or "text".',
    });
    expect(issue("Count")).toMatchObject({
      path: ["blocks", 0, "columns", 1],
      message: "isn't an object with a code, a label and a type.",
    });
    expect(GridColumn.safeParse({ code: "a", label: "A", type: "date" }).success).toBe(false);
  });

  it("treats empty codes and the codes they'd get as the same content", () => {
    const empty = { title: "T", blocks: [grid({ rows: raw(["", "Alcohol"]), columns: [{ code: "", label: "Frequency", type: "radio", options: raw(["", "Daily"]) }] })] };
    const filled = { title: "T", blocks: [grid({ rows: raw(["alcohol", "Alcohol"]), columns: [{ code: "frequency", label: "Frequency", type: "radio", options: raw(["daily", "Daily"]) }] })] };
    expect(sameContent(empty, filled)).toBe(true);
  });

  it("counts any column edit as a change: order, type, required, options", () => {
    const base = { title: "T", blocks: [grid()] };
    const variant = (columns: TGridColumn[]) => ({ title: "T", blocks: [grid({ columns })] });
    expect(sameContent(base, variant(moveGridColumn(COLUMNS, 0, 1)))).toBe(false);
    expect(sameContent(base, variant(COLUMNS.map((c, k) => (k === 3 ? withColumnType(c, "dropdown") : c))))).toBe(false);
    expect(sameContent(base, variant(updateGridColumn(COLUMNS, 1, { required: true })))).toBe(false);
    expect(sameContent(base, variant(COLUMNS.map((c, k) => (k === 1 && isChoiceColumn(c) ? { ...c, options: c.options!.slice(1) } : c))))).toBe(false);
    expect(sameContent(base, variant(updateGridColumn(COLUMNS, 1, { required: undefined })))).toBe(true);
  });

  it("exports the grid exactly as stored, labels as data", () => {
    const html = "<img src=x onerror=alert(1)>";
    const form = parse(grid({ rows: raw(["", html]), columns: [{ code: "", label: html, type: "dropdown", options: raw(["", html]) }] }));
    const artifact = buildArtifact(form, { formId: "f", formVersionId: "v" });
    expect(artifact.blocks[0]).toEqual(form.blocks[0]);
    expect((artifact.blocks[0] as GridBlock).rows![0].label).toBe(html);
    expect((artifact.blocks[0] as GridBlock).columns![0]).toEqual({
      code: "img_srcx_onerroralert1", label: html, type: "dropdown", options: raw(["img_srcx_onerroralert1", html]),
    });
  });
});

/* ---------- code generation in all three lists (contract §13.3) ---------- */

describe("grid codes generated at save", () => {
  it("fills rows, columns and each column's options as separate lists, with collisions suffixed", () => {
    const form = parse(grid({
      rows: raw(["other", "Other"], ["", "Other!"]),
      columns: [
        { code: "other", label: "Other", type: "text" },
        { code: "", label: "Other!", type: "radio", options: raw(["other", "Other"], ["", "Other!"]) },
      ],
    }));
    const g = form.blocks[0] as GridBlock;
    expect(g.rows).toEqual(raw(["other", "Other"], ["other_2", "Other!"]));
    expect(g.columns!.map((c) => c.code)).toEqual(["other", "other_2"]);
    expect((g.columns![1] as { options: Option[] }).options).toEqual(raw(["other", "Other"], ["other_2", "Other!"]));
  });

  it("allows a column's option codes to repeat a row code and a column code", () => {
    const form = parse(grid({
      rows: raw(["", "Yes"], ["", "No"]),
      columns: [{ code: "", label: "Yes", type: "radio", options: raw(["", "Yes"], ["", "No"]) }],
    }));
    const g = form.blocks[0] as GridBlock;
    expect(g.rows!.map((r) => r.code)).toEqual(["yes", "no"]);
    expect(g.columns![0].code).toBe("yes");
    expect((g.columns![0] as { options: Option[] }).options.map((o) => o.code)).toEqual(["yes", "no"]);
    expect(formProblems(form)).toEqual([]);
  });

  it("reserves typed codes first and never regenerates an existing one", () => {
    const form = parse(grid({
      columns: [
        { code: "", label: "Frequency", type: "text" },
        { code: "frequency", label: "Something else", type: "text" },
      ],
    }));
    expect((form.blocks[0] as GridBlock).columns!.map((c) => c.code)).toEqual(["frequency_2", "frequency"]);
  });

  it("keeps every column's type, options and required while filling codes", () => {
    const blank = COLUMNS.map((c) => ({ ...c, code: "" }));
    const form = parse(grid({ columns: blank }));
    const columns = (form.blocks[0] as GridBlock).columns!;
    expect(columns.map((c) => c.code)).toEqual(["age_at_first_use", "frequency", "used_in_the_last_30_days", "sought_help"]);
    expectKept(columns, COLUMNS);
  });
});

/* ---------- the shared helpers that touch columns ---------- */

describe("fillCodes and fillCodeAt keep a column's other fields", () => {
  const blank = COLUMNS.map((c) => ({ ...c, code: "" }));

  it("fillCodes fills every empty code and keeps every column's type, options and required", () => {
    const filled = fillCodes(blank);
    expect(filled.map((c) => c.code)).toEqual(["age_at_first_use", "frequency", "used_in_the_last_30_days", "sought_help"]);
    expectKept(filled, COLUMNS);
  });

  it("fillCodeAt fills one column's code; every column keeps its fields", () => {
    for (let i = 0; i < blank.length; i += 1) {
      const filled = fillCodeAt(blank, i);
      expect(filled.map((c) => c.code)).toEqual(blank.map((c, k) => (k === i ? fillCodes(blank)[i].code : "")));
      expectKept(filled, COLUMNS);
    }
  });

  it("fillCodeAt avoids the other columns' codes and changes nothing when a code is there", () => {
    const columns: TGridColumn[] = [{ ...COLUMNS[0], code: "frequency" }, { ...COLUMNS[1], code: "" }];
    expect(fillCodeAt(columns, 1)[1]).toEqual({ ...COLUMNS[1], code: "frequency_2" });
    expect(fillCodeAt(COLUMNS, 1)).toEqual(COLUMNS);
  });

  it("still returns plain options for plain options", () => {
    expect(fillCodes(raw(["", "Yes"]))).toEqual(raw(["yes", "Yes"]));
    expect(fillCodeAt(raw(["", "Yes"]), 0)).toEqual(raw(["yes", "Yes"]));
  });

  it("leaves the input untouched", () => {
    const copy = JSON.stringify(blank);
    fillCodes(blank);
    fillCodeAt(blank, 2);
    expect(JSON.stringify(blank)).toBe(copy);
  });
});

describe("editing columns keeps every column's type, options and required", () => {
  it("updateGridColumn: a code, a label or required changes only that", () => {
    const code = updateGridColumn(COLUMNS, 2, { code: "last_30" });
    expect(code[2]).toEqual({ ...COLUMNS[2], code: "last_30" });
    expectKept(code, COLUMNS);

    const label = updateGridColumn(COLUMNS, 1, { label: "How often" });
    expect(label[1]).toEqual({ ...COLUMNS[1], label: "How often" });
    expectKept(label, COLUMNS);

    const on = updateGridColumn(COLUMNS, 3, { required: true });
    expect(on.map((c) => c.required)).toEqual([true, undefined, true, true]);
    expect(on.map((c) => (isChoiceColumn(c) ? c.options : undefined))).toEqual(COLUMNS.map((c) => (isChoiceColumn(c) ? c.options : undefined)));
    expect(on.map((c) => c.type)).toEqual(COLUMNS.map((c) => c.type));

    const off = updateGridColumn(COLUMNS, 0, { required: undefined });
    expect(off.map((c) => c.required)).toEqual([undefined, undefined, true, undefined]);
    expect(off.map((c) => c.type)).toEqual(COLUMNS.map((c) => c.type));
  });

  it("generating one column's code after its label is edited keeps all the others", () => {
    const edited = updateGridColumn(updateGridColumn(COLUMNS, 1, { code: "" }), 1, { label: "How often" });
    const filled = fillCodeAt(edited, 1);
    expect(filled[1].code).toBe("how_often");
    expectKept(filled, COLUMNS);
  });

  it("addGridColumn appends a text column, the next free 'Column n', empty code, not required", () => {
    const added = addGridColumn(COLUMNS);
    expect(added).toHaveLength(5);
    expect(added[4]).toEqual({ code: "", label: "Column 5", type: "text" });
    expectKept(added.slice(0, 4), COLUMNS);
    expect(addGridColumn([{ code: "", label: "Column 2", type: "text" }])[1].label).toBe("Column 3");
  });

  it("removeGridColumn removes one; the rest keep their fields, in order", () => {
    for (let i = 0; i < COLUMNS.length; i += 1) {
      const removed = removeGridColumn(COLUMNS, i);
      expect(removed.map((c) => c.code)).toEqual(COLUMNS.filter((_, k) => k !== i).map((c) => c.code));
      expectKept(removed, COLUMNS.filter((_, k) => k !== i));
    }
    expect(removeGridColumn([COLUMNS[0]], 0)).toEqual([]);
  });

  it("moveGridColumn swaps with a neighbour; each column carries its fields; the ends don't move", () => {
    const down = moveGridColumn(COLUMNS, 1, 1);
    expect(down.map((c) => c.code)).toEqual(["first_age", "recent", "frequency", "help"]);
    expectKept(down, [COLUMNS[0], COLUMNS[2], COLUMNS[1], COLUMNS[3]]);

    const up = moveGridColumn(COLUMNS, 3, -1);
    expect(up.map((c) => c.code)).toEqual(["first_age", "frequency", "help", "recent"]);
    expectKept(up, [COLUMNS[0], COLUMNS[1], COLUMNS[3], COLUMNS[2]]);

    expect(moveGridColumn(COLUMNS, 0, -1)).toEqual(COLUMNS);
    expect(moveGridColumn(COLUMNS, 3, 1)).toEqual(COLUMNS);
    expect(moveGridColumn(COLUMNS, 9, 1)).toEqual(COLUMNS);
  });

  it("returns new lists and leaves the input untouched", () => {
    const copy = JSON.stringify(COLUMNS);
    for (const next of [
      addGridColumn(COLUMNS), removeGridColumn(COLUMNS, 1), moveGridColumn(COLUMNS, 1, 1),
      updateGridColumn(COLUMNS, 1, { label: "x" }),
    ]) expect(next).not.toBe(COLUMNS);
    expect(JSON.stringify(COLUMNS)).toBe(copy);
  });
});

describe("changing a column's type (contract §14.6)", () => {
  const [text, dropdown, radio] = COLUMNS;

  it("between radio and dropdown keeps the options, code, label and required", () => {
    expect(withColumnType(radio, "dropdown")).toEqual({ ...radio, type: "dropdown" });
    expect(withColumnType(dropdown, "radio")).toEqual({ ...dropdown, type: "radio" });
  });

  it("from text seeds a new choice block's placeholder options, codes empty, keeping required", () => {
    expect(withColumnType(text, "radio")).toEqual({
      code: "first_age", label: "Age at first use", type: "radio", options: newBlock("choice").options, required: true,
    });
    expect((withColumnType(text, "dropdown") as { options: Option[] }).options).toEqual(raw(["", "Option 1"], ["", "Option 2"], ["", "Option 3"]));
  });

  it("to text removes the options and keeps code, label and required", () => {
    expect(withColumnType(radio, "text")).toEqual({ code: "recent", label: "Used in the last 30 days?", type: "text", required: true });
    expect(withColumnType(dropdown, "text")).toEqual({ code: "frequency", label: "Frequency", type: "text" });
  });

  it("to the same type is no change", () => {
    expect(withColumnType(radio, "radio")).toBe(radio);
  });

  it("changing one column's type leaves every other column's fields alone", () => {
    const next = COLUMNS.map((c, k) => (k === 3 ? withColumnType(c, "text") : c));
    expectKept(next.slice(0, 3), COLUMNS.slice(0, 3));
  });

  it("asks before a choice column becomes text, naming it and its option count", () => {
    expect(columnTypeChangeWarning(dropdown, 1, "text")).toBe('Change "Frequency" to short text? Its 3 options will be removed.');
    expect(columnTypeChangeWarning({ ...radio, label: " " }, 2, "text")).toBe('Change "Column 3" to short text? Its 2 options will be removed.');
    expect(columnTypeChangeWarning({ ...radio, options: opts("Yes") }, 2, "text")).toBe(
      'Change "Used in the last 30 days?" to short text? Its 1 option will be removed.',
    );
    expect(columnTypeChangeWarning(radio, 2, "dropdown")).toBeNull();
    expect(columnTypeChangeWarning(text, 0, "radio")).toBeNull();
    expect(columnTypeChangeWarning({ ...radio, options: [] }, 2, "text")).toBeNull();
  });
});

describe("reading and replacing a list by reference", () => {
  const g = grid();

  it("reads rows, columns and a column's options", () => {
    expect(optionListAt(g, { list: "rows" })).toEqual(g.rows);
    expect(optionListAt(g, { list: "columns" })).toEqual(COLUMNS);
    expect(optionListAt(g, { list: "options", column: 1 })).toEqual(opts("Daily", "Weekly", "Rarely"));
    expect(optionListAt(g, { list: "options", column: 0 })).toEqual([]); // a text column has none
    expect(optionListAt(q("m", "matrix", { options: opts("R"), columns: opts("C") }), { list: "columns" })).toEqual(opts("C"));
  });

  it("replacing the rows keeps every column", () => {
    const next = withOptionList(g, { list: "rows" }, opts("Alcohol")) as GridBlock;
    expect(next.rows).toEqual(opts("Alcohol"));
    expect(next.columns).toBe(g.columns);
  });

  it("replacing one column's options keeps that column's other fields and every other column", () => {
    const next = withOptionList(g, { list: "options", column: 2 }, opts("Yes", "No", "Unsure")) as GridBlock;
    expect(next.columns![2]).toEqual({ ...COLUMNS[2], options: opts("Yes", "No", "Unsure") });
    expectKept([next.columns![0], next.columns![1], next.columns![3]], [COLUMNS[0], COLUMNS[1], COLUMNS[3]]);
  });

  it("replacing the columns needs real columns: a column's code generated through it keeps every field", () => {
    const blank = COLUMNS.map((c, k) => (k === 1 ? { ...c, code: "" } : c));
    const next = withOptionList(grid({ columns: blank }), { list: "columns" }, fillCodeAt(blank, 1)) as GridBlock;
    expect(next.columns![1].code).toBe("frequency");
    expectKept(next.columns!, COLUMNS);
    expect(() => withOptionList(g, { list: "columns" }, opts("Plain"))).toThrow(/only be replaced by columns/);
  });

  it("refuses a column that has no options, and grid lists on other blocks", () => {
    expect(() => withOptionList(g, { list: "options", column: 0 }, opts("x"))).toThrow(/No radio or dropdown column/);
    expect(() => withOptionList(q("a", "choice", { options: opts("x") }), { list: "rows" }, opts("x"))).toThrow(/Only a grid/);
  });

  it("works as before on a choice block and a matrix", () => {
    expect((withOptionList(q("a", "choice", { options: opts("x") }), { list: "options" }, opts("y")) as LeafBlock).options).toEqual(opts("y"));
    expect((withOptionList(q("m", "matrix", { options: opts("R"), columns: opts("C") }), { list: "columns" }, opts("D")) as LeafBlock).columns).toEqual(opts("D"));
  });

  it("leaves the block untouched", () => {
    const copy = JSON.stringify(g);
    withOptionList(g, { list: "options", column: 1 }, opts("x"));
    withOptionList(g, { list: "rows" }, opts("x"));
    expect(JSON.stringify(g)).toBe(copy);
  });
});

/* ---------- the save checks (contract §14.4, §13.6) ---------- */

describe("grid save checks", () => {
  const S = 'Block "Substance use"';

  it("accepts a valid grid", () => {
    expect(problemsOf(grid())).toEqual([]);
  });

  it("refuses missing or empty rows", () => {
    expect(problemsOf(grid({ rows: undefined }))).toEqual([`${S}: it needs at least one row.`]);
    expect(problemsOf(grid({ rows: [] }))).toEqual([`${S}: it needs at least one row.`]);
  });

  it("refuses missing or empty columns", () => {
    expect(problemsOf(grid({ columns: undefined }))).toEqual([`${S}: it needs at least one column.`]);
    expect(problemsOf(grid({ columns: [] }))).toEqual([`${S}: it needs at least one column.`]);
  });

  it("refuses a radio or dropdown column with missing or empty options, naming the column", () => {
    const without = (k: number, options: Option[] | undefined) =>
      grid({ columns: COLUMNS.map((c, i) => (i === k ? ({ ...c, options } as TGridColumn) : c)) });
    expect(problemsOf(without(1, undefined))).toEqual([`${S}: column "Frequency" needs at least one option.`]);
    expect(problemsOf(without(2, []))).toEqual([`${S}: column "Used in the last 30 days?" needs at least one option.`]);
  });

  it("names a column with no label by its position", () => {
    const columns = COLUMNS.map((c, i) => (i === 1 ? ({ ...c, label: " ", options: [] } as TGridColumn) : c));
    expect(problemsOf(grid({ columns }))).toEqual([
      `${S}: column 2 (code "frequency") needs a label.`,
      `${S}: column 2 needs at least one option.`,
    ]);
    expect(gridColumnName({ label: "  Frequency " }, 1)).toBe('column "Frequency"');
    expect(gridColumnName({ label: 3 }, 1)).toBe("column 2");
  });

  it("checks the rows: label, code characters, duplicates", () => {
    expect(problemsOf(grid({ rows: raw(["a", "Alcohol"], ["b", " "]) }))).toEqual([`${S}: row 2 (code "b") needs a label.`]);
    expect(problemsOf(grid({ rows: raw(["a b", "Alcohol"]) }))).toEqual([
      `${S}: the code "a b" of row "Alcohol" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`,
    ]);
    expect(problemsOf(grid({ rows: raw(["a", "Alcohol"], ["A", "Cannabis"]) }))).toEqual([
      `${S}: the code "A" is used by more than one row ("Alcohol" and "Cannabis"). Codes must be unique, ignoring case.`,
    ]);
    expect(problemsOf(grid({ rows: raw(["a", "Alcohol"], ["b", " alcohol "]) }))).toEqual([
      `${S}: the label "alcohol" is used by more than one row. Labels must be unique, ignoring case.`,
    ]);
  });

  it("checks the columns' codes and labels as one list", () => {
    const columns = (...pairs: [string, string][]) => grid({ columns: pairs.map(([code, label]) => ({ code, label, type: "text" as const })) });
    expect(problemsOf(columns(["a", "Age"], ["b", ""]))).toEqual([`${S}: column 2 (code "b") needs a label.`]);
    expect(problemsOf(columns(["-a", "Age"]))).toEqual([
      `${S}: the code "-a" of column "Age" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`,
    ]);
    expect(problemsOf(columns(["age", "Age"], ["AGE", "Years"]))).toEqual([
      `${S}: the code "AGE" is used by more than one column ("Age" and "Years"). Codes must be unique, ignoring case.`,
    ]);
    expect(problemsOf(columns(["a", "Age"], ["b", "AGE "]))).toEqual([
      `${S}: the label "AGE" is used by more than one column. Labels must be unique, ignoring case.`,
    ]);
  });

  it("checks each column's options as its own list, naming the column", () => {
    const freq = (options: Option[]) => grid({ columns: [{ code: "f", label: "Frequency", type: "dropdown", options }] });
    expect(problemsOf(freq(raw(["d", "Daily"], ["w", ""])))).toEqual([`${S}: in column "Frequency", option 2 (code "w") needs a label.`]);
    expect(problemsOf(freq(raw(["d y", "Daily"])))).toEqual([
      `${S}: in column "Frequency", the code "d y" of option "Daily" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`,
    ]);
    expect(problemsOf(freq(raw(["d", "Daily"], ["D", "Weekly"])))).toEqual([
      `${S}: in column "Frequency", the code "D" is used by more than one option ("Daily" and "Weekly"). Codes must be unique, ignoring case.`,
    ]);
    expect(problemsOf(freq(raw(["d", "Daily"], ["w", "daily"])))).toEqual([
      `${S}: in column "Frequency", the label "daily" is used by more than one option. Labels must be unique, ignoring case.`,
    ]);
  });

  it("allows the same code in the rows, the columns and different columns' options", () => {
    expect(problemsOf(grid({
      rows: raw(["yes", "Yes"]),
      columns: [
        { code: "yes", label: "Yes", type: "radio", options: raw(["yes", "Yes"]) },
        { code: "no", label: "No", type: "dropdown", options: raw(["yes", "Yes"]) },
      ],
    }))).toEqual([]);
  });

  it("gives each problem its list, column, entry and field, for the editor", () => {
    const g = grid({ rows: raw(["a", ""]), columns: [{ code: "f", label: "Frequency", type: "radio", options: raw(["d", "Daily"], ["D", "Weekly"]) }] });
    expect(optionListProblems(g).map(({ list, column, index, field }) => ({ list, column, index, field }))).toEqual([
      { list: "rows", column: undefined, index: 0, field: "label" },
      { list: "options", column: 0, index: 1, field: "code" },
    ]);
    expect(optionListProblems(g)[1].detail).toBe(
      'In column "Frequency", the code "D" is used by more than one option ("Daily" and "Weekly"). Codes must be unique, ignoring case.',
    );
  });

  it("names the grid by its path inside pages and groups", () => {
    const blocks = [page("p", [group("meds", [grid({ rows: [] })])])];
    expect(problemsOf(...blocks)).toEqual(['Block "P › MEDS › Substance use": it needs at least one row.']);
  });

  it("keeps its list problems out of the Logic section, but not out of the save", () => {
    const g = grid({ rows: [] });
    expect(problemsBesideContent({ blocks: [g] }, "g")).toEqual([]);
    expect(problemsOf(g)).toHaveLength(1);
  });
});

/* ---------- conditions and placement (contract §3.3, §14.1) ---------- */

describe("grid and conditions", () => {
  const choice = q("c", "choice", { label: "Uses substances?", options: opts("Yes", "No") });

  it("is never a condition source", () => {
    expect(sourceOperators(grid())).toBeUndefined();
    expect(conditionAnswerOptions(grid())).toBeNull();
    for (const operator of ["exists", "=", "contains"] as const) {
      const c = operator === "exists" ? { question: "g", operator } : { question: "g", operator, answer: "alcohol" };
      expect(problemsOf(grid(), when(q("later", "short", { label: "Later" }), c))).toEqual([
        'Block "Later": "Substance use" is a grid block, which can\'t be used in a condition.',
      ]);
    }
  });

  it("is rejected as a source wherever the dependent is", () => {
    const blocks = [page("p1", [grid()]), page("p2", [group("g2", [when(q("x", "short", { label: "X" }), { question: "g", operator: "exists" })])])];
    expect(problemsOf(...blocks)).toEqual(['Block "P2 › G2 › X": "Substance use" is a grid block, which can\'t be used in a condition.']);
  });

  it("may carry its own condition", () => {
    const form = parse(choice, when(grid(), { question: "c", operator: "=", answer: "yes" }));
    expect(formProblems(form)).toEqual([]);
    expect(buildArtifact(form, { formId: "f", formVersionId: "v" }).blocks[1].enableWhen).toEqual([{ id: "c1", question: "c", operator: "=", answer: "yes" }]);
  });

  it("saves cleanly inside a repeating group, conditional on a question in the same entry", () => {
    const repeat = group("subs", [choice, when(grid(), { question: "c", operator: "=", answer: "yes" })], {
      repeats: true, repeatLabel: "substance", minOccurs: 0,
    });
    const form = parse(page("p", [repeat]));
    expect(formProblems(form)).toEqual([]);
    expect(questionNumbers(form.blocks).get("g")).toBe(2);
  });

  it("saves cleanly with its codes generated inside a repeating group", () => {
    const form = parse(group("subs", [grid({ rows: raw(["", "Alcohol"]), columns: [{ code: "", label: "Frequency", type: "radio", options: raw(["", "Daily"]) }] })], {
      repeats: true, repeatLabel: "entry",
    }));
    expect(formProblems(form)).toEqual([]);
    const g = (form.blocks[0] as GroupBlock).blocks[0] as GridBlock;
    expect(g.rows![0].code).toBe("alcohol");
    expect(g.columns![0]).toEqual({ code: "frequency", label: "Frequency", type: "radio", options: raw(["daily", "Daily"]) });
  });
});
