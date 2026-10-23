import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_DIR, getPage, readReference } from "./content";
import { attributesOf, walk } from "./mdast";
import { formRendererReference } from "./reference";

/*
 * The drift test for the FormRenderer reference (docs brief, "Accuracy
 * rules"). The table on the page comes from form-renderer.props.json; this
 * fails when the installed package says something else, or when the page
 * leaves a prop out. After a package upgrade, regenerate the file with
 *
 *   DOCS_WRITE_REFERENCE=1 pnpm --filter web exec vitest run src/lib/docs/reference.test.ts
 *
 * and re-read every prop entry the diff touches before committing it.
 */

const SLUG = "integrate/reference/form-renderer";
const FILE = path.join(CONTENT_DIR, `${SLUG}.props.json`);

describe("the FormRenderer reference", () => {
  const fresh = formRendererReference();
  if (process.env.DOCS_WRITE_REFERENCE) fs.writeFileSync(FILE, `${JSON.stringify(fresh, null, 2)}\n`);

  it("matches the installed package's types and defaults", () => {
    expect(readReference(SLUG)).toEqual(fresh);
  });

  it("reads what the package says", () => {
    const byName = new Map(fresh.props.map((p) => [p.name, p]));
    expect(byName.get("schema")).toMatchObject({ type: "FormSchema", required: true, default: null });
    expect(byName.get("credentials")?.default).toBe("'same-origin'");
    expect(byName.get("timeoutMs")?.default).toBe("30000");
  });

  it("has one entry on the page for every prop, in the package's order", () => {
    const page = getPage(SLUG)!;
    const entries = [...walk(page.tree)].filter((n) => n.name === "Prop").map((n) => attributesOf(n).name);
    expect(entries).toEqual(fresh.props.map((p) => p.name));
    expect([...walk(page.tree)].some((n) => n.name === "PropsAtAGlance")).toBe(true);
  });
});
