import { describe, expect, it } from "vitest";
import type { Opening, RoomShape } from "../schemas/room";
import { editDimension, isRightAngled } from "./edit-dimensions";
import { rectRoom } from "./factory";

const door: Opening = { id: "door-1", kind: "door", wallIndex: 0, offset: 17, width: 88, height: 200, hinge: "start", swing: "in" };
const win: Opening = { id: "window-1", kind: "window", wallIndex: 0, offset: 200, width: 138, height: 120, sillHeight: 90, openable: true };
const room = (): RoomShape => ({ ...rectRoom({ name: "Hall", type: "hallway", widthCm: 400, lengthCm: 300 }), openings: [door, win] });

const ok = <T,>(r: { ok: true; room: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(r.reason);
  return r.room;
};

describe("editDimension", () => {
  it("sets an opening's width, keeping where it starts", () => {
    const r = ok(editDimension(room(), { kind: "opening", openingId: "door-1" }, 90));
    expect(r.openings[0]).toMatchObject({ offset: 17, width: 90 });
  });

  it("moves an opening by the stretch before it, measured from the previous opening", () => {
    expect(ok(editDimension(room(), { kind: "before", openingId: "door-1" }, 30)).openings[0]!.offset).toBe(30);
    // Before the window: from the end of the door (17 + 88 = 105).
    expect(ok(editDimension(room(), { kind: "before", openingId: "window-1" }, 50)).openings[1]!.offset).toBe(155);
  });

  it("moves the last opening by the stretch after it", () => {
    // 400 long wall, window 138 wide, 40 left after it: starts at 222.
    expect(ok(editDimension(room(), { kind: "after", openingId: "window-1" }, 40)).openings[1]!.offset).toBe(222);
  });

  it("lengthens a wall by moving the side beyond its end", () => {
    const r = ok(editDimension(room(), { kind: "wall", wallIndex: 0 }, 450));
    expect(r.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 450, y: 0 },
      { x: 450, y: 300 },
      { x: 0, y: 300 },
    ]);
    // The left wall (index 3) runs bottom to top; its far side is the top edge.
    const deeper = ok(editDimension(room(), { kind: "wall", wallIndex: 3 }, 320));
    expect(deeper.polygon.map((p) => p.y).sort((a, b) => a - b)).toEqual([-20, -20, 300, 300]);
  });

  it("lets the user set any length, and only refuses what cannot be a room", () => {
    // A door wide enough to run into the window is allowed; Checks warns about it.
    const wide = editDimension(room(), { kind: "opening", openingId: "door-1" }, 200);
    expect(wide.ok && wide.warning).toMatch(/overlaps/);
    expect(editDimension(room(), { kind: "wall", wallIndex: 0 }, -5)).toEqual({ ok: false, reason: "Enter a length above 0 cm" });
    // 20 × 300 cm is under 1 m².
    expect(editDimension(room(), { kind: "wall", wallIndex: 0 }, 20)).toEqual({ ok: false, reason: "Room must be at least 1 m²" });
  });

  it("shortening a wall under a window moves the window back onto it", () => {
    const r = ok(editDimension(room(), { kind: "wall", wallIndex: 0 }, 300));
    const w = r.openings.find((o) => o.id === "window-1")!;
    expect(w.offset + w.width).toBeLessThanOrEqual(300);
    expect(w.width).toBe(138);
  });

  // The main bedroom: a step in the top-left corner where the corridor door is.
  //   (0,0)───(445,0)
  //     │        │
  //  (-90,80)─(0,80)
  //     │        …  bottom wall 535 long, running right to left
  const stepped = (): RoomShape => ({
    ...room(),
    openings: [{ ...win, wallIndex: 5, offset: 10, width: 50 }],
    polygon: [{ x: 0, y: 0 }, { x: 445, y: 0 }, { x: 445, y: 400 }, { x: -90, y: 400 }, { x: -90, y: 80 }, { x: 0, y: 80 }],
  });

  it("shortens a wall even when that leaves a very short wall, with a warning", () => {
    const res = editDimension(stepped(), { kind: "wall", wallIndex: 2 }, 447);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.polygon[3]).toEqual({ x: -2, y: 400 });
    expect(res.warning).toBe("Wall 5 is shorter than 10 cm");
  });

  it("removes a corner when a wall shrinks to nothing, keeping openings on the right walls", () => {
    const r = ok(editDimension(stepped(), { kind: "wall", wallIndex: 2 }, 445));
    expect(r.polygon).toEqual([{ x: 0, y: 0 }, { x: 445, y: 0 }, { x: 445, y: 400 }, { x: 0, y: 400 }, { x: 0, y: 80 }]);
    // The window was on wall 6 (index 5, the step's top); with wall 5 gone it is wall 5 (index 4).
    expect(r.openings[0]!.wallIndex).toBe(4);
  });

  it("in a room with slanted walls, moves the wall's end corner so the next wall tilts", () => {
    const slanted: RoomShape = { ...room(), polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 350, y: 300 }, { x: 0, y: 300 }], openings: [] };
    expect(isRightAngled(slanted.polygon)).toBe(false);
    const r = ok(editDimension(slanted, { kind: "wall", wallIndex: 0 }, 420));
    expect(r.polygon).toEqual([{ x: 0, y: 0 }, { x: 420, y: 0 }, { x: 350, y: 300 }, { x: 0, y: 300 }]);
  });
});
