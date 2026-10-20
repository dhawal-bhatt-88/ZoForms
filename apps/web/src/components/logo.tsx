import Link from "next/link";

/*
 * The wordmark: the ZoBlocks mark, "Zowork" in the display face, and "Forms"
 * as the small mono label, the way the ZoBlocks console reads "ZoBlocks APP".
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0: the mark is
 * `ZoBlocksMark` in apps/app/src/components/Rail.tsx, verbatim, and the lockup
 * is the one in that file and apps/app/src/app/(auth)/layout.tsx. The tab icons
 * (app/icon.svg, favicon.ico, apple-icon.png) are that app's files, copied.
 *
 * Reusing the ZoBlocks mark is the family signal. If Zowork Forms gets a mark
 * of its own, only this file and the tab icons change.
 */

export function ZoBlocksMark({ className = "h-4 w-7" }: { className?: string }) {
  // Two blocks and the tenon that joins them.
  return (
    <svg viewBox="0 0 28 16" className={className} aria-hidden="true">
      <rect x="11.5" y="5.5" width="5" height="5" rx="1.25" fill="rgb(var(--zb-brand))" />
      <rect x="2.5" y="3" width="9.5" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="3" width="9.5" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="Zowork Forms home" className="group inline-flex items-center gap-2.5 text-ink">
      <ZoBlocksMark className="h-4 w-7 transition-transform duration-500 ease-out-expo group-hover:rotate-180" />
      {/* The space is part of the visible text, "Zowork Forms", which the
          name has to contain (WCAG 2.5.3); the gap is drawn by `gap-2.5`. */}
      <span className="font-display text-[0.9375rem] font-semibold tracking-[-0.02em]">Zowork</span>{" "}
      <span className="eyebrow text-graphite-soft">Forms</span>
    </Link>
  );
}
