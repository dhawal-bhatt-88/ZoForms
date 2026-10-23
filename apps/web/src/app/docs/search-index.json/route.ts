import { getLivePages } from "@/lib/docs/content";
import { searchIndex } from "@/lib/docs/search-index";

/** What the docs' search box matches against (lib/docs/search.ts). Built static. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(searchIndex(getLivePages()));
}
