import { add, dot, scale, sub, type Vec } from "../geometry/vec";
import { type Wall, wallsOf } from "../geometry/walls";
import type { InnerWall, Opening } from "../schemas/room";

/*
 * Walls standing inside a room. Each is described by its middle line; its
 * "face" is a Wall half the thickness to one side, so every piece of
 * opening code written for outer walls (spans, door swings, wall pieces,
 * the 3D joinery) works on it unchanged, with the wall's own thickness
 * behind the face. Pure, so the geometry is tested.
 */

export interface InnerWallRoom {
  polygon: readonly Vec[];
  openings: readonly Opening[];
  innerWalls?: readonly InnerWall[];
}

/** The inner wall's face as a Wall (index 0): doors on it open towards `inward`. */
export function innerWallFace(w: Pick<InnerWall, "a" | "b" | "thickness">): Wall {
  const d = sub(w.b, w.a);
  const length = Math.hypot(d.x, d.y);
  const dir = length > 0 ? { x: d.x / length, y: d.y / length } : { x: 1, y: 0 };
  // Left of the direction of travel in y-down plan coordinates, as for outer walls drawn clockwise.
  const inward = { x: -dir.y, y: dir.x };
  const half = scale(inward, w.thickness / 2);
  return { index: 0, a: add(w.a, half), b: add(w.b, half), length, dir, inward };
}

/** The solid parts of an inner wall, as outlines: the wall minus its doorways and passages (windows are holes higher up, so the wall stays solid at floor level). */
export function innerWallSolids(w: InnerWall): Vec[][] {
  const face = innerWallFace(w);
  const gaps = w.openings
    .filter((o) => o.kind === "door")
    .map((o) => [Math.max(0, o.offset), Math.min(face.length, o.offset + o.width)] as const)
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  const out: Vec[][] = [];
  let cursor = 0;
  const strip = (from: number, to: number) => {
    const p = add(face.a, scale(face.dir, from));
    const q = add(face.a, scale(face.dir, to));
    const back = scale(face.inward, -w.thickness);
    out.push([p, q, add(q, back), add(p, back)]);
  };
  for (const [a, b] of gaps) {
    if (a > cursor) strip(cursor, a);
    cursor = Math.max(cursor, b);
  }
  if (cursor < face.length) strip(cursor, face.length);
  return out;
}

export interface FoundOpening {
  opening: Opening;
  /** The wall it sits on: an outer wall of the outline, or an inner wall's face. */
  wall: Wall;
  /** "outer", or the id of the inner wall. */
  host: string;
}

/** Every door, window and fitting of a room with the wall it sits on, outer walls first. */
export function allOpenings(room: InnerWallRoom): FoundOpening[] {
  const walls = wallsOf(room.polygon);
  const outer = room.openings.flatMap((opening) => {
    const wall = walls[opening.wallIndex];
    return wall ? [{ opening, wall, host: "outer" }] : [];
  });
  const inner = (room.innerWalls ?? []).flatMap((w) => {
    const wall = innerWallFace(w);
    return w.openings.map((opening) => ({ opening, wall, host: w.id }));
  });
  return [...outer, ...inner];
}

export const findOpening = (room: InnerWallRoom, id: string): FoundOpening | null => allOpenings(room).find((o) => o.opening.id === id) ?? null;

/** The room with one opening changed, wherever it sits. */
export function updateOpening<R extends InnerWallRoom>(room: R, id: string, fn: (o: Opening) => Opening): R {
  if (room.openings.some((o) => o.id === id)) return { ...room, openings: room.openings.map((o) => (o.id === id ? fn(o) : o)) };
  return { ...room, innerWalls: (room.innerWalls ?? []).map((w) => (w.openings.some((o) => o.id === id) ? { ...w, openings: w.openings.map((o) => (o.id === id ? fn(o) : o)) } : w)) };
}

export function removeOpening<R extends InnerWallRoom>(room: R, id: string): R {
  if (room.openings.some((o) => o.id === id)) return { ...room, openings: room.openings.filter((o) => o.id !== id) };
  return { ...room, innerWalls: (room.innerWalls ?? []).map((w) => ({ ...w, openings: w.openings.filter((o) => o.id !== id) })) };
}

/** The inner wall nearest `p` (room coordinates) within `maxDist` cm of its middle line, and where along it `p` lies. */
export function nearestInnerWall(room: InnerWallRoom, p: Vec, maxDist: number): { wall: InnerWall; face: Wall; offset: number; distance: number } | null {
  let best: { wall: InnerWall; face: Wall; offset: number; distance: number } | null = null;
  for (const w of room.innerWalls ?? []) {
    const face = innerWallFace(w);
    const along = dot(sub(p, w.a), face.dir);
    if (along < 0 || along > face.length) continue;
    const distance = Math.abs(dot(sub(p, w.a), face.inward));
    if (distance <= maxDist && (!best || distance < best.distance)) best = { wall: w, face, offset: along, distance };
  }
  return best;
}
