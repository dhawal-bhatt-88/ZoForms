import { describe, expect, it } from "vitest";
import { formatStartTime, videoPreviewText } from "./video-preview";

describe("videoPreviewText (the canvas preview for each kind)", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube video · dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=90", "YouTube video · dQw4w9WgXcQ · from 1:30"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s", "YouTube video · dQw4w9WgXcQ · from 1:02:03"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0", "YouTube video · dQw4w9WgXcQ"],
    ["https://vimeo.com/76979871/abc123def4", "Vimeo video · 76979871"],
    ["https://player.vimeo.com/video/76979871?h=abc123def4", "Vimeo video · 76979871"],
    ["  /videos/intro.mp4 ", "Video file · /videos/intro.mp4"],
    ["https://cdn.example.com/intro.webm", "Video file · https://cdn.example.com/intro.webm"],
    ["", "Add a video link"],
    [undefined, "Add a video link"],
    ["https://www.youtube.com/playlist?list=PL123", "Add a video link"],
    ["https://cdn.example.com/intro.mov", "Add a video link"],
  ])("%j → %j", (content, text) => {
    expect(videoPreviewText(content)).toBe(text);
  });
});

describe("formatStartTime", () => {
  it.each([
    [5, "0:05"],
    [90, "1:30"],
    [600, "10:00"],
    [3600, "1:00:00"],
    [3723, "1:02:03"],
  ])("%d → %s", (seconds, text) => {
    expect(formatStartTime(seconds)).toBe(text);
  });
});
