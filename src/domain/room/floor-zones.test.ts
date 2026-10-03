import { describe, expect, it } from "vitest";
import { floorAt, zoneOutline } from "./floor-zones";

const room = { floorZones: [{ id: "z1", rect: { x: 100, y: 0, w: 100, d: 50 }, height: 15 }, { id: "z2", rect: { x: 0, y: 200, w: 80, d: 80 }, height: -5 }] };

describe("floorAt", () => {
  it("is the area's height inside a raised or lowered area, and 0 elsewhere", () => {
    expect(floorAt(room, { x: 150, y: 25 })).toBe(15);
    expect(floorAt(room, { x: 40, y: 240 })).toBe(-5);
    expect(floorAt(room, { x: 300, y: 100 })).toBe(0);
    expect(floorAt({ floorZones: [] }, { x: 0, y: 0 })).toBe(0);
  });

  it("counts the edge as inside", () => {
    expect(floorAt(room, { x: 100, y: 50 })).toBe(15);
  });
});

describe("zoneOutline", () => {
  it("is the rectangle's corners, clockwise", () => {
    expect(zoneOutline(room.floorZones[0]!)).toEqual([
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 50 },
      { x: 100, y: 50 },
    ]);
  });
});
