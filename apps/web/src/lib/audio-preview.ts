/*
 * What the editor's canvas says about an audio block. The canvas loads
 * nothing, so instead of a player it names the file the renderer will play,
 * recognised by the same rule (parseAudioSource, contract §11).
 */

import { parseAudioSource } from "@formbuilder/form-schema";

/** The canvas text for an audio block's source. */
export function audioPreviewText(content: string | undefined): string {
  const src = parseAudioSource(content);
  return src === null ? "Add an audio file" : `Audio file · ${src}`;
}
