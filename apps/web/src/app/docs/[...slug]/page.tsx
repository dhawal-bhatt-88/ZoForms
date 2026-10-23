import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/article";
import { getLivePages, getPage } from "@/lib/docs/content";
import { docsHref, markdownHref } from "@/lib/docs/nav";

/**
 * Every docs page but the home: content/docs/<slug>.mdx, for each page the
 * navigation lists as live. All built at build time; any other path is a 404.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getLivePages()
    .filter((p) => p.slug)
    .map((p) => ({ slug: p.slug.split("/") }));
}

type Params = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug.join("/");
  const page = getPage(slug);
  if (!page) return {};
  return {
    title: page.frontmatter.title,
    description: page.frontmatter.summary,
    alternates: { canonical: docsHref(slug), types: { "text/markdown": markdownHref(slug) } },
  };
}

export default async function DocsPageRoute({ params }: Params) {
  const page = getPage((await params).slug.join("/"));
  if (!page) notFound();
  return <DocsArticle page={page} />;
}
