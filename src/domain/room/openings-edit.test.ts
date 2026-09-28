import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import { nearestWall, wallsOf } from "../geometry/walls";
import { DEFAULT_FIT_OUT } from "./fit-out";
import { clampOffset, newOpening, newPassThrough, nextId, withFitOutStyle } from "./openings-edit";

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

describe("withFitOutStyle", () => {
  const fitOut = { ...DEFAULT_FIT_OUT, doors: { ...DEFAULT_FIT_OUT.doors, style: "double" as const, finish: "walnut" as const }, windows: { ...DEFAULT_FIT_OUT.windows, style: "floor_to_ceiling" as const, finish: "black" as const } };

  it("gives a new opening the apartment's default style, kept on the wall", () => {
    const d = withFitOutStyle(newOpening("door", "door-1", 0, 350, 400), fitOut, 260, 400);
    expect(d).toMatchObject({ style: "double", width: 140 });
    expect(d.offset + d.width).toBeLessThanOrEqual(400);
    expect(withFitOutStyle(newOpening("window", "w", 0, 200, 400), fitOut, 260, 400)).toMatchObject({ style: "floor_to_ceiling", sillHeight: 0, height: 260 });
  });

  it("leaves pass-throughs and sockets alone", () => {
    const pass = newPassThrough("pass-1", 0, 200, 400);
    expect(withFitOutStyle(pass, fitOut, 260, 400)).toBe(pass);
    const socket = newOpening("socket", "s", 0, 200, 400);
    expect(withFitOutStyle(socket, fitOut, 260, 400)).toBe(socket);
  });

  it("does not stretch past a short wall", () => {
    expect(withFitOutStyle(newOpening("door", "d", 0, 50, 100), fitOut, 260, 100).width).toBe(100);
  });
});
