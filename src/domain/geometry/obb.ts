import { containsPoint, segmentsCross } from "./polygon";
import type { Vec } from "./vec";
import { add, dot, length, normalize, rotate, scale, sub } from "./vec";

/** The fields of a furniture item that define its footprint. */
export interface Footprint {
  x: number;
  y: number;
  w: number;
  d: number;
  rotation: number;
}

/** Local axes after rotation: u along width (local +x), v along depth towards the front (local +y). */
export function axes(f: Pick<Footprint, "rotation">): { u: Vec; v: Vec } {
  return { u: rotate({ x: 1, y: 0 }, f.rotation), v: rotate({ x: 0, y: 1 }, f.rotation) };
}

/** Unit vector the item's front faces. */
export const frontNormal = (f: Pick<Footprint, "rotation">): Vec => axes(f).v;

/** Corners in order back-left, back-right, front-right, front-left (local). */
export function itemFootprint(f: Footprint): Vec[] {
  const { u, v } = axes(f);
  const c = { x: f.x, y: f.y };
  const hu = scale(u, f.w / 2);
  const hv = scale(v, f.d / 2);
  return [sub(sub(c, hu), hv), sub(add(c, hu), hv), add(add(c, hu), hv), add(sub(c, hu), hv)];
}

/** Rectangle `depth` deep attached outside one side of the footprint (same rotation). */
export function stripBeside(f: Footprint, side: "front" | "back" | "left" | "right", depth: number): Vec[] {
  const { u, v } = axes(f);
  const c = { x: f.x, y: f.y };
  switch (side) {
    case "front":
      return itemFootprint({ ...f, ...add(c, scale(v, f.d / 2 + depth / 2)), d: depth });
    case "back":
      return itemFootprint({ ...f, ...sub(c, scale(v, f.d / 2 + depth / 2)), d: depth });
    case "right":
      return itemFootprint({ ...f, ...add(c, scale(u, f.w / 2 + depth / 2)), w: depth });
    case "left":
      return itemFootprint({ ...f, ...sub(c, scale(u, f.w / 2 + depth / 2)), w: depth });
  }
}

/** Minimum overlap below which shapes count as touching, not overlapping. */
export const TOUCH_TOLERANCE_CM = 1;

export interface Overlap {
  /** Penetration depth along `axis` (cm). */
  depth: number;
  /** Unit axis along which moving `a` by `depth` separates the shapes. Points from b towards a. */
  axis: Vec;
}

function project(poly: readonly Vec[], axis: Vec): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = dot(p, axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

function centroid(poly: readonly Vec[]): Vec {
  const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return scale(s, 1 / poly.length);
}

/**
 * Separating axis test for two convex polygons. Returns the smallest
 * penetration or null when they are separate (or only touching).
 */
export function convexOverlap(a: readonly Vec[], b: readonly Vec[], tolerance = TOUCH_TOLERANCE_CM): Overlap | null {
  let best: Overlap | null = null;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const edge = sub(q, p);
      if (length(edge) < 1e-9) continue;
      const axis = normalize({ x: -edge.y, y: edge.x });
      const [aMin, aMax] = project(a, axis);
      const [bMin, bMax] = project(b, axis);
      const depth = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (depth <= tolerance) return null;
      if (!best || depth < best.depth) best = { depth, axis };
    }
  }
  if (!best) return null;
  // Orient the axis from b to a.
  const dir = sub(centroid(a), centroid(b));
  return dot(dir, best.axis) < 0 ? { depth: best.depth, axis: scale(best.axis, -1) } : best;
}

/** True if every corner is inside `room` and no edge crosses a room wall. */
export function polygonInside(room: readonly Vec[], poly: readonly Vec[], tolerance = TOUCH_TOLERANCE_CM): boolean {
  // Shrink slightly towards the centroid so shapes flush against a wall count as inside.
  const c = centroid(poly);
  const shrunk = poly.map((p) => {
    const d = sub(p, c);
    const l = length(d);
    return l <= tolerance ? p : sub(p, scale(d, tolerance / l));
  });
  if (!shrunk.every((p) => containsPoint(room, p))) return false;
  for (let i = 0; i < shrunk.length; i++) {
    for (let j = 0; j < room.length; j++) {
      if (segmentsCross(shrunk[i]!, shrunk[(i + 1) % shrunk.length]!, room[j]!, room[(j + 1) % room.length]!)) return false;
    }
  }
  return true;
}

/** Human-readable direction for a move along `axis`, e.g. "+x (right)". */
export function directionWord(axis: Vec): string {
  if (Math.abs(axis.x) >= Math.abs(axis.y)) return axis.x >= 0 ? "+x (right)" : "−x (left)";
  return axis.y >= 0 ? "+y (down)" : "−y (up)";
}
