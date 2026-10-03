import type { Rect } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import { layoutRooms, roomsBounds } from "./layout";

/*
 * Where every room of an apartment stands on its plan: the position saved
 * with the room, or the default arrangement for rooms never placed. The
 * planner, the apartment card and the 3D preview all use this, so they show
 * the same floor.
 */

export interface FloorRoom {
  id: string;
  polygon: readonly Vec[];
  plan?: Vec | null;
}

export function floorOrigins(rooms: readonly FloorRoom[]): Map<string, Vec> {
  const known = new Map(rooms.flatMap((r) => (r.plan ? [[r.id, r.plan] as const] : [])));
  return layoutRooms(rooms, known);
}

export const floorBounds = (rooms: readonly FloorRoom[], origins: ReadonlyMap<string, Vec>): Rect | null => roomsBounds(rooms, origins);
