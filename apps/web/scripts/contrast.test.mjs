import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, measure, readTokens } from "./contrast.mjs";
import { PAIRS } from "./contrast-pairs.mjs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

describe("the contrast gate", () => {
  it("measures WCAG ratios", () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 5);
    expect(contrastRatio({ r: 118, g: 118, b: 118 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(4.54, 2);
  });

  it("reads both themes from globals.css, and every pair's tokens are defined in each", () => {
    for (const selector of [":root", ".dark"]) {
      const tokens = readTokens(css, selector);
      for (const { fg, bg } of PAIRS) {
        expect(tokens.has(fg), `${fg} in ${selector}`).toBe(true);
        expect(tokens.has(bg), `${bg} in ${selector}`).toBe(true);
      }
    }
    expect(measure(css).problems.filter((p) => p.includes("not defined"))).toEqual([]);
  });

  it("takes values from the block, not from comments or other selectors", () => {
    const tokens = readTokens(
      `:root {\n  /* --zb-ink: 1 2 3; */\n  --zb-ink: 8 17 15;\n}\n.dark .surface {\n  --zb-ink: 9 9 9;\n}\n.dark {\n  --zb-ink: 237 242 247;\n}`,
      ".dark",
    );
    expect(tokens.get("ink")).toEqual({ r: 237, g: 242, b: 247 });
  });

  it("fails a pair below its floor, a tint outside its band, and a pair it can't measure", () => {
    const sheet = `:root {\n  --zb-a: 255 255 255;\n  --zb-b: 200 200 200;\n  --zb-c: 238 243 241;\n}\n.dark {\n  --zb-a: 0 0 0;\n  --zb-b: 60 60 60;\n  --zb-c: 0 0 0;\n}`;
    const { problems, readings } = measure(sheet, [
      { fg: "b", bg: "a", kind: "ui", use: "a border" },
      { fg: "c", bg: "a", kind: "tint", use: "a tint" },
      { fg: "missing", bg: "a", kind: "text", use: "nothing" },
    ]);
    expect(readings.filter((r) => !r.pass).map((r) => `${r.theme} ${r.fg}`)).toEqual(["light b", "dark b", "dark c"]);
    expect(problems.some((p) => p.includes("missing is not defined"))).toBe(true);
  });
});
