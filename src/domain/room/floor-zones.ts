import { rectPolygon } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import type { FloorZone } from "../schemas/room";

/*
 * Parts of a room's floor that are higher or lower than the rest. Pure, so
 * the plan, the 3D view, the walkthrough and the checks agree on the floor
 * height at any point.
 */

/** Floor height (cm, relative to the room's floor) at room point `p`. */
export function floorAt(room: { floorZones?: readonly FloorZone[] }, p: Vec): number {
  for (const z of room.floorZones ?? []) {
    const r = z.rect;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.d) return z.height;
  }
  return 0;
}

export const zoneOutline = (z: Pick<FloorZone, "rect">): Vec[] => rectPolygon(z.rect.w, z.rect.d, z.rect.x, z.rect.y);
