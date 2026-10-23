/*
 * Search without a search service: the server writes a small index of every
 * live page at build time (/docs/search-index.json), and the search box
 * fetches it once, on first use, and matches in the browser. Fine for tens of
 * pages; past about fifty, swap `search` for a library such as MiniSearch.
 */

export type SearchEntry = {
  slug: string;
  title: string;
  summary: string;
  section: string;
  headings: string[];
  /** Body text without code, for matching only. */
  text: string;
};

export type SearchResult = { entry: SearchEntry; score: number };

/** Lower-case words; an API name also gives its parts, so "renderer" finds FormRenderer. */
const words = (s: string) =>
  (s.match(/[\p{L}\p{N}]+/gu) ?? []).flatMap((w) => {
    const parts = w.split(/(?<=\p{Ll})(?=\p{Lu})/u);
    return (parts.length > 1 ? [w, ...parts] : [w]).map((x) => x.toLowerCase());
  });

/**
 * Pages containing every word of the query (as a word prefix), best first:
 * a match in the title counts most, then a heading, the summary, the text.
 */
export function search(index: readonly SearchEntry[], query: string, limit = 8): SearchResult[] {
  const terms = words(query);
  if (!terms.length) return [];
  const results: SearchResult[] = [];
  for (const entry of index) {
    const fields: [string[], number][] = [
      [words(entry.title), 10],
      [words(entry.headings.join(" ")), 5],
      [words(entry.summary), 3],
      [words(entry.text), 1],
    ];
    let score = 0;
    let all = true;
    for (const term of terms) {
      const hit = fields.reduce((best, [ws, weight]) => (ws.some((w) => w.startsWith(term)) ? Math.max(best, weight) : best), 0);
      if (!hit) {
        all = false;
        break;
      }
      score += hit;
    }
    if (all) results.push({ entry, score });
  }
  return results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit);
}
