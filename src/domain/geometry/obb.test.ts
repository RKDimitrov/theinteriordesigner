import { describe, expect, it } from "vitest";
import { rectRoom } from "../room/factory";
import type { Opening } from "../schemas/room";
import { cellIndex, cellsIn, clearance, rasterise, reachable } from "./grid";
import { axes, convexOverlap, directionWord, frontNormal, itemFootprint, polygonInside, stripBeside } from "./obb";
import { rectPolygon } from "./polygon";
import { keepClearZones } from "./zones";

const box = (x: number, y: number, w: number, d: number, rotation = 0) => ({ x, y, w, d, rotation });

describe("itemFootprint / axes", () => {
  it("builds an axis-aligned footprint at rotation 0", () => {
    expect(itemFootprint(box(100, 50, 40, 20))).toEqual([
      { x: 80, y: 40 },
      { x: 120, y: 40 },
      { x: 120, y: 60 },
      { x: 80, y: 60 },
    ]);
  });

  it("front faces +y at 0°, −x at 90°, −y at 180°, +x at 270°", () => {
    const f = (r: number) => frontNormal({ rotation: r });
    expect(f(0).y).toBeCloseTo(1);
    expect(f(90).x).toBeCloseTo(-1);
    expect(f(180).y).toBeCloseTo(-1);
    expect(f(270).x).toBeCloseTo(1);
    expect(axes({ rotation: 90 }).u.y).toBeCloseTo(1);
  });

  it("swaps extents at 90°", () => {
    const xs = itemFootprint(box(100, 100, 200, 50, 90)).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50);
  });

  it("builds strips on each side", () => {
    const front = stripBeside(box(100, 100, 40, 20), "front", 60);
    expect(Math.min(...front.map((p) => p.y))).toBeCloseTo(110);
    expect(Math.max(...front.map((p) => p.y))).toBeCloseTo(170);
    const left = stripBeside(box(100, 100, 40, 20), "left", 30);
    expect(Math.min(...left.map((p) => p.x))).toBeCloseTo(50);
  });
});

describe("convexOverlap", () => {
  it("detects overlap with depth and axis pointing from b to a", () => {
    const a = itemFootprint(box(100, 100, 100, 100));
    const b = itemFootprint(box(180, 100, 100, 100));
    const o = convexOverlap(a, b)!;
    expect(o.depth).toBeCloseTo(20);
    expect(o.axis.x).toBeCloseTo(-1);
    expect(directionWord(o.axis)).toBe("−x (left)");
  });

  it("treats touching as no overlap", () => {
    expect(convexOverlap(itemFootprint(box(50, 50, 100, 100)), itemFootprint(box(150, 50, 100, 100)))).toBeNull();
  });

  it("handles rotation (diamond vs square corner)", () => {
    const diamond = itemFootprint(box(0, 0, 100, 100, 45));
    expect(convexOverlap(diamond, itemFootprint(box(80, 0, 40, 40)))).not.toBeNull();
    expect(convexOverlap(diamond, itemFootprint(box(60, 60, 20, 20)))).toBeNull();
  });
});

describe("polygonInside", () => {
  const room = rectPolygon(400, 300);
  it("accepts flush items and rejects items poking out", () => {
    expect(polygonInside(room, itemFootprint(box(20, 150, 40, 100)))).toBe(true);
    expect(polygonInside(room, itemFootprint(box(15, 150, 40, 100)))).toBe(false);
  });
  it("rejects items crossing into an L-shape notch", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ];
    expect(polygonInside(l, itemFootprint(box(250, 250, 50, 50)))).toBe(false);
    expect(polygonInside(l, itemFootprint(box(150, 250, 50, 50)))).toBe(true);
  });
});

describe("keepClearZones", () => {
  it("creates door swing, door path, window and radiator zones", () => {
    const room = rectRoom({ name: "r", type: "living", widthCm: 400, lengthCm: 300 });
    const openings: Opening[] = [
      { id: "d", kind: "door", wallIndex: 2, offset: 20, width: 90, height: 200, hinge: "start", swing: "in" },
      { id: "w", kind: "window", wallIndex: 0, offset: 100, width: 120, height: 140, sillHeight: 90, openable: true },
      { id: "r", kind: "radiator", wallIndex: 0, offset: 110, width: 100, height: 60, depth: 10 },
    ];
    const zones = keepClearZones({ ...room, openings });
    expect(zones.map((z) => z.kind)).toEqual(["door_swing", "door_path", "window", "radiator"]);
    const win = zones.find((z) => z.kind === "window")!;
    expect(Math.max(...win.polygon.map((p) => p.y))).toBeCloseTo(60);
    expect(win.minBlockingHeight).toBe(90);
    const rad = zones.find((z) => z.kind === "radiator")!;
    expect(Math.max(...rad.polygon.map((p) => p.y))).toBeCloseTo(40);
  });
});

describe("grid walkway", () => {
  const room = rectPolygon(300, 200);

  it("computes clearance to walls and obstacles", () => {
    const g = rasterise(room, []);
    const c = clearance(g);
    expect(c[cellIndex(g, { x: 2, y: 100 })!]).toBeCloseTo(2.5);
    expect(c[cellIndex(g, { x: 150, y: 100 })!]).toBeGreaterThan(90);
  });

  it("an 80 cm corridor is walkable, a 60 cm one is not", () => {
    // Obstacles leave a corridor of `gap` cm between y = 100 - gap/2 and 100 + gap/2 across x.
    const corridor = (gap: number) => {
      const top = itemFootprint(box(150, (100 - gap / 2) / 2, 300, 100 - gap / 2));
      const bottom = itemFootprint(box(150, 200 - (100 - gap / 2) / 2, 300, 100 - gap / 2));
      const g = rasterise(room, [top, bottom]);
      const c = clearance(g);
      const seen = reachable(g, c, 37.5, [cellIndex(g, { x: 45, y: 100 })!]);
      return seen[cellIndex(g, { x: 255, y: 100 })!] === 1;
    };
    expect(corridor(80)).toBe(true);
    expect(corridor(60)).toBe(false);
  });

  it("lists cells inside a polygon", () => {
    const g = rasterise(room, []);
    expect(cellsIn(g, rectPolygon(20, 20, 0, 0))).toHaveLength(16);
  });
});
