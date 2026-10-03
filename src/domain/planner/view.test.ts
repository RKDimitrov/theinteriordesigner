import { describe, expect, it } from "vitest";
import { rotatePoint, rulerAxes, screenToWorld, turnView, uprightAngle, type ViewRotation, worldToScreen } from "./view";

const ROTS: ViewRotation[] = [0, 90, 180, 270];

describe("plan view rotation", () => {
  it("turns a quarter clockwise on screen: right becomes down", () => {
    expect(rotatePoint({ x: 1, y: 0 }, 90)).toEqual({ x: -0, y: 1 });
    expect(rotatePoint({ x: 0, y: 1 }, 90)).toEqual({ x: -1, y: 0 });
  });

  it.each(ROTS)("maps screen to plan and back at %i°", (rot) => {
    const v = { k: 1.7, pan: { x: 300, y: -40 }, rot };
    const p = { x: 123, y: -45 };
    const back = screenToWorld(worldToScreen(p, v), v);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("steps a quarter at a time and wraps", () => {
    expect(turnView(270, 1)).toBe(0);
    expect(turnView(0, -1)).toBe(270);
  });

  it.each(ROTS)("names the plan coordinate along each screen axis at %i°", (rot) => {
    const v = { k: 1, pan: { x: 0, y: 0 }, rot };
    const axes = rulerAxes(rot);
    const o = screenToWorld({ x: 0, y: 0 }, v);
    const right = screenToWorld({ x: 10, y: 0 }, v);
    const down = screenToWorld({ x: 0, y: 10 }, v);
    expect((right[axes.x.axis] - o[axes.x.axis]) * axes.x.sign).toBeCloseTo(10);
    expect((down[axes.y.axis] - o[axes.y.axis]) * axes.y.sign).toBeCloseTo(10);
  });

  it("keeps labels upright whatever the turn", () => {
    for (const rot of ROTS)
      for (const angle of [0, 45, 90, 135, 180, 270]) {
        const screen = (((uprightAngle(angle, rot) + rot) % 360) + 360) % 360;
        expect(screen <= 90 || screen > 270, `${angle}° at ${rot}°`).toBe(true);
      }
  });
});
