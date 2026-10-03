import { describe, expect, it } from "vitest";
import { area, rectPolygon } from "../geometry/polygon";
import { wallsOf } from "../geometry/walls";
import { ceilingAt, ceilingPatches, clipHalfPlane, headroomUnder, slopeBands, wallTop } from "./roof";

// 400 wide, 300 deep; clockwise from the top-left: wall 0 top, 1 right, 2 bottom, 3 left.
const room = (slopes: { wallIndex: number; kneeHeight: number; depth: number }[] = []) => ({ polygon: rectPolygon(400, 300), ceilingHeight: 210, roofSlopes: slopes });
const left = { wallIndex: 3, kneeHeight: 170, depth: 90 };
const right = { wallIndex: 1, kneeHeight: 170, depth: 90 };

describe("ceilingAt", () => {
  it("is the full height without roof slopes", () => {
    expect(ceilingAt(room(), { x: 5, y: 5 })).toBe(210);
  });

  it("rises from the knee height at the wall to the full height at the slope's depth", () => {
    const r = room([left]);
    expect(ceilingAt(r, { x: 0, y: 150 })).toBe(170);
    expect(ceilingAt(r, { x: 45, y: 150 })).toBe(190);
    expect(ceilingAt(r, { x: 90, y: 150 })).toBe(210);
    expect(ceilingAt(r, { x: 300, y: 150 })).toBe(210);
  });

  it("takes the lower of two slopes", () => {
    const r = room([left, right]);
    expect(ceilingAt(r, { x: 400, y: 10 })).toBe(170);
    expect(ceilingAt(r, { x: 200, y: 10 })).toBe(210);
  });
});

describe("clipHalfPlane", () => {
  it("keeps the part of a polygon on the inner side of a line", () => {
    const kept = clipHalfPlane(rectPolygon(400, 300), { x: 90, y: 0 }, { x: 1, y: 0 });
    expect(area(kept)).toBeCloseTo(310 * 300);
  });

  it("keeps everything or nothing when the line misses the polygon", () => {
    expect(area(clipHalfPlane(rectPolygon(100, 100), { x: -10, y: 0 }, { x: 1, y: 0 }))).toBeCloseTo(10_000);
    expect(clipHalfPlane(rectPolygon(100, 100), { x: 500, y: 0 }, { x: 1, y: 0 })).toHaveLength(0);
  });
});

describe("slopeBands", () => {
  it("gives each slope the strip between its wall and the line where the full height starts", () => {
    const [band] = slopeBands(room([left]));
    expect(band!.slope).toEqual(left);
    expect(area(band!.polygon)).toBeCloseTo(90 * 300);
    expect(band!.line[0].x).toBeCloseTo(90);
    expect(band!.line[1].x).toBeCloseTo(90);
  });

  it("skips slopes on walls that do not exist", () => {
    expect(slopeBands(room([{ ...left, wallIndex: 9 }]))).toEqual([]);
  });
});

describe("wallTop", () => {
  it("keeps the wall under a slope at the knee height", () => {
    const r = room([left]);
    expect(wallTop(r, wallsOf(r.polygon)[3]!)).toEqual([
      { t: 0, h: 170 },
      { t: 300, h: 170 },
    ]);
  });

  it("slopes the end of a wall that runs into the roof", () => {
    const r = room([left]);
    // The top wall runs from the left corner (0) to the right (400).
    expect(wallTop(r, wallsOf(r.polygon)[0]!)).toEqual([
      { t: 0, h: 170 },
      { t: 90, h: 210 },
      { t: 400, h: 210 },
    ]);
  });

  it("is flat at the full height without slopes", () => {
    const r = room();
    expect(wallTop(r, wallsOf(r.polygon)[0]!)).toEqual([
      { t: 0, h: 210 },
      { t: 400, h: 210 },
    ]);
  });
});

describe("ceilingPatches", () => {
  it("covers the room once: a flat part and one sloped part per slope", () => {
    const r = room([left, right]);
    const patches = ceilingPatches(r);
    expect(patches).toHaveLength(3);
    const total = patches.reduce((n, p) => n + area(p.polygon), 0);
    expect(total).toBeCloseTo(400 * 300);
    for (const p of patches) p.polygon.forEach((v, i) => expect(p.heights[i]).toBeCloseTo(ceilingAt(r, v)));
  });

  it("is a single flat patch without slopes", () => {
    const patches = ceilingPatches(room());
    expect(patches).toHaveLength(1);
    expect(patches[0]!.heights.every((h) => h === 210)).toBe(true);
  });
});

describe("headroomUnder", () => {
  it("is the lowest ceiling over a footprint", () => {
    const r = room([left]);
    expect(headroomUnder(r, rectPolygon(60, 60, 0, 100))).toBe(170);
    expect(headroomUnder(r, rectPolygon(60, 60, 200, 100))).toBe(210);
  });
});
