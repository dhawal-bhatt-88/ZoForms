import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { CopyButton, StatusChip, buttonClasses } from "@/components/ui";
import type { DocsFrontmatter } from "@/lib/docs/frontmatter";
import type { Heading } from "@/lib/docs/mdast";
import { docsHref, livePages, markdownHref } from "@/lib/docs/nav";
import { TEMPLATES } from "@/lib/docs/templates";
import { Feedback } from "./feedback";

/*
 * The parts every docs page shares around its body: the header, "On this
 * page", and the page end (docs brief, "Common layout").
 */

/** "October 23, 2026": the public pages are in US English. */
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * Breadcrumb, title, page actions, summary, badges and "Last updated", in
 * that order on every page. The docs home has no breadcrumb: it would name
 * only itself.
 */
export function PageHeader({ slug, frontmatter, markdown }: { slug: string; frontmatter: DocsFrontmatter; markdown: string }) {
  const trail = livePages().find((p) => p.slug === slug);
  const crumbs = [trail?.section, trail?.group].filter((c): c is string => !!c);
  const badges = [TEMPLATES[frontmatter.template].label, ...frontmatter.badges];

  return (
    <div className="border-b border-rule pb-6">
      {slug && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-graphite">
            <li>
              <Link href="/docs" className="link">
                Docs
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c} className="flex items-center gap-x-1.5">
                <span aria-hidden="true" className="text-graphite-soft">
                  /
                </span>
                {c}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h1 className="display-sm text-ink">{frontmatter.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={markdown}>Copy page</CopyButton>
          <a href={markdownHref(slug)} className={buttonClasses({ size: "sm" })}>
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
            View as Markdown
          </a>
        </div>
      </div>
      <p className="lede mt-3 max-w-[44rem]">{frontmatter.summary}</p>
      <ul aria-label="Badges" className="mt-4 flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <li key={b}>
            <StatusChip tone={b === badges[0] ? "accent" : "neutral"}>{b}</StatusChip>
          </li>
        ))}
      </ul>
      <p className="body-sm mt-3 text-graphite">
        Last updated{" "}
        <time dateTime={frontmatter.updated}>{longDate(frontmatter.updated)}</time>.
      </p>
    </div>
  );
}

/** Links to the page's `h2` sections. Shown from 1180px, beside the page. */
export function OnThisPage({ headings }: { headings: readonly Heading[] }) {
  const h2 = headings.filter((h) => h.depth === 2);
  if (!h2.length) return null;
  return (
    <nav aria-label="On this page" className="hidden min-[1180px]:block">
      <div className="sticky top-0 max-h-screen overflow-y-auto pb-6 pt-8">
        <p className="eyebrow text-graphite-soft">On this page</p>
        <ul className="mt-2 border-l border-rule">
          {h2.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className="-ml-px block border-l border-transparent py-1 pl-3 text-[0.75rem] text-graphite hover:border-graphite-soft hover:text-ink"
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** "Was this page helpful?", then the previous and next pages from the frontmatter. */
export function PageEnd({ frontmatter }: { frontmatter: DocsFrontmatter }) {
  const title = (href: string) => livePages().find((p) => docsHref(p.slug) === href)?.title ?? href;
  return (
    <div className="mt-12 space-y-6 border-t border-rule pt-8">
      <Feedback />
      {(frontmatter.prev || frontmatter.next) && (
        <nav aria-label="Previous and next" className="grid gap-3 sm:grid-cols-2">
          {frontmatter.prev ? (
            <Link href={frontmatter.prev} className="surface group block px-4 py-3 hover:border-rule-strong">
              <span className="flex items-center gap-1.5 text-[0.75rem] text-graphite">
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Previous
              </span>
              <span className="mt-1 block text-[0.875rem] font-medium text-ink">{title(frontmatter.prev)}</span>
            </Link>
          ) : (
            <span />
          )}
          {frontmatter.next && (
            <Link href={frontmatter.next} className="surface group block px-4 py-3 text-right hover:border-rule-strong">
              <span className="flex items-center justify-end gap-1.5 text-[0.75rem] text-graphite">
                Next
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="mt-1 block text-[0.875rem] font-medium text-ink">{title(frontmatter.next)}</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
