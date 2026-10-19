import { cn } from "@formbuilder/ui";

/*
 * A placeholder shaped like what is coming, so nothing moves when it arrives.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Skeleton.tsx. Compare against it on the next sync.
 *
 * A travelling sweep (`.shimmer`), not `animate-pulse`: a pulse wears the same
 * clothes as a disabled control. `aria-hidden`; the region that owns the
 * loading state announces it once.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("shimmer block rounded bg-paper-sunk", className)} />;
}

/** The busy region around skeletons: says "Loading" once, not once per bar. */
export function Loading({ label = "Loading", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" className={className}>
      {/* Text, not an aria-label: a status region announces its content. */}
      <span role="status" className="sr-only">
        {label}…
      </span>
      {children}
    </div>
  );
}

/** A skeleton shaped like a `DataTable`. */
export function TableSkeleton({ rows = 4, columns = 4, label = "Loading" }: { rows?: number; columns?: number; label?: string }) {
  return (
    <Loading label={label} className="surface overflow-hidden">
      <div className="flex gap-4 border-b border-rule bg-paper-sunk px-4 py-2.5">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-rule px-4 py-3 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </Loading>
  );
}
