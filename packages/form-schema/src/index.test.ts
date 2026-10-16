import { describe, expect, it } from "vitest";
import {
  Block,
  buildArtifact,
  formProblems,
  isPresentationalType,
  COUNTRY_OPTIONS,
  dependentsOf,
  emptyForm,
  FormSchema,
  misorderedDependents,
  newBlock,
  newBlockId,
  type LeafBlock as TBlock,
  type Condition,
} from "./index";
import { opts } from "./test-utils/options";

describe("emptyForm", () => {
  it("returns a titled form with no blocks", () => {
    expect(emptyForm()).toEqual({ title: "Untitled form", blocks: [] });
    expect(emptyForm("Survey").title).toBe("Survey");
  });
});

describe("newBlock", () => {
  it("seeds placeholder options, with empty codes, for option-type blocks", () => {
    expect(newBlock("choice").options).toEqual(opts("Option 1", "Option 2", "Option 3").map((o) => ({ ...o, code: "" })));
  });

  it("seeds columns for a matrix and min/max for a scale", () => {
    expect(newBlock("matrix").columns).toHaveLength(3);
    const scale = newBlock("scale");
    expect(scale.min).toBe(1);
    expect(scale.max).toBe(5);
  });

  it("does not seed options for a short-answer block", () => {
    expect(newBlock("short").options).toBeUndefined();
  });

  it("applies overrides last", () => {
    expect(newBlock("short", { label: "Your name", required: true })).toMatchObject({
      type: "short",
      label: "Your name",
      required: true,
    });
  });
});

describe("newBlockId", () => {
  it("never returns an id that is already taken", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const id = newBlockId(taken);
      expect(taken.has(id)).toBe(false);
      taken.add(id);
    }
  });

  it("keeps the b_ + 8 lowercase base-36 format", () => {
    expect(newBlockId()).toMatch(/^b_[0-9a-z]{8}$/);
  });

  it("is what newBlock uses, honouring taken ids", () => {
    const first = newBlock("short");
    expect(newBlock("short", undefined, [first.id]).id).not.toBe(first.id);
  });
});

/* ---------- conditional logic ---------- */

// Presentational blocks carry no `required`; every other leaf defaults to false.
const q = (id: string, type: TBlock["type"], extra: Partial<TBlock> = {}): TBlock =>
  ({
    id,
    type,
    label: id.toUpperCase(),
    ...(isPresentationalType(type) ? {} : { required: false }),
    ...extra,
  }) as TBlock;
const when = (block: TBlock, ...enableWhen: Condition[]): TBlock => ({ ...block, enableWhen });

describe("Condition schema", () => {
  const parse = (c: unknown) => Block.safeParse({ ...q("x", "short"), enableWhen: [c] }).success;

  it('"exists" must have no answer', () => {
    expect(parse({ question: "a", operator: "exists" })).toBe(true);
    expect(parse({ question: "a", operator: "exists", answer: "yes" })).toBe(false);
  });

  it("every other operator requires an answer", () => {
    expect(parse({ question: "a", operator: "=", answer: "yes" })).toBe(true);
    expect(parse({ question: "a", operator: ">", answer: 3 })).toBe(true);
    expect(parse({ question: "a", operator: "=" })).toBe(false);
  });

  it("rejects unknown operators and enableBehavior values", () => {
    expect(parse({ question: "a", operator: "~", answer: "x" })).toBe(false);
    expect(Block.safeParse({ ...q("x", "short"), enableBehavior: "some" }).success).toBe(false);
  });

  it("round-trips enableWhen exactly, in contract key order", () => {
    const parsed = FormSchema.parse({
      title: "t",
      blocks: [
        q("a", "choice", { options: opts("Yes", "No") }),
        {
          ...q("b", "short"),
          enableBehavior: "any",
          enableWhen: [{ answer: "yes", operator: "=", question: "a" }],
        },
      ],
    });
    expect(JSON.stringify(parsed.blocks[1].enableWhen)).toBe(
      '[{"question":"a","operator":"=","answer":"yes"}]',
    );
    expect(parsed.blocks[1].enableBehavior).toBe("any");
  });
});

describe("formProblems", () => {
  const choice = q("a", "choice", { options: opts("Yes", "No") });
  const problems = (...blocks: TBlock[]) => formProblems({ blocks }).map((p) => p.message);

  it("accepts a valid condition on a question above", () => {
    expect(problems(choice, when(q("b", "short"), { question: "a", operator: "=", answer: "yes" }))).toEqual([]);
  });

  it("rejects a reference to a block that isn't in the form", () => {
    expect(problems(when(q("b", "short"), { question: "zzz", operator: "exists" }))[0]).toMatch(
      /^Block "B": .*isn't in this form/,
    );
  });

  it("rejects a reference to a block below (which also rules out cycles)", () => {
    expect(problems(when(q("b", "short"), { question: "a", operator: "exists" }), choice)[0]).toMatch(
      /^Block "B": .*"A", which comes after it/,
    );
  });

  it("rejects a self-reference", () => {
    expect(problems(when(q("b", "short"), { question: "b", operator: "exists" }))[0]).toMatch(
      /^Block "B": .*the block itself/,
    );
  });

  it("rejects ineligible source types: matrix and layout blocks", () => {
    for (const type of ["matrix", "divider", "heading", "title", "label", "hidden"] as const) {
      // A matrix with rows and columns, so its only problem is the condition.
      const source = type === "matrix" ? q("a", type, { options: opts("Row"), columns: opts("Column") }) : q("a", type);
      expect(problems(source, when(q("b", "short"), { question: "a", operator: "exists" }))[0]).toMatch(
        new RegExp(`"A" is a ${type} block, which can't be used in a condition`),
      );
    }
  });

  it("enforces the operator table per source type", () => {
    const cond = (type: TBlock["type"], operator: Condition["operator"], answer?: string | number) =>
      problems(q("a", type, { options: opts("x") }), when(q("b", "short"), { question: "a", operator, answer }));
    expect(cond("short", ">", 1)[0]).toMatch(/operator ">" can't be used with "A" \(a short question\)/);
    expect(cond("short", "contains", "x")[0]).toMatch(/operator "contains"/);
    expect(cond("number", ">=", 3)).toEqual([]);
    expect(cond("rating", "<", 3)).toEqual([]);
    expect(cond("checkbox", "contains", "x")).toEqual([]);
    expect(cond("checkbox", "=", "x")[0]).toMatch(/operator "="/);
    expect(cond("ranking", "exists")).toEqual([]);
  });

  it("requires choice-type answers to be one of the source's options", () => {
    expect(problems(choice, when(q("b", "short"), { question: "a", operator: "=", answer: "Maybe" }))[0]).toMatch(
      /answer "Maybe" isn't the code of any option of "A"/,
    );
    const multi = q("m", "checkbox", { options: opts("Red") });
    expect(problems(multi, when(q("b", "short"), { question: "m", operator: "contains", answer: "Blue" }))[0]).toMatch(
      /answer "Blue"/,
    );
  });

  it("requires a number answer for >, <, >= and <=", () => {
    const num = q("n", "number");
    const gt = (answer: string | number) =>
      problems(num, when(q("b", "short"), { question: "n", operator: ">", answer }));
    expect(gt(3)).toEqual([]);
    expect(gt("abc")[0]).toMatch(/^Block "B": the operator ">" needs a number as its answer, but got "abc"\./);
    expect(gt("3")[0]).toMatch(/needs a number/); // a numeric string is still a string
    for (const operator of ["<", ">=", "<="] as const) {
      expect(problems(num, when(q("b", "short"), { question: "n", operator, answer: "x" }))[0]).toMatch(/needs a number/);
    }
    // = / != on a number source are not ordering operators, so they aren't covered by this rule
    expect(problems(num, when(q("b", "short"), { question: "n", operator: "=", answer: 3 }))).toEqual([]);
  });

  it("limits country answers to the fixed country list", () => {
    const country = q("c", "country");
    const is = (answer: string) =>
      problems(country, when(q("b", "short"), { question: "c", operator: "=", answer }));
    expect(is("India")).toEqual([]);
    expect(is("Other")).toEqual([]);
    expect(is("Narnia")[0]).toMatch(/answer "Narnia" isn't one of the options of "C"/);
    expect(is("india")[0]).toMatch(/isn't one of the options/); // exact match only
    expect(COUNTRY_OPTIONS).toHaveLength(16);
  });

  it("rejects duplicate block ids", () => {
    expect(problems(q("a", "short"), q("a", "email"))[0]).toMatch(/same id "a"/);
  });
});

describe("dependency guards", () => {
  const a = q("a", "choice", { options: opts("Yes", "No") });
  const b = when(q("b", "short"), { question: "a", operator: "=", answer: "yes" });
  const c = when(q("c", "short"), { question: "a", operator: "exists" });

  it("dependentsOf lists blocks with conditions on a source (the type-change and delete guards)", () => {
    expect(dependentsOf([a, b, c], "a").map((x) => x.id)).toEqual(["b", "c"]);
    expect(dependentsOf([a, b, c], "b")).toEqual([]);
  });

  it("dependentsOf can narrow to conditions whose answer an options change would break", () => {
    const newOptions = ["yes_please", "no"]; // the code "yes" changed
    const broken = dependentsOf([a, b, c], "a", (x) => typeof x.answer === "string" && !newOptions.includes(x.answer));
    expect(broken.map((x) => x.id)).toEqual(["b"]);
  });

  it("misorderedDependents flags a dependent moved above its source, or a source moved below", () => {
    expect(misorderedDependents([a, b, c])).toEqual([]);
    expect(misorderedDependents([b, a, c]).map((x) => x.id)).toEqual(["b"]);
    expect(misorderedDependents([b, c, a]).map((x) => x.id)).toEqual(["b", "c"]);
  });
});

describe("settings", () => {
  const old = {
    title: "Old",
    settings: {
      submitLabel: "Send",
      theme: { accent: "#123456", logo: "https://client.example/logo.png", customCss: ".x{}" },
      redirectUrl: "https://client.example/thanks",
      notifyEmails: ["owner@client.example"],
    },
    blocks: [],
  };

  it("drops settings from content saved before they were removed, without failing", () => {
    expect(FormSchema.parse(old)).not.toHaveProperty("settings");
  });

  it("never exports them", () => {
    expect(buildArtifact(old, { formId: "f", formVersionId: "v" })).not.toHaveProperty("settings");
  });
});
