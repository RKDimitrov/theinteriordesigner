import { describe, expect, it } from "vitest";
import { rectRoom } from "../room/factory";
import type { Opening } from "../schemas/room";
import { facadeSunFactor, floorFactor, roomDaylight } from "./daylight";

const win = (wallIndex: number, width = 120, height = 150): Opening => ({
  id: `w${wallIndex}-${width}`,
  kind: "window",
  wallIndex,
  offset: 20,
  width,
  height,
  sillHeight: 80,
  openable: true,
});

const room = (openings: Opening[]) => ({ ...rectRoom({ name: "R", type: "living", widthCm: 400, lengthCm: 400 }), id: "r1", openings });

describe("facadeSunFactor", () => {
  it("ranks south > east ≈ west > north in Berlin", () => {
    const s = facadeSunFactor(180, 52.5);
    const e = facadeSunFactor(90, 52.5);
    const w = facadeSunFactor(270, 52.5);
    const n = facadeSunFactor(0, 52.5);
    expect(s).toBeCloseTo(1, 5);
    expect(e).toBeLessThan(s);
    expect(Math.abs(e - w)).toBeLessThan(0.05);
    expect(n).toBeLessThan(e);
    expect(n).toBeGreaterThanOrEqual(0.3);
  });

  it("flips in the southern hemisphere", () => {
    expect(facadeSunFactor(0, -33.9)).toBeCloseTo(1, 5);
    expect(facadeSunFactor(180, -33.9)).toBeLessThan(facadeSunFactor(90, -33.9));
  });

  it("falls back to a cardinal table without a location", () => {
    expect(facadeSunFactor(180, null)).toBe(1);
    expect(facadeSunFactor(90, null)).toBe(0.7);
    expect(facadeSunFactor(0, null)).toBe(0.35);
  });
});

describe("floorFactor", () => {
  it("rises with floor level and is clamped", () => {
    expect(floorFactor(0)).toBe(0.85);
    expect(floorFactor(2)).toBeCloseTo(0.95);
    expect(floorFactor(10)).toBe(1.05);
    expect(floorFactor(-1)).toBe(0.85);
  });
});

describe("roomDaylight", () => {
  it("rates a room without windows as low", () => {
    const d = roomDaylight(room([]), 0, 52.5, 2);
    expect(d).toMatchObject({ level: "low", score: 0, dominantOrientation: null });
  });

  it("south windows beat north windows (north up, wall 2 faces south)", () => {
    const south = roomDaylight(room([win(2, 200, 150), win(2, 120, 150)]), 0, 52.5, 3);
    const north = roomDaylight(room([win(0, 200, 150), win(0, 120, 150)]), 0, 52.5, 3);
    expect(south.dominantOrientation).toBe("S");
    expect(north.dominantOrientation).toBe("N");
    expect(south.score).toBeGreaterThan(north.score);
    expect(north.lightTemperature).toBe("cool");
    expect(south.lightTemperature).toBe("warm");
    expect(south.windowFloorRatio).toBeCloseTo((320 * 150) / 160000, 3);
  });

  it("rotating north changes the orientation of the same wall", () => {
    const d = roomDaylight(room([win(0)]), 180, 52.5, 1);
    expect(d.dominantOrientation).toBe("S");
  });

  it("classifies levels by score", () => {
    const big = roomDaylight(room([win(2, 300, 200), win(1, 300, 200)]), 0, 52.5, 4);
    expect(big.level).toBe("high");
    const small = roomDaylight(room([win(0, 60, 60)]), 0, 52.5, 0);
    expect(small.level).toBe("low");
  });
});
