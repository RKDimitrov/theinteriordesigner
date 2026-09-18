import type { Door, Opening } from "../schemas/room";
import type { Vec } from "./vec";
import { add, scale } from "./vec";
import type { Wall } from "./walls";
import { pointOnWall } from "./walls";

export interface OpeningSpan {
  wall: Wall;
  start: Vec;
  end: Vec;
}

/** Start/end points of an opening on its wall, or null if the wall index is invalid. */
export function openingSpan(walls: readonly Wall[], opening: Pick<Opening, "wallIndex" | "offset" | "width">): OpeningSpan | null {
  const wall = walls[opening.wallIndex];
  if (!wall) return null;
  return {
    wall,
    start: pointOnWall(wall, opening.offset),
    end: pointOnWall(wall, opening.offset + opening.width),
  };
}

export const SWING_SEGMENTS = 16;

export interface DoorSwing {
  hinge: Vec;
  /** Tip of the leaf when closed (lies on the wall). */
  closedTip: Vec;
  /** Tip of the leaf when opened 90° into the room. */
  openTip: Vec;
  radius: number;
  /** Quarter-disc polygon, clockwise or counter-clockwise depending on hinge side. */
  polygon: Vec[];
}

/**
 * Swept quarter disc of a hinged door leaf, on whichever side it opens to
 * ("out" opens away from this room). Null for sliding doors. Used for drawing.
 */
export function doorLeaf(walls: readonly Wall[], door: Door, segments = SWING_SEGMENTS): DoorSwing | null {
  if (door.swing === "sliding") return null;
  const span = openingSpan(walls, door);
  if (!span) return null;
  const { wall } = span;
  const openDir = door.swing === "in" ? wall.inward : scale(wall.inward, -1);
  const hinge = door.hinge === "start" ? span.start : span.end;
  const closedDir = door.hinge === "start" ? wall.dir : scale(wall.dir, -1);
  const r = door.width;
  const polygon: Vec[] = [hinge];
  for (let i = 0; i <= segments; i++) {
    const t = ((i / segments) * Math.PI) / 2;
    polygon.push(add(hinge, add(scale(closedDir, r * Math.cos(t)), scale(openDir, r * Math.sin(t)))));
  }
  return {
    hinge,
    closedTip: add(hinge, scale(closedDir, r)),
    openTip: add(hinge, scale(openDir, r)),
    radius: r,
    polygon,
  };
}

/**
 * Area swept by a door leaf inside this room. Null for sliding doors and doors
 * that swing out of the room. Used by the validator.
 */
export function doorSwing(walls: readonly Wall[], door: Door, segments = SWING_SEGMENTS): DoorSwing | null {
  return door.swing === "in" ? doorLeaf(walls, door, segments) : null;
}

/** Openings that pierce the wall and therefore may not overlap each other. */
export const THROUGH_WALL: ReadonlySet<Opening["kind"]> = new Set(["door", "window"]);

/** Pairs of opening kinds that may not share wall span. */
export function kindsConflict(a: Opening["kind"], b: Opening["kind"]): boolean {
  if (a === "socket" || b === "socket") return false;
  if (THROUGH_WALL.has(a) && THROUGH_WALL.has(b)) return true;
  // A radiator may sit under a window, never in a doorway.
  const pair = new Set([a, b]);
  if (pair.has("radiator") && pair.has("door")) return true;
  return a === "radiator" && b === "radiator";
}

export function spansOverlap(a: Pick<Opening, "offset" | "width">, b: Pick<Opening, "offset" | "width">): boolean {
  return a.offset < b.offset + b.width && b.offset < a.offset + a.width;
}
