import type { Config } from "tailwindcss";
import { frameEyebrow } from "./frame-components";

/**
 * The web app's design tokens: the ZoBlocks palette.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/app/globals.css (`@theme inline`, L31–80). Compare against that
 * file on the next sync.
 *
 * The values live in apps/web/src/app/globals.css as `--zb-*` RGB channel
 * triplets, with `:root` for light and `.dark` for dark. Tailwind 3 needs a
 * colour written as channels to support opacity modifiers, so every colour here
 * is `rgb(var(--zb-x) / <alpha-value>)` and `bg-ink/40` keeps working.
 *
 * Two sets of names point at the same variables:
 *   - the builder's own (`bg`, `surface`, `ink-2`, `muted`, `faint`, `line`,
 *     `primary`, `accent`, `red`, `amber`, `green`), so every existing class
 *     re-colours without being touched;
 *   - ZoBlocks' (`paper`, `rule`, `graphite`, `cta`, `fail-wash`, …), for code
 *     written from now on.
 */
const zb = (name: string) => `rgb(var(--zb-${name}) / <alpha-value>)`;

/*
 * Of the shared component classes, only `.eyebrow`: the web app's buttons and
 * fields are its kit's (`apps/web/src/components/ui`), so `.btn*` and `.input`
 * aren't generated here (restyle 3). The admin preset keeps them.
 *
 * The ZoBlocks eyebrow: a mono uppercase label, not a pill. No colour of its
 * own; the call site picks one.
 */
const zoblocksPlugin = frameEyebrow({
  fontFamily: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.6875rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: "500",
});

const sans = [
  "var(--font-instrument-sans)",
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
];

const zoblocksPreset: Partial<Config> = {
  // `.dark` on <html>, set before first paint by the boot script in layout.tsx.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // The builder's names.
        bg: zb("paper"),
        surface: { DEFAULT: zb("surface"), "2": zb("paper-sunk"), "3": zb("paper-sunk") },
        ink: { DEFAULT: zb("ink"), "2": zb("graphite") },
        muted: zb("graphite"),
        faint: zb("graphite-soft"),
        line: { DEFAULT: zb("rule"), "2": zb("rule-strong") },
        primary: zb("cta"),
        accent: { DEFAULT: zb("brand-deep"), "2": zb("cta-hover"), weak: zb("accent-wash") },
        red: zb("critical"),
        amber: zb("warn"),
        green: zb("pass"),

        // ZoBlocks' names.
        paper: zb("paper"),
        "paper-sunk": zb("paper-sunk"),
        // Builder-only, not a ZoBlocks token: the editor's alternate
        // group-box fill (globals.css; docs/ZOBLOCKS-UPSTREAM-NOTES.md).
        nest: zb("nest"),
        rule: zb("rule"),
        "rule-strong": zb("rule-strong"),
        // A field's border: 3:1 against every ground a field sits on
        // (globals.css; the ZoBlocks library's --zb-field-border).
        "field-border": zb("field-border"),
        shimmer: zb("shimmer"),
        graphite: zb("graphite"),
        "graphite-soft": zb("graphite-soft"),
        brand: zb("brand"),
        "brand-deep": zb("brand-deep"),
        "accent-solid": zb("accent-solid"),
        "accent-on": zb("accent-on"),
        "accent-wash": zb("accent-wash"),
        electric: zb("electric"),
        critical: zb("critical"),
        cta: zb("cta"),
        "cta-hover": zb("cta-hover"),
        panel: zb("panel"),
        "panel-raised": zb("panel-raised"),
        "panel-rule": zb("panel-rule"),
        "panel-fg": zb("panel-fg"),
        "panel-muted": zb("panel-muted"),
        trace: zb("trace"),
        "critical-lum": zb("critical-lum"),
        pass: zb("pass"),
        "pass-wash": zb("pass-wash"),
        fail: zb("critical"),
        "fail-wash": zb("critical-wash"),
        warn: zb("warn"),
        "warn-wash": zb("warn-wash"),
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,22,28,.06), 0 1px 1px rgba(20,22,28,.04)",
        pop: "0 6px 18px -8px rgba(20,22,28,.18), 0 2px 6px -3px rgba(20,22,28,.08)",
      },
      fontFamily: {
        // The variables are set by the root layout (next/font).
        sans,
        display: sans,
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [zoblocksPlugin],
};

export default zoblocksPreset;
