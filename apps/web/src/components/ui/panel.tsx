import { cn } from "@formbuilder/ui";

/*
 * A titled region, with a fixed home for its actions and an optional footer.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Panel.tsx. Compare against it on the next sync.
 * Adapted: the `instrument` tone is left out until something here renders a
 * preview in a dark panel.
 */
export function Panel({
  id,
  title,
  description,
  actions,
  footer,
  padded = true,
  className,
  children,
}: {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Off for a panel whose child manages its own edges, e.g. a table. */
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn("surface overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-rule px-5 py-4">
          {/* `flex-1 basis-[18rem]`: a growing base keeps the action beside the title. */}
          <div className="min-w-0 flex-1 basis-[18rem]">
            {title && (
              <h2 id={headingId} className="font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
                {title}
              </h2>
            )}
            {description && <p className="body-sm mt-1 max-w-[64ch] text-graphite">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-paper-sunk px-5 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}
