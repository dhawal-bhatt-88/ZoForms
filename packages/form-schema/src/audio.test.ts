import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  displayBlockProblem,
  findBlock,
  formProblems,
  FormSchema,
  isAnswerable,
  newBlock,
  parseAudioSource,
  problemsBesideContent,
  questionNumbers,
  sameContent,
  sourceOperators,
  type Block,
  type PageBlock,
} from "./index";

// docs/GROUPS-AND-PAGES-CONTRACT.md §11: the `audio` display block.

/** Contract §11's shared test table, verbatim (the renderer tests the same one), with the trimmed source each gives. */
const SECTION_11_RECOGNISED: [string, string][] = [
  ["https://cdn.example.com/welcome.mp3", "https://cdn.example.com/welcome.mp3"],
  ["https://cdn.example.com/welcome.M4A?v=2", "https://cdn.example.com/welcome.M4A?v=2"],
  ["/audio/breathing.ogg", "/audio/breathing.ogg"],
  ["/audio/breathing.wav#t=10", "/audio/breathing.wav#t=10"],
  ["  /audio/intro.mp3  ", "/audio/intro.mp3"],
];

const SECTION_11_NOT_RECOGNISED = [
  "",
  "http://cdn.example.com/welcome.mp3",
  "//cdn.example.com/welcome.mp3",
  "https://user@cdn.example.com/welcome.mp3",
  "https://cdn.example.com/welcome.flac",
  "https://cdn.example.com/welcome.mp3.exe",
  "https://cdn.example.com/?file=welcome.mp3",
  "https://open.spotify.com/track/abc",
  "/audio/",
  "javascript:alert(1)",
  "<audio src=x>",
];

describe("parseAudioSource — contract §11 shared table", () => {
  it.each(SECTION_11_RECOGNISED)("recognises %j", (src, expected) => {
    expect(parseAudioSource(src)).toBe(expected);
  });
  it.each(SECTION_11_NOT_RECOGNISED)("does not recognise %j", (src) => {
    expect(parseAudioSource(src)).toBeNull();
  });
});

describe("parseAudioSource — the contract's other rules", () => {
  it.each([
    ["https://cdn.example.com/a/b/welcome.ogg?token=x#t=5", "https://cdn.example.com/a/b/welcome.ogg?token=x#t=5"],
    ["HTTPS://cdn.example.com/welcome.WAV", "HTTPS://cdn.example.com/welcome.WAV"],
    ["\n\t/audio/welcome.m4a ", "/audio/welcome.m4a"],
  ])("recognises %j", (src, expected) => {
    expect(parseAudioSource(src)).toBe(expected);
  });

  it.each([
    // Follows §9: the source must be valid before its extension counts.
    "audio/welcome.mp3",
    "/\\evil.com/welcome.mp3",
    "/\t/evil.com/welcome.mp3",
    "https:cdn.example.com/welcome.mp3",
    "https://user:pass@cdn.example.com/welcome.mp3",
    "data:audio/mpeg;base64,AAAA",
    // The extension is read from the path only, never the query or fragment.
    "https://cdn.example.com/#welcome.mp3",
    "https://cdn.example.com/welcome",
    // No other formats, no player or streaming links.
    "https://cdn.example.com/welcome.mp4",
    "https://cdn.example.com/welcome.aac",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://soundcloud.com/artist/track",
    "   ",
    undefined,
  ])("does not recognise %j", (src) => {
    expect(parseAudioSource(src)).toBeNull();
  });
});

const audio = (id: string, content: string | undefined, label = id.toUpperCase(), extra: object = {}): Block =>
  ({ id, type: "audio", label, required: false, ...(content === undefined ? {} : { content }), ...extra }) as Block;
const choice = (id: string): Block => ({ id, type: "choice", label: id.toUpperCase(), required: false, options: ["Yes", "No"] }) as Block;
const page = (id: string, blocks: Block[]): PageBlock => ({ id, type: "page", title: id.toUpperCase(), blocks }) as unknown as PageBlock;
const group = (id: string, blocks: Block[]): Block => ({ id, type: "group", label: id.toUpperCase(), blocks }) as Block;
const messages = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
const AUDIO_MSG = (path: string) =>
  `Audio "${path}": add the address of an .mp3, .m4a, .ogg or .wav file (https:// or a path on your app's server such as /audio/welcome.mp3).`;

describe("save rule: audio", () => {
  it("rejects an empty, missing or unrecognised source, naming the block by its path", () => {
    expect(messages(audio("a", ""))).toEqual([AUDIO_MSG("A")]);
    expect(messages(audio("a", undefined))).toEqual([AUDIO_MSG("A")]);
    expect(messages(audio("a", "   "))).toEqual([AUDIO_MSG("A")]);
    expect(messages(audio("a", "https://open.spotify.com/track/abc", "Welcome"))).toEqual([AUDIO_MSG("Welcome")]);
    expect(messages(page("p1", [group("g", [audio("a", "https://cdn.example.com/welcome.flac", "Welcome")])]))).toEqual([
      AUDIO_MSG("P1 › G › Welcome"),
    ]);
  });

  it("accepts recognised sources", () => {
    expect(messages(audio("a", "https://cdn.example.com/welcome.mp3"), audio("b", " /audio/breathing.ogg "))).toEqual([]);
  });

  it("the editor's inline message is the same as the save message", () => {
    const blocks = [page("p1", [audio("a", "https://cdn.example.com/?file=welcome.mp3", "Welcome")])];
    const inline = displayBlockProblem(findBlock(blocks, "a")!)!;
    expect(inline.message).toBe(formProblems({ blocks })[0].message);
    expect(inline.message).toBe(AUDIO_MSG("P1 › Welcome"));
    expect(inline.detail).toBe(
      "Add the address of an .mp3, .m4a, .ogg or .wav file (https:// or a path on your app's server such as /audio/welcome.mp3).",
    );
    expect(displayBlockProblem(findBlock([audio("ok", "/audio/intro.mp3")], "ok")!)).toBeNull();
  });

  it("a new audio block straight from the menu can't be saved until a source is added", () => {
    const block = newBlock("audio", { id: "a" } as never);
    expect(block.content).toBe("");
    expect(block.label).toBe("Audio");
    expect(messages(block)).toEqual([AUDIO_MSG("Audio")]);
  });
});

describe("audio is presentational (§11, §3.3, §4)", () => {
  it("is not answerable, not numbered, and can't be a condition source", () => {
    const a = audio("a", "/audio/intro.mp3");
    expect(isAnswerable(a)).toBe(false);
    expect(questionNumbers([a, choice("q")]).get("a")).toBeUndefined();
    expect(questionNumbers([a, choice("q")]).get("q")).toBe(1);
    expect(sourceOperators(a)).toBeUndefined();
    const dependent = { ...choice("dep"), enableWhen: [{ question: "a", operator: "exists" }] } as Block;
    expect(messages(a, dependent)).toEqual(['Block "DEP": "A" is a audio block, which can\'t be used in a condition.']);
  });

  it("may carry its own condition", () => {
    const a = audio("a", "/audio/intro.mp3", "Intro", { enableWhen: [{ question: "q", operator: "=", answer: "Yes" }] });
    expect(messages(choice("q"), a)).toEqual([]);
  });
});

describe("stored and exported values", () => {
  const identity = { formId: "f", formVersionId: "v" };

  it("an audio source is stored trimmed", () => {
    const form = FormSchema.parse({ title: "t", blocks: [audio("a", "  https://cdn.example.com/welcome.mp3 \n")] });
    expect(form.blocks[0].content).toBe("https://cdn.example.com/welcome.mp3");
  });

  it("padding alone is not a change (the editor's dirty state and the API's NO_CHANGES)", () => {
    expect(
      sameContent(
        { title: "t", blocks: [audio("a", "\t/audio/intro.mp3  ")] },
        { title: "t", blocks: [audio("a", "/audio/intro.mp3")] },
      ),
    ).toBe(true);
  });

  it("the artifact holds the trimmed source, label, required: false and no description", () => {
    const artifact = buildArtifact(
      { title: "t", blocks: [audio("a", "\t/audio/breathing.wav#t=10 ", "Breathing exercise", { description: "" })] },
      identity,
    );
    expect(artifact.blocks[0]).toEqual({
      id: "a",
      type: "audio",
      label: "Breathing exercise",
      required: false,
      content: "/audio/breathing.wav#t=10",
    });
  });
});

describe("the Logic section lists everything but a display block's content message", () => {
  // Each display block's content rule is shown once, inline under its field.
  const bad: [string, Block][] = [
    ["text", { id: "x", type: "text", label: "X", required: false, content: "  " } as Block],
    ["image", { id: "x", type: "image", label: "X", required: false, content: "http://example.com/a.png" } as Block],
    ["video", { id: "x", type: "video", label: "X", required: false, content: "https://cdn.example.com/a.mov" } as Block],
    ["audio", audio("x", "https://cdn.example.com/a.flac", "X")],
  ];

  it.each(bad)("%s: the content message is a save problem but not a Logic one", (_type, block) => {
    const blocks = [block];
    expect(formProblems({ blocks }).map((p) => p.blockId)).toEqual(["x"]);
    expect(problemsBesideContent({ blocks }, "x")).toEqual([]);
  });

  it.each(bad)("%s: a condition problem still shows in Logic, once", (_type, block) => {
    const blocks = [{ ...block, enableWhen: [{ question: "later", operator: "exists" }] } as Block, choice("later")];
    const logic = problemsBesideContent({ blocks }, "x").map((p) => p.detail);
    expect(logic).toEqual(['a condition depends on "LATER", which comes after it. A condition can only use a question that comes before it.']);
    // The save sees both: the content rule and the condition.
    expect(formProblems({ blocks }).filter((p) => p.blockId === "x")).toHaveLength(2);
  });

  it("structural problems on groups are still listed", () => {
    expect(problemsBesideContent({ blocks: [group("g", [])] }, "g").map((p) => p.detail)).toEqual([
      "a group must contain at least one block.",
    ]);
  });
});
