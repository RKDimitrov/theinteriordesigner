import { describe, expect, it } from "vitest";
import type { Door } from "../schemas/room";
import { doorLeaf, doorSwing, kindsConflict, openingSpan, spansOverlap } from "./openings";
import { area, bbox, containsPoint, isAxisAlignedRect, isClockwise, isSelfIntersecting, offsetPolygon, rectPolygon, signedArea } from "./polygon";
import { normDeg, snap } from "./units";
import { rotate } from "./vec";
import { bearingToCardinal, planAngle, wallFacingBearing, wallOrientations, wallsOf } from "./walls";

const room = rectPolygon(400, 300); // top, right, bottom, left

describe("polygon", () => {
  it("computes area and clockwise orientation in y-down space", () => {
    expect(area(room)).toBe(120_000);
    expect(signedArea(room)).toBeGreaterThan(0);
    expect(isClockwise(room)).toBe(true);
    expect(isClockwise([...room].reverse())).toBe(false);
  });

  it("detects axis-aligned rectangles", () => {
    expect(isAxisAlignedRect(room)).toBe(true);
    expect(isAxisAlignedRect([{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 100, y: 100 }, { x: 0, y: 100 }])).toBe(false);
    expect(isAxisAlignedRect(room.slice(0, 3))).toBe(false);
  });

  it("contains interior and boundary points, not exterior", () => {
    expect(containsPoint(room, { x: 200, y: 150 })).toBe(true);
    expect(containsPoint(room, { x: 0, y: 150 })).toBe(true);
    expect(containsPoint(room, { x: 400, y: 300 })).toBe(true);
    expect(containsPoint(room, { x: 401, y: 150 })).toBe(false);
    expect(containsPoint(room, { x: -1, y: -1 })).toBe(false);
  });

  it("handles an L-shaped polygon", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ];
    expect(area(l)).toBe(400 * 200 + 200 * 200);
    expect(containsPoint(l, { x: 300, y: 300 })).toBe(false);
    expect(containsPoint(l, { x: 100, y: 300 })).toBe(true);
  });

  it("detects self-intersection (bow tie)", () => {
    expect(isSelfIntersecting([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(true);
    expect(isSelfIntersecting(room)).toBe(false);
  });

  it("computes bbox", () => {
    expect(bbox(rectPolygon(50, 60, 10, 20))).toEqual({ x: 10, y: 20, w: 50, d: 60 });
  });
});

describe("units", () => {
  it("snaps to 5 cm grid", () => {
    expect(snap(402)).toBe(400);
    expect(snap(403)).toBe(405);
    expect(snap(-2)).toBe(0);
    expect(snap(12, 10)).toBe(10);
  });
  it("normalises degrees", () => {
    expect(normDeg(-90)).toBe(270);
    expect(normDeg(720)).toBe(0);
  });
});

describe("vec.rotate", () => {
  it("rotates clockwise on screen (y-down)", () => {
    const r = rotate({ x: 1, y: 0 }, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1); // right -> down
  });
});

describe("walls", () => {
  const walls = wallsOf(room);

  it("indexes walls clockwise from top-left with inward normals", () => {
    expect(walls.map((w) => w.length)).toEqual([400, 300, 400, 300]);
    expect(walls[0]!.inward).toEqual({ x: -0, y: 1 });
    expect(walls[1]!.inward.x).toBeCloseTo(-1);
    expect(walls[2]!.inward.y).toBeCloseTo(-1);
    expect(walls[3]!.inward.x).toBeCloseTo(1);
  });

  it("keeps inward normals correct for counter-clockwise input without reindexing", () => {
    const ccw = [...room].reverse();
    const w = wallsOf(ccw);
    expect(w[0]!.a).toEqual(ccw[0]);
    // ccw[0] = (0,300) -> (400,300) is the bottom wall; inward is up.
    expect(w[0]!.inward.y).toBeCloseTo(-1);
  });

  it("computes plan angles", () => {
    expect(planAngle({ x: 0, y: -1 })).toBeCloseTo(0);
    expect(planAngle({ x: 1, y: 0 })).toBeCloseTo(90);
    expect(planAngle({ x: 0, y: 1 })).toBeCloseTo(180);
    expect(planAngle({ x: -1, y: 0 })).toBeCloseTo(270);
  });

  it("derives orientations with north up", () => {
    expect(wallOrientations(room, 0)).toEqual(["N", "E", "S", "W"]);
  });

  it("derives orientations when north points right on the plan", () => {
    // North is at plan angle 90: the right wall faces north.
    expect(wallOrientations(room, 90)).toEqual(["W", "N", "E", "S"]);
    expect(wallFacingBearing(walls[0]!, 90)).toBeCloseTo(270);
  });

  it("applies manual overrides", () => {
    expect(wallOrientations(room, 0, { "2": "E" })).toEqual(["N", "E", "E", "W"]);
  });

  it("maps bearings to cardinals at boundaries", () => {
    expect(bearingToCardinal(44.9)).toBe("N");
    expect(bearingToCardinal(45)).toBe("E");
    expect(bearingToCardinal(225)).toBe("W");
    expect(bearingToCardinal(-10)).toBe("N");
  });
});

describe("openings", () => {
  const walls = wallsOf(room);
  const door: Door = { id: "d1", kind: "door", wallIndex: 2, offset: 50, width: 90, height: 200, hinge: "start", swing: "in" };

  it("locates an opening span on its wall", () => {
    // Wall 2 runs from (400,300) to (0,300).
    const s = openingSpan(walls, door)!;
    expect(s.start).toEqual({ x: 350, y: 300 });
    expect(s.end).toEqual({ x: 260, y: 300 });
    expect(openingSpan(walls, { ...door, wallIndex: 9 })).toBeNull();
  });

  it("builds a quarter-disc swing into the room", () => {
    const sw = doorSwing(walls, door)!;
    expect(sw.hinge).toEqual({ x: 350, y: 300 });
    expect(sw.closedTip.x).toBeCloseTo(260);
    expect(sw.openTip.x).toBeCloseTo(350);
    expect(sw.openTip.y).toBeCloseTo(210); // swings up into the room
    expect(sw.polygon).toHaveLength(18);
    expect(area(sw.polygon)).toBeCloseTo((Math.PI * 90 * 90) / 4, -2);
    for (const p of sw.polygon) expect(containsPoint(room, p)).toBe(true);
  });

  it("places the hinge at the far end when hinge=end", () => {
    const sw = doorSwing(walls, { ...door, hinge: "end" })!;
    expect(sw.hinge).toEqual({ x: 260, y: 300 });
    expect(sw.closedTip.x).toBeCloseTo(350);
  });

  it("has no swing area for outward or sliding doors", () => {
    expect(doorSwing(walls, { ...door, swing: "out" })).toBeNull();
    expect(doorSwing(walls, { ...door, swing: "sliding" })).toBeNull();
    expect(doorSwing(walls, { ...door, swing: "none" })).toBeNull();
    expect(doorLeaf(walls, { ...door, swing: "none" })).toBeNull();
  });

  it("knows which opening kinds conflict", () => {
    expect(kindsConflict("door", "window")).toBe(true);
    expect(kindsConflict("window", "radiator")).toBe(false);
    expect(kindsConflict("door", "radiator")).toBe(true);
    expect(kindsConflict("socket", "door")).toBe(false);
  });

  it("detects span overlap (touching is fine)", () => {
    expect(spansOverlap({ offset: 0, width: 100 }, { offset: 100, width: 50 })).toBe(false);
    expect(spansOverlap({ offset: 0, width: 100 }, { offset: 99, width: 50 })).toBe(true);
  });
});

describe("offsetPolygon", () => {
  it("grows a clockwise rectangle outward on every side", () => {
    const out = offsetPolygon(rectPolygon(400, 300), 12);
    const b = bbox(out);
    expect([b.x, b.y, b.w, b.d].map(Math.round)).toEqual([-12, -12, 424, 324]);
  });

  it("works for counter-clockwise input too", () => {
    const out = offsetPolygon([...rectPolygon(200, 100)].reverse(), 10);
    const b = bbox(out);
    expect([b.x, b.y, b.w, b.d].map(Math.round)).toEqual([-10, -10, 220, 120]);
  });

  it("mitres the inside corner of an L-shaped room", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { x: 0, y: 300 },
    ];
    const out = offsetPolygon(l, 10);
    expect(out[3]!.x).toBeCloseTo(110);
    expect(out[3]!.y).toBeCloseTo(110);
  });
});
