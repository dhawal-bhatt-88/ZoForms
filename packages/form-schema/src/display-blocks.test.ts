import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  displayBlockProblem,
  findBlock,
  formProblems,
  FormSchema,
  isValidImageSource,
  newBlock,
  type Block,
  type PageBlock,
} from "./index";

// docs/GROUPS-AND-PAGES-CONTRACT.md §9: display blocks `text` and `image`.

const image = (id: string, content: string | undefined, label = id.toUpperCase()): Block =>
  ({ id, type: "image", label, required: false, ...(content === undefined ? {} : { content }) }) as Block;
const text = (id: string, content: string | undefined, label = id.toUpperCase()): Block =>
  ({ id, type: "text", label, required: false, ...(content === undefined ? {} : { content }) }) as Block;
const short = (id: string, extra: object = {}): Block => ({ id, type: "short", label: id.toUpperCase(), required: false, ...extra }) as Block;
const page = (id: string, blocks: Block[]): PageBlock =>
  ({ id, type: "page", title: id.toUpperCase(), blocks }) as unknown as PageBlock;
const group = (id: string, blocks: Block[]): Block => ({ id, type: "group", label: id.toUpperCase(), blocks }) as Block;
const messages = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
const identity = { formId: "f", formVersionId: "v" };

describe("image source rule (contract §9, the shared table)", () => {
  // The contract's own table, which the renderer tests too.
  const contractValid = ["https://example.com/a.png", "HTTPS://example.com/a.png", "/images/a.png", "  /images/a.png  "];
  const contractInvalid = [
    "", "   ", "http://example.com/a.png", "https:example.com/a.png", "//cdn.example.com/a.png",
    "/\\evil.com/a.png", "/\t/evil.com/a.png", "data:image/png;base64,AAAA", "javascript:alert(1)",
    "images/a.png", "<img src=x>", "https://user@cdn.example.com/a.png", "https://user:pass@cdn.example.com/a.png",
  ];
  it.each(contractValid)("valid: %j", (src) => expect(isValidImageSource(src)).toBe(true));
  it.each(contractInvalid)("invalid: %j", (src) => expect(isValidImageSource(src)).toBe(false));

  // The brief's cases.
  it.each([
    ["https://", "https://cdn.example.com/logo.png", true],
    ["/path", "/images/logo.png", true],
    ["//cdn…", "//cdn.example.com/logo.png", false],
    ["http:", "http://example.com/logo.png", false],
    ["data:", "data:image/gif;base64,R0lGODlhAQABAAAAACw=", false],
    ["javascript:", "javascript:alert(document.cookie)", false],
    ["bare word", "logo", false],
    ["HTML", '<img src="https://x/a.png">', false],
    ["whitespace-padded", "\t https://example.com/a.png \n", true],
    ["empty", "", false],
    ["missing", undefined, false],
  ] as const)("%s → %s", (_case, src, valid) => expect(isValidImageSource(src)).toBe(valid));
});

describe("save rules: image and text", () => {
  it("rejects an image with an empty or invalid source, naming it by path", () => {
    const expected = (path: string) =>
      `Image "${path}": add an image address starting with https:// or a path on your app's server such as /images/logo.png.`;
    expect(messages(image("logo", ""))).toEqual([expected("LOGO")]);
    expect(messages(image("logo", undefined))).toEqual([expected("LOGO")]);
    expect(messages(image("logo", "not a url at all"))).toEqual([expected("LOGO")]);
    expect(messages(page("p1", [group("g", [image("logo", "http://x/a.png", "Logo")])]))).toEqual([expected("P1 › G › Logo")]);
  });

  it("accepts valid image sources", () => {
    expect(messages(image("a", "https://example.com/a.png"), image("b", " /images/b.png "))).toEqual([]);
  });

  it("rejects a blank or whitespace-only text block, naming it by path", () => {
    expect(messages(text("intro", ""))).toEqual(['Text block "INTRO" is empty — add some text or delete it.']);
    expect(messages(text("intro", " \n\t "))).toEqual(['Text block "INTRO" is empty — add some text or delete it.']);
    expect(messages(text("intro", undefined))).toEqual(['Text block "INTRO" is empty — add some text or delete it.']);
    expect(messages(page("p1", [text("intro", "", "Welcome")]))).toEqual(['Text block "P1 › Welcome" is empty — add some text or delete it.']);
  });

  it("accepts text with content, line breaks and all", () => {
    expect(messages(text("intro", "Line one\nLine two"))).toEqual([]);
  });

  it("the editor's inline message is the same as the save message", () => {
    const blocks = [page("p1", [image("logo", "nope", "Logo")])];
    const entry = findBlock(blocks, "logo")!;
    expect(displayBlockProblem(entry)!.message).toBe(formProblems({ blocks })[0].message);
    expect(displayBlockProblem(findBlock([image("ok", "/a.png")], "ok")!)).toBeNull();
  });

  it("a new image or text block straight from the menu can't be saved until filled in", () => {
    // newBlock gives image content "" and text a default sentence.
    expect(messages(newBlock("image", { id: "i" } as never))).toHaveLength(1);
    expect(messages(newBlock("text", { id: "t" } as never))).toEqual([]);
  });
});

describe("stored values", () => {
  it("an image source is stored trimmed", () => {
    const form = FormSchema.parse({ title: "t", blocks: [image("logo", "  https://example.com/a.png \n")] });
    expect(form.blocks[0].content).toBe("https://example.com/a.png");
  });

  it("text content is stored as written (not trimmed), line breaks kept", () => {
    const form = FormSchema.parse({ title: "t", blocks: [text("intro", "  Line one\nLine two  ")] });
    expect(form.blocks[0].content).toBe("  Line one\nLine two  ");
  });

  it('description: "" is never stored or exported, on any block', () => {
    const blocks = [short("q", { description: "" }), text("t", "Hi", "T"), page("p", [short("inner", { description: "" })])];
    (blocks[1] as { description?: string }).description = "";
    const form = FormSchema.parse({ title: "t", blocks: [page("p0", blocks.slice(0, 2)), blocks[2]] });
    expect(JSON.stringify(form)).not.toContain('"description"');
    const artifact = buildArtifact({ title: "t", blocks: [page("p0", blocks.slice(0, 2)), blocks[2]] }, identity);
    expect(JSON.stringify(artifact)).not.toContain('"description"');
  });

  it("real help text is kept", () => {
    const form = FormSchema.parse({ title: "t", blocks: [short("q", { description: "Your full legal name" })] });
    expect(form.blocks[0].description).toBe("Your full legal name");
  });
});
