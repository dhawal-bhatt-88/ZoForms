import { describe, expect, it } from "vitest";
import {
  applyImport,
  canApplyImport,
  parseOptionFile,
  previewImport,
  replaceBlockers,
  type Block,
  type ImportRow,
  type Option,
} from "./index";

const raw = (...pairs: [string, string][]): Option[] => pairs.map(([code, label]) => ({ code, label }));
const csv = (text: string) => parseOptionFile(text, "csv");
const rowsOf = (text: string, kind: "csv" | "txt" = "csv") => {
  const parsed = parseOptionFile(text, kind);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.rows.map(({ line, code, label }) => [line, code, label]);
};
const row = (line: number, code: string, label: string): ImportRow => ({ line, code, label });

/* ---------- reading the file ---------- */

describe(".txt files", () => {
  it("reads one label per non-blank line, trimmed, with its line number", () => {
    expect(rowsOf("Yes\n\n  No  \r\nNot sure\r\n\r\n", "txt")).toEqual([[1, "", "Yes"], [3, "", "No"], [4, "", "Not sure"]]);
  });

  it("ignores a leading byte-order mark", () => {
    expect(rowsOf("﻿Yes\nNo", "txt")).toEqual([[1, "", "Yes"], [2, "", "No"]]);
  });

  it("keeps commas and quotes: a .txt line is a label, never split", () => {
    expect(rowsOf('Married, "separated"', "txt")).toEqual([[1, "", 'Married, "separated"']]);
  });
});

describe(".csv files (RFC 4180)", () => {
  it("one column: labels", () => {
    expect(rowsOf("Yes\nNo\n")).toEqual([[1, "", "Yes"], [2, "", "No"]]);
  });

  it("two columns: code, then label, trimmed", () => {
    expect(rowsOf(" F32.1 , Major depressive disorder \nF41.1,Generalised anxiety")).toEqual([
      [1, "F32.1", "Major depressive disorder"],
      [2, "F41.1", "Generalised anxiety"],
    ]);
  });

  it("an empty code in a two-column row is left for generation", () => {
    expect(rowsOf(",Yes\n\"\",No")).toEqual([[1, "", "Yes"], [2, "", "No"]]);
  });

  it("quoted values may hold commas and doubled quotes", () => {
    expect(rowsOf('"married_sep","Married, separated"\nq,"He said ""hi"""')).toEqual([
      [1, "married_sep", "Married, separated"],
      [2, "q", 'He said "hi"'],
    ]);
  });

  it("quoted values may hold line breaks; the next row's line number counts them", () => {
    expect(rowsOf('a,"Line one\r\nline two"\r\nb,Next\nc,"x\ny\nz"\nd,Last')).toEqual([
      [1, "a", "Line one\r\nline two"],
      [3, "b", "Next"],
      [4, "c", "x\ny\nz"],
      [7, "d", "Last"],
    ]);
  });

  it("accepts CRLF, LF and lone CR row endings", () => {
    expect(rowsOf("a,A\r\nb,B\nc,C\rd,D")).toEqual([[1, "a", "A"], [2, "b", "B"], [3, "c", "C"], [4, "d", "D"]]);
  });

  it("ignores a leading byte-order mark, so a header after it is still found", () => {
    expect(rowsOf("﻿code,label\r\nyes,Yes")).toEqual([[2, "yes", "Yes"]]);
    expect(rowsOf('﻿"Yes"\nNo')).toEqual([[1, "", "Yes"], [2, "", "No"]]);
  });

  it("skips a header row: label, or code,label — ignoring case and spaces", () => {
    expect(rowsOf("label\nYes")).toEqual([[2, "", "Yes"]]);
    expect(rowsOf(" Code , LABEL \nyes,Yes")).toEqual([[2, "yes", "Yes"]]);
    expect(rowsOf("CODE,LA BEL\nyes,Yes")).toEqual([[2, "yes", "Yes"]]);
  });

  it("treats a header only as the first row, and nothing else as one", () => {
    expect(rowsOf("Yes\nlabel")).toEqual([[1, "", "Yes"], [2, "", "label"]]);
    expect(rowsOf("label,code\nyes,Yes")).toEqual([[1, "label", "code"], [2, "yes", "Yes"]]);
    expect(rowsOf("\n\nlabel\nYes")).toEqual([[4, "", "Yes"]]); // blank rows before it don't count
  });

  it("ignores blank rows, including rows of empty values", () => {
    expect(rowsOf("Yes\n\n,\n  \n\"\"\nNo\n\n")).toEqual([[1, "", "Yes"], [6, "", "No"]]);
  });

  it("refuses more than two columns, naming the line", () => {
    expect(csv("a,A\nb,B,extra")).toEqual({
      ok: false,
      message: "Line 2 has 3 columns. A file can have one column (labels) or two (code, then label).",
    });
  });

  it("refuses a quoted value that is never closed, naming the line it opens on", () => {
    expect(csv('a,A\nb,"Broken\nc,C\n')).toEqual({ ok: false, message: "Line 2: a quoted value is never closed. Check the quotes on that line." });
    expect(csv('"')).toEqual({ ok: false, message: "Line 1: a quoted value is never closed. Check the quotes on that line." });
  });

  it("keeps a stray quote inside an unquoted value as an ordinary character", () => {
    // Documented in parseOptionFile: only a quote that opens a value starts quoting.
    expect(rowsOf('tv,5" screen\nsaid,He said "hi"\nmid,a"b"c')).toEqual([
      [1, "tv", '5" screen'],
      [2, "said", 'He said "hi"'],
      [3, "mid", 'a"b"c'],
    ]);
    // A quote that opens a value always starts quoting, so it must be closed.
    expect(csv('end,"').ok).toBe(false);
  });

  it("refuses text after a closing quote, naming the line", () => {
    expect(csv('a,"Yes"please\n')).toEqual({
      ok: false,
      message: 'Line 1: there is text after a closing quote. Put the whole value inside the quotes, and write a quote inside it as "".',
    });
  });

  it("hints when the file looks semicolon-separated", () => {
    const parsed = csv("code;label\nyes;Yes\nno;No");
    expect(parsed.ok && parsed.hint).toMatch(/^This file looks semicolon-separated/);
    expect(parsed.ok && parsed.rows.map((r) => r.label)).toEqual(["code;label", "yes;Yes", "no;No"]);
  });

  it("gives no hint when only some rows have semicolons, or they're quoted inside two columns", () => {
    const some = csv("Yes;please\nNo");
    expect(some.ok && some.hint).toBeUndefined();
    const twoColumns = csv('a,"x;y"\nb,"p;q"');
    expect(twoColumns.ok && twoColumns.hint).toBeUndefined();
  });

  it("reads an empty file as no rows", () => {
    expect(rowsOf("")).toEqual([]);
    expect(rowsOf("﻿\r\n\r\n")).toEqual([]);
  });
});

/* ---------- the preview ---------- */

describe("previewImport", () => {
  it("shows codes as given or generated, reserving the file's codes first", () => {
    const preview = previewImport([row(1, "", "Yes"), row(2, "yes", "Yeah"), row(3, "", "No")], [], "add");
    expect(preview.map(({ code, label, generated }) => [code, label, generated])).toEqual([
      ["yes_2", "Yes", true],
      ["yes", "Yeah", false],
      ["no", "No", true],
    ]);
    expect(canApplyImport(preview)).toBe(true);
  });

  it("for Add, reserves the list's existing codes too; for Replace, it doesn't", () => {
    const existing = raw(["yes", "Absolutely"]);
    expect(previewImport([row(1, "", "Yes")], existing, "add")[0].code).toBe("yes_2");
    expect(previewImport([row(1, "", "Yes")], existing, "replace")[0].code).toBe("yes");
  });

  it("flags a missing label", () => {
    expect(previewImport([row(1, "x", "")], [], "add")[0].flags).toEqual(["No label."]);
  });

  it("flags an invalid code", () => {
    expect(previewImport([row(4, "no way", "No way")], [], "add")[0].flags).toEqual([
      'The code "no way" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.',
    ]);
  });

  it("flags a code or label used twice in the file, ignoring case, naming the first line", () => {
    const preview = previewImport([row(1, "a", "Yes"), row(2, "A", "Other"), row(5, "b", "YES")], [], "replace");
    expect(preview.map((r) => r.flags)).toEqual([[], ['The code "A" is also on line 1.'], ['The label "YES" is also on line 1.']]);
    expect(canApplyImport(preview)).toBe(false);
  });

  it("for Add, flags a code or label already in the list", () => {
    const existing = raw(["F32.1", "Depression"]);
    const preview = previewImport([row(1, "f32.1", "Low mood"), row(2, "x", " depression ")], existing, "add");
    expect(preview.map((r) => r.flags)).toEqual([
      ['The code "f32.1" is already used by the option "Depression".'],
      ['The label "depression" is already an option.'],
    ]);
    expect(previewImport([row(1, "f32.1", "Low mood")], existing, "replace")[0].flags).toEqual([]);
  });

  it("can't be applied with no rows", () => {
    expect(canApplyImport(previewImport([], [], "add"))).toBe(false);
  });

  it("applies: Add appends in file order; Replace replaces", () => {
    const existing = raw(["a", "A"]);
    const preview = previewImport([row(1, "", "C"), row(2, "b", "B")], existing, "add");
    expect(applyImport(existing, preview, "add")).toEqual(raw(["a", "A"], ["c", "C"], ["b", "B"]));
    expect(applyImport(existing, previewImport([row(1, "", "C")], existing, "replace"), "replace")).toEqual(raw(["c", "C"]));
  });

  it("handles 5,000 rows quickly", () => {
    const rows = Array.from({ length: 5000 }, (_, k) => row(k + 1, "", `Option number ${k % 2500}`));
    const started = performance.now();
    const preview = previewImport(rows, raw(["option_number_0", "Existing"]), "add");
    const ms = performance.now() - started;
    expect(preview).toHaveLength(5000);
    // Half the labels repeat, so 2,500 rows are flagged; the codes still never collide.
    expect(preview.filter((r) => r.flags.length).length).toBe(2500);
    expect(new Set(preview.map((r) => r.code.toLowerCase())).size).toBe(5000);
    expect(ms).toBeLessThan(500);
    console.log(`previewImport, 5,000 rows: ${ms.toFixed(1)} ms`);
  });
});

describe("replaceBlockers: Replace all is refused while a condition uses a code that would go", () => {
  const blocks = [
    { id: "dx", type: "choice", label: "Dx", required: false, options: raw(["dep", "Depression"], ["anx", "Anxiety"]) },
    { id: "a", type: "short", label: "A", required: false, enableWhen: [{ question: "dx", operator: "=", answer: "dep" }] },
    { id: "b", type: "short", label: "B", required: false, enableWhen: [{ question: "dx", operator: "=", answer: "anx" }] },
    { id: "c", type: "short", label: "C", required: false, enableWhen: [{ question: "dx", operator: "exists" }] },
  ] as unknown as Block[];

  it("names the blocks whose code isn't in the new file", () => {
    expect(replaceBlockers(blocks, "dx", ["dep", "other"]).map((b) => b.id)).toEqual(["b"]);
  });

  it("keeps conditions whose code is in the new file, and 'is answered' ones", () => {
    expect(replaceBlockers(blocks, "dx", ["anx", "dep"])).toEqual([]);
  });

  it("compares codes exactly", () => {
    expect(replaceBlockers(blocks, "dx", ["DEP", "anx"]).map((b) => b.id)).toEqual(["a"]);
  });
});
