import { bbox, type Rect } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";

/** Wall thickness drawn outside each room in the planner. Rooms placed side by side share one wall. */
export const PLANNER_WALL_CM = 12;

/** Row width after which auto-layout starts a new row. */
const ROW_CM = 1200;

export interface LayoutRoom {
  id: string;
  polygon: readonly Vec[];
}

/**
 * Where each room sits in apartment coordinates (cm, y-down, 0 = interior top-left).
 * Rooms with a known origin keep it; the others are placed left to right in rows,
 * one wall apart, after the known ones. Rooms have no stored position yet, so this
 * is the default arrangement the user drags from.
 */
export function layoutRooms(rooms: readonly LayoutRoom[], known: ReadonlyMap<string, Vec> = new Map()): Map<string, Vec> {
  const out = new Map<string, Vec>();
  let placedBottom = 0;
  for (const r of rooms) {
    const o = known.get(r.id);
    if (!o) continue;
    out.set(r.id, o);
    const b = bbox(r.polygon);
    placedBottom = Math.max(placedBottom, o.y + b.y + b.d + PLANNER_WALL_CM);
  }

  let x = 0;
  let y = placedBottom;
  let rowDepth = 0;
  for (const r of rooms) {
    if (out.has(r.id)) continue;
    const b = bbox(r.polygon);
    if (x > 0 && x + b.w > ROW_CM) {
      x = 0;
      y += rowDepth + PLANNER_WALL_CM;
      rowDepth = 0;
    }
    // Shift so the room's own bbox starts at the cursor.
    out.set(r.id, { x: x - b.x, y: y - b.y });
    x += b.w + PLANNER_WALL_CM;
    rowDepth = Math.max(rowDepth, b.d);
  }
  return out;
}

/** Bounding box of rooms placed at their origins. Null when there are no rooms. */
export function roomsBounds(rooms: readonly LayoutRoom[], origins: ReadonlyMap<string, Vec>): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    const o = origins.get(r.id) ?? { x: 0, y: 0 };
    const b = bbox(r.polygon);
    minX = Math.min(minX, o.x + b.x);
    minY = Math.min(minY, o.y + b.y);
    maxX = Math.max(maxX, o.x + b.x + b.w);
    maxY = Math.max(maxY, o.y + b.y + b.d);
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, d: maxY - minY } : null;
}
