/*
 * Moving blocks around the editor's tree: the flat list the canvas renders, the
 * drop position a drag projects to, and the one-step moves behind the keyboard
 * controls. All of it reads the tree through walkBlocks — nothing here walks it
 * a second way.
 *
 * Dragging follows dnd-kit's "sortable tree" approach: the visible tree is shown
 * as one flat list, and while a block is dragged, its horizontal offset sets how
 * deeply it will sit. Pages and groups hold children. Pages are never dragged:
 * they move with Move up / Move down (movePage), and in a paged form no block
 * may land at the top level, outside every page.
 */

import { arrayMove } from "@dnd-kit/sortable";
import {
  blockName,
  findBlock,
  isContainer,
  isPage,
  walkBlocks,
  type Block,
} from "@formbuilder/form-schema";

/** One visible row of the canvas. */
export type FlatItem = {
  id: string;
  block: Block;
  depth: number;
  /**
   * Nesting counted from the page, so a group looks the same with or without
   * pages: `depth`, less one inside a page.
   */
  level: number;
  /** The enclosing page or group, or null at the top level. */
  parentId: string | null;
  /** A page or group: a row that opens a container. */
  isContainer: boolean;
  isPage: boolean;
  collapsed: boolean;
};

/**
 * The rows the canvas shows, in reading order: everything except what's inside
 * a collapsed page or group — or inside `hideChildrenOf`, the group being
 * dragged, which travels as one row.
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
      level: e.ancestors[0] && isPage(e.ancestors[0]) ? e.depth - 1 : e.depth,
      parentId: e.ancestors[e.ancestors.length - 1]?.id ?? null,
      isContainer: isContainer(e.block),
      isPage: isPage(e.block),
      collapsed: collapsed.has(e.block.id),
    }));
}

/** Where a drag would put the active block: its depth, and the page or group it lands in. */
export type Projection = { depth: number; parentId: string | null; index: number };

/**
 * Where the dragged block lands if dropped now. `offsetX` is how far it has been
 * dragged sideways; every `indentWidth` pixels is one level. The depth is kept
 * within what the neighbours allow: at most one deeper than an open container
 * just above (so it goes inside), never shallower than the row just below. In
 * a paged form the lowest depth is 1 — inside a page — and a drop above Page
 * 1's header lands at the start of Page 1. `index` is its position among the
 * target's children once it has been taken out of its old place — what
 * moveBlockInTree expects.
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
  if (active.isPage) return null; // pages move with Move up / Move down only
  const paged = items.some((i) => i.depth === 0 && i.isPage);
  const floor = paged ? 1 : 0;
  const moved = arrayMove([...items], activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  // Above Page 1's header: clamp into Page 1, at its start.
  if (paged && !previous) {
    const firstPage = moved.find((i) => i.isPage);
    return firstPage ? { depth: 1, parentId: firstPage.id, index: 0 } : null;
  }

  const wanted = active.depth + Math.round(offsetX / indentWidth);
  const maxDepth = previous
    ? previous.isContainer && !previous.collapsed
      ? previous.depth + 1
      : previous.depth
    : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, floor, Math.min(wanted, Math.max(maxDepth, floor)));

  let parentId: string | null = null;
  if (previous && depth > 0) {
    if (depth > previous.depth) parentId = previous.id; // inside the container above
    else if (depth === previous.depth) parentId = previous.parentId;
    else {
      const sibling = moved
        .slice(0, overIndex)
        .reverse()
        .find((i) => i.depth === depth);
      parentId = sibling?.parentId ?? null;
    }
  }

  // Dropped straight after a collapsed page's header: its contents are hidden, so go to its end.
  const parentRow = parentId ? items.find((i) => i.id === parentId) : undefined;
  if (parentRow?.collapsed && isContainer(parentRow.block)) {
    const inside = parentRow.block.blocks.filter((b) => b.id !== activeId).length;
    return { depth, parentId, index: inside };
  }
  const index = moved
    .slice(0, overIndex)
    .filter((i) => i.id !== activeId && i.parentId === parentId).length;
  return { depth, parentId, index };
}

/** A move for moveBlockInTree: into `parentId` (null = top level) at `index`. */
export type MoveTarget = { parentId: string | null; index: number };

/**
 * One step up or down for the keyboard controls. Within a page or group it
 * swaps with the neighbouring block. From the first or last place in a group
 * it steps out, to just before or after it. From the first or last place in a
 * page it steps into the neighbouring page — the end of the previous page or
 * the start of the next — never out to the top level. Entering a group is
 * "Move to…". Null when there's nowhere to go. Not for pages: see movePage.
 */
export function stepMove(blocks: readonly Block[], id: string, direction: -1 | 1): MoveTarget | null {
  const entry = findBlock(blocks, id);
  if (!entry || isPage(entry.block)) return null;
  const index = entry.path[entry.path.length - 1];
  const parent = entry.ancestors[entry.ancestors.length - 1] ?? null;
  const siblings = parent ? parent.blocks : blocks;

  if (direction === -1 && index > 0) return { parentId: parent?.id ?? null, index: index - 1 };
  if (direction === 1 && index < siblings.length - 1) return { parentId: parent?.id ?? null, index: index + 1 };
  if (!parent) return null;

  const parentIndex = entry.path[entry.path.length - 2];
  if (isPage(parent)) {
    const neighbour = blocks[parentIndex + direction];
    if (!neighbour || !isPage(neighbour)) return null;
    return { parentId: neighbour.id, index: direction === -1 ? neighbour.blocks.length : 0 };
  }
  // Step out of the group, to just before or after it in its own parent.
  const grandparent = entry.ancestors[entry.ancestors.length - 2] ?? null;
  return { parentId: grandparent?.id ?? null, index: direction === -1 ? parentIndex : parentIndex + 1 };
}

/**
 * Where "Move to…" can put `id`: every page and group except the block's
 * current one, and — when it's a group — except itself and anything inside it.
 * "Top level" only in a form without pages, and only for a block that's in a
 * group. Each comes with its path of names (page title first) for display.
 */
export function moveDestinations(
  blocks: readonly Block[],
  id: string,
): { id: string | null; path: string[] }[] {
  const moving = findBlock(blocks, id);
  if (!moving || isPage(moving.block)) return [];
  const currentParent = moving.ancestors[moving.ancestors.length - 1]?.id ?? null;
  const paged = blocks.some(isPage);
  const destinations: { id: string | null; path: string[] }[] = [];
  if (!paged && currentParent !== null) destinations.push({ id: null, path: [] });
  for (const e of walkBlocks(blocks)) {
    if (!isContainer(e.block)) continue;
    if (e.block.id === id || e.ancestors.some((a) => a.id === id)) continue;
    if (e.block.id === currentParent) continue;
    destinations.push({ id: e.block.id, path: [...e.ancestors.map(blockName), blockName(e.block)] });
  }
  return destinations;
}
