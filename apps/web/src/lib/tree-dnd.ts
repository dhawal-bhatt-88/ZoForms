/*
 * Moving blocks around the editor's tree: the flat list the canvas renders, the
 * drop position a drag projects to, and the one-step moves behind the keyboard
 * controls. All of it reads the tree through walkBlocks — nothing here walks it
 * a second way.
 *
 * Dragging follows dnd-kit's "sortable tree" approach: the visible tree is shown
 * as one flat list, and while a block is dragged, its horizontal offset sets how
 * deeply it will sit. Only a group can hold children.
 */

import { arrayMove } from "@dnd-kit/sortable";
import { findBlock, isGroup, walkBlocks, type Block } from "@formbuilder/form-schema";

/** One visible row of the canvas. */
export type FlatItem = {
  id: string;
  block: Block;
  depth: number;
  /** The enclosing group, or null at the top level. */
  parentId: string | null;
  isGroup: boolean;
  collapsed: boolean;
};

/**
 * The rows the canvas shows, in reading order: everything except what's inside
 * a collapsed group — or inside `hideChildrenOf`, the group being dragged, which
 * travels as one row.
 */
export function flattenVisible(
  blocks: readonly Block[],
  collapsed: ReadonlySet<string>,
  hideChildrenOf?: string | null,
): FlatItem[] {
  return walkBlocks(blocks)
    .filter((e) => !e.ancestors.some((a) => collapsed.has(a.id) || a.id === hideChildrenOf))
    .map((e) => ({
      id: e.block.id,
      block: e.block,
      depth: e.depth,
      parentId: e.ancestors[e.ancestors.length - 1]?.id ?? null,
      isGroup: isGroup(e.block),
      collapsed: collapsed.has(e.block.id),
    }));
}

/** Where a drag would put the active block: its depth, and the group it lands in. */
export type Projection = { depth: number; parentId: string | null; index: number };

/**
 * Where the dragged block lands if dropped now. `offsetX` is how far it has been
 * dragged sideways; every `indentWidth` pixels is one level. The depth is kept
 * within what the neighbours allow: at most one deeper than an open group just
 * above (so it goes inside), never shallower than the row just below.
 * `index` is its position among the target group's children once it has been
 * taken out of its old place — what moveBlockInTree expects.
 */
export function getProjection(
  items: readonly FlatItem[],
  activeId: string,
  overId: string,
  offsetX: number,
  indentWidth: number,
): Projection | null {
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const overIndex = items.findIndex((i) => i.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;

  const active = items[activeIndex];
  const moved = arrayMove([...items], activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const wanted = active.depth + Math.round(offsetX / indentWidth);
  const maxDepth = previous
    ? previous.isGroup && !previous.collapsed
      ? previous.depth + 1
      : previous.depth
    : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(wanted, maxDepth));

  let parentId: string | null = null;
  if (previous && depth > 0) {
    if (depth > previous.depth) parentId = previous.id; // inside the open group above
    else if (depth === previous.depth) parentId = previous.parentId;
    else {
      const sibling = moved
        .slice(0, overIndex)
        .reverse()
        .find((i) => i.depth === depth);
      parentId = sibling?.parentId ?? null;
    }
  }

  const index = moved
    .slice(0, overIndex)
    .filter((i) => i.id !== activeId && i.parentId === parentId).length;
  return { depth, parentId, index };
}

/** A move for moveBlockInTree: into `parentId` (null = top level) at `index`. */
export type MoveTarget = { parentId: string | null; index: number };

/**
 * One step up or down for the keyboard controls. Within a group it swaps with
 * the neighbouring block; from the first or last place it steps out of the
 * group, to just before or after it. Entering a group is "Move to group…".
 * Null when there's nowhere to go.
 */
export function stepMove(blocks: readonly Block[], id: string, direction: -1 | 1): MoveTarget | null {
  const entry = findBlock(blocks, id);
  if (!entry) return null;
  const index = entry.path[entry.path.length - 1];
  const parent = entry.ancestors[entry.ancestors.length - 1] ?? null;
  const siblings = parent ? parent.blocks : blocks;

  if (direction === -1 && index > 0) return { parentId: parent?.id ?? null, index: index - 1 };
  if (direction === 1 && index < siblings.length - 1) return { parentId: parent?.id ?? null, index: index + 1 };
  if (!parent) return null;

  // Step out of the group, to just before or after it in its own parent.
  const grandparent = entry.ancestors[entry.ancestors.length - 2] ?? null;
  const parentIndex = entry.path[entry.path.length - 2];
  return { parentId: grandparent?.id ?? null, index: direction === -1 ? parentIndex : parentIndex + 1 };
}

/**
 * Groups `id` can be moved into with "Move to group…": every group except the
 * block's current one, and — when it's a group — except itself and anything
 * inside it. Each comes with its path of group labels for display.
 */
export function moveDestinations(
  blocks: readonly Block[],
  id: string,
): { id: string | null; path: string[] }[] {
  const moving = findBlock(blocks, id);
  if (!moving) return [];
  const currentParent = moving.ancestors[moving.ancestors.length - 1]?.id ?? null;
  const destinations: { id: string | null; path: string[] }[] = [];
  if (currentParent !== null) destinations.push({ id: null, path: [] });
  for (const e of walkBlocks(blocks)) {
    if (!isGroup(e.block)) continue;
    if (e.block.id === id || e.ancestors.some((a) => a.id === id)) continue;
    if (e.block.id === currentParent) continue;
    destinations.push({ id: e.block.id, path: [...e.ancestors.map((a) => a.label), e.block.label] });
  }
  return destinations;
}
