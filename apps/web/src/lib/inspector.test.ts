import { describe, expect, it } from "vitest";
import { newBlock, newGroup, newPage, type Block } from "@formbuilder/form-schema";
import { inspectorHeading, logicNoun, TEXT_ONLY_TYPES, textFieldEdit } from "./inspector";

describe("inspectorHeading", () => {
  it.each([
    ["text", "Text"],
    ["image", "Image"],
    ["video", "Video"],
    ["audio", "Audio"],
    ["heading", "Heading"],
    ["divider", "Divider"],
    ["title", "Title"],
    ["label", "Label"],
    ["hidden", "Hidden field"],
  ] as const)("a %s block is called %j, not a question", (type, heading) => {
    expect(inspectorHeading(newBlock(type))).toBe(heading);
  });

  it("questions, groups and pages keep their headings", () => {
    expect(inspectorHeading(newBlock("short"))).toBe("Question");
    expect(inspectorHeading(newBlock("choice"))).toBe("Question");
    expect(inspectorHeading(newBlock("country"))).toBe("Question");
    expect(inspectorHeading(newGroup() as Block)).toBe("Group");
    expect(inspectorHeading(newPage() as Block)).toBe("Page");
  });
});

describe("logicNoun (Show this ___ only when…)", () => {
  it.each([
    ["text", "text block"],
    ["image", "image block"],
    ["video", "video block"],
    ["audio", "audio block"],
    ["heading", "heading block"],
    ["divider", "divider block"],
    ["title", "title block"],
    ["label", "label block"],
    ["hidden", "hidden field"],
  ] as const)("a %s block is %j, not a question", (type, noun) => {
    expect(logicNoun(newBlock(type))).toBe(noun);
  });

  it("questions, groups and pages keep their nouns", () => {
    expect(logicNoun(newBlock("short"))).toBe("question");
    expect(logicNoun(newGroup() as Block)).toBe("group");
    expect(logicNoun(newPage() as Block)).toBe("page");
  });
});

describe("textFieldEdit (Title and Label: one Text field, the label follows it)", () => {
  it("writes the content as typed and the label trimmed", () => {
    expect(textFieldEdit(newBlock("title"), "  Your visit ")).toEqual({ content: "  Your visit ", label: "Your visit" });
    expect(textFieldEdit(newBlock("label"), "Appointment details")).toEqual({ content: "Appointment details", label: "Appointment details" });
  });

  it("blank text leaves the type's default as the label, which respondents then see", () => {
    expect(textFieldEdit(newBlock("title"), "")).toEqual({ content: "", label: "Title" });
    // Spaces only count as blank: the renderer would show them, not the label.
    expect(textFieldEdit(newBlock("label"), "   ")).toEqual({ content: "", label: "Label" });
  });

  it("only Title and Label blocks get the one field", () => {
    expect(TEXT_ONLY_TYPES).toEqual(["title", "label"]);
  });
});
