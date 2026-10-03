import { describe, expect, it } from "vitest";
import { rectPolygon } from "@/domain/geometry/polygon";
import { cataloguePieces, newPlannerItem } from "@/domain/planner/items";
import type { Opening, Room } from "@/domain/schemas/room";
import { copySelection, nudgeSelection, PASTE_OFFSET_CM, pasteClip, turnSelection } from "./edit-ops";
import type { Plan } from "./state";

const door: Opening = { id: "door-1", kind: "door", wallIndex: 0, offset: 50, width: 90, height: 200, hinge: "start", swing: "in" };
const room = (id: string): Room => ({
  id,
  apartmentId: "a",
  sortOrder: 0,
  name: id,
  type: "living",
  polygon: rectPolygon(400, 300),
  ceilingHeight: 250,
  openings: [door],
  fixedElements: [{ id: "built_in-1", label: "Shelf", kind: "built_in", rect: { x: 10, y: 10, w: 60, d: 30 }, height: 200 }],
  wallOrientationOverrides: {},
  roofSlopes: [],
  innerWalls: [],
  floorZones: [],
  finishes: { wallOverrides: {} },
  wallOutlooks: {},
  plan: null,
});
const sofa = newPlannerItem(cataloguePieces([]).find((p) => p.key === "sofa-medium")!, { x: 200, y: 150 }, "Sofa", []);
const plan: Plan = {
  rooms: [
    { room: room("r1"), furniture: [sofa] },
    { room: room("r2"), furniture: [] },
  ],
  origins: { r1: { x: 0, y: 0 }, r2: { x: 412, y: 0 } },
  annotations: [],
};

describe("copy and paste", () => {
  it("pastes a piece next to the original with a fresh id", () => {
    const clip = copySelection(plan, { kind: "item", roomId: "r1", id: sofa.id })!;
    const res = pasteClip(plan, clip)!;
    const copy = res.plan.rooms[0]!.furniture.find((f) => f.id === res.selection.id)!;
    expect(copy.id).not.toBe(sofa.id);
    expect({ x: copy.x, y: copy.y }).toEqual({ x: sofa.x + PASTE_OFFSET_CM, y: sofa.y + PASTE_OFFSET_CM });
  });

  it("pastes into the room under the pointer, at the pointer", () => {
    const clip = copySelection(plan, { kind: "item", roomId: "r1", id: sofa.id })!;
    const res = pasteClip(plan, clip, { at: { x: 600, y: 100 } })!;
    expect(res.selection.roomId).toBe("r2");
    const copy = res.plan.rooms[1]!.furniture[0]!;
    expect({ x: copy.x, y: copy.y }).toEqual({ x: 188, y: 100 });
  });

  it("pastes an opening next to the original on its wall, or on the wall nearest the pointer", () => {
    const clip = copySelection(plan, { kind: "opening", roomId: "r1", id: "door-1" })!;
    const beside = pasteClip(plan, clip)!;
    expect(beside.plan.rooms[0]!.room.openings.find((o) => o.id === beside.selection.id)).toMatchObject({ wallIndex: 0, offset: 150, width: 90 });
    // A point near the right wall of the second room.
    const there = pasteClip(plan, clip, { at: { x: 412 + 395, y: 150 } })!;
    expect(there.plan.rooms[1]!.room.openings.find((o) => o.id === there.selection.id)).toMatchObject({ wallIndex: 1, offset: 105 });
  });

  it("pastes a fixed element centred on the pointer", () => {
    const clip = copySelection(plan, { kind: "fixed", roomId: "r1", id: "built_in-1" })!;
    const res = pasteClip(plan, clip, { at: { x: 100, y: 200 } })!;
    expect(res.plan.rooms[0]!.room.fixedElements.find((f) => f.id === res.selection.id)!.rect).toEqual({ x: 70, y: 185, w: 60, d: 30 });
  });

  it("copies nothing without a selection", () => {
    expect(copySelection(plan, null)).toBeNull();
  });
});

describe("nudge and turn", () => {
  it("moves a piece, and slides an opening only along its wall", () => {
    expect(nudgeSelection(plan, { kind: "item", roomId: "r1", id: sofa.id }, 10, -1).rooms[0]!.furniture[0]).toMatchObject({ x: 210, y: 149 });
    const slid = nudgeSelection(plan, { kind: "opening", roomId: "r1", id: "door-1" }, 10, 25);
    expect(slid.rooms[0]!.room.openings[0]!.offset).toBe(60);
    // Never past the wall's end.
    expect(nudgeSelection(plan, { kind: "opening", roomId: "r1", id: "door-1" }, 1000, 0).rooms[0]!.room.openings[0]!.offset).toBe(310);
  });

  it("turns a piece and leaves openings alone", () => {
    expect(turnSelection(plan, { kind: "item", roomId: "r1", id: sofa.id }, 45).rooms[0]!.furniture[0]!.rotation).toBe(45);
    expect(turnSelection(plan, { kind: "item", roomId: "r1", id: sofa.id }, -45).rooms[0]!.furniture[0]!.rotation).toBe(315);
    expect(turnSelection(plan, { kind: "opening", roomId: "r1", id: "door-1" }, 45)).toBe(plan);
  });
});

describe("corners, walls, rooms and annotations", () => {
  it("nudges a corner, moves a wall square to itself, a room by its origin and an annotation", () => {
    const corner = nudgeSelection(plan, { kind: "corner", roomId: "r1", id: "1" }, 10, 0);
    expect(corner.rooms[0]!.room.polygon[1]).toEqual({ x: 410, y: 0 });
    // Wall 2 (index 1) runs down the right side: only the move across it counts.
    const wall = nudgeSelection(plan, { kind: "wall", roomId: "r1", id: "1" }, 10, 10);
    expect(wall.rooms[0]!.room.polygon.slice(1, 3)).toEqual([{ x: 410, y: 0 }, { x: 410, y: 300 }]);
    expect(nudgeSelection(plan, { kind: "room", roomId: "r2", id: "r2" }, 0, 5).origins["r2"]).toEqual({ x: 412, y: 5 });
    const withDim: Plan = { ...plan, annotations: [{ id: "dim-1", kind: "dimension", a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }] };
    expect(nudgeSelection(withDim, { kind: "annotation", roomId: "", id: "dim-1" }, 0, 10).annotations[0]).toEqual({ id: "dim-1", kind: "dimension", a: { x: 0, y: 10 }, b: { x: 100, y: 10 } });
  });

  it("copies none of them", () => {
    expect(copySelection(plan, { kind: "corner", roomId: "r1", id: "0" })).toBeNull();
    expect(copySelection(plan, { kind: "room", roomId: "r1", id: "r1" })).toBeNull();
  });
});

describe("inner walls and floor areas", () => {
  const pass: Opening = { id: "pass-1", kind: "door", wallIndex: 0, offset: 20, width: 80, height: 200, hinge: "start", swing: "none" };
  const withInner: Plan = {
    ...plan,
    rooms: plan.rooms.map((r, i) =>
      i === 0
        ? {
            ...r,
            room: {
              ...r.room,
              innerWalls: [{ id: "iw-1", a: { x: 200, y: 0 }, b: { x: 200, y: 300 }, thickness: 12, openings: [pass] }],
              floorZones: [{ id: "zone-1", rect: { x: 10, y: 200, w: 100, d: 80 }, height: 15 }],
            },
          }
        : r,
    ),
  };
  const r1 = (p: Plan) => p.rooms[0]!.room;

  it("copies and pastes an opening on an inner wall next to the original, on the same inner wall", () => {
    const clip = copySelection(withInner, { kind: "opening", roomId: "r1", id: "pass-1" })!;
    const res = pasteClip(withInner, clip)!;
    const openings = r1(res.plan).innerWalls[0]!.openings;
    expect(openings).toHaveLength(2);
    expect(openings[1]!.offset).toBe(110);
    expect(r1(res.plan).openings).toHaveLength(1);
    expect(res.selection.id).not.toBe("pass-1");
  });

  it("pastes an opening onto an inner wall when the pointer is nearer to it than to an outer wall", () => {
    const clip = copySelection(withInner, { kind: "opening", roomId: "r1", id: "door-1" })!;
    const res = pasteClip(withInner, clip, { at: { x: 205, y: 150 } })!;
    expect(r1(res.plan).innerWalls[0]!.openings.map((o) => o.offset)).toEqual([20, 105]);
  });

  it("pastes an inner wall with fresh ids for it and its openings", () => {
    const clip = copySelection(withInner, { kind: "innerWall", roomId: "r1", id: "iw-1" })!;
    const res = pasteClip(withInner, clip)!;
    const [, copy] = r1(res.plan).innerWalls;
    expect(copy!.id).not.toBe("iw-1");
    expect(copy!.a).toEqual({ x: 200 + PASTE_OFFSET_CM, y: PASTE_OFFSET_CM });
    expect(copy!.openings[0]!.id).not.toBe("pass-1");
  });

  it("pastes a floor area centred on the pointer", () => {
    const clip = copySelection(withInner, { kind: "zone", roomId: "r1", id: "zone-1" })!;
    const res = pasteClip(withInner, clip, { at: { x: 100, y: 100 } })!;
    expect(r1(res.plan).floorZones[1]!.rect).toEqual({ x: 50, y: 60, w: 100, d: 80 });
    expect(res.selection.kind).toBe("zone");
  });

  it("nudges inner walls, floor areas, and openings along an inner wall", () => {
    const wall = r1(nudgeSelection(withInner, { kind: "innerWall", roomId: "r1", id: "iw-1" }, 10, 5)).innerWalls[0]!;
    expect([wall.a, wall.b]).toEqual([{ x: 210, y: 5 }, { x: 210, y: 305 }]);
    expect(r1(nudgeSelection(withInner, { kind: "zone", roomId: "r1", id: "zone-1" }, -5, 0)).floorZones[0]!.rect.x).toBe(5);
    // The inner wall runs downwards, so only the downward part of the move slides the passage.
    expect(r1(nudgeSelection(withInner, { kind: "opening", roomId: "r1", id: "pass-1" }, 50, 10)).innerWalls[0]!.openings[0]!.offset).toBe(30);
  });
});
