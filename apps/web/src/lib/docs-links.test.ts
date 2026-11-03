import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { livePages } from "./docs/nav";
import { DOCS_LINKS } from "./docs-links";

/*
 * Every docs link in the builder's own screens goes to a live docs page
 * (developer docs brief, CP4). The editor takes its links from DOCS_LINKS;
 * a /docs/ path written anywhere else in the signed-in app is caught here too.
 */

const SRC = path.join(process.cwd(), "src");
const live = new Set(livePages().map((p) => `/docs/${p.slug}`.replace(/\/$/, "")));

/** Every /docs/ path written in a file under these folders, with where it is. */
function docsPathsIn(...folders: string[]): { where: string; href: string }[] {
  const found: { where: string; href: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        fs.readFileSync(full, "utf8")
          .split("\n")
          .forEach((line, i) => {
            for (const [, href] of line.matchAll(/["'`](\/docs(?:\/[^"'`#?\s]*)?)["'`#?]/g)) found.push({ where: `${path.relative(SRC, full)}:${i + 1}`, href });
          });
      }
    }
  };
  for (const folder of folders) walk(path.join(SRC, folder));
  return found;
}

describe("docs links in the builder", () => {
  it.each(Object.entries(DOCS_LINKS))("%s goes to a live docs page", (_, href) => {
    expect(live.has(href), `${href} isn't a live docs page`).toBe(true);
  });

  it("the editor uses DOCS_LINKS for every docs link, and the signed-in app links only to live pages", () => {
    const written = docsPathsIn("components/form-editor", "app/(app)");
    expect(written.filter((w) => !live.has(w.href))).toEqual([]);
    expect(fs.readFileSync(path.join(SRC, "components/form-editor/editor.tsx"), "utf8")).toContain("DOCS_LINKS.drafts");
  });
});
