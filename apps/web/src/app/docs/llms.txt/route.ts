import { getLivePages } from "@/lib/docs/content";
import { llmsTxt } from "@/lib/docs/llms";
import { siteOrigin } from "@/lib/docs/site";

/** /docs/llms.txt: every live page's Markdown version, with its summary. Built static. */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(getLivePages(), siteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
