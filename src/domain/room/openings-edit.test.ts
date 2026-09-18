import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import { nearestWall, wallsOf } from "../geometry/walls";
import { clampOffset, newOpening, nextId } from "./openings-edit";

describe("clampOffset", () => {
  it("keeps the opening on the wall and on the grid", () => {
    expect(clampOffset(-20, 90, 400)).toBe(0);
    expect(clampOffset(372, 90, 400)).toBe(310);
    expect(clampOffset(101, 90, 400)).toBe(100);
    expect(clampOffset(50, 90, 83)).toBe(0);
  });
});

describe("newOpening", () => {
  it("centres a door on the click point", () => {
    const d = newOpening("door", "door-1", 0, 200, 400);
    expect(d).toMatchObject({ kind: "door", offset: 155, width: 90, swing: "in" });
  });

  it("shrinks to fit a short wall", () => {
    const w = newOpening("window", "window-1", 1, 40, 80);
    expect(w.width).toBe(80);
    expect(w.offset).toBe(0);
  });
});

describe("nextId", () => {
  it("returns the first free id", () => {
    expect(nextId("door", ["door-1", "door-2", "window-1"])).toBe("door-3");
    expect(nextId("socket", [])).toBe("socket-1");
  });
});

describe("nearestWall", () => {
  const walls = wallsOf(rectPolygon(400, 300));
  it("finds the closest wall within range", () => {
    const hit = nearestWall(walls, { x: 120, y: 290 }, 30)!;
    expect(hit.wall.index).toBe(2);
    expect(hit.offset).toBe(280); // wall 2 runs right-to-left
    expect(hit.distance).toBe(10);
  });
  it("returns null when far from every wall", () => {
    expect(nearestWall(walls, { x: 200, y: 150 }, 30)).toBeNull();
  });
});
