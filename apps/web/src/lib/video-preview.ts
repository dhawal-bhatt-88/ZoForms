/*
 * What the editor's canvas says about a video block. The canvas loads nothing
 * third-party, so instead of a player it names what the renderer will play,
 * recognised by the same rule (parseVideoSource, contract §10).
 */

import { parseVideoSource } from "@formbuilder/form-schema";

/** Seconds as a clock: 90 → "1:30", 3723 → "1:02:03". */
export function formatStartTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The canvas text for a video block's source. */
export function videoPreviewText(content: string | undefined): string {
  const source = parseVideoSource(content);
  if (!source) return "Add a video link";
  if (source.kind === "youtube") {
    const start = source.start === undefined ? "" : ` · from ${formatStartTime(source.start)}`;
    return `YouTube video · ${source.id}${start}`;
  }
  if (source.kind === "vimeo") return `Vimeo video · ${source.id}`;
  return `Video file · ${source.src}`;
}
