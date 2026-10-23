import type { Metadata } from "next";
import { DocsArticle } from "@/components/docs/article";
import { getPage } from "@/lib/docs/content";
import { markdownHref } from "@/lib/docs/nav";

/** The docs home: content/docs/index.mdx. */

export function generateMetadata(): Metadata {
  const { frontmatter } = getPage("")!;
  return {
    title: frontmatter.title,
    description: frontmatter.summary,
    alternates: { canonical: "/docs", types: { "text/markdown": markdownHref("") } },
  };
}

export default function DocsHome() {
  return <DocsArticle page={getPage("")!} />;
}
