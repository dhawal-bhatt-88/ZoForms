#!/usr/bin/env node
/**
 * The contrast gate: every pair in contrast-pairs.mjs, in light and dark,
 * measured from the values in src/app/globals.css.
 *
 *   node scripts/contrast.mjs          measure, write contrast.json, fail on a miss
 *   node scripts/contrast.mjs --check  also fail if contrast.json is out of date (CI)
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0: the colour maths from
 * packages/tokens/src/validate/color.ts, the pair shape from pairs.ts, and the
 * failure from scripts/gen/index.ts (report every problem, then exit 1). Like
 * ZoBlocks' contrast.json, the measured ratios are written out as evidence and
 * committed, so a change in any ratio shows up in review.
 *
 * Adapted: ZoBlocks reads its DTCG token source. The builder's tokens are the
 * `--zb-*` channel triplets in globals.css (`:root` light, `.dark` dark), so
 * this reads that file: the gate measures exactly what the app ships. It runs
 * before `next build` and in CI, and needs no server.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAIRS, floorFor } from "./contrast-pairs.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = path.join(APP, "src/app/globals.css");
const EVIDENCE = path.join(APP, "contrast.json");

export const THEMES = { light: ":root", dark: ".dark" };

/**
 * The `--zb-*: r g b;` declarations of the first top-level block opened by
 * `selector`. Comments are stripped first, so a triplet in a comment is never
 * read as a value.
 */
export function readTokens(css, selector) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const open = new RegExp(`(^|\\n)${escaped}\\s*\\{`).exec(text);
  if (!open) return new Map();
  const start = open.index + open[0].length;
  const block = text.slice(start, text.indexOf("}", start));
  const tokens = new Map();
  for (const m of block.matchAll(/--zb-([a-z0-9-]+)\s*:\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g)) {
    tokens.set(m[1], { r: +m[2], g: +m[3], b: +m[4] });
  }
  return tokens;
}

function channelLuminance(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio. Symmetric. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * One pair can serve several uses (brand-deep on surface is the focus outline,
 * the selected block and the Switch's track); it is measured once, with every
 * use listed, so the evidence has one row per pair.
 */
function uniquePairs(pairs) {
  const byKey = new Map();
  for (const p of pairs) {
    const key = `${p.fg}|${p.bg}|${p.kind}`;
    const seen = byKey.get(key);
    if (seen) seen.use = `${seen.use}; ${p.use}`;
    else byKey.set(key, { ...p });
  }
  return [...byKey.values()];
}

/** Every reading, and every problem: a miss, or a pair naming a missing token. */
export function measure(css, pairs = PAIRS) {
  const readings = [];
  const problems = [];
  for (const [theme, selector] of Object.entries(THEMES)) {
    const tokens = readTokens(css, selector);
    for (const { fg, bg, kind, use } of uniquePairs(pairs)) {
      const a = tokens.get(fg);
      const b = tokens.get(bg);
      if (!a || !b) {
        // A pair that can't be measured is a failure, not a skip: silence here
        // is how a renamed token would drop out of the gate unnoticed.
        problems.push(`${theme}: ${!a ? fg : bg} is not defined in ${selector}, so ${fg} on ${bg} can't be measured.`);
        continue;
      }
      const ratio = Math.round(contrastRatio(a, b) * 1000) / 1000;
      const floor = floorFor(kind);
      const pass = ratio >= floor.min && (floor.max === undefined || ratio <= floor.max);
      readings.push({ theme, fg, bg, kind, ratio, floor: floor.max ? `${floor.min}–${floor.max}` : floor.min, pass, colours: `${hex(a)} on ${hex(b)}`, use });
      if (!pass) {
        const rule = kind === "text" ? "SC 1.4.3 (text)" : kind === "ui" ? "SC 1.4.11 (interface component)" : "the tint band";
        const bound = floor.max ? `outside ${floor.min}–${floor.max}:1` : `below ${floor.min}:1`;
        problems.push(`${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (${hex(a)} on ${hex(b)}), ${bound} for ${rule}. Used for: ${use}.`);
      }
    }
  }
  return { readings, problems };
}

function main() {
  const check = process.argv.includes("--check");
  const { readings, problems } = measure(readFileSync(CSS, "utf8"));
  const evidence = JSON.stringify(readings, null, 2) + "\n";

  if (check) {
    let committed = "";
    try {
      committed = readFileSync(EVIDENCE, "utf8").replace(/\r\n/g, "\n");
    } catch {}
    if (committed !== evidence) problems.push("contrast.json is out of date. Run `pnpm --filter web contrast` and commit it.");
  } else {
    writeFileSync(EVIDENCE, evidence);
  }

  const passed = readings.filter((r) => r.pass).length;
  if (problems.length) {
    console.error(`\n✗ ${problems.length} contrast problem(s)\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(`\n${passed}/${readings.length} pairs pass.\n`);
    process.exit(1);
  }
  console.log(`✓ contrast: ${passed}/${readings.length} pairs pass in light and dark.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
