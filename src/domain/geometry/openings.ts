import { doorStyle, slides } from "../room/fit-out";
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

/** Width of the trim (architrave) round a door; it runs over the head of the opening too. */
export const DOOR_TRIM_CM = 7;

/**
 * Top of the hole in the wall for a door. A door's height is measured to the
 * top of its trim, as on the wall, so the hole stops one trim width lower;
 * the trim never reaches past the ceiling.
 */
export function doorHoleTop(door: Pick<Door, "height">, ceiling: number): number {
  return Math.max(20, Math.min(door.height, ceiling) - DOOR_TRIM_CM);
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
 * ("out" opens away from this room). Null for sliding doors and pass-throughs. Used for drawing.
 */
export function doorLeaf(walls: readonly Wall[], door: Door, segments = SWING_SEGMENTS): DoorSwing | null {
  return doorLeaves(walls, door, segments)[0] ?? null;
}

/**
 * Every swinging leaf of a door: one for hinged, glazed and balcony doors,
 * two half-width leaves for a double door, one half-width fold for a bifold.
 * Empty for sliding styles and pass-throughs.
 */
export function doorLeaves(walls: readonly Wall[], door: Door, segments = SWING_SEGMENTS): DoorSwing[] {
  if (door.swing === "sliding" || door.swing === "none" || slides(door)) return [];
  const style = doorStyle(door);
  if (style === "double") {
    const half = door.width / 2;
    return (["start", "end"] as const).flatMap((hinge) => {
      const leaf = swingLeaf(walls, door, hinge, half, segments);
      return leaf ? [leaf] : [];
    });
  }
  const leaf = swingLeaf(walls, door, door.hinge, style === "bifold" ? door.width / 2 : door.width, segments);
  return leaf ? [leaf] : [];
}

function swingLeaf(walls: readonly Wall[], door: Door, hingeAt: "start" | "end", r: number, segments: number): DoorSwing | null {
  const span = openingSpan(walls, door);
  if (!span) return null;
  const { wall } = span;
  const openDir = door.swing === "in" ? wall.inward : scale(wall.inward, -1);
  const hinge = hingeAt === "start" ? span.start : span.end;
  const closedDir = hingeAt === "start" ? wall.dir : scale(wall.dir, -1);
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

/** Areas swept inside this room by all of a door's leaves. */
export function doorSwings(walls: readonly Wall[], door: Door, segments = SWING_SEGMENTS): DoorSwing[] {
  return door.swing === "in" ? doorLeaves(walls, door, segments) : [];
}

export const SLIDE_RUN_DEPTH_CM = 15;

/**
 * Strip of wall face a sliding or barn leaf runs along when open: `width` long
 * on the hinge side of the opening, clipped to the wall. Null for pocket doors
 * (the leaf disappears into the wall) and for swinging doors.
 */
export function slideRun(walls: readonly Wall[], door: Door): Vec[] | null {
  if (!slides(door) || doorStyle(door) === "pocket") return null;
  const wall = walls[door.wallIndex];
  if (!wall) return null;
  const from = door.hinge === "start" ? Math.max(0, door.offset - door.width) : door.offset + door.width;
  const to = door.hinge === "start" ? door.offset : Math.min(wall.length, door.offset + 2 * door.width);
  if (to - from < 1) return null;
  const a = pointOnWall(wall, from);
  const b = pointOnWall(wall, to);
  const inward = scale(wall.inward, SLIDE_RUN_DEPTH_CM);
  return [a, b, add(b, inward), add(a, inward)];
}

/** Openings that pierce the wall and therefore may not overlap each other. */
export const THROUGH_WALL: ReadonlySet<Opening["kind"]> = new Set(["door", "window"]);

/** Pairs of opening kinds that may not share wall span. */
export function kindsConflict(a: Opening["kind"], b: Opening["kind"]): boolean {
  // Sockets and switches sit on the wall's surface, beside or under anything.
  if (a === "socket" || b === "socket" || a === "switch" || b === "switch") return false;
  if (THROUGH_WALL.has(a) && THROUGH_WALL.has(b)) return true;
  // A radiator may sit under a window, never in a doorway.
  const pair = new Set([a, b]);
  if (pair.has("radiator") && pair.has("door")) return true;
  return a === "radiator" && b === "radiator";
}

export function spansOverlap(a: Pick<Opening, "offset" | "width">, b: Pick<Opening, "offset" | "width">): boolean {
  return a.offset < b.offset + b.width && b.offset < a.offset + a.width;
}
