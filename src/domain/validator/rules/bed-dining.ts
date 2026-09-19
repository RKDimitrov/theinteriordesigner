import { axes, convexOverlap, itemFootprint, polygonInside, stripBeside } from "../../geometry/obb";
import type { Vec } from "../../geometry/vec";
import { add, dot, scale, sub } from "../../geometry/vec";
import type { FurnitureItem } from "../../schemas/design";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { CLEARANCE, DOUBLE_BED_MIN_WIDTH } from "../clearances";
import type { RuleContext, Rule } from "../types";

/** Nightstands sit next to the head, so the side strip starts this far from the head end. */
const HEAD_ALLOWANCE = 50;

function stripFree(ctx: RuleContext, strip: Vec[], ignore: ReadonlySet<string>): string[] | null {
  if (!polygonInside(ctx.room.polygon, strip)) return [];
  const blockers = ctx.floorItems.filter((o) => !ignore.has(o.id) && convexOverlap(ctx.footprints.get(o.id)!, strip)).map((o) => o.id);
  const fixed = ctx.zones.some((z) => z.kind === "fixed" && convexOverlap(z.polygon, strip));
  return blockers.length > 0 || fixed ? blockers : null;
}

/** Side strip along a bed's long side, excluding the head end where nightstands go. */
function bedSideStrip(bed: FurnitureItem, side: "left" | "right"): Vec[] {
  const { u, v } = axes(bed);
  const length = bed.d - HEAD_ALLOWANCE;
  const sign = side === "right" ? 1 : -1;
  const centre = add(add({ x: bed.x, y: bed.y }, scale(u, sign * (bed.w / 2 + CLEARANCE.bedSide / 2))), scale(v, HEAD_ALLOWANCE / 2));
  return itemFootprint({ ...centre, w: CLEARANCE.bedSide, d: length, rotation: bed.rotation });
}

/** 60 cm beside the long sides of beds (both for double beds) and at the foot. */
export const bedAccessRule: Rule = (ctx) => {
  const issues: ValidationIssue[] = [];
  for (const bed of ctx.floorItems) {
    if (bed.category !== "bed") continue;
    const ignore = new Set(ctx.floorItems.filter((o) => o.category === "nightstand").map((o) => o.id).concat(bed.id));
    const blocked = (["left", "right"] as const).map((s) => stripFree(ctx, bedSideStrip(bed, s), ignore));
    const blockedCount = blocked.filter((b) => b !== null).length;
    const double = bed.w >= DOUBLE_BED_MIN_WIDTH;
    const blockers = blocked.flatMap((b) => b ?? []);
    if (blockedCount === 2) {
      issues.push({
        code: "BED_ACCESS",
        severity: "error",
        itemIds: [bed.id, ...blockers],
        message: `${bed.name} has no ${CLEARANCE.bedSide} cm free space along either long side`,
        required: CLEARANCE.bedSide,
        hint: `leave ${CLEARANCE.bedSide} cm free beside ${double ? "both long sides" : "one long side"} of the bed`,
      });
    } else if (double && blockedCount === 1) {
      issues.push({
        code: "BED_ACCESS",
        severity: "warning",
        itemIds: [bed.id, ...blockers],
        message: `${bed.name} is a double bed but only one long side has ${CLEARANCE.bedSide} cm free`,
        required: CLEARANCE.bedSide,
        hint: `move ${bed.name} away from the wall so both sides have ${CLEARANCE.bedSide} cm`,
      });
    }
    const foot = stripFree(ctx, stripBeside(bed, "front", CLEARANCE.bedSide), new Set([bed.id]));
    if (foot !== null) {
      issues.push({
        code: "BED_ACCESS",
        severity: "warning",
        itemIds: [bed.id, ...foot],
        message: `Less than ${CLEARANCE.bedSide} cm free at the foot of ${bed.name}`,
        required: CLEARANCE.bedSide,
        hint: `keep ${CLEARANCE.bedSide} cm free in front of the bed`,
      });
    }
  }
  return issues;
};

/** Which side of `table` a point lies on, in the table's local frame. */
function sideOf(table: FurnitureItem, p: Vec): "front" | "back" | "left" | "right" {
  const { u, v } = axes(table);
  const rel = sub(p, { x: table.x, y: table.y });
  const lu = dot(rel, u) / (table.w / 2);
  const lv = dot(rel, v) / (table.d / 2);
  if (Math.abs(lu) > Math.abs(lv)) return lu > 0 ? "right" : "left";
  return lv > 0 ? "front" : "back";
}

/** 75 cm free behind every side of a dining table that has chairs. */
export const diningRule: Rule = (ctx) => {
  const issues: ValidationIssue[] = [];
  const chairs = ctx.floorItems.filter((f) => f.category === "dining_chair");
  for (const table of ctx.floorItems) {
    if (table.category !== "dining_table") continue;
    const reach = Math.max(table.w, table.d) / 2 + 60;
    const mine = chairs.filter((c) => Math.hypot(c.x - table.x, c.y - table.y) <= reach);
    const sides = new Set(mine.map((c) => sideOf(table, { x: c.x, y: c.y })));
    const ignore = new Set([table.id, ...chairs.map((c) => c.id)]);
    for (const side of sides) {
      const blocked = stripFree(ctx, stripBeside(table, side, CLEARANCE.diningBehindChairs), ignore);
      if (blocked === null) continue;
      issues.push({
        code: "DINING_CLEARANCE",
        severity: "error",
        itemIds: [table.id, ...blocked],
        message: `Less than ${CLEARANCE.diningBehindChairs} cm free behind the chairs on the ${side} side of ${table.name}`,
        required: CLEARANCE.diningBehindChairs,
        hint: `keep ${CLEARANCE.diningBehindChairs} cm between that table edge and walls or furniture`,
      });
    }
  }
  return issues;
};
