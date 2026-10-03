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

  it("refuses values that break the room, and says why", () => {
    const tooWide = editDimension(room(), { kind: "opening", openingId: "door-1" }, 200);
    expect(tooWide.ok).toBe(false);
    expect(!tooWide.ok && tooWide.reason).toMatch(/overlaps|fit/);
    expect(editDimension(room(), { kind: "wall", wallIndex: 0 }, -5)).toEqual({ ok: false, reason: "Enter a length above 0 cm" });
    // Shortening the wall under the window would cut it off.
    expect(editDimension(room(), { kind: "wall", wallIndex: 0 }, 300).ok).toBe(false);
  });

  it("only lengthens walls of right-angled rooms", () => {
    const slanted: RoomShape = { ...room(), polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 350, y: 300 }, { x: 0, y: 300 }], openings: [] };
    expect(isRightAngled(slanted.polygon)).toBe(false);
    expect(editDimension(slanted, { kind: "wall", wallIndex: 0 }, 420).ok).toBe(false);
  });
});
