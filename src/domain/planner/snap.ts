import type { Vec } from "../geometry/vec";

/*
 * Snapping and alignment for drawing on the plan, like the smart guides of
 * drawing programs: a point lands on a nearby corner, then on a nearby wall,
 * otherwise it lines up across or down with corners further away. Shift keeps
 * a line straight (0°, 45°, 90°) from where it starts. A shape being moved
 * shifts so that its nearest corner lines up. Pure, so every case is tested;
 * the plan draws the guides it returns.
 */

export interface SnapTargets {
  /** Corners and ends to land on or line up with. */
  points: readonly Vec[];
  /** Walls to land on. */
  segments: readonly (readonly [Vec, Vec])[];
}

/** A dashed line from what the point lined up with to where it ended. */
export interface Guide {
  from: Vec;
  to: Vec;
}

export interface Snapped {
  p: Vec;
  guides: Guide[];
  /** Set when the point landed exactly on a corner. */
  ring?: Vec;
  snapped: boolean;
}

function onSegment(p: Vec, a: Vec, b: Vec): { q: Vec; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const q = { x: a.x + dx * t, y: a.y + dy * t };
  return { q, d: Math.hypot(p.x - q.x, p.y - q.y) };
}

/** Lines `p` up across (x) and down (y) with the nearest target in reach, each on its own. */
function alignAxes(p: Vec, points: readonly Vec[], tol: number, axes: { x: boolean; y: boolean } = { x: true, y: true }): Snapped {
  let bx: Vec | null = null;
  let by: Vec | null = null;
  // Closest line first; between equally close ones, the nearer corner, so the guide stays short.
  const better = (q: Vec, cur: Vec | null, axis: "x" | "y") => {
    if (!cur) return true;
    const dq = Math.abs(q[axis] - p[axis]);
    const dc = Math.abs(cur[axis] - p[axis]);
    return dq < dc || (dq === dc && Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(cur.x - p.x, cur.y - p.y));
  };
  for (const q of points) {
    if (axes.x && Math.abs(q.x - p.x) <= tol && better(q, bx, "x")) bx = q;
    if (axes.y && Math.abs(q.y - p.y) <= tol && better(q, by, "y")) by = q;
  }
  const out = { x: bx ? bx.x : p.x, y: by ? by.y : p.y };
  const guides: Guide[] = [];
  if (bx) guides.push({ from: bx, to: out });
  if (by) guides.push({ from: by, to: out });
  return { p: out, guides, snapped: guides.length > 0 };
}

/** Where `p` lands: on a corner, else on a wall, else lined up with corners; `tol` is the reach in cm. */
export function snapPoint(p: Vec, t: SnapTargets, tol: number): Snapped {
  let corner: Vec | null = null;
  let cd = tol;
  for (const q of t.points) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= cd) {
      cd = d;
      corner = q;
    }
  }
  if (corner) return { p: { ...corner }, guides: [], ring: { ...corner }, snapped: true };

  let wall: Vec | null = null;
  let wd = tol;
  for (const [a, b] of t.segments) {
    const { q, d } = onSegment(p, a, b);
    if (d <= wd) {
      wd = d;
      wall = q;
    }
  }
  if (wall) return { p: { x: Math.round(wall.x * 10) / 10, y: Math.round(wall.y * 10) / 10 }, guides: [], snapped: true };

  return alignAxes(p, t.points, tol);
}

/**
 * With Shift: `p` kept straight across, down or at 45° from the nearest of
 * `anchors` (a line's start, or a corner's two neighbours), then lined up
 * with other corners along the direction left free.
 */
export function snapStraight(p: Vec, anchors: readonly Vec[], t: SnapTargets, tol: number): Snapped {
  let best: { q: Vec; d: number; free: "x" | "y" | null; anchor: Vec } | null = null;
  for (const a of anchors) {
    const across = { q: { x: p.x, y: a.y }, free: "x" as const };
    const down = { q: { x: a.x, y: p.y }, free: "y" as const };
    // The 45° lines through the anchor.
    const diagonals = [1, -1].map((s) => {
      const u = (p.x - a.x + s * (p.y - a.y)) / 2;
      return { q: { x: Math.round((a.x + u) * 10) / 10, y: Math.round((a.y + s * u) * 10) / 10 }, free: null };
    });
    for (const c of [across, down, ...diagonals]) {
      const d = Math.hypot(c.q.x - p.x, c.q.y - p.y);
      if (!best || d < best.d) best = { q: c.q, d, free: c.free, anchor: a };
    }
  }
  if (!best) return snapPoint(p, t, tol);
  const guide = { from: best.anchor, to: best.q };
  if (!best.free) return { p: best.q, guides: [guide], snapped: true };
  const lined = alignAxes(best.q, t.points, tol, { x: best.free === "x", y: best.free === "y" });
  return { p: lined.p, guides: [{ from: best.anchor, to: lined.p }, ...lined.guides], snapped: true };
}

/** How far to shift a shape being moved so that its corners line up with the targets; across and down are found separately. */
export function snapOffset(moving: readonly Vec[], t: SnapTargets, tol: number): { dx: number; dy: number; guides: Guide[] } {
  let bx: { d: number; m: Vec; q: Vec } | null = null;
  let by: { d: number; m: Vec; q: Vec } | null = null;
  for (const m of moving) {
    for (const q of t.points) {
      const dx = q.x - m.x;
      const dy = q.y - m.y;
      if (Math.abs(dx) <= tol && (!bx || Math.abs(dx) < Math.abs(bx.d))) bx = { d: dx, m, q };
      if (Math.abs(dy) <= tol && (!by || Math.abs(dy) < Math.abs(by.d))) by = { d: dy, m, q };
    }
  }
  const dx = bx ? bx.d : 0;
  const dy = by ? by.d : 0;
  const guides: Guide[] = [];
  if (bx) guides.push({ from: bx.q, to: { x: bx.m.x + dx, y: bx.m.y + dy } });
  if (by) guides.push({ from: by.q, to: { x: by.m.x + dx, y: by.m.y + dy } });
  return { dx, dy, guides };
}
