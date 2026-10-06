import { describe, expect, it } from "vitest";
import { audioPreviewText } from "./audio-preview";

describe("audioPreviewText (the canvas preview)", () => {
  it.each([
    ["/audio/breathing.ogg", "Audio file · /audio/breathing.ogg"],
    ["  /audio/intro.mp3  ", "Audio file · /audio/intro.mp3"],
    ["https://cdn.example.com/welcome.M4A?v=2", "Audio file · https://cdn.example.com/welcome.M4A?v=2"],
    ["", "Add an audio file"],
    [undefined, "Add an audio file"],
    ["   ", "Add an audio file"],
    ["https://cdn.example.com/welcome.flac", "Add an audio file"],
    ["https://open.spotify.com/track/abc", "Add an audio file"],
    ["http://cdn.example.com/welcome.mp3", "Add an audio file"],
  ])("%j → %j", (content, text) => {
    expect(audioPreviewText(content)).toBe(text);
  });
});
