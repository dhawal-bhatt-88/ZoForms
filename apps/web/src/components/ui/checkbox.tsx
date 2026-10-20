import { cn } from "@formbuilder/ui";

/*
 * A checkbox that belongs to this product: still one real
 * `<input type="checkbox">` (same keyboard, form and announcement), with the
 * drawing taken back by `appearance-none`.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Checkbox.tsx. Compare against it on the next sync.
 *
 * An 18px circle in a 24px target (WCAG 2.5.8): the box is 24px and
 * `bg-clip-content` keeps the painted circle at 18px; the ring is a sibling for
 * the same reason. The fill is `accent-solid` with `accent-on` for the tick, a
 * pair that holds 3:1 in both themes.
 *
 * Adapted: the unchecked ring is `graphite-soft` (5.47:1 on surface in light,
 * 5.84:1 in dark), not ZoBlocks' `rule-strong`, which is about 1.6:1 — under
 * the 3:1 WCAG 1.4.11 asks of a control's boundary.
 *
 * Forced colours: the fill becomes the canvas and the SVG tick keeps its own
 * colour (white in light), so a checked box looked unchecked. The tick takes
 * `CanvasText` there, and shows on whatever canvas the reader has chosen.
 */
export function Checkbox({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <input
        {...props}
        type="checkbox"
        className={cn(
          "peer h-6 w-6 appearance-none rounded-full bg-surface bg-clip-content p-[3px]",
          "transition-[background-color] duration-150",
          "checked:bg-accent-solid",
          "disabled:cursor-not-allowed disabled:bg-paper-sunk",
          "disabled:checked:bg-graphite-soft",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-[3px] top-[3px] h-[1.125rem] w-[1.125rem] rounded-full",
          "border border-graphite-soft transition-colors duration-150",
          "peer-checked:border-accent-solid peer-disabled:border-rule",
        )}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-[3px] top-[3px] h-[1.125rem] w-[1.125rem] text-accent-on opacity-0 transition-opacity duration-150 peer-checked:opacity-100 forced-colors:text-[CanvasText]"
      >
        <path d="M4.2 8.3 6.9 11 11.8 5.6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
