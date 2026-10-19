/**
 * The top of every screen: an optional eyebrow, the title, an optional
 * one-line lede, and a fixed home for the page's actions on the right.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/PageHeader.tsx (without `eyebrowHref`, which no
 * screen here needs yet). Compare against it on the next sync.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** One paragraph. If it needs two, it belongs in the page body. */
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-rule pb-6">
      {/* `flex-1 basis-[24rem]`, not `min-w-0`: a wrapping row wraps before it
          shrinks, so a long lede would push the actions onto their own line. */}
      <div className="min-w-0 flex-1 basis-[24rem]">
        {eyebrow && <p className="eyebrow mb-2 text-brand-deep">{eyebrow}</p>}
        <h1 className="display-sm">{title}</h1>
        {lede && <p className="mt-1.5 max-w-[74ch] text-[0.875rem] leading-relaxed text-graphite">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
