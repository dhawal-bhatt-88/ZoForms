import { Children as ReactChildren, cloneElement, isValidElement, type ReactElement } from "react";
import Link from "next/link";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import type { FormSchema } from "@zoworkhq/forms/core";
import { readCss, readExampleForm, readReference, readTypes, type DocsPage } from "@/lib/docs/content";
import { cssTable, type CssTableName } from "@/lib/docs/css-table";
import type { Reference, ReferenceType } from "@/lib/docs/reference";
import { exampleReactCode, formExcerpt } from "@/lib/docs/example-code";
import type { MARKDOWN_COMPONENTS } from "@/lib/docs/markdown";
import { remarkCodeTitles, remarkHeadingIds } from "@/lib/docs/mdast";
import { markdownFor } from "@/lib/docs/page-markdown";
import { rendererStyles, rendererVersion } from "@/lib/docs/renderer";
import { TEMPLATES } from "@/lib/docs/templates";
import { Note, Tip, Warning } from "./callouts";
import { CodeBlock, MdxPre } from "./code-block";
import { LiveExample } from "./live-example";
import { OnThisPage, PageEnd, PageHeader } from "./page-frame";
import { Architecture, CssTable, Door, Doors, Field, FieldList, Gif, Prop, PropsAtAGlance, Rules, Series, TryThis, UseCase, UseCases } from "./template-parts";

/** The page's generated reference table (`<page>.props.json`); a page using Prop must have one. */
function referenceOf(page: DocsPage): Reference {
  const reference = readReference(page.slug);
  if (!reference) throw new Error(`${page.file}: no ${page.slug}.props.json beside it`);
  return reference;
}

/** A type or function from the page's generated `<page>.types.json`. */
function typeOf(page: DocsPage, name: string): ReferenceType {
  const found = readTypes(page.slug)?.types.find((t) => t.name === name);
  if (!found) throw new Error(`${page.file}: "${name}" isn't in ${page.slug}.types.json`);
  return found;
}

/*
 * One docs page: its MDX compiled on the server (at build time, since every
 * docs route is static), inside the shared header, page end and "On this
 * page". The MDX compiler never reaches the browser; only the client
 * components a page uses do.
 */

type Props = Record<string, unknown> & { children?: React.ReactNode };

/** Markdown elements, in the kit's type and colours. */
const ELEMENTS = {
  h2: (p: Props) => <h2 {...p} className="mt-12 scroll-mt-6 text-[1.375rem] font-semibold tracking-[-0.015em] text-ink" />,
  h3: (p: Props) => <h3 {...p} className="mt-8 scroll-mt-6 text-[1.0625rem] font-semibold text-ink" />,
  p: (p: Props) => <p {...p} className="my-3 first:mt-0 last:mb-0" />,
  a: ({ href, ...p }: Props) =>
    typeof href === "string" && href.startsWith("/") ? <Link href={href} {...p} className="link" /> : <a href={href as string} {...p} className="link" />,
  ul: (p: Props) => <ul {...p} className="my-3 list-disc space-y-1.5 pl-5 marker:text-graphite-soft" />,
  ol: (p: Props) => <ol {...p} className="my-3 list-decimal space-y-1.5 pl-5 marker:text-graphite-soft" />,
  li: (p: Props) => <li {...p} className="pl-1 [&>p]:my-1" />,
  blockquote: (p: Props) => <blockquote {...p} className="my-4 border-l-2 border-rule-strong pl-4 text-graphite" />,
  hr: () => <hr className="my-8 border-rule" />,
  strong: (p: Props) => <strong {...p} className="font-semibold text-ink" />,
  code: (p: Props) => <code {...p} className="rounded bg-paper-sunk px-1 py-0.5 font-mono text-[0.8125em] text-ink" />,
  pre: MdxPre,
  table: (p: Props) => (
    <div className="surface scroll-x relative my-5 overflow-x-auto">
      <table {...p} className="w-full border-collapse text-[0.8125rem]" />
    </div>
  ),
  th: (p: Props) => (
    <th
      {...p}
      scope="col"
      className="border-b border-rule bg-paper-sunk px-4 py-2.5 text-left font-mono text-[0.625rem] font-medium uppercase tracking-[0.11em] text-graphite-soft"
    />
  ),
  td: (p: Props) => <td {...p} className="border-b border-rule px-4 py-2.5 align-top text-ink [tr:last-child>&]:border-b-0" />,
};

/**
 * The components a page may use. Typed against MARKDOWN_COMPONENTS, so one
 * without a Markdown form, or a Markdown form without a component, fails the
 * typecheck.
 */
function components(page: DocsPage) {
  const template = TEMPLATES[page.frontmatter.template];
  const named: Record<keyof typeof MARKDOWN_COMPONENTS, React.ComponentType<never>> = {
    Note,
    Tip,
    Warning,
    UseCases,
    UseCase,
    Gif,
    Series: ({ group }: { group?: string }) => <Series slug={page.slug} inGroup={group !== undefined} />,
    FormExcerpt: ({ form, block, field }: { form: string; block: string; field: string }) => (
      <CodeBlock code={formExcerpt(readExampleForm(page.slug, form).schema, block, field)} lang="json" title={`${form}.json, block "${block}"`} />
    ),
    PropsAtAGlance: () => <PropsAtAGlance props={referenceOf(page).props} />,
    Prop: ({ name, children }: { name: string; children?: React.ReactNode }) => {
      const prop = referenceOf(page).props.find((p) => p.name === name);
      if (!prop) throw new Error(`${page.file}: <Prop name="${name}"> isn't in the package's FormRendererProps`);
      return (
        <Prop name={name} prop={prop}>
          {children}
        </Prop>
      );
    },
    Rules,
    Signature: ({ of }: { of: string }) => <CodeBlock code={typeOf(page, of).text} lang="ts" title={of} />,
    // Each Field finds itself in its list's type.
    FieldList: ({ of, children }: { of: string; children?: React.ReactNode }) => (
      <FieldList>
        {ReactChildren.map(children, (child) =>
          isValidElement(child) ? cloneElement(child as ReactElement<{ owner?: ReferenceType }>, { owner: typeOf(page, of) }) : null,
        )}
      </FieldList>
    ),
    Field: ({ name, owner, children }: { name: string; owner?: ReferenceType; children?: React.ReactNode }) => {
      const member = owner?.members.find((m) => m.name === name);
      if (!member) throw new Error(`${page.file}: <Field name="${name}"> isn't a member of its <FieldList>`);
      return <Field member={member}>{children}</Field>;
    },
    CssTable: ({ of }: { of: string }) => {
      const css = readCss(page.slug);
      if (!css) throw new Error(`${page.file}: no ${page.slug}.css.json beside it`);
      return <CssTable table={cssTable(css, of as CssTableName)} />;
    },
    TryThis,
    Doors,
    Door,
    Architecture,
    LiveExample: ({ form }: { form: string }) => {
      if (!template.example) throw new Error(`${page.file}: the ${page.frontmatter.template} template has no live example`);
      return (
        <LiveExample
          name={form}
          title={page.frontmatter.title}
          schema={readExampleForm(page.slug, form).schema as unknown as FormSchema}
          css={rendererStyles()}
          tabs={template.example.tabs}
          density={template.example.density}
          reactCode={template.example.tabs.includes("react") ? exampleReactCode(form) : undefined}
        />
      );
    },
  };
  return { ...ELEMENTS, ...named };
}

export async function DocsArticle({ page }: { page: DocsPage }) {
  const version = rendererVersion();
  const markdown = markdownFor(page);
  const { default: Content } = await evaluate(page.body, {
    ...runtime,
    development: false,
    remarkPlugins: [remarkGfm, remarkHeadingIds as never, remarkCodeTitles as never],
  });

  return (
    <div className="min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,920px)_220px] min-[1180px]:gap-10">
      <article className="min-w-0 max-w-[920px] py-8">
        <PageHeader slug={page.slug} frontmatter={page.frontmatter} markdown={markdown} version={version} />
        <div className="body mt-8 text-ink">
          <Content components={components(page) as never} />
        </div>
        <PageEnd frontmatter={page.frontmatter} />
      </article>
      <OnThisPage headings={page.headings} />
    </div>
  );
}
