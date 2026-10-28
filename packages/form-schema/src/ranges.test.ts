import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  formProblems,
  FormSchema,
  newBlock,
  problemsBesideContent,
  rangeSettingsProblems,
  SCALE_MAX_POINTS,
  type Block,
} from "./index";

const scale = (min?: number, max?: number, label = "How easy was booking?"): Block =>
  ({ id: "s", type: "scale", label, required: false, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) }) as Block;
const number = (min?: number, max?: number, label = "Age"): Block =>
  ({ id: "n", type: "number", label, required: false, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) }) as Block;
const rules = (block: Block) => rangeSettingsProblems(block).map(({ field, detail }) => [field, detail]);
const saveMessages = (...blocks: Block[]) => formProblems(FormSchema.parse({ title: "t", blocks })).map((p) => p.message);

describe("a linear scale's Min and Max (contract §6, builder only)", () => {
  it("a new scale, and any whole range of up to 20 points, is fine", () => {
    expect(rules(newBlock("scale"))).toEqual([]);
    for (const [min, max] of [[1, 5], [0, 10], [-5, 5], [3, 3], [1, 20], [-10, 9]]) expect(rules(scale(min, max))).toEqual([]);
  });

  it("an absent Min or Max counts as the renderer's 1 or 5", () => {
    expect(rules(scale())).toEqual([]);
    expect(rules(scale(undefined, 0))).toEqual([["max", "Max (0) can't be less than Min (1)."]]);
    expect(rules(scale(6))).toEqual([["max", "Max (5) can't be less than Min (6)."]]);
  });

  it("Min or Max not a whole number: under that field, and no range check on top", () => {
    expect(rules(scale(1.5, 5))).toEqual([["min", "Min must be a whole number, such as 0 or 1."]]);
    expect(rules(scale(1, 4.5))).toEqual([["max", "Max must be a whole number, such as 5 or 10."]]);
    expect(rules(scale(9.5, 2.5))).toEqual([
      ["min", "Min must be a whole number, such as 0 or 1."],
      ["max", "Max must be a whole number, such as 5 or 10."],
    ]);
  });

  it("Min greater than Max: under Max", () => {
    expect(rules(scale(5, 3))).toEqual([["max", "Max (3) can't be less than Min (5)."]]);
  });

  it(`more than ${SCALE_MAX_POINTS} points: under Max, with the count`, () => {
    expect(rules(scale(1, 21))).toEqual([["max", "A scale can have at most 20 points; 1 to 21 has 21. Lower Max or raise Min."]]);
    expect(rules(scale(0, 30))).toEqual([["max", "A scale can have at most 20 points; 0 to 30 has 31. Lower Max or raise Min."]]);
  });

  it("refused at save, naming the block; the message reads on from its name", () => {
    expect(saveMessages(scale(5, 3))).toEqual(['Block "How easy was booking?": Max (3) can\'t be less than Min (5).']);
    expect(saveMessages(scale(1, 30))).toEqual([
      'Block "How easy was booking?": a scale can have at most 20 points; 1 to 30 has 30. Lower Max or raise Min.',
    ]);
    expect(saveMessages(scale(1.5, 5))).toEqual(['Block "How easy was booking?": Min must be a whole number, such as 0 or 1.']);
  });
});

describe("a number's Minimum and Maximum (contract §6, builder only)", () => {
  it("either may be blank, decimals and negatives are fine, and they may be equal", () => {
    for (const [min, max] of [[undefined, undefined], [0, undefined], [undefined, 100], [0.5, 99.5], [-10, -2], [7, 7]]) {
      expect(rules(number(min, max))).toEqual([]);
    }
  });

  it("Minimum greater than Maximum: under Maximum, and refused at save", () => {
    expect(rules(number(10, 5))).toEqual([["max", "Maximum (5) can't be less than Minimum (10)."]]);
    expect(rules(number(0.75, 0.5))).toEqual([["max", "Maximum (0.5) can't be less than Minimum (0.75)."]]);
    expect(saveMessages(number(10, 5))).toEqual(['Block "Age": Maximum (5) can\'t be less than Minimum (10).']);
  });

  it("other blocks have no range rules", () => {
    expect(rules({ ...newBlock("rating"), min: 9, max: 1 } as Block)).toEqual([]);
  });

  it("a number's limits are exported as they are", () => {
    const art = buildArtifact({ title: "t", blocks: [number(0.5, 120)] }, { formId: "f", formVersionId: "v" });
    expect(art.blocks[0]).toMatchObject({ type: "number", min: 0.5, max: 120 });
  });
});

it("shown under their fields, so not listed again beside the content", () => {
  const form = { blocks: [scale(5, 3)] };
  expect(problemsBesideContent(form, "s")).toEqual([]);
  expect(formProblems(form)).toHaveLength(1);
});
