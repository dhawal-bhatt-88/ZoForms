import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_TYPES } from "@zoworkhq/forms/core";
import { CONTENT_DIR, getPage } from "./content";
import { textOf, walk } from "./mdast";

/*
 * "The form file" (docs brief, CP4): its example is a real download, word for
 * word, and its table of block types is the package's list, no more or less.
 */

const page = getPage("integrate/reference/form-file")!;

describe("the form file page", () => {
  it("shows the two-page intake exactly as the builder downloaded it", () => {
    const shown = [...walk(page.tree)].find((n) => n.type === "code" && n.lang === "json")!.value!;
    const download = fs.readFileSync(path.join(CONTENT_DIR, "integrate", "intake-server.form.json"), "utf8");
    expect(JSON.parse(shown)).toEqual(JSON.parse(download));
  });

  it("lists every block type the package knows, once", () => {
    const table = [...walk(page.tree)].find((n) => n.type === "table" && textOf(n.children![0].children![0]) === "type")!;
    const listed = (table.children ?? []).slice(1).flatMap((row) => [...textOf(row.children![0]).matchAll(/[a-z]+/g)].map((m) => m[0]));
    expect(listed.sort()).toEqual([...KNOWN_TYPES].sort());
  });
});
