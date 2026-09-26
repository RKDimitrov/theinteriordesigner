import { clamp, snap } from "../geometry/units";
import type { Opening, OpeningKind } from "../schemas/room";

export const DEFAULT_OPENING_WIDTH: Record<OpeningKind, number> = {
  door: 90,
  window: 120,
  radiator: 100,
  socket: 10,
};

/** Keep an opening of `width` fully on a wall of `wallLength`, snapped to the grid. */
export function clampOffset(offset: number, width: number, wallLength: number): number {
  const max = Math.max(0, Math.floor(wallLength - width));
  return clamp(snap(offset), 0, max - (max % 5));
}

/**
 * New opening of `kind` centred at `centerOffset` on a wall. Width shrinks to
 * fit short walls.
 */
export function newOpening(kind: OpeningKind, id: string, wallIndex: number, centerOffset: number, wallLength: number): Opening {
  const width = Math.min(DEFAULT_OPENING_WIDTH[kind], Math.max(5, Math.floor(wallLength / 5) * 5));
  const offset = clampOffset(centerOffset - width / 2, width, wallLength);
  const onWall = { id, wallIndex, offset, width };
  switch (kind) {
    case "door":
      return { ...onWall, kind, height: 200, hinge: "start", swing: "in" };
    case "window":
      return { ...onWall, kind, height: 140, sillHeight: 90, openable: true };
    case "radiator":
      return { ...onWall, kind, height: 60, depth: 10 };
    case "socket":
      return { ...onWall, kind, height: 30, socketType: "power" };
  }
}

/** A doorway without a leaf: a door that does not swing. */
export function newPassThrough(id: string, wallIndex: number, centerOffset: number, wallLength: number): Opening {
  const door = newOpening("door", id, wallIndex, centerOffset, wallLength);
  return door.kind === "door" ? { ...door, width: Math.min(door.width, 80), swing: "none" } : door;
}

/** Short unique id for openings and fixed elements, e.g. "door-3". */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let i = 1; ; i++) {
    const id = `${prefix}-${i}`;
    if (!used.has(id)) return id;
  }
}
