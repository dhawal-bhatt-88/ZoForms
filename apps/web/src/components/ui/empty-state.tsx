import { cn } from "@formbuilder/ui";

/*
 * Nothing here yet — and what to do next. An empty state that only says
 * "nothing here" is a dead end, so the next action is part of the component.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/EmptyState.tsx. Compare against it on the next sync.
 */
export function EmptyState({
  title,
  body,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** What this is for, in a sentence. */
  body?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface px-6 py-12 text-center", className)}>
      <p className="font-display text-[1.0625rem] font-semibold tracking-[-0.015em]">{title}</p>
      {body && <p className="body-sm mx-auto mt-2 max-w-[46ch] text-graphite">{body}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
