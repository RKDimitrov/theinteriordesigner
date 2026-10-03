import { describe, expect, it } from "vitest";
import { DEFAULT_WALK_VIEW, horizontalFov, parseWalkView } from "./walk-view";

describe("walk view", () => {
  it("defaults to a 50° view at 160 cm, about 80° across on a wide screen", () => {
    expect(DEFAULT_WALK_VIEW).toEqual({ fov: 50, eye: 160 });
    expect(horizontalFov(50, 16 / 9)).toBe(79);
    expect(horizontalFov(62, 16 / 9)).toBe(94);
  });

  it("reads what was saved and ignores anything out of range", () => {
    expect(parseWalkView(JSON.stringify({ fov: 45, eye: 170 }))).toEqual({ fov: 45, eye: 170 });
    expect(parseWalkView(JSON.stringify({ fov: 120, eye: 170 }))).toEqual(DEFAULT_WALK_VIEW);
    expect(parseWalkView("nope")).toEqual(DEFAULT_WALK_VIEW);
    expect(parseWalkView(null)).toEqual(DEFAULT_WALK_VIEW);
  });
});
