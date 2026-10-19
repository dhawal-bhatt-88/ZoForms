import { cn } from "@formbuilder/ui";

/*
 * A segmented control's appearance, without its semantics: the same track and
 * segments serve tabs (the Templates tabs), a radio group (the theme toggle, a
 * heading's level) and anything else that picks one of a few. Each use brings
 * its own roles and keys, so this is a class helper like `buttonClasses`, not
 * a component.
 *
 * After github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ThemeToggle.tsx. Adapted: the selected segment gets
 * a 1px `brand-deep` border (docs/ZOBLOCKS-UPSTREAM-NOTES.md, note 6). ZoBlocks
 * marks it with a `paper` fill on the `paper-sunk` track, 1.06:1 in light and
 * 1.05:1 in dark; the builder's accent wash was 1.01:1 and 1.23:1. The border
 * is 4.96:1 against the track in light and 12.46:1 in dark, so the state clears
 * the 3:1 WCAG 1.4.11 asks of it in both themes. Every segment carries a
 * border, transparent until selected, so selecting one moves nothing.
 */

export type SegmentSize = "md" | "sm" | "icon";

const SIZES: Record<SegmentSize, string> = {
  md: "px-3 py-1.5 text-[0.8125rem]",
  sm: "px-2.5 py-1 text-[0.75rem]",
  icon: "h-7 w-7",
};

/** The track the segments sit in. */
export function segmentTrackClasses(className?: string): string {
  return cn("inline-flex items-center gap-0.5 rounded-lg border border-rule bg-paper-sunk p-0.5", className);
}

/** One segment: `selected` is the one chosen. */
export function segmentClasses({
  selected,
  size = "md",
  className,
}: {
  selected: boolean;
  size?: SegmentSize;
  className?: string;
}): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md border font-medium",
    "transition-[background-color,border-color,color] duration-200",
    SIZES[size],
    selected
      ? "border-brand-deep bg-accent-wash text-brand-deep shadow-sm"
      : "border-transparent text-graphite hover:text-ink",
    className,
  );
}
