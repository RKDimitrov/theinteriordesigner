import { describe, expect, it } from "vitest";
import { fitDistance, RENDER_VIEW, type View, viewDirection } from "./framing.ts";

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] * (1 / l)];
};

/** Largest |x| and |y| of the box's corners in normalised device coordinates, seen from `distance`. */
function extent(size: V3, view: View, distance: number): { x: number; y: number } {
  const dir = viewDirection(view);
  const right = unit(cross([0, 1, 0], dir));
  const up = cross(dir, right);
  const t = Math.tan((view.fovDeg * Math.PI) / 360);
  let x = 0;
  let y = 0;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const c: V3 = [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2];
        const depth = distance - dot(c, dir);
        x = Math.max(x, Math.abs(dot(c, right)) / (depth * t * view.aspect));
        y = Math.max(y, Math.abs(dot(c, up)) / (depth * t));
      }
  return { x, y };
}

describe("viewDirection", () => {
  it("looks from the front, to the right and above", () => {
    const [x, y, z] = viewDirection(RENDER_VIEW);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(x);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });
});

describe("fitDistance", () => {
  const margin = 0.1;
  it.each([
    ["a cube", [100, 100, 100]],
    ["a sofa", [220, 80, 95]],
    ["a floor lamp", [40, 170, 40]],
    ["a low table", [120, 35, 60]],
  ] as [string, V3][])("frames %s so it fills the picture up to the margin", (_, size) => {
    const e = extent(size, RENDER_VIEW, fitDistance(size, RENDER_VIEW, margin));
    expect(Math.max(e.x, e.y)).toBeCloseTo(1 - margin, 5);
    expect(Math.min(e.x, e.y)).toBeLessThanOrEqual(1 - margin + 1e-9);
  });

  it("stands further back for a bigger piece", () => {
    expect(fitDistance([200, 200, 200], RENDER_VIEW, margin)).toBeCloseTo(2 * fitDistance([100, 100, 100], RENDER_VIEW, margin));
  });
});
