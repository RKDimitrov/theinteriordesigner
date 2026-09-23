import { cellCenter, rasterise } from "../../geometry/grid";
import type { Rect } from "../../geometry/polygon";
import type { Vec } from "../../geometry/vec";
import { add, cross, dot, scale, sub } from "../../geometry/vec";
import { backAgainstRotation, type Wall, wallsOf } from "../../geometry/walls";
import { type KeepClearZone, keepClearZones } from "../../geometry/zones";
import type { RoomShape } from "../../schemas/room";
import { CLEARANCE } from "../../validator/clearances";

/** A free stretch of wall where a piece can stand with its back against the wall. */
export interface WallSlot {
  wallIndex: number;
  /** cm from the wall's start vertex. */
  from: number;
  to: number;
  length: number;
  /** How deep a piece may be and still leave an 80 cm walkway in front of it. */
  usableDepth: number;
  backAgainstRotation: number;
}

export interface SlotOptions {
  /** Depth of the piece (cm): keep-clear zones within this band block the wall. */
  depth?: number;
  /** Height of the piece: windows only block pieces taller than their sill. */
  height?: number;
  /** Ignore runs shorter than this. */
  minLength?: number;
}

export type Interval = readonly [number, number];

/** Wall-frame extent of a polygon: along the wall and inward from it. */
function wallFrameBounds(wall: Wall, poly: readonly Vec[]): { along: Interval; inward: Interval } {
  let a0 = Infinity;
  let a1 = -Infinity;
  let i0 = Infinity;
  let i1 = -Infinity;
  for (const p of poly) {
    const rel = sub(p, wall.a);
    const a = dot(rel, wall.dir);
    const i = dot(rel, wall.inward);
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    i0 = Math.min(i0, i);
    i1 = Math.max(i1, i);
  }
  return { along: [a0, a1], inward: [i0, i1] };
}

/** `[0, length]` minus the blocked intervals. */
export function subtract(length: number, blocked: readonly Interval[]): Interval[] {
  const sorted = [...blocked].sort((p, q) => p[0] - q[0]);
  const out: Interval[] = [];
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (s > cursor) out.push([cursor, Math.min(s, length)]);
    cursor = Math.max(cursor, e);
    if (cursor >= length) break;
  }
  if (cursor < length) out.push([cursor, length]);
  return out.filter(([s, e]) => e > s);
}

/** Distance from `origin` along unit `dir` to the first polygon edge (ignoring the edge it starts on). */
export function rayDistance(poly: readonly Vec[], origin: Vec, dir: Vec): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const e = sub(poly[(i + 1) % poly.length]!, p);
    const denom = cross(dir, e);
    if (Math.abs(denom) < 1e-9) continue;
    const w = sub(p, origin);
    const t = cross(w, e) / denom;
    const u = cross(w, dir) / denom;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

/** Does a keep-clear zone block pieces of this height? */
const blocksHeight = (z: KeepClearZone, height: number): boolean => z.minBlockingHeight === undefined || height > z.minBlockingHeight;

/**
 * Free wall runs per wall: the wall minus every door swing, door path,
 * radiator, fixed element (and window, for pieces taller than the sill)
 * that reaches into a band `depth` deep in front of the wall.
 */
export function wallSlots(room: Pick<RoomShape, "polygon" | "openings" | "fixedElements">, opts: SlotOptions = {}): WallSlot[] {
  const depth = opts.depth ?? 60;
  const height = opts.height ?? Infinity;
  const minLength = opts.minLength ?? 30;
  const zones = keepClearZones(room).filter((z) => blocksHeight(z, height));
  const walls = wallsOf(room.polygon);
  const slots: WallSlot[] = [];
  for (const wall of walls) {
    const blocked: Interval[] = [];
    for (const z of zones) {
      const b = wallFrameBounds(wall, z.polygon);
      // Zones behind the wall or beyond the band do not block it.
      if (b.inward[1] <= 1 || b.inward[0] >= depth - 1) continue;
      if (b.along[1] <= 0 || b.along[0] >= wall.length) continue;
      blocked.push(b.along);
    }
    for (const [from, to] of subtract(wall.length, blocked)) {
      if (to - from < minLength) continue;
      const mid = add(wall.a, scale(wall.dir, (from + to) / 2));
      const across = rayDistance(room.polygon, mid, wall.inward);
      slots.push({
        wallIndex: wall.index,
        from: round1(from),
        to: round1(to),
        length: round1(to - from),
        usableDepth: round1(Math.max(0, across - CLEARANCE.walkway)),
        backAgainstRotation: backAgainstRotation(wall),
      });
    }
  }
  return slots;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Largest axis-aligned rectangle of open floor, clear of door swings and
 * paths, radiators and fixed elements (windows do not block the floor).
 */
export function freeFloorRect(room: Pick<RoomShape, "polygon" | "openings" | "fixedElements">): Rect {
  const obstacles = keepClearZones(room)
    .filter((z) => z.kind !== "window")
    .map((z) => z.polygon);
  const g = rasterise(room.polygon, obstacles);
  const heights = new Array<number>(g.cols).fill(0);
  let best = { area: 0, c0: 0, c1: 0, r0: 0, r1: 0 };
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) heights[c] = g.blocked[r * g.cols + c] ? 0 : heights[c]! + 1;
    // Largest rectangle in a histogram (monotonic stack).
    const stack: number[] = [];
    for (let c = 0; c <= g.cols; c++) {
      const h = c === g.cols ? 0 : heights[c]!;
      while (stack.length > 0 && heights[stack.at(-1)!]! >= h) {
        const top = stack.pop()!;
        const height = heights[top]!;
        const left = stack.length > 0 ? stack.at(-1)! + 1 : 0;
        const area = height * (c - left);
        if (area > best.area) best = { area, c0: left, c1: c - 1, r0: r - height + 1, r1: r };
      }
      stack.push(c);
    }
  }
  if (best.area === 0) return { x: g.x0, y: g.y0, w: 0, d: 0 };
  const tl = cellCenter(g, best.r0 * g.cols + best.c0);
  const half = g.cell / 2;
  return {
    x: tl.x - half,
    y: tl.y - half,
    w: (best.c1 - best.c0 + 1) * g.cell,
    d: (best.r1 - best.r0 + 1) * g.cell,
  };
}
