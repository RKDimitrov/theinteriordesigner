import { describe, expect, it } from "vitest";
import { kelvinToHex, lampSources, nearestLights, roomLit, skyLight } from "./lighting";

describe("roomLit", () => {
  it("switches lights on by itself after dark, unless the room was switched by hand", () => {
    expect(roomLit("r", {}, 14)).toBe(false);
    expect(roomLit("r", {}, 20)).toBe(true);
    expect(roomLit("r", { r: true }, 14)).toBe(true);
    expect(roomLit("r", { r: false }, 21)).toBe(false);
  });
});

describe("kelvinToHex", () => {
  it("gives warm light at 2700 K and near-white at 6500 K", () => {
    const warm = kelvinToHex(2700);
    const day = kelvinToHex(6500);
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [wr, , wb] = rgb(warm);
    expect(wr).toBe(255);
    expect(wb).toBeLessThan(180);
    for (const c of rgb(day)) expect(c).toBeGreaterThan(240);
  });
});

describe("lampSources", () => {
  const room = {
    ceilingHeight: 260,
    polygon: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ],
    fixedElements: [{ id: "p", label: "P", kind: "pendant" as const, rect: { x: 180, y: 130, w: 40, d: 40 }, height: 90 }],
  };

  it("lights pendants and floor lamps where they hang or stand", () => {
    const lamps = lampSources(room, [{ id: "fl", category: "floor_lamp", x: 50, y: 60, h: 160 }]);
    expect(lamps).toEqual([
      { id: "p", x: 200, y: 150, elevation: 260 - 90 * 0.8, kind: "ceiling" },
      { id: "fl", x: 50, y: 60, elevation: 140, kind: "floor_lamp" },
    ]);
  });

  it("gives a room without lamps one light in the middle of its ceiling", () => {
    expect(lampSources({ ...room, fixedElements: [] }, [])).toEqual([{ id: "ceiling", x: 200, y: 150, elevation: 240, kind: "ceiling" }]);
  });
});

describe("nearestLights", () => {
  it("keeps the lights closest to the camera, up to the cap", () => {
    const lamps = [0, 500, 100, 300].map((x, i) => ({ key: String(i), pos: { x, y: 0, z: 0 } }));
    expect(nearestLights(lamps, { x: 0, y: 0, z: 0 }, 2).map((l) => l.key)).toEqual(["0", "2"]);
  });
});

describe("skyLight", () => {
  it("is full at midday, warm at a low sun and dark at night", () => {
    expect(skyLight(45).light).toBe(1);
    expect(skyLight(5).light).toBeLessThan(1);
    expect(skyLight(5).tint).not.toBe("#ffffff");
    expect(skyLight(-10).light).toBeLessThan(0.25);
  });
});
