import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ANSWERABLE_TYPES,
  COUNTRIES,
  MAX_FREE_TEXT_LENGTH,
  assertSchemaIntegrity,
  calculateScores,
  getVisibleBlockIds,
  type Block,
  type FieldValidator,
  type FormSchema,
} from "@zoworkhq/forms/core";
import { SOURCE_OPERATORS } from "@formbuilder/form-schema";
import { compileExamples, writeProject, type CodeExample } from "./code-examples";
import { CONTENT_DIR, getPage } from "./content";
import { markdownFor } from "./page-markdown";
import { looseForm, stores } from "./question-forms";
import { operatorsFor, questionValues, type QuestionValue } from "./question-values";

/*
 * The question pages' "For developers" sections (developer docs brief, scope
 * item 3), checked against the real package: every value, condition, score
 * and validator in question-values.json, on the page's own form, a real
 * download.
 */

const values = questionValues();
const entries = Object.entries(values);
const slugOf = (v: QuestionValue) => `build/question-types/${v.page}`;
const formOf = (v: QuestionValue) => looseForm(slugOf(v));
const blockOf = (v: QuestionValue) => formOf(v).blocks.find((b) => b.id === v.field)!;

describe("question-values.json", () => {
  it("has every answerable type with a question page, and multiselect has no page yet", () => {
    // Multi-select stays a [TODO] (the form file page) until Dhawal decides between it and Checkboxes.
    expect(Object.keys(values).sort()).toEqual([...ANSWERABLE_TYPES].filter((t) => t !== "multiselect").sort());
    const pages = fs.readdirSync(path.join(CONTENT_DIR, "build", "question-types")).filter((f) => f.endsWith(".mdx"));
    expect(entries.map(([, v]) => `${v.page}.mdx`).sort()).toEqual(pages.sort());
  });

  it.each(entries)("%s: the page's form has the question, and the page shows this section", (type, v) => {
    expect(blockOf(v)?.type).toBe(type);
    const page = getPage(slugOf(v))!;
    expect(page.body.split(`## For developers\n\n<ForDevelopers type="${type}" />\n`)).toHaveLength(2);
  });
});

describe("the values", () => {
  it.each(entries)("%s: what the browser sends is stored as the section says, and a validator gets it as sent", (_, v) => {
    let got: unknown;
    const recording: FieldValidator = { field: v.field, validate: ({ value }) => ((got = value), null) };
    expect(stores(formOf(v), v.example, { id: v.field, validators: [recording] })).toEqual({ state: "answered", value: v.stored });
    expect(got).toEqual(v.example);
  });

  // Each note below a stored value, and what proves it.
  const notes: Record<string, (v: QuestionValue, store: (value: unknown) => unknown) => void> = {
    short: (v, store) => {
      expect(v.storedNote).toContain('`" Demo "` is stored as `" Demo "`');
      expect(store(" Demo ")).toEqual({ state: "answered", value: " Demo " });
    },
    long: (v, store) => {
      expect(v.storedNote).toContain("at most 20,000 characters");
      expect(MAX_FREE_TEXT_LENGTH).toBe(20000);
      expect(store(" a ")).toEqual({ state: "answered", value: " a " });
      expect(store("x".repeat(20000))).toMatchObject({ state: "answered" });
      expect(store("x".repeat(20001))).toHaveProperty("errors");
    },
    email: (v, store) => {
      expect(v.storedNote).toContain("checked on the trimmed text, and the stored text keeps its spaces");
      expect(store(" client@example.org ")).toEqual({ state: "answered", value: " client@example.org " });
    },
    phone: (v, store) => expect(store(" 555 0100 ")).toEqual({ state: "answered", value: " 555 0100 " }),
    link: (v, store) => expect(store(" https://example.org ")).toEqual({ state: "answered", value: " https://example.org " }),
    number: (v, store) => {
      expect(v.storedNote).toContain('such as `"3"`, is also accepted, and stored as the number `3`');
      expect(store("3")).toEqual({ state: "answered", value: 3 });
    },
    scale: (v, store) => expect(store("4")).toEqual({ state: "answered", value: 4 }),
    rating: (v, store) => expect(store("5")).toEqual({ state: "answered", value: 5 }),
    date: (v, store) => {
      expect(v.storedNote).toContain("`2026-02-30` is refused");
      expect(store("2026-02-30")).toHaveProperty("errors");
    },
    time: (v, store) => {
      expect(v.storedNote).toContain("`HH:MM:SS`, from `00:00` to `23:59`, and stores it as sent");
      expect(store("09:30:15")).toEqual({ state: "answered", value: "09:30:15" });
      expect(store("23:59")).toMatchObject({ state: "answered" });
      expect(store("24:00")).toHaveProperty("errors");
    },
    country: (v, store) => {
      expect(v.storedNote).toContain("one of `COUNTRIES`");
      for (const country of COUNTRIES) expect(store(country)).toEqual({ state: "answered", value: country });
      expect(store("Demo Land")).toHaveProperty("errors");
    },
    checkbox: (v, store) => {
      expect(v.storedNote).toBe("The options keep the order they were sent in.");
      expect(store(["friday", "monday"])).toEqual({ state: "answered", value: [{ code: "friday", label: "Friday" }, { code: "monday", label: "Monday" }] });
    },
    ranking: (v, store) => {
      const sent = ["therapists_specialty", "cost", "distance_from_home", "appointment_availability"];
      expect((store(sent) as { value: { code: string }[] }).value.map((o) => o.code)).toEqual(sent);
    },
    matrix: (v, store) => {
      expect(v.storedNote).toBe("Only answered rows are listed, in the form's order.");
      const stored = store({ session: "satisfied", booking: "dissatisfied" }) as { value: { row: { code: string } }[] };
      expect(stored.value.map((r) => r.row.code)).toEqual(["booking", "session"]);
    },
    grid: (v, store) => {
      expect(v.storedNote).toContain("A choice cell is stored with its option's label, and a text cell as its text");
      const stored = store({ tuesday: { earliest_time: "After 4", available: "yes" }, monday: { session_format: "video" } });
      expect(stored).toEqual({
        state: "answered",
        value: [
          { row: { code: "monday", label: "Monday" }, cells: [{ column: { code: "session_format", label: "Session format" }, value: { code: "video", label: "Video" } }] },
          {
            row: { code: "tuesday", label: "Tuesday" },
            cells: [
              { column: { code: "available", label: "Available" }, value: { code: "yes", label: "Yes" } },
              { column: { code: "earliest_time", label: "Earliest time" }, value: "After 4" },
            ],
          },
        ],
      });
    },
  };

  it("has a check for every note", () => {
    expect(Object.keys(notes).sort()).toEqual(entries.filter(([, v]) => v.storedNote).map(([type]) => type).sort());
  });

  it.each(entries.filter(([, v]) => v.storedNote))("%s: the note below the stored value holds", (type, v) => {
    notes[type](v, (value) => stores(formOf(v), value, { id: v.field }));
  });
});

/** The page's form with one more question, shown only when `operator` passes. */
function withCondition(v: QuestionValue, operator: string, answer?: string | number): FormSchema {
  const form = formOf(v);
  const target = { id: "shown_when", type: "short", label: "Shown when", enableWhen: [{ id: "c1", question: v.field, operator, ...(answer === undefined ? {} : { answer }) }] };
  return { ...form, blocks: [...form.blocks, target as unknown as Block] };
}

const shows = (schema: FormSchema, field: string, value: unknown) => {
  assertSchemaIntegrity(schema);
  return getVisibleBlockIds(schema, { [field]: { state: "answered", value } }).has("shown_when");
};

describe("the conditions", () => {
  it.each(entries)("%s: the section lists the builder's operators, and has an answer to compare only when there are some", (type, v) => {
    expect(operatorsFor(type)).toEqual(SOURCE_OPERATORS[type as keyof typeof SOURCE_OPERATORS] ?? []);
    expect(v.conditionAnswer === null).toBe(operatorsFor(type).length === 0);
  });

  it.each(entries.filter(([type]) => operatorsFor(type).length === 0))("%s: the package refuses a condition on it", (_, v) => {
    expect(() => assertSchemaIntegrity(withCondition(v, "exists"))).toThrow(/enableWhen condition on block/);
  });

  it.each(entries.filter(([type]) => operatorsFor(type).length > 0))("%s: each operator the builder offers works on the example answer", (type, v) => {
    const operators = operatorsFor(type);
    const x = v.example;
    expect(shows(withCondition(v, "exists"), v.field, x)).toBe(true);
    if (Array.isArray(x)) {
      const block = blockOf(v) as { options: { code: string }[] };
      const unchosen = block.options.map((o) => o.code).find((c) => !x.includes(c));
      expect(operators).toEqual(["exists", "contains"]);
      for (const chosen of x as string[]) expect(shows(withCondition(v, "contains", chosen), v.field, x)).toBe(true);
      if (unchosen) expect(shows(withCondition(v, "contains", unchosen), v.field, x)).toBe(false);
      return;
    }
    const answer = x as string | number;
    expect(shows(withCondition(v, "=", answer), v.field, x)).toBe(true);
    expect(shows(withCondition(v, "!=", answer), v.field, x)).toBe(false);
    if (typeof answer === "number") {
      expect(operators).toEqual(["exists", "=", "!=", ">", "<", ">=", "<="]);
      expect(shows(withCondition(v, ">", answer - 1), v.field, x)).toBe(true);
      expect(shows(withCondition(v, "<", answer + 1), v.field, x)).toBe(true);
      expect(shows(withCondition(v, ">=", answer), v.field, x)).toBe(true);
      expect(shows(withCondition(v, "<=", answer), v.field, x)).toBe(true);
      expect(shows(withCondition(v, ">", answer), v.field, x)).toBe(false);
    } else {
      expect(operators).toEqual(["exists", "=", "!="]);
    }
  });

  it("text is matched exactly, as the text sections say", () => {
    for (const type of ["short", "email", "phone", "link"]) {
      const v = values[type];
      expect(v.conditionAnswer).toBe("The condition's `answer` is text, matched exactly: case and spaces count.");
      const answer = v.example as string;
      expect(shows(withCondition(v, "=", ` ${answer}`), v.field, answer), type).toBe(false);
      // A phone number has no letters to change.
      if (answer.toUpperCase() !== answer) expect(shows(withCondition(v, "=", answer.toUpperCase()), v.field, answer), type).toBe(false);
    }
  });

  it("a time is matched as text", () => {
    expect(values.time.conditionAnswer).toContain("`09:30` doesn't match `09:30:00`");
    expect(shows(withCondition(values.time, "=", "09:30"), values.time.field, "09:30:00")).toBe(false);
  });

  it("a country condition's answer is a name in COUNTRIES", () => {
    expect(values.country.conditionAnswer).toContain("exactly as in `COUNTRIES`");
    expect(shows(withCondition(values.country, "=", "Canada"), values.country.field, "Canada")).toBe(true);
  });

  it("a ranking passes for an option ranked in any place", () => {
    const v = values.ranking;
    const ranked = v.example as string[];
    expect(shows(withCondition(v, "contains", ranked[ranked.length - 1]), v.field, ranked)).toBe(true);
  });
});

/** The page's question inside a group with one score, `{ ref }` to it; option and column scores 1, 2, 3, … */
function scored(v: QuestionValue, unanswered: "no-score" | "zero" = "no-score", withScores = true): FormSchema {
  const form = formOf(v);
  const block = { ...blockOf(v) } as Record<string, unknown>;
  const number = (list: unknown) => (list as Record<string, unknown>[]).map((o, i) => ({ ...o, score: i + 1 }));
  if (withScores && v.scoring !== "columns" && Array.isArray(block.options)) block.options = number(block.options);
  if (withScores && v.scoring === "columns") block.columns = number(block.columns);
  const group = { id: "scored", type: "group", label: "Scored", blocks: [block], scores: [{ id: "total", label: "Total", formula: { ref: v.field }, unanswered }] };
  return { ...form, blocks: [group as unknown as Block] };
}

const scoreOf = (schema: FormSchema, field: string, value: unknown) => {
  assertSchemaIntegrity(schema);
  return calculateScores(schema, { [field]: { state: "answered", value } })[0].value;
};

describe("the scores", () => {
  it.each(entries.filter(([, v]) => v.scoring === null))("%s: the package refuses a formula that uses it", (_, v) => {
    expect(() => assertSchemaIntegrity(scored(v))).toThrow(/can't be scored/);
  });

  it.each(entries.filter(([, v]) => v.scoring !== null))("%s: it counts in a formula as the section says", (_, v) => {
    const block = blockOf(v) as { options?: { code: string }[]; columns?: { code: string }[] };
    const position = (list: { code: string }[] | undefined, code: string) => list!.findIndex((o) => o.code === code) + 1;
    const x = v.example;
    if (v.scoring === "answer") expect(scoreOf(scored(v), v.field, x)).toBe(x);
    if (v.scoring === "option") expect(scoreOf(scored(v), v.field, x)).toBe(position(block.options, x as string));
    if (v.scoring === "options") {
      const sum = (x as string[]).reduce((total, code) => total + position(block.options, code), 0);
      expect(scoreOf(scored(v), v.field, x)).toBe(sum);
    }
    if (v.scoring === "columns") {
      const all = Object.fromEntries(block.options!.map((row) => [row.code, "satisfied"]));
      expect(scoreOf(scored(v), v.field, all)).toBe(block.options!.length * position(block.columns, "satisfied"));
      // Two of four rows: no score, or 0 for each row left.
      const some = { booking: "satisfied", session: "very_satisfied" };
      expect(scoreOf(scored(v, "no-score"), v.field, some)).toBeNull();
      expect(scoreOf(scored(v, "zero"), v.field, some)).toBe(position(block.columns, "satisfied") + position(block.columns, "very_satisfied"));
    }
    // "Every option needs one", and every column.
    if (v.scoring !== "answer") expect(() => assertSchemaIntegrity(scored(v, "no-score", false))).toThrow(/needs a finite number score/);
  });
});

describe("the validators", () => {
  const withValidators = entries.filter(([, v]) => v.validator !== null);

  it("are strict JavaScript", () => {
    const examples: CodeExample[] = withValidators.map(([, v]) => ({
      page: slugOf(v),
      line: 0,
      lang: "js",
      code: v.validator!.code,
      words: { file: "validators.js", check: "browser" },
      check: "browser",
      file: "validators.js",
    }));
    for (const example of examples) writeProject(example.page, [example]);
    const { programs, errors } = compileExamples(examples);
    expect(programs).toEqual(["bundler, JavaScript"]);
    expect(errors).toEqual([]);
  });

  it.each(withValidators)("%s: the example refuses its failing answer with its message, and passes the other", async (_, v) => {
    const example: CodeExample = { page: slugOf(v), line: 0, lang: "js", code: v.validator!.code, words: {}, check: "browser", file: "validators.js" };
    const dir = writeProject(example.page, [example]);
    const { validators } = (await import(/* @vite-ignore */ pathToFileURL(path.join(dir, "validators.js")).href)) as { validators: FieldValidator[] };
    expect(stores(formOf(v), v.validator!.fails, { id: v.field, validators })).toEqual({ errors: [v.validator!.message] });
    expect(stores(formOf(v), v.validator!.passes, { id: v.field, validators })).toMatchObject({ state: "answered" });
  });
});

describe("the section on the page", () => {
  it.each(entries)("%s: comes out in the page's Markdown, its validator's fence without words", (_, v) => {
    const md = markdownFor(getPage(slugOf(v))!, "https://docs.example");
    const section = md.slice(md.indexOf("## For developers"), md.indexOf("## Troubleshooting"));
    expect(section).toContain(`**Payload.** The browser sends ${v.sends}:`);
    expect(section).toContain(JSON.stringify(v.field));
    expect(section).not.toContain("ForDevelopers");
    expect(section.includes("```js\n")).toBe(v.validator !== null);
    expect(section).not.toContain("file=");
  });
});
