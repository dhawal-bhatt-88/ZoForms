import { getLivePages, getPage } from "@/lib/docs/content";
import { markdownFor } from "@/lib/docs/page-markdown";

/**
 * Each docs page as plain Markdown. Readers ask for `/docs/<page>.md` (and
 * `/docs.md` for the home); next.config.mjs rewrites those here, because a
 * route segment can't end in ".md" beside the page of the same name.
 */

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getLivePages().map((p) => ({ slug: p.slug ? p.slug.split("/") : [] }));
}

export async function GET(_: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  // A rewrite may pass the path as one encoded segment; split it either way.
  const slug = ((await params).slug ?? []).flatMap((s) => decodeURIComponent(s).split("/")).join("/");
  const page = getPage(slug);
  if (!page) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(markdownFor(page), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
