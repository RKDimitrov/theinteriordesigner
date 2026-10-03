import { describe, expect, it } from "vitest";
import type { Opening, RoomShape } from "../schemas/room";
import { collapseWall, moveCorner, moveWall, removeCorner } from "./edit-shape";
import { rectRoom } from "./factory";

const door: Opening = { id: "door-1", kind: "door", wallIndex: 2, offset: 50, width: 80, height: 200, hinge: "start", swing: "in" };
const win: Opening = { id: "window-1", kind: "window", wallIndex: 4, offset: 20, width: 60, height: 100, sillHeight: 90, openable: true };

// An L: 400 wide, 300 deep, with the top-right 150 × 100 cut away.
//  (0,0)──(250,0)
//    │       │
//    │    (250,100)──(400,100)
//    │                  │
//  (0,300)──────────(400,300)
const ell = (): RoomShape => ({
  ...rectRoom({ name: "L", type: "living", widthCm: 400, lengthCm: 300 }),
  polygon: [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 300 }],
  openings: [door, win],
  roofSlopes: [{ wallIndex: 5, kneeHeight: 150, depth: 60 }],
});

const ok = <T,>(r: { ok: true; room: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(r.reason);
  return r.room;
};

describe("removeCorner", () => {
  it("joins the two walls at the corner into one, renumbering what refers to later walls", () => {
    // Corner 2 (250,100): walls 1 and 2 become one slanted wall from (250,0) to (400,100).
    const r = ok(removeCorner(ell(), 2));
    expect(r.polygon).toEqual([{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 300 }]);
    // The door was on wall 2 (index 2): it stays on the joined wall (index 1), still 80 wide.
    const d = r.openings.find((o) => o.id === "door-1")!;
    expect(d.wallIndex).toBe(1);
    expect(d.width).toBe(80);
    // The window on index 4 moves to 3; the roof slope on index 5 to 4.
    expect(r.openings.find((o) => o.id === "window-1")!.wallIndex).toBe(3);
    expect(r.roofSlopes).toEqual([{ wallIndex: 4, kneeHeight: 150, depth: 60 }]);
  });

  it("refuses to leave fewer than three walls", () => {
    const tri: RoomShape = { ...ell(), polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 300 }], openings: [], roofSlopes: [] };
    expect(removeCorner(tri, 1)).toEqual({ ok: false, reason: "A room needs at least three walls" });
  });
});

describe("collapseWall", () => {
  it("merges the wall's two corners at its middle, so its neighbours meet there", () => {
    // Wall 2 runs (250,100) → (400,100); both corners go to (325,100).
    const r = ok(collapseWall(ell(), 2));
    expect(r.polygon).toEqual([{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 325, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 300 }]);
    // The door on the collapsed wall goes with it; later walls are renumbered.
    expect(r.openings.map((o) => [o.id, o.wallIndex])).toEqual([["window-1", 3]]);
    expect(r.roofSlopes).toEqual([{ wallIndex: 4, kneeHeight: 150, depth: 60 }]);
  });

  it("refuses on a triangle", () => {
    const tri: RoomShape = { ...ell(), polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 300 }], openings: [], roofSlopes: [] };
    expect(collapseWall(tri, 0).ok).toBe(false);
  });
});

describe("moveCorner and moveWall", () => {
  it("moves one corner, sliding openings back onto a wall that got shorter", () => {
    const r = ok(moveCorner(ell(), 3, { x: 300, y: 100 }));
    expect(r.polygon[3]).toEqual({ x: 300, y: 100 });
    // Wall 2 is now 50 long: the 80 cm door is narrowed to fit.
    expect(r.openings.find((o) => o.id === "door-1")!.width).toBe(50);
  });

  it("will not put a corner on top of its neighbour", () => {
    expect(moveCorner(ell(), 3, { x: 250, y: 100 }).ok).toBe(false);
  });

  it("moves a wall square to itself, whatever the direction asked", () => {
    // Wall 4 runs down the right side; moving it by (-20, 7) moves it 20 to the left only.
    const r = ok(moveWall(ell(), 3, { x: -20, y: 7 }));
    expect(r.polygon[3]).toEqual({ x: 380, y: 100 });
    expect(r.polygon[4]).toEqual({ x: 380, y: 300 });
  });
});
