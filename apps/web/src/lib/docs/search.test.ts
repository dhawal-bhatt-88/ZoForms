import { describe, expect, it } from "vitest";
import { search, type SearchEntry } from "./search";

const entry = (slug: string, fields: Partial<SearchEntry>): SearchEntry => ({
  slug,
  title: "",
  summary: "",
  section: "",
  headings: [],
  text: "",
  ...fields,
});

const INDEX = [
  entry("a", { title: "Dropdown", text: "a select menu of options" }),
  entry("b", { title: "Show a question only when it applies", headings: ["Rules the builder enforces"], text: "dropdown sources" }),
  entry("c", { title: "FormRenderer", summary: "Renders a form file" }),
];

describe("search", () => {
  it("ranks a title match above a match in the text", () => {
    expect(search(INDEX, "dropdown").map((r) => r.entry.slug)).toEqual(["a", "b"]);
  });

  it("matches word prefixes, ignoring case", () => {
    expect(search(INDEX, "RENDER").map((r) => r.entry.slug)).toEqual(["c"]);
  });

  it("finds an API name by any of its words", () => {
    expect(search(INDEX, "renderer").map((r) => r.entry.slug)).toEqual(["c"]);
    expect(search(INDEX, "formrenderer").map((r) => r.entry.slug)).toEqual(["c"]);
  });

  it("needs every word of the query somewhere in the page", () => {
    expect(search(INDEX, "rules builder").map((r) => r.entry.slug)).toEqual(["b"]);
    expect(search(INDEX, "rules dropdownz")).toEqual([]);
  });

  it("finds nothing for an empty query", () => {
    expect(search(INDEX, "  ")).toEqual([]);
  });
});
