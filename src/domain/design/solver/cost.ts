import { axes, convexOverlap, itemFootprint, polygonInside, stripBeside } from "../../geometry/obb";
import type { Vec } from "../../geometry/vec";
import { add, scale } from "../../geometry/vec";
import { CLEARANCE, DOUBLE_BED_MIN_WIDTH, overlapAllowed } from "../../validator/clearances";
import { needsFrontAccess } from "../catalogue";
import type { PlannedItem, Pose } from "../plan";
import type { SolverCtx } from "./candidates";

/** A placed item with its footprint. */
export interface Placed {
  item: PlannedItem;
  pose: Pose;
  poly: Vec[];
}

/** Cost of one hard conflict (overlap, keep-clear zone). */
export const HARD = 1000;
/** Cost of a blocked access strip. */
export const ACCESS = 300;
/** Depth of the strip kept free in front of pieces that need access. */
const FRONT_RESERVE = 60;
/** Nightstands sit at the head, so bed side strips start this far from it (matches the validator). */
const HEAD_ALLOWANCE = 50;

export const footprintOf = (item: Pick<PlannedItem, "w" | "d">, pose: Pose): Vec[] => itemFootprint({ ...pose, w: item.w, d: item.d });

function bedSideStrip(bed: PlannedItem, pose: Pose, sign: 1 | -1): Vec[] {
  const { u, v } = axes(pose);
  const centre = add(add(pose, scale(u, sign * (bed.w / 2 + CLEARANCE.bedSide / 2))), scale(v, HEAD_ALLOWANCE / 2));
  return itemFootprint({ ...centre, w: CLEARANCE.bedSide, d: bed.d - HEAD_ALLOWANCE, rotation: pose.rotation });
}

/**
 * Floor strips an item needs free around it: bed sides and foot, dining
 * sides, fronts. A single bed needs only one free side, so its sides are
 * not reserved (the validator still checks them).
 */
export function reservedStrips(item: PlannedItem, pose: Pose): Vec[][] {
  const f = { ...pose, w: item.w, d: item.d };
  if (item.category === "bed") {
    const sides = item.w >= DOUBLE_BED_MIN_WIDTH ? [bedSideStrip(item, pose, 1), bedSideStrip(item, pose, -1)] : [];
    return [...sides, stripBeside(f, "front", CLEARANCE.bedSide)];
  }
  if (item.category === "dining_table") {
    const sides = item.w >= item.d ? (["front", "back"] as const) : (["left", "right"] as const);
    return sides.map((s) => stripBeside(f, s, CLEARANCE.diningBehindChairs));
  }
  if (needsFrontAccess(item.category)) return [stripBeside(f, "front", FRONT_RESERVE)];
  return [];
}

/** True if one item is placed relative to the other (coffee table ↔ sofa): they may share access strips. */
const related = (a: PlannedItem, b: PlannedItem) => a.intent.relativeTo === b.id || b.intent.relativeTo === a.id;

const verticalOverlap = (a: PlannedItem, b: PlannedItem) => a.elevation < b.elevation + b.h && b.elevation < a.elevation + a.h;

/**
 * Fast estimate of how bad a pose is against the pieces already placed:
 * Infinity when outside the room, HARD per collision, ACCESS per blocked strip.
 * Used to rank candidates before the full validator runs on the best few.
 */
export function cheapCost(ctx: SolverCtx, item: PlannedItem, pose: Pose, placed: readonly Placed[]): number {
  if (item.placement === "ceiling") return 0;
  const poly = footprintOf(item, pose);
  if (!polygonInside(ctx.room.polygon, poly)) return Infinity;
  if (item.placement === "floor_covering") return 0;
  let cost = 0;

  if (item.placement === "wall") {
    const thick = footprintOf({ w: item.w, d: Math.max(item.d, 10) }, pose);
    for (const z of ctx.zones) {
      const win = z.kind === "window" ? ctx.windows.get(z.refId) : undefined;
      if (win && item.elevation < win.top && item.elevation + item.h > win.bottom && convexOverlap(thick, z.polygon)) cost += HARD;
    }
    for (const p of placed) {
      if (p.item.placement === "floor_covering" || p.item.placement === "ceiling") continue;
      if (!verticalOverlap(item, p.item) || !convexOverlap(thick, p.poly)) continue;
      cost += p.item.placement === "wall" ? HARD / 2 : 200;
    }
    return cost;
  }

  // Floor item.
  for (const z of ctx.zones) {
    if (z.kind === "window" && item.h <= (z.minBlockingHeight ?? 0)) continue;
    const o = convexOverlap(poly, z.polygon);
    if (o) cost += HARD + o.depth * 10;
  }
  const floor = placed.filter((p) => p.item.placement === "floor");
  for (const p of floor) {
    if (overlapAllowed(item.category, p.item.category)) continue;
    const o = convexOverlap(poly, p.poly);
    if (o) cost += HARD + o.depth * 10;
  }
  for (const p of placed) {
    if (p.item.placement === "wall" && verticalOverlap(item, p.item) && convexOverlap(poly, footprintOf({ w: p.item.w, d: Math.max(p.item.d, 10) }, p.pose))) cost += 200;
  }
  // Own access strips must be inside the room and free.
  for (const strip of reservedStrips(item, pose)) {
    if (!polygonInside(ctx.room.polygon, strip)) {
      cost += ACCESS;
      continue;
    }
    const blocked =
      floor.some((p) => !related(item, p.item) && !overlapAllowed(item.category, p.item.category) && convexOverlap(strip, p.poly)) ||
      ctx.zones.some((z) => z.kind === "fixed" && convexOverlap(strip, z.polygon));
    if (blocked) cost += ACCESS;
  }
  // And this piece must not stand in the access strips of pieces already placed.
  for (const p of floor) {
    if (related(item, p.item) || overlapAllowed(item.category, p.item.category)) continue;
    for (const strip of reservedStrips(p.item, p.pose)) if (convexOverlap(poly, strip)) cost += ACCESS;
  }
  // A single bed needs one free long side.
  if (item.category === "bed" && item.w < DOUBLE_BED_MIN_WIDTH) {
    const free = ([1, -1] as const).some((sign) => {
      const strip = bedSideStrip(item, pose, sign);
      return polygonInside(ctx.room.polygon, strip) && !floor.some((p) => !related(item, p.item) && convexOverlap(strip, p.poly));
    });
    if (!free) cost += ACCESS;
  }
  return cost;
}
