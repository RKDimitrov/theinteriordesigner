import { describe, expect, it } from "vitest";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { freeFloorRect, rayDistance, wallSlots } from "./slots";

const living = SAMPLE_ROOMS[0]!;
const runs = (wallIndex: number, slots: ReturnType<typeof wallSlots>) => slots.filter((s) => s.wallIndex === wallIndex).map((s) => [s.from, s.to]);

describe("wallSlots", () => {
  const slots = wallSlots(living);

  it("keeps tall pieces out of window and radiator runs", () => {
    expect(runs(0, slots)).toEqual([
      [0, 60],
      [180, 240],
      [360, 420],
    ]);
  });

  it("lets low pieces use window runs but not the radiator", () => {
    expect(runs(0, wallSlots(living, { height: 50 }))).toEqual([
      [0, 70],
      [170, 420],
    ]);
  });

  it("splits the door wall and blocks the door swing on the adjacent wall", () => {
    expect(runs(2, slots)).toEqual([
      [0, 30],
      [120, 420],
    ]);
    expect(runs(1, slots)).toEqual([[0, 290]]);
    expect(runs(3, slots)).toEqual([[0, 380]]);
  });

  it("gives usable depth that leaves an 80 cm walkway and the back-against rotation", () => {
    const right = slots.find((s) => s.wallIndex === 1)!;
    expect(right.usableDepth).toBe(340);
    expect(right.backAgainstRotation).toBe(90);
  });
});

describe("freeFloorRect", () => {
  it("finds the largest open rectangle clear of doors and radiators", () => {
    expect(freeFloorRect(living)).toEqual({ x: 0, y: 40, w: 420, d: 250 });
  });
});

describe("rayDistance", () => {
  it("measures to the opposite wall", () => {
    expect(rayDistance(living.polygon, { x: 0, y: 100 }, { x: 1, y: 0 })).toBeCloseTo(420);
  });
});
