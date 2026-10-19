import { cn } from "@formbuilder/ui";

/*
 * A state, in a word. Severity is never colour alone: every chip renders text
 * and the colour reinforces it.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/StatusChip.tsx. Compare against it on the next sync.
 */

export type ChipTone = "neutral" | "pass" | "fail" | "warn" | "accent" | "locked";

export function StatusChip({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: ChipTone;
  /** Decorative. The word carries the meaning. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5",
        "font-mono text-[0.625rem] font-medium uppercase tracking-[0.09em]",
        tone === "neutral" && "border border-rule bg-paper-sunk text-graphite",
        tone === "pass" && "bg-pass-wash text-pass",
        tone === "fail" && "bg-fail-wash text-fail",
        tone === "warn" && "bg-warn-wash text-warn",
        tone === "accent" && "bg-accent-wash text-brand-deep",
        tone === "locked" && "border border-rule bg-paper-sunk text-graphite-soft",
        className,
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
