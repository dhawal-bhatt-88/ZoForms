import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_BLOCK_COUNT, catalogLabel, matchCatalog } from "./block-catalog";

const types = (groups = CATALOG) => groups.flatMap((g) => g.items.map((it) => it.type));
const labels = (query: string) => matchCatalog(query).flatMap((g) => g.items.map(catalogLabel));

describe("the insert menu", () => {
  it("doesn't offer Hidden field, which the renderer neither shows nor collects", () => {
    expect(types()).not.toContain("hidden");
    for (const query of ["hidden", "Hidden field", "prefill"]) expect(matchCatalog(query)).toEqual([]);
  });

  it("doesn't offer Multi-select, which does what Checkboxes does", () => {
    expect(types()).not.toContain("multiselect");
    for (const query of ["multi-select", "Multiselect", "tags"]) expect(matchCatalog(query)).toEqual([]);
    // The words it shared with others still find those.
    expect(labels("multi")).toEqual(["Multiple choice"]);
    expect(labels("select")).toEqual(["Dropdown"]);
    expect(labels("check")).toEqual(["Checkboxes"]);
  });

  it("finds Respondent's country by name, with no keyword that suggests detection", () => {
    expect(labels("country")).toEqual(["Respondent's country"]);
    expect(labels("nation")).toEqual(["Respondent's country"]);
    for (const query of ["geo", "location", "detect", "auto"]) expect(labels(query)).not.toContain("Respondent's country");
  });

  it("still offers every other block, and counts the blocks for the empty canvas", () => {
    expect(new Set(types())).toEqual(
      new Set([
        "group", "short", "long", "choice", "checkbox", "dropdown", "number", "email", "phone", "link",
        "date", "time", "scale", "grid", "matrix", "rating", "ranking", "text", "heading", "divider", "title", "label",
        "image", "video", "audio", "country",
      ]),
    );
    // Every item but "From template…" (Heading counts once per level).
    expect(CATALOG_BLOCK_COUNT).toBe(28);
  });

  it("an empty query keeps every group; matching ignores case and spaces around it", () => {
    expect(matchCatalog("")).toEqual(CATALOG);
    expect(labels("  LINEAR ")).toEqual(["Linear scale"]);
  });
});
