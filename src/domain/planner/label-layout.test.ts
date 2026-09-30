import { describe, expect, it } from "vitest";
import { type Box, overlapArea, placeLabels } from "./label-layout";

const label = (id: string, anchor: Box) => ({ id, anchor, w: 60, h: 10 });
const boxAt = (c: { x: number; y: number }): Box => ({ x: c.x - 30, y: c.y - 5, w: 60, h: 10 });

describe("placeLabels", () => {
  it("puts a label in the middle of its ghost when nothing is in the way", () => {
    const at = placeLabels([label("a", { x: 0, y: 0, w: 100, h: 40 })], [], 4);
    expect(at["a"]).toEqual({ x: 50, y: 20 });
  });

  it("moves a label off a placed piece that covers the ghost", () => {
    const ghost = { x: 0, y: 0, w: 100, h: 40 };
    const sofa = { x: -10, y: 5, w: 120, h: 30 };
    const at = placeLabels([label("a", ghost)], [sofa], 4);
    expect(overlapArea(boxAt(at["a"]!), sofa)).toBe(0);
    // Above the ghost is tried first.
    expect(at["a"]).toEqual({ x: 50, y: -9 });
  });

  it("keeps the labels of overlapping ghosts apart", () => {
    const at = placeLabels([label("a", { x: 0, y: 0, w: 100, h: 40 }), label("b", { x: 10, y: 5, w: 100, h: 40 })], [], 4);
    expect(overlapArea(boxAt(at["a"]!), boxAt(at["b"]!))).toBe(0);
  });

  it("settles for the least covered spot when every one is taken", () => {
    const ghost = { x: 0, y: 0, w: 100, h: 40 };
    const everywhere = { x: -500, y: -500, w: 1000, h: 1000 };
    expect(placeLabels([label("a", ghost)], [everywhere], 4)["a"]).toEqual({ x: 50, y: 20 });
  });
});
