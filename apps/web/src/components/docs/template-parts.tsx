import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { Callout, StatusChip } from "@/components/ui";
import { docsHref, sectionPages } from "@/lib/docs/nav";

/*
 * The components a page's MDX may use beyond Markdown and the callouts, by
 * template (docs brief, "Page templates"). Each one has a Markdown form in
 * lib/docs/markdown.ts, and a page may use only those (a unit test checks).
 * Attributes are plain text, so the content files stay plain.
 */

type Children = { children?: React.ReactNode };

/* ---------- How-to guide (B) ---------- */

/** "When you'd use this": two or three example cards. */
export const UseCases = ({ children }: Children) => <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;

export const UseCase = ({ title, children }: Children & { title: string }) => (
  <div className="surface px-4 py-3 [&_p]:my-1">
    <h3 className="text-[0.875rem] font-semibold text-ink">{title}</h3>
    <div className="body-sm text-graphite">{children}</div>
  </div>
);

/** Where an animation of a step will go. Says so in words; there is nothing to describe yet. */
export const Gif = ({ alt }: { alt: string }) => (
  <div className="my-4 flex items-center gap-3 rounded-xl border border-dashed border-rule-strong bg-paper-sunk px-4 py-5 text-[0.8125rem] text-graphite">
    <Film aria-hidden="true" className="h-4 w-4 shrink-0 text-graphite-soft" />
    <span>Animation not recorded yet: {alt}</span>
  </div>
);

/** "More about …": the other live pages of this page's section, this one marked. */
export function Series({ slug }: { slug: string }) {
  return (
    <ul className="my-4 space-y-1">
      {sectionPages(slug).map((page) =>
        page.slug === slug ? (
          <li key={page.slug}>
            <span aria-current="page" className="flex items-center gap-2 text-[0.875rem] font-medium text-ink">
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-brand-deep" />
              {page.title} <span className="text-[0.75rem] font-normal text-graphite">(this page)</span>
            </span>
          </li>
        ) : (
          <li key={page.slug} className="pl-[1.375rem]">
            <Link href={docsHref(page.slug)} className="link text-[0.875rem]">
              {page.title}
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}

/* ---------- API reference (C) ---------- */

/** One prop: name, type, default and whether it is required, then its description and example. */
export function Prop({
  name,
  type,
  default: fallback,
  required,
  children,
}: Children & { name: string; type: string; default?: string; required?: string }) {
  const isRequired = required !== undefined;
  return (
    <section aria-labelledby={`prop-${name}`} className="mt-8 border-t border-rule pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`prop-${name}`} className="font-mono text-[1rem] font-semibold text-ink">
          {name}
        </h3>
        <StatusChip tone={isRequired ? "accent" : "neutral"}>{isRequired ? "Required" : "Optional"}</StatusChip>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.8125rem]">
        <dt className="text-graphite">Type</dt>
        <dd>
          <code className="font-mono text-[0.75rem] text-ink">{type}</code>
        </dd>
        <dt className="text-graphite">Default</dt>
        <dd>{fallback ? <code className="font-mono text-[0.75rem] text-ink">{fallback}</code> : <span className="text-graphite">None</span>}</dd>
      </dl>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The rules a prop's value must follow. */
export const Rules = ({ children }: Children) => (
  <Callout tone="info" title="Rules" className="my-4">
    {children}
  </Callout>
);

/* ---------- Example (D) ---------- */

/** "Try this": things to do in the live example, as a checklist to read down. */
export const TryThis = ({ children }: Children) => (
  <div
    className={cn(
      "my-4 [&_li]:relative [&_li]:list-none [&_li]:pl-7 [&_ol]:pl-0 [&_ul]:pl-0",
      "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.2em] [&_li]:before:h-4 [&_li]:before:w-4 [&_li]:before:rounded [&_li]:before:border [&_li]:before:border-rule-strong [&_li]:before:content-['']",
    )}
  >
    {children}
  </div>
);

/* ---------- Docs home ---------- */

export const Doors = ({ children }: Children) => <div className="my-8 grid gap-4 sm:grid-cols-2">{children}</div>;

/** One way in: "I build forms", "I integrate forms". */
export const Door = ({ title, href, children }: Children & { title: string; href: string }) => (
  <Link href={href} className="surface group block px-5 py-5 transition-colors duration-200 hover:border-rule-strong">
    <h2 className="flex items-center justify-between gap-3 text-[1.0625rem] font-semibold text-ink">
      {title}
      <ArrowRight aria-hidden="true" className="h-4 w-4 text-brand-deep transition-transform duration-200 group-hover:translate-x-0.5" />
    </h2>
    <div className="body-sm mt-2 text-graphite [&_p]:my-0">{children}</div>
  </Link>
);

const STAGES = [
  { label: "Zowork Forms builder", body: "You build the form." },
  { label: "JSON form file", body: "You download it." },
  { label: "@zoworkhq/forms in your app", body: "Renders the file.", mono: true },
  { label: "Your API", body: "Receives the answers." },
];

/** Builder → form file → @zoworkhq/forms in your app → your API, as an ordered list. */
export const Architecture = () => (
  <figure className="my-8">
    <ol className="grid gap-3 min-[900px]:grid-cols-4">
      {STAGES.map((s, i) => (
        <li key={s.label} className="surface relative px-4 py-3">
          <span className="font-mono text-[0.6875rem] text-graphite-soft">{i + 1}</span>
          <p className={cn("mt-1 text-[0.875rem] font-semibold text-ink", s.mono && "font-mono text-[0.8125rem]")}>{s.label}</p>
          <p className="body-sm mt-0.5 text-graphite">{s.body}</p>
          {i < STAGES.length - 1 && (
            <ArrowRight
              aria-hidden="true"
              className="absolute -bottom-3 left-1/2 h-4 w-4 -translate-x-1/2 rotate-90 text-graphite-soft min-[900px]:-right-3 min-[900px]:bottom-auto min-[900px]:left-auto min-[900px]:top-1/2 min-[900px]:-translate-y-1/2 min-[900px]:translate-x-0 min-[900px]:rotate-0"
            />
          )}
        </li>
      ))}
    </ol>
    <figcaption className="body-sm mt-3 text-graphite">
      Nothing a person types into the form reaches Zowork Forms: your app posts the answers to your own API.
    </figcaption>
  </figure>
);
