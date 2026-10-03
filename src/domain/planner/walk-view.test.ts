import { describe, expect, it } from "vitest";
import { EYE_SITTING, EYE_STANDING } from "./walk-motion";
import { DEFAULT_WALK_VIEW, horizontalFov, parseWalkView, WALK_VIEW_STORAGE_KEY, walkEye } from "./walk-view";

describe("walk view", () => {
  it("defaults to a wide 75° view (about 108° across a wide screen) for a 180 cm person", () => {
    expect(DEFAULT_WALK_VIEW).toEqual({ fov: 75, height: 180 });
    expect(horizontalFov(75, 16 / 9)).toBe(108);
    expect(horizontalFov(62, 16 / 9)).toBe(94);
  });

  it("puts the eyes 12 cm below the top of the head", () => {
    expect(walkEye(DEFAULT_WALK_VIEW)).toBe(168);
    expect(walkEye({ fov: 75, height: 160 })).toBe(148);
    expect(EYE_STANDING).toBe(168);
    expect(EYE_SITTING).toBe(120);
  });

  it("reads what was saved and ignores anything out of range", () => {
    expect(parseWalkView(JSON.stringify({ fov: 80, height: 170 }))).toEqual({ fov: 80, height: 170 });
    expect(parseWalkView(JSON.stringify({ fov: 120, height: 170 }))).toEqual(DEFAULT_WALK_VIEW);
    expect(parseWalkView(JSON.stringify({ fov: 50, eye: 160 }))).toEqual(DEFAULT_WALK_VIEW);
    expect(parseWalkView("nope")).toEqual(DEFAULT_WALK_VIEW);
    expect(parseWalkView(null)).toEqual(DEFAULT_WALK_VIEW);
  });

  it("keeps the new settings apart from the old narrow ones", () => {
    expect(WALK_VIEW_STORAGE_KEY).toBe("raumplan.walk-view.v2");
  });
});
