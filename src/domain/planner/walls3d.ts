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
    if (containsPoint(r.room.polygon, local) && walls.every((w) => dot(sub(local, w.a), w.inward) >= WALK_MARGIN_CM)) {
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
