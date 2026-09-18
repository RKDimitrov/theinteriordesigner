import type { Vec } from "./vec";
import { cross, EPS, sub } from "./vec";

/**
 * Shoelace signed area. In y-down (screen) coordinates a positive value means
 * the polygon runs clockwise as seen on screen.
 */
export function signedArea(poly: readonly Vec[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const area = (poly: readonly Vec[]): number => Math.abs(signedArea(poly));
export const isClockwise = (poly: readonly Vec[]): boolean => signedArea(poly) > 0;

export function toClockwise<T extends Vec>(poly: readonly T[]): T[] {
  return isClockwise(poly) ? [...poly] : [...poly].reverse();
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Axis-aligned rectangle as clockwise polygon, starting top-left. */
export function rectPolygon(w: number, d: number, x = 0, y = 0): Vec[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
}

export function bbox(poly: readonly Vec[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, d: maxY - minY };
}

/** True if the polygon is an axis-aligned rectangle (4 vertices, right angles). */
export function isAxisAlignedRect(poly: readonly Vec[]): boolean {
  if (poly.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % 4]!;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return area(poly) > 0;
}

function onSegment(p: Vec, a: Vec, b: Vec): boolean {
  if (Math.abs(cross(sub(b, a), sub(p, a))) > EPS) return false;
  return (
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}

/** Point in polygon (ray casting). Points on the boundary count as inside. */
export function containsPoint(poly: readonly Vec[], p: Vec): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (onSegment(p, a, b)) return true;
    const intersects = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Proper segment intersection (touching at endpoints does not count). */
export function segmentsCross(a1: Vec, a2: Vec, b1: Vec, b2: Vec): boolean {
  const d1 = cross(sub(a2, a1), sub(b1, a1));
  const d2 = cross(sub(a2, a1), sub(b2, a1));
  const d3 = cross(sub(b2, b1), sub(a1, b1));
  const d4 = cross(sub(b2, b1), sub(a2, b1));
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}

/** True if any two non-adjacent edges cross. */
export function isSelfIntersecting(poly: readonly Vec[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return true;
    }
  }
  return false;
}
