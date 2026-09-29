import { doorStyle, radiatorStyle, windowStyle } from "../room/fit-out";
import { frontZone, isCeilingKind } from "../room/fixtures";
import type { FixedElement, Opening, RoomShape } from "../schemas/room";
import { doorSwings, openingSpan, slideRun } from "./openings";
import { rectPolygon } from "./polygon";
import type { Vec } from "./vec";
import { add, scale } from "./vec";
import { wallsOf } from "./walls";

/** Keep-clear areas derived from the room. Shared by the validator and the prompt facts. */
export interface KeepClearZone {
  kind: "door_swing" | "door_path" | "door_slide" | "window" | "radiator" | "fixed" | "fixture_front";
  /** Opening or fixed element id. */
  refId: string;
  polygon: Vec[];
  /** Window: only items taller than this block it. */
  minBlockingHeight?: number;
  /** Radiator span length along the wall, for coverage checks. */
  spanLength?: number;
}

export const DOOR_PATH_DEPTH_CM = 80;
export const WINDOW_ZONE_DEPTH_CM = 60;
export const RADIATOR_EXTRA_DEPTH_CM = 30;
/** In front of full-height glazing, pieces up to this height may stand (a sofa back is taller). */
export const LOW_IN_FRONT_OF_GLAZING_CM = 50;

function bandInside(walls: ReturnType<typeof wallsOf>, o: Pick<Opening, "wallIndex" | "offset" | "width">, depth: number): Vec[] | null {
  const span = openingSpan(walls, o);
  if (!span) return null;
  const inward = scale(span.wall.inward, depth);
  return [span.start, span.end, add(span.end, inward), add(span.start, inward)];
}

export function keepClearZones(room: Pick<RoomShape, "polygon" | "openings" | "fixedElements">): KeepClearZone[] {
  const walls = wallsOf(room.polygon);
  const zones: KeepClearZone[] = [];
  for (const o of room.openings) {
    if (o.kind === "door") {
      for (const swing of doorSwings(walls, o)) zones.push({ kind: "door_swing", refId: o.id, polygon: swing.polygon });
      const run = slideRun(walls, o);
      if (run) zones.push({ kind: "door_slide", refId: o.id, polygon: run });
      const path = bandInside(walls, o, DOOR_PATH_DEPTH_CM);
      if (path) zones.push({ kind: "door_path", refId: o.id, polygon: path });
      // A balcony door is glazing too: keep the light in front of it.
      const glass = doorStyle(o) === "balcony" ? bandInside(walls, o, WINDOW_ZONE_DEPTH_CM) : null;
      if (glass) zones.push({ kind: "window", refId: o.id, polygon: glass, minBlockingHeight: LOW_IN_FRONT_OF_GLAZING_CM });
    } else if (o.kind === "window") {
      const z = bandInside(walls, o, WINDOW_ZONE_DEPTH_CM);
      const minBlockingHeight = windowStyle(o) === "floor_to_ceiling" ? Math.max(o.sillHeight, LOW_IN_FRONT_OF_GLAZING_CM) : o.sillHeight;
      if (z) zones.push({ kind: "window", refId: o.id, polygon: z, minBlockingHeight });
    } else if (o.kind === "radiator") {
      // A floor convector is walked over; nothing needs to keep clear of it.
      if (radiatorStyle(o) === "convector") continue;
      const z = bandInside(walls, o, o.depth + RADIATOR_EXTRA_DEPTH_CM);
      if (z) zones.push({ kind: "radiator", refId: o.id, polygon: z, spanLength: o.width });
    }
  }
  for (const f of room.fixedElements) {
    // Ceiling lights hang above the furniture.
    if (isCeilingKind(f.kind)) continue;
    zones.push({ kind: "fixed", refId: f.id, polygon: fixedPolygon(f) });
    const front = frontZone(f);
    if (front) zones.push({ kind: "fixture_front", refId: f.id, polygon: front });
  }
  return zones;
}

export const fixedPolygon = (f: FixedElement): Vec[] => rectPolygon(f.rect.w, f.rect.d, f.rect.x, f.rect.y);

/** Point just inside a door, `depth` cm into the room from the middle of the opening. */
export function doorEntryPoint(room: Pick<RoomShape, "polygon">, door: Pick<Opening, "wallIndex" | "offset" | "width">, depth: number): Vec | null {
  const walls = wallsOf(room.polygon);
  const span = openingSpan(walls, door);
  if (!span) return null;
  const mid = scale(add(span.start, span.end), 0.5);
  return add(mid, scale(span.wall.inward, depth));
}
