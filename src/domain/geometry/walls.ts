import type { Cardinal } from "../schemas/room";
import { isClockwise } from "./polygon";
import { normDeg } from "./units";
import type { Vec } from "./vec";
import { add, distance, normalize, perpCw, scale, sub } from "./vec";

export interface Wall {
  index: number;
  a: Vec;
  b: Vec;
  length: number;
  /** Unit vector from a to b. */
  dir: Vec;
  /** Unit normal pointing into the room. */
  inward: Vec;
}

/**
 * Walls of a polygon. Wall i runs from vertex i to vertex i+1.
 * Stored rooms are clockwise (y-down), where the inward normal is the
 * direction rotated 90° clockwise on screen. Vertex order is never changed
 * here, because opening wall indices depend on it.
 */
export function wallsOf(polygon: readonly Vec[]): Wall[] {
  const sign = isClockwise(polygon) ? 1 : -1;
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!;
    const dir = normalize(sub(b, a));
    return { index: i, a, b, length: distance(a, b), dir, inward: scale(perpCw(dir), sign) };
  });
}

/** Point on a wall `offset` cm from its start. */
export const pointOnWall = (wall: Wall, offset: number): Vec => add(wall.a, scale(wall.dir, offset));

/**
 * Plan angle of a direction: clockwise degrees from plan "up" (0,-1).
 */
export function planAngle(v: Vec): number {
  return normDeg((Math.atan2(v.x, -v.y) * 180) / Math.PI);
}

/** Item rotation that puts its back against `wall` with its front facing into the room. */
export const backAgainstRotation = (wall: Pick<Wall, "inward">): number => Math.round(normDeg(planAngle(wall.inward) - 180)) % 360;

/**
 * Compass bearing (0 = N, 90 = E) that a wall faces, i.e. its outward normal.
 * `northAngleDeg` is the plan angle at which north points.
 */
export function wallFacingBearing(wall: Wall, northAngleDeg: number): number {
  const outward = scale(wall.inward, -1);
  return normDeg(planAngle(outward) - northAngleDeg);
}

export function bearingToCardinal(bearing: number): Cardinal {
  const b = normDeg(bearing);
  if (b >= 315 || b < 45) return "N";
  if (b < 135) return "E";
  if (b < 225) return "S";
  return "W";
}

export function wallOrientations(
  polygon: readonly Vec[],
  northAngleDeg: number,
  overrides: Readonly<Record<string, Cardinal>> = {},
): Cardinal[] {
  return wallsOf(polygon).map((w) => overrides[String(w.index)] ?? bearingToCardinal(wallFacingBearing(w, northAngleDeg)));
}

export interface WallHit {
  wall: Wall;
  /** Projection of the point onto the wall, cm from its start (clamped to the wall). */
  offset: number;
  distance: number;
}

/** Nearest wall to `p` within `maxDist` cm, measured perpendicular to the wall. */
export function nearestWall(walls: readonly Wall[], p: Vec, maxDist: number): WallHit | null {
  let best: WallHit | null = null;
  for (const wall of walls) {
    const rel = sub(p, wall.a);
    const along = rel.x * wall.dir.x + rel.y * wall.dir.y;
    if (along < -maxDist || along > wall.length + maxDist) continue;
    const distance = Math.abs(rel.x * wall.inward.x + rel.y * wall.inward.y);
    if (distance > maxDist) continue;
    if (!best || distance < best.distance) best = { wall, offset: Math.min(wall.length, Math.max(0, along)), distance };
  }
  return best;
}
