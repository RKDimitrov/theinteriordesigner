import { itemFootprint } from "../geometry/obb";
import { containsPoint } from "../geometry/polygon";
import { add, dot, scale, sub, type Vec } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";
import type { FurnitureItem } from "../schemas/design";
import type { Opening, Room } from "../schemas/room";

/** A solid part of a wall: `from`–`to` cm along the wall, `y0`–`y1` cm above the floor. */
export interface WallPiece {
  from: number;
  to: number;
  y0: number;
  y1: number;
}

/**
 * Split one wall into solid pieces around its doors and windows: doors leave a
 * gap up to their height, windows leave a gap between sill and head.
 */
export function wallPieces(length: number, ceiling: number, openings: readonly Opening[]): WallPiece[] {
  const holes = openings
    .filter((o) => o.kind === "door" || o.kind === "window")
    .map((o) => {
      const from = Math.max(0, o.offset);
      const to = Math.min(length, o.offset + o.width);
      const bottom = o.kind === "window" ? o.sillHeight : 0;
      const top = Math.min(ceiling, o.kind === "window" ? o.sillHeight + o.height : o.height);
      return { from, to, bottom, top };
    })
    .filter((h) => h.to > h.from)
    .sort((a, b) => a.from - b.from);

  const pieces: WallPiece[] = [];
  let cursor = 0;
  for (const h of holes) {
    if (h.from > cursor) pieces.push({ from: cursor, to: h.from, y0: 0, y1: ceiling });
    const from = Math.max(cursor, h.from);
    if (h.to > from) {
      if (h.bottom > 0) pieces.push({ from, to: h.to, y0: 0, y1: h.bottom });
      if (h.top < ceiling) pieces.push({ from, to: h.to, y0: h.top, y1: ceiling });
    }
    cursor = Math.max(cursor, h.to);
  }
  if (cursor < length) pieces.push({ from: cursor, to: length, y0: 0, y1: ceiling });
  return pieces;
}

export interface WallShare {
  /** Another room's wall runs along this one, one wall thickness away. */
  shared: boolean;
  /** That room's doors and windows, as openings on this wall, so both halves of the wall have the hole. */
  cuts: Opening[];
}

/**
 * For every room and wall: whether a neighbour's wall runs along it at the
 * planner's wall thickness (then each room draws only its own half, and the
 * two halves do not overlap and flicker in 3D), and the neighbour's openings
 * mapped onto it.
 */
export function sharedWallInfo(rooms: readonly { id: string; polygon: readonly Vec[]; origin: Vec; openings: readonly Opening[] }[], thickness: number): Record<string, WallShare[]> {
  const placed = rooms.map((r) => ({ ...r, walls: wallsOf(r.polygon).map((w) => ({ ...w, a: add(w.a, r.origin), b: add(w.b, r.origin) })) }));
  const out: Record<string, WallShare[]> = {};
  for (const r of placed) {
    out[r.id] = r.walls.map((w) => {
      const cuts: Opening[] = [];
      let shared = false;
      for (const other of placed) {
        if (other.id === r.id) continue;
        other.walls.forEach((v) => {
          // Parallel, facing the other way, one thickness out, and overlapping along the wall.
          if (dot(w.dir, v.dir) > -0.999) return;
          const gap = dot(sub(v.a, w.a), w.inward);
          if (Math.abs(gap + thickness) > 1) return;
          const from = Math.max(0, Math.min(dot(sub(v.a, w.a), w.dir), dot(sub(v.b, w.a), w.dir)));
          const to = Math.min(w.length, Math.max(dot(sub(v.a, w.a), w.dir), dot(sub(v.b, w.a), w.dir)));
          if (to - from < 1) return;
          shared = true;
          for (const o of other.openings) {
            if (o.wallIndex !== v.index || (o.kind !== "door" && o.kind !== "window")) continue;
            const s0 = dot(sub(add(v.a, scale(v.dir, o.offset)), w.a), w.dir);
            const s1 = dot(sub(add(v.a, scale(v.dir, o.offset + o.width)), w.a), w.dir);
            const start = Math.max(0, Math.min(s0, s1));
            const end = Math.min(w.length, Math.max(s0, s1));
            if (end - start < 1) continue;
            cuts.push({ ...o, id: `cut-${other.id}-${o.id}`, wallIndex: w.index, offset: start, width: end - start });
          }
        });
      }
      return { shared, cuts };
    });
  }
  return out;
}

/** Keep the walker this far from walls and furniture. */
export const WALK_MARGIN_CM = 22;

export interface WalkRoom {
  id: string;
  room: Room;
  origin: Vec;
  furniture: readonly FurnitureItem[];
}

/**
 * Whether a walker may stand at `p` (apartment cm): inside a room and clear of
 * its walls and floor furniture, or inside the doorway of an open door (or a
 * doorway without a leaf).
 */
export function canStand(p: Vec, rooms: readonly WalkRoom[], isOpen: (roomId: string, openingId: string) => boolean): boolean {
  for (const r of rooms) {
    const local = sub(p, r.origin);
    const walls = wallsOf(r.room.polygon);
    // Distance to each wall segment, not its whole line: L-shaped rooms have walls whose line crosses the room.
    if (containsPoint(r.room.polygon, local) && walls.every((w) => segmentDistance(local, w.a, w.b) >= WALK_MARGIN_CM)) {
      const blocked = r.furniture.some((f) => f.placement === "floor" && containsPoint(itemFootprint({ ...f, w: f.w + 30, d: f.d + 30 }), local));
      if (!blocked) return true;
    }
    for (const o of r.room.openings) {
      if (o.kind !== "door") continue;
      if (o.swing !== "none" && !isOpen(r.id, o.id)) continue;
      const w = walls[o.wallIndex];
      if (!w) continue;
      const along = dot(sub(local, w.a), w.dir);
      const across = dot(sub(local, w.a), w.inward);
      if (along > o.offset + 8 && along < o.offset + o.width - 8 && across > -40 && across < 40) return true;
    }
  }
  return false;
}

/** Shortest distance from `p` to the segment a–b. */
function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(1e-9, dot(ab, ab))));
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}

/** Name of the room the walker is in, or null (e.g. in a doorway). */
export function roomAt(p: Vec, rooms: readonly WalkRoom[]): WalkRoom | null {
  return rooms.find((r) => containsPoint(r.room.polygon, sub(p, r.origin))) ?? null;
}

/** A free spot to start a walkthrough: the middle of the first room, nudged until clear. */
export function startSpot(rooms: readonly WalkRoom[], isOpen: (roomId: string, openingId: string) => boolean): Vec | null {
  for (const r of rooms) {
    const xs = r.room.polygon.map((q) => q.x);
    const ys = r.room.polygon.map((q) => q.y);
    const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    for (let ring = 0; ring < 12; ring++) {
      for (let a = 0; a < 8; a++) {
        const q = add(add(c, r.origin), scale({ x: Math.cos((a * Math.PI) / 4), y: Math.sin((a * Math.PI) / 4) }, ring * 25));
        if (canStand(q, rooms, isOpen)) return q;
      }
    }
  }
  return null;
}

/** How far in front of a window the walker stops to look out. */
export const WINDOW_STAND_CM = 70;

/**
 * Where to stand to look out of a window: in front of its middle, as close
 * to WINDOW_STAND_CM as furniture allows, facing out. `yaw` uses the
 * walkthrough's convention (0 looks towards plan +x, counter-clockwise on
 * screen). Null when there is no free spot in front of it.
 */
export function windowSpot(
  roomId: string,
  openingId: string,
  rooms: readonly WalkRoom[],
  isOpen: (roomId: string, openingId: string) => boolean,
): { x: number; y: number; yaw: number } | null {
  const r = rooms.find((x) => x.id === roomId);
  const o = r?.room.openings.find((x) => x.id === openingId);
  const w = o && r ? wallsOf(r.room.polygon)[o.wallIndex] : undefined;
  if (!r || !o || !w) return null;
  const mid = add(add(r.origin, w.a), scale(w.dir, o.offset + o.width / 2));
  const yaw = (Math.atan2(w.inward.y, -w.inward.x) * 180) / Math.PI;
  for (const dist of [WINDOW_STAND_CM, 90, 55, 120, 150, 190]) {
    const p = add(mid, scale(w.inward, dist));
    if (canStand(p, rooms, isOpen)) return { ...p, yaw };
  }
  return null;
}
