import { describe, expect, it } from "vitest";
import { area, rectPolygon } from "../geometry/polygon";
import type { InnerWall, Opening } from "../schemas/room";
import { allOpenings, findOpening, innerWallFace, innerWallSolids, nearestInnerWall, removeOpening, updateOpening } from "./inner-walls";

const pass: Opening = { id: "pass-1", kind: "door", wallIndex: 0, offset: 50, width: 100, height: 200, hinge: "start", swing: "none" };
// A partition across a 400 × 300 room, 200 cm in from the left, running top to bottom.
const wall: InnerWall = { id: "iw-1", a: { x: 200, y: 0 }, b: { x: 200, y: 300 }, thickness: 12, openings: [pass] };
const door: Opening = { id: "door-1", kind: "door", wallIndex: 1, offset: 20, width: 90, height: 200, hinge: "start", swing: "in" };
const room = { polygon: rectPolygon(400, 300), openings: [door], innerWalls: [wall] };

describe("innerWallFace", () => {
  it("is a wall along the partition, on the side its doors open to, half the thickness from its middle line", () => {
    const face = innerWallFace(wall);
    expect(face.length).toBe(300);
    expect(face.dir).toEqual({ x: 0, y: 1 });
    // Left of the direction of travel in y-down coordinates.
    expect(face.inward.x).toBeCloseTo(-1);
    expect(face.a.x).toBeCloseTo(194);
  });
});

describe("innerWallSolids", () => {
  it("gives the solid parts of the wall around its passages", () => {
    const solids = innerWallSolids(wall);
    expect(solids).toHaveLength(2);
    // 50 cm above the passage and 150 cm below it, 12 cm thick.
    expect(solids.map((s) => Math.round(area(s)))).toEqual([600, 1800]);
  });
});

describe("openings on outer and inner walls", () => {
  it("finds an opening wherever it is, with the wall it sits on", () => {
    expect(findOpening(room, "door-1")?.host).toBe("outer");
    const onInner = findOpening(room, "pass-1")!;
    expect(onInner.host).toBe("iw-1");
    expect(onInner.wall.length).toBe(300);
    expect(findOpening(room, "nope")).toBeNull();
    expect(allOpenings(room).map((o) => o.opening.id)).toEqual(["door-1", "pass-1"]);
  });

  it("updates and removes openings on inner walls", () => {
    const moved = updateOpening(room, "pass-1", (o) => ({ ...o, offset: 80 }));
    expect(moved.innerWalls[0]!.openings[0]!.offset).toBe(80);
    expect(moved.openings).toBe(room.openings);
    const gone = removeOpening(room, "pass-1");
    expect(gone.innerWalls[0]!.openings).toEqual([]);
    expect(removeOpening(room, "door-1").openings).toEqual([]);
  });
});

describe("nearestInnerWall", () => {
  it("finds the partition near a point, and how far along it the point is", () => {
    const hit = nearestInnerWall(room, { x: 203, y: 120 }, 20)!;
    expect(hit.wall.id).toBe("iw-1");
    expect(hit.offset).toBeCloseTo(120);
    expect(nearestInnerWall(room, { x: 100, y: 120 }, 20)).toBeNull();
  });
});
