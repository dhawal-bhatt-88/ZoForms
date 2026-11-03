import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_DIR, getLivePages } from "./content";

/*
 * Every MDN link on a docs page has been opened and read against its sentence
 * (developer docs brief, CP4): content/docs/mdn-links.json lists each, with
 * when and what it was checked for. A link not in the list fails here.
 */

const checked = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "mdn-links.json"), "utf8")) as { links: Record<string, { checked: string; supports: string }> };

describe("MDN links on the docs pages", () => {
  const cited = new Map<string, string[]>();
  for (const page of getLivePages()) {
    for (const [url] of page.body.matchAll(/https:\/\/developer\.mozilla\.org[^)\s"'>]*/g)) cited.set(url, [...(cited.get(url) ?? []), page.slug]);
  }

  it("are each in the checked list", () => {
    expect([...cited.keys()].filter((url) => !checked.links[url])).toEqual([]);
  });

  it("and the list has none no page cites", () => {
    expect(Object.keys(checked.links).filter((url) => !cited.has(url))).toEqual([]);
  });
});
