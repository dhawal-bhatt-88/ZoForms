import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  displayBlockProblem,
  findBlock,
  formProblems,
  FormSchema,
  isAnswerable,
  newBlock,
  parseVideoSource,
  questionNumbers,
  sourceOperators,
  type Block,
  type PageBlock,
  type VideoSource,
} from "./index";

// docs/GROUPS-AND-PAGES-CONTRACT.md §10: the `video` display block.

const ID = "dQw4w9WgXcQ";
const yt = (start?: number): VideoSource => (start === undefined ? { kind: "youtube", id: ID } : { kind: "youtube", id: ID, start });
const vimeo = (hash?: string): VideoSource =>
  hash === undefined ? { kind: "vimeo", id: "76979871" } : { kind: "vimeo", id: "76979871", hash };
const file = (src: string): VideoSource => ({ kind: "file", src });

/** Contract §10's shared test table, verbatim (the renderer tests the same one), with what each parses to. */
const SECTION_10_RECOGNISED: [string, VideoSource][] = [
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", yt()],
  ["https://youtu.be/dQw4w9WgXcQ?t=90", yt(90)],
  ["https://youtu.be/dQw4w9WgXcQ?t=90s", yt(90)],
  ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", yt(90)],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s", yt(3723)],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc", yt()],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0", yt()],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc&start=20", yt(20)],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0&start=20", yt()],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", yt()],
  ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", yt()],
  ["https://vimeo.com/76979871", vimeo()],
  ["https://vimeo.com/76979871/abc123def4", vimeo("abc123def4")],
  ["https://vimeo.com/76979871?h=abc123def4", vimeo("abc123def4")],
  ["https://player.vimeo.com/video/76979871?h=abc123def4", vimeo("abc123def4")],
  ["https://cdn.example.com/intro.mp4", file("https://cdn.example.com/intro.mp4")],
  ["/videos/intro.WEBM", file("/videos/intro.WEBM")],
  ["  https://youtu.be/dQw4w9WgXcQ  ", yt()],
];

const SECTION_10_NOT_RECOGNISED = [
  "",
  "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
  "https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/playlist?list=PL123",
  "https://youtu.be/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ/",
  "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
  "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/clip.mp4",
  "https://vimeo.com/channels/staffpicks",
  "https://vimeo.com/abc",
  "https://cdn.example.com/intro.mov",
  "https://user@cdn.example.com/intro.mp4",
  "//cdn.example.com/intro.mp4",
  "javascript:alert(1)",
  "<iframe src=x></iframe>",
];

describe("parseVideoSource — contract §10 shared table", () => {
  it.each(SECTION_10_RECOGNISED)("recognises %j", (src, expected) => {
    expect(parseVideoSource(src)).toEqual(expected);
  });
  it.each(SECTION_10_NOT_RECOGNISED)("does not recognise %j", (src) => {
    expect(parseVideoSource(src)).toBeNull();
  });
});

describe("parseVideoSource — the contract's other rules", () => {
  it.each<[string, VideoSource]>([
    // Every YouTube path form and host.
    ["https://www.youtube.com/embed/dQw4w9WgXcQ?start=45", yt(45)],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", yt()],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", yt()],
    ["https://youtube-nocookie.com/embed/dQw4w9WgXcQ", yt()],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2", yt()],
    // The default port is dropped by URL parsing, so it counts as no port.
    ["https://www.youtube.com:443/watch?v=dQw4w9WgXcQ", yt()],
    ["HTTPS://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ", yt()],
    ["https://www.vimeo.com/76979871", vimeo()],
    ["https://player.vimeo.com/video/76979871", vimeo()],
    // A path hash wins over ?h=; a malformed ?h= is ignored and the video kept.
    ["https://vimeo.com/76979871/abc123def4?h=zzz999", vimeo("abc123def4")],
    ["https://vimeo.com/76979871?h=bad!", vimeo()],
    // Files: the extension is read from the path, before ? or #.
    ["https://cdn.example.com/a/intro.mp4?token=x#t=10", file("https://cdn.example.com/a/intro.mp4?token=x#t=10")],
    ["https://cdn.example.com/intro.webm", file("https://cdn.example.com/intro.webm")],
    ["\n\t/videos/intro.mp4 ", file("/videos/intro.mp4")],
  ])("recognises %j", (src, expected) => {
    expect(parseVideoSource(src)).toEqual(expected);
  });

  it.each([
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com./watch?v=dQw4w9WgXcQ",
    "https://user:pw@vimeo.com/76979871",
    "https://player.vimeo.com:444/video/76979871",
    "https://www.youtube.com/watch/?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ/",
    "https://vimeo.com/video/76979871",
    "https://player.vimeo.com/video/76979871/",
    // Player hosts are exclusive: never a video file.
    "https://player.vimeo.com/intro.mp4",
    "https://youtu.be/intro.mp4",
    // Files follow §9.
    "http://cdn.example.com/intro.mp4",
    "https://cdn.example.com/watch?file=intro.mp4",
    "https://cdn.example.com/#intro.mp4",
    "videos/intro.mp4",
    "/\\evil.com/intro.mp4",
    "https://user:pass@cdn.example.com/intro.mp4",
    "data:video/mp4;base64,AAAA",
    "   ",
    undefined,
  ])("does not recognise %j", (src) => {
    expect(parseVideoSource(src)).toBeNull();
  });

  it.each<[string, number | undefined]>([
    ["90", 90],
    ["5m", 300],
    ["2h", 7200],
    ["1h30s", 3630],
    ["0s", undefined],
    ["", undefined],
    ["-5", undefined],
    ["1.5", undefined],
    ["1m30", undefined],
    ["1M30S", undefined],
  ])("start time t=%s gives %s", (t, start) => {
    expect(parseVideoSource(`https://youtu.be/${ID}?t=${t}`)).toEqual(yt(start));
  });
});

const video = (id: string, content: string | undefined, label = id.toUpperCase(), extra: object = {}): Block =>
  ({ id, type: "video", label, required: false, ...(content === undefined ? {} : { content }), ...extra }) as Block;
const choice = (id: string): Block => ({ id, type: "choice", label: id.toUpperCase(), required: false, options: ["Yes", "No"] }) as Block;
const page = (id: string, blocks: Block[]): PageBlock => ({ id, type: "page", title: id.toUpperCase(), blocks }) as unknown as PageBlock;
const group = (id: string, blocks: Block[]): Block => ({ id, type: "group", label: id.toUpperCase(), blocks }) as Block;
const messages = (...blocks: Block[]) => formProblems({ blocks }).map((p) => p.message);
const VIDEO_MSG = (path: string) =>
  `Video "${path}": paste a YouTube or Vimeo link, or the address of an .mp4 or .webm file (https:// or a path on your app's server such as /videos/intro.mp4).`;

describe("save rule: video", () => {
  it("rejects an empty, missing or unrecognised source, naming the block by its path", () => {
    expect(messages(video("v", ""))).toEqual([VIDEO_MSG("V")]);
    expect(messages(video("v", undefined))).toEqual([VIDEO_MSG("V")]);
    expect(messages(video("v", "   "))).toEqual([VIDEO_MSG("V")]);
    expect(messages(video("v", "https://www.youtube.com/playlist?list=PL123", "Intro"))).toEqual([VIDEO_MSG("Intro")]);
    expect(messages(page("p1", [group("g", [video("v", "https://cdn.example.com/intro.mov", "Intro")])]))).toEqual([
      VIDEO_MSG("P1 › G › Intro"),
    ]);
  });

  it("accepts every recognised kind", () => {
    expect(
      messages(
        video("a", "https://youtu.be/dQw4w9WgXcQ?t=90"),
        video("b", "https://vimeo.com/76979871"),
        video("c", " /videos/intro.mp4 "),
      ),
    ).toEqual([]);
  });

  it("the editor's inline message is the same as the save message", () => {
    const blocks = [page("p1", [video("v", "https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ", "Intro")])];
    expect(displayBlockProblem(findBlock(blocks, "v")!)!.message).toBe(formProblems({ blocks })[0].message);
    expect(displayBlockProblem(findBlock(blocks, "v")!)!.message).toBe(VIDEO_MSG("P1 › Intro"));
    expect(displayBlockProblem(findBlock([video("ok", "https://vimeo.com/76979871")], "ok")!)).toBeNull();
  });

  it("a new video straight from the menu can't be saved until a source is added", () => {
    const block = newBlock("video", { id: "v" } as never);
    expect(block.content).toBe("");
    expect(messages(block)).toEqual([VIDEO_MSG("Video")]);
  });
});

describe("video is presentational (§10, §3.3, §4)", () => {
  it("is not answerable, not numbered, and can't be a condition source", () => {
    const v = video("v", "https://youtu.be/dQw4w9WgXcQ");
    expect(isAnswerable(v)).toBe(false);
    expect(questionNumbers([v, choice("q")]).get("v")).toBeUndefined();
    expect(sourceOperators(v)).toBeUndefined();
    const dependent = { ...choice("dep"), enableWhen: [{ question: "v", operator: "exists" }] } as Block;
    expect(messages(v, dependent)).toEqual(['Block "DEP": "V" is a video block, which can\'t be used in a condition.']);
  });

  it("may carry its own condition", () => {
    const v = video("v", "https://youtu.be/dQw4w9WgXcQ", "Intro", { enableWhen: [{ question: "q", operator: "=", answer: "Yes" }] });
    expect(messages(choice("q"), v)).toEqual([]);
  });
});

describe("stored and exported values", () => {
  const identity = { formId: "f", formVersionId: "v" };

  it("a video source is stored trimmed", () => {
    const form = FormSchema.parse({ title: "t", blocks: [video("v", "  https://youtu.be/dQw4w9WgXcQ?t=90 \n")] });
    expect(form.blocks[0].content).toBe("https://youtu.be/dQw4w9WgXcQ?t=90");
  });

  it("the artifact holds the trimmed source as authored, not a rewritten player URL", () => {
    const artifact = buildArtifact(
      { title: "t", blocks: [video("v", "\thttps://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s ", "Intro", { description: "" })] },
      identity,
    );
    expect(artifact.blocks[0]).toEqual({
      id: "v",
      type: "video",
      label: "Intro",
      required: false,
      content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s",
    });
  });
});
