import { AlertTriangle, X } from "lucide-react";
import { cn } from "@formbuilder/ui";

/*
 * Something the reader needs to know before they act: what happened, what it
 * affects, what to do.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Callout.tsx. Compare against it on the next sync.
 * Adapted: the info tone's left border is `border-l-brand`. ZoBlocks writes
 * `border-l-zoblocks`, a colour its theme doesn't define, so its info callouts
 * draw no accent edge (docs/ZOBLOCKS-UPSTREAM-NOTES.md).
 *
 * No `role="alert"`: the toast is the announcement, this is the detail a
 * reader works from. Where nothing else announces it (inside a modal dialog,
 * or the editor's notices), the caller passes `role` itself.
 *
 * Also adapted: `onDismiss` adds a "Dismiss" button, for a message the reader
 * may clear once read.
 */
export function Callout({
  tone = "info",
  title,
  items,
  action,
  className,
  role,
  onDismiss,
  children,
}: {
  tone?: "info" | "fail" | "warn" | "pass";
  title: React.ReactNode;
  /** One per problem. */
  items?: readonly React.ReactNode[];
  action?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
  onDismiss?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={role}
      className={cn(
        "rounded-r-xl border border-l-[3px] px-4 py-3",
        tone === "info" && "border-rule border-l-brand bg-surface",
        tone === "fail" && "border-fail/25 border-l-fail bg-fail-wash",
        tone === "warn" && "border-warn/25 border-l-warn bg-warn-wash",
        tone === "pass" && "border-pass/25 border-l-pass bg-pass-wash",
        onDismiss && "relative pr-11",
        className,
      )}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink"
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
      <p
        className={cn(
          "text-[0.8125rem] font-semibold",
          tone === "info" && "text-ink",
          tone === "fail" && "text-fail",
          tone === "warn" && "text-warn",
          tone === "pass" && "text-pass",
        )}
      >
        {title}
      </p>

      {children && <div className="body-sm mt-1 text-graphite">{children}</div>}

      {items && items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="tabular flex gap-2 text-[0.75rem] leading-relaxed text-ink">
              <AlertTriangle
                aria-hidden="true"
                strokeWidth={2}
                className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "fail" ? "text-fail" : "text-graphite-soft")}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
