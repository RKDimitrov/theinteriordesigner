import { dot, sub, type Vec } from "../geometry/vec";
import { type Wall, wallsOf } from "../geometry/walls";
import type { RoofSlope } from "../schemas/room";

/*
 * Rooms under the roof. Along an outer wall the roof cuts the ceiling: at the
 * wall it is `kneeHeight` high, and it rises in a straight plane to the room's
 * full height `depth` cm into the room. Pure, so the geometry is tested and
 * shared by the plan, the 3D view and the validator.
 */

export interface RoofRoom {
  polygon: readonly Vec[];
  ceilingHeight: number;
  roofSlopes: readonly RoofSlope[];
}

/** Slopes whose wall exists, with that wall. */
function slopesWithWalls(room: RoofRoom): { slope: RoofSlope; wall: Wall }[] {
  const walls = wallsOf(room.polygon);
  return (room.roofSlopes ?? []).flatMap((slope) => {
    const wall = walls[slope.wallIndex];
    return wall ? [{ slope, wall }] : [];
  });
}

/** Distance of `p` into the room from the line of `wall`. */
const into = (wall: Wall, p: Vec) => dot(sub(p, wall.a), wall.inward);

const planeHeight = (room: RoofRoom, slope: RoofSlope, wall: Wall, p: Vec) =>
  slope.kneeHeight + ((room.ceilingHeight - slope.kneeHeight) * Math.max(0, into(wall, p))) / slope.depth;

/** Ceiling height above point `p` (room coordinates, cm). */
export function ceilingAt(room: RoofRoom, p: Vec): number {
  let h = room.ceilingHeight;
  for (const { slope, wall } of slopesWithWalls(room)) h = Math.min(h, planeHeight(room, slope, wall, p));
  return Math.round(h * 100) / 100;
}

/** The lowest ceiling over a footprint (its corners; the ceiling is planar between them). */
export const headroomUnder = (room: RoofRoom, footprint: readonly Vec[]): number => Math.min(...footprint.map((p) => ceilingAt(room, p)));

/**
 * The part of `poly` where dot(p − point, normal) ≥ 0 (Sutherland–Hodgman
 * against one line). Correct for any simple polygon cut by one line into one piece.
 */
export function clipHalfPlane(poly: readonly Vec[], point: Vec, normal: Vec): Vec[] {
  const side = (p: Vec) => dot(sub(p, point), normal);
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out.length >= 3 ? out : [];
}

export interface SlopeBand {
  slope: RoofSlope;
  /** The strip between the wall and the line where the full height starts. */
  polygon: Vec[];
  /** That line across the room: the dashed line on the plan. */
  line: [Vec, Vec];
}

export function slopeBands(room: RoofRoom): SlopeBand[] {
  return slopesWithWalls(room).flatMap(({ slope, wall }) => {
    const at = { x: wall.a.x + wall.inward.x * slope.depth, y: wall.a.y + wall.inward.y * slope.depth };
    const polygon = clipHalfPlane(room.polygon, at, { x: -wall.inward.x, y: -wall.inward.y });
    if (polygon.length === 0) return [];
    // The line is the band's edge that lies on the depth line.
    const onLine = polygon.filter((p) => Math.abs(into(wall, p) - slope.depth) < 0.01);
    if (onLine.length < 2) return [];
    const along = (p: Vec) => dot(sub(p, wall.a), wall.dir);
    onLine.sort((p, q) => along(p) - along(q));
    return [{ slope, polygon, line: [onLine[0]!, onLine[onLine.length - 1]!] as [Vec, Vec] }];
  });
}

/** Height of the ceiling along a wall: where it starts, where it bends, where it ends. `t` runs from the wall's start. */
export function wallTop(room: RoofRoom, wall: Wall): { t: number; h: number }[] {
  const at = (t: number): Vec => ({ x: wall.a.x + wall.dir.x * t, y: wall.a.y + wall.dir.y * t });
  const ts = new Set<number>([0, wall.length]);
  const slopes = slopesWithWalls(room);
  // A slope's plane reaches the full height where this wall crosses its depth line.
  for (const { slope, wall: w } of slopes) {
    const rate = dot(wall.dir, w.inward);
    if (Math.abs(rate) < 1e-9) continue;
    const t = (slope.depth - into(w, wall.a)) / rate;
    if (t > 0 && t < wall.length) ts.add(Math.round(t * 100) / 100);
  }
  // Two slopes cross each other where their heights are equal.
  for (let i = 0; i < slopes.length; i++)
    for (let j = i + 1; j < slopes.length; j++) {
      const f = (t: number) => planeHeight(room, slopes[i]!.slope, slopes[i]!.wall, at(t)) - planeHeight(room, slopes[j]!.slope, slopes[j]!.wall, at(t));
      const f0 = f(0);
      const f1 = f(wall.length);
      if (f0 * f1 < 0) ts.add(Math.round(((f0 / (f0 - f1)) * wall.length) * 100) / 100);
    }
  const out = [...ts].sort((a, b) => a - b).map((t) => ({ t, h: ceilingAt(room, at(t)) }));
  // Drop points in the middle of a straight run.
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1]!;
    const b = out[i + 1]!;
    return Math.abs(a.h + ((b.h - a.h) * (p.t - a.t)) / (b.t - a.t) - p.h) > 0.01;
  });
}

export interface CeilingPatch {
  polygon: Vec[];
  /** Ceiling height at each polygon vertex. */
  heights: number[];
}

/** The ceiling as flat and sloped pieces: the flat middle, and one piece per slope band. */
export function ceilingPatches(room: RoofRoom): CeilingPatch[] {
  const bands = slopeBands(room);
  let flat: Vec[] = [...room.polygon];
  for (const b of bands) {
    const wall = wallsOf(room.polygon)[b.slope.wallIndex]!;
    flat = clipHalfPlane(flat, { x: wall.a.x + wall.inward.x * b.slope.depth, y: wall.a.y + wall.inward.y * b.slope.depth }, wall.inward);
  }
  const patches: CeilingPatch[] = bands.map((b) => ({ polygon: b.polygon, heights: b.polygon.map((p) => ceilingAt(room, p)) }));
  if (flat.length >= 3) patches.push({ polygon: flat, heights: flat.map(() => room.ceilingHeight) });
  return patches;
}
