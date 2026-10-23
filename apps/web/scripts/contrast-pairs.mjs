/**
 * Every colour pair the builder composes, and the floor each is held to.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * packages/tokens/src/validate/pairs.ts. Its lesson carries over with the
 * list: a pair that isn't named here isn't checked at all, so a gate over a
 * hand-picked subset reports green while the screens fail. Anything that
 * carries meaning against a ground belongs here.
 *
 * Names are the `--zb-*` variables in src/app/globals.css, without the prefix.
 * The builder's own colour names (`muted`, `faint`, `line`, `accent`, …) point
 * at the same variables (packages/ui/preset-zoblocks.ts), so they're covered.
 *
 * `kind` picks the floor:
 *   - `text`: readable text, WCAG 1.4.3, 4.5:1.
 *   - `ui`: the boundary or state of a control, WCAG 1.4.11, 3:1.
 *   - `tint`: a fill that sets one area apart from the next as an extra cue,
 *     never the only one. Held to a band, not a WCAG floor: below it the cue
 *     is gone, above it the tint reads as a different kind of thing.
 *
 * Deliberately absent, as in ZoBlocks:
 *   - a callout's or toast's coloured edge on its own tint, and the info
 *     callout's `brand` edge: they reinforce a box its title already names;
 *   - `rule` around cards and panels, and `rule-strong` where it remains (a
 *     card's hover, group and page boxes, dashed empty boxes, a divider): their
 *     content identifies them, and no control is drawn with it any more;
 *   - the `brand/20` halo beside a focused field: the solid `brand-deep`
 *     border is the indicator;
 *   - disabled controls, which WCAG exempts.
 */

/** Where text sits: the page, its sunk wells, cards, and nested group boxes. */
const GROUNDS = ["paper", "paper-sunk", "surface", "nest"];

const on = (fg, grounds, kind, use) => grounds.map((bg) => ({ fg, bg, kind, use }));

export const PAIRS = [
  // Readable text — SC 1.4.3.
  ...on("ink", [...GROUNDS, "accent-wash"], "text", "body text, titles"),
  ...on("graphite", [...GROUNDS, "accent-wash"], "text", "secondary text, hints, neutral chip"),
  ...on("graphite-soft", GROUNDS, "text", "placeholders, meta, the locked chip"),
  ...on("brand-deep", [...GROUNDS, "accent-wash"], "text", "links, the selected segment, the accent chip, info toast title"),
  ...on("paper", ["cta", "cta-hover"], "text", "primary button label (Button)"),
  ...on("accent-on", ["accent-solid"], "text", "the account menu's initials, Checkbox's tick"),
  ...on("critical", ["paper", "surface", "critical-wash"], "text", "errors, danger-ghost buttons, fail chip and callout"),
  ...on("ink", ["critical-wash"], "text", "the value in an invalid field"),
  ...on("graphite", ["critical-wash", "warn-wash", "pass-wash"], "text", "callout and toast body text"),
  ...on("warn", ["warn-wash"], "text", "warn chip, callout and the verify-email banner"),
  ...on("pass", ["pass-wash"], "text", "pass chip, callout and toast"),
  ...on("ink", ["pass-wash", "warn-wash"], "text", "the docs' Tip and Warning: bold text in the body"),
  ...on("brand-deep", ["pass-wash", "warn-wash"], "text", "the docs' Tip and Warning: a link in the body"),

  // Interface components and states — SC 1.4.11.
  ...on("brand-deep", [...GROUNDS, "accent-wash"], "ui", "the focus outline and a focused field's border"),
  ...on("brand-deep", ["paper-sunk"], "ui", "the selected segment's border on its track"),
  ...on("brand-deep", ["surface", "nest", "paper"], "ui", "the selected block and page box"),
  ...on("field-border", ["surface", "paper", "nest", "paper-sunk"], "ui", "a field's border (controlClasses), and the canvas's drawings of fields, radios and checkboxes"),
  ...on("critical", ["critical-wash"], "ui", "an invalid field's border"),
  ...on("graphite-soft", ["surface", "paper", "nest"], "ui", "Checkbox's unchecked ring, Switch's off outline"),
  ...on("graphite-soft", ["paper"], "ui", "Switch's off thumb on its track"),
  ...on("accent-solid", ["surface", "paper", "nest"], "ui", "Checkbox checked"),
  ...on("brand-deep", ["surface", "paper"], "ui", "Switch's on track"),
  ...on("paper", ["brand-deep"], "ui", "Switch's on thumb on its track"),
  ...on("cta", ["paper", "surface"], "ui", "a primary button's fill"),

  // Tints — set one area apart from its neighbour.
  ...on("nest", ["surface"], "tint", "alternate nested group boxes in the editor"),
];

/** SC 1.4.3 for text, SC 1.4.11 for components; a band for tints. */
export function floorFor(kind) {
  if (kind === "text") return { min: 4.5 };
  if (kind === "ui") return { min: 3 };
  return { min: 1.1, max: 1.2 };
}
