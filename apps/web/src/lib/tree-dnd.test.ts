import { describe, expect, it } from "vitest";
import { moveBlockInTree, walkBlocks, type Block } from "@formbuilder/form-schema";
import { flattenVisible, getProjection, moveDestinations, stepMove } from "./tree-dnd";

const leaf = (id: string): Block => ({ id, type: "short", label: id.toUpperCase(), required: false });
const group = (id: string, blocks: Block[]): Block => ({ id, type: "group", label: id.toUpperCase(), blocks });
const tree = (): Block[] => [leaf("a"), group("g", [leaf("b"), leaf("c")]), leaf("d")];
/** The tree in reading order, two spaces of indent per level. */
const ids = (blocks: Block[]) => walkBlocks(blocks).map((e) => `${"  ".repeat(e.depth)}${e.block.id}`).join(",");
const W = 28;

function drop(blocks: Block[], collapsed: Set<string>, active: string, over: string, dx: number) {
  const rows = flattenVisible(blocks, collapsed, active);
  const p = getProjection(rows, active, over, dx, W)!;
  return { p, result: ids(moveBlockInTree(blocks, active, p.parentId, p.index)) };
}

describe("drag projection", () => {
  it("dropping between two children lands inside the group", () => {
    const { p, result } = drop(tree(), new Set(), "d", "c", 0);
    expect(p).toEqual({ depth: 1, parentId: "g", index: 1 });
    expect(result).toBe("a,g,  b,  d,  c");
  });
  it("dragging right onto an open group puts the block inside it, first", () => {
    const { p, result } = drop(tree(), new Set(), "a", "g", W);
    expect(p).toEqual({ depth: 1, parentId: "g", index: 0 });
    expect(result).toBe("g,  a,  b,  c,d");
  });
  it("dragging the last child left takes it out of the group, just after it", () => {
    const { p, result } = drop(tree(), new Set(), "c", "c", -W);
    expect(p).toEqual({ depth: 0, parentId: null, index: 2 });
    expect(result).toBe("a,g,  b,c,d");
  });
  it("can't drop into a collapsed group", () => {
    const { p } = drop(tree(), new Set(["g"]), "d", "g", W * 3);
    expect(p.depth).toBe(0);
    expect(p.parentId).toBe(null);
  });
  it("a dragged group travels with its contents", () => {
    const { p, result } = drop(tree(), new Set(), "g", "a", 0);
    expect(p).toEqual({ depth: 0, parentId: null, index: 0 });
    expect(result).toBe("g,  b,  c,a,d");
  });
  it("nests into a deeper group and outdents several levels at once", () => {
    const deep: Block[] = [group("g1", [group("g2", [leaf("x")])]), leaf("y")];
    // Dragged up over x, y takes x's place — just before it — two levels in.
    const into = drop(deep, new Set(), "y", "x", W * 2);
    expect(into.p).toEqual({ depth: 2, parentId: "g2", index: 0 });
    expect(into.result).toBe("g1,  g2,    y,    x");
    const out = drop(deep, new Set(), "x", "x", -W * 2);
    expect(out.p).toEqual({ depth: 0, parentId: null, index: 1 });
    expect(out.result).toBe("g1,  g2,x,y");
  });
});

describe("keyboard moves", () => {
  it("swaps within a group and steps out at its ends", () => {
    const t = tree();
    expect(stepMove(t, "b", -1)).toEqual({ parentId: null, index: 1 });
    expect(ids(moveBlockInTree(t, "b", null, 1))).toBe("a,b,g,  c,d");
    expect(stepMove(t, "c", 1)).toEqual({ parentId: null, index: 2 });
    expect(ids(moveBlockInTree(t, "c", null, 2))).toBe("a,g,  b,c,d");
    expect(stepMove(t, "b", 1)).toEqual({ parentId: "g", index: 1 });
    expect(stepMove(t, "a", -1)).toBe(null);
    expect(stepMove(t, "d", 1)).toBe(null);
  });
  it("offers every other group, never the block's own group, itself or its contents", () => {
    const t: Block[] = [group("g1", [leaf("x"), group("g2", [leaf("y")])]), group("g3", [leaf("z")])];
    expect(moveDestinations(t, "x").map((d) => d.id)).toEqual([null, "g2", "g3"]);
    expect(moveDestinations(t, "g1").map((d) => d.id)).toEqual(["g3"]);
    expect(moveDestinations(t, "y").find((d) => d.id === "g3")?.path).toEqual(["G3"]);
  });
});
