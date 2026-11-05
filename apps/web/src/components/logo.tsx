import Link from "next/link";

/*
 * The wordmark: the ZoBlocks mark and "ZoForms", one word in the display face,
 * set the way ZoBlocks sets its own name, so the two read as one family.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0: the mark is
 * `ZoBlocksMark` in apps/app/src/components/Rail.tsx, verbatim, and the lockup
 * is the one in that file and apps/app/src/app/(auth)/layout.tsx. The tab icons
 * (app/icon.svg, favicon.ico, apple-icon.png) are that app's files, copied.
 *
 * Reusing the ZoBlocks mark is the family signal. If ZoForms gets a mark
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
    <Link href={href} aria-label="ZoForms home" className="group inline-flex items-center gap-2.5 text-ink">
      <ZoBlocksMark className="h-4 w-7 transition-transform duration-500 ease-out-expo group-hover:rotate-180" />
      {/* The visible text, "ZoForms", is in the link's name (WCAG 2.5.3). */}
      <span className="font-display text-[0.9375rem] font-semibold tracking-[-0.02em]">ZoForms</span>
    </Link>
  );
}
