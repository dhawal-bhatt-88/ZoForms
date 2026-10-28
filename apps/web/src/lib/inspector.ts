/*
 * Pure helpers for the editor's inspector (the panel for the selected block).
 */

import { BLOCK_META, isGroup, isPage, isPresentationalType, type Block } from "@formbuilder/form-schema";

/**
 * Blocks that ask nothing: the display blocks of contract §9–§11 (text, image,
 * video, audio) and the presentational ones (heading, divider, title, label,
 * hidden field).
 */
const DISPLAY_BLOCK_TYPES: readonly string[] = ["text", "image", "video", "audio"];

function asksNothing(block: Block): boolean {
  return DISPLAY_BLOCK_TYPES.includes(block.type) || isPresentationalType(block.type);
}

/**
 * Title and Label blocks show their `content`, or their `label` only when the
 * content is empty. The inspector gives them one field, Text, which writes the
 * content; the label follows it, so the block is named by what it says on the
 * canvas, in jump links and in save messages.
 */
export const TEXT_ONLY_TYPES: readonly string[] = ["title", "label"];

/**
 * What typing `text` into a Title or Label block's Text field changes: the
 * content as typed, and the label as the trimmed text. Blank text is stored as
 * no text (the renderer would show spaces as they are), and the label is then
 * the type's default ("Title", "Label"), which is what respondents see.
 */
export function textFieldEdit(block: Block, text: string): { content: string; label: string } {
  const blank = !text.trim();
  return { content: blank ? "" : text, label: blank ? BLOCK_META[block.type as keyof typeof BLOCK_META].question : text.trim() };
}

/** The inspector's heading: what the selected block is. A block that asks nothing is named by its type, never "Question". */
export function inspectorHeading(block: Block): string {
  if (isPage(block)) return "Page";
  if (isGroup(block)) return "Group";
  if (asksNothing(block)) return BLOCK_META[block.type].label;
  return "Question";
}

/**
 * How the Logic section names the selected block — "Show this ___ only when…":
 * "page", "group", "question", or for a block that asks nothing its type, e.g.
 * "audio block" (a hidden field is already a noun: "hidden field").
 */
export function logicNoun(block: Block): string {
  if (isPage(block)) return "page";
  if (isGroup(block)) return "group";
  if (block.type === "hidden") return "hidden field";
  if (asksNothing(block)) return `${BLOCK_META[block.type].label.toLowerCase()} block`;
  return "question";
}
