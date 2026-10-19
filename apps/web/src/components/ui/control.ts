import { cn } from "@formbuilder/ui";

/**
 * The shared appearance of every form control: one focus treatment and one
 * invalid state, so the same field never looks like three different fields.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/control.ts. Compare against it on the next sync.
 * Adapted: the field sits on `surface`, not `paper` — the builder's light
 * surface is white (restyle 1).
 *
 * The control opts out of the global `:focus-visible` outline and draws one
 * soft ring instead. The border goes to `brand-deep`, not `brand`: `brand` is
 * about 2.1:1 against paper, under the 3:1 a focus indicator needs.
 */
export function controlClasses({
  invalid,
  mono,
  size = "md",
  className,
}: {
  invalid?: boolean;
  /** For values compared down a column — codes, versions. */
  mono?: boolean;
  /** `sm` is for controls inside a table row. */
  size?: "sm" | "md";
  className?: string;
} = {}): string {
  return cn(
    "w-full rounded-lg border bg-surface text-ink",
    "border-rule-strong placeholder:text-graphite-soft",
    "transition-[border-color,box-shadow] duration-200",
    "focus:border-brand-deep focus:outline-none focus:ring-[3px] focus:ring-brand/20",
    // Unavailable reads as unavailable, not as low-contrast text: opacity would
    // multiply both sides of a contrast pair by a number nobody checked.
    "disabled:cursor-not-allowed disabled:border-rule disabled:bg-paper-sunk disabled:text-graphite",
    size === "md" ? "px-3 py-2 text-[0.875rem]" : "px-2.5 py-1.5 text-[0.8125rem]",
    invalid && "border-fail bg-fail-wash",
    mono && "font-mono tabular",
    className,
  );
}
