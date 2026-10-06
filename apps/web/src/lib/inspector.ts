/*
 * Pure helpers for the editor's inspector (the panel for the selected block).
 */

import { BLOCK_META, isGroup, isPage, type Block } from "@formbuilder/form-schema";

/** The display blocks of contract §9–§11: they show content and ask nothing. */
const DISPLAY_BLOCK_TYPES: readonly string[] = ["text", "image", "video", "audio"];

/** The inspector's heading: what the selected block is. A display block is named by its type, never "Question". */
export function inspectorHeading(block: Block): string {
  if (isPage(block)) return "Page";
  if (isGroup(block)) return "Group";
  if (DISPLAY_BLOCK_TYPES.includes(block.type)) return BLOCK_META[block.type].label;
  return "Question";
}

/**
 * How the Logic section names the selected block — "Show this ___ only when…":
 * "page", "group", "question", or for a display block its type, e.g. "audio block".
 */
export function logicNoun(block: Block): string {
  if (isPage(block)) return "page";
  if (isGroup(block)) return "group";
  if (DISPLAY_BLOCK_TYPES.includes(block.type)) return `${BLOCK_META[block.type].label.toLowerCase()} block`;
  return "question";
}
