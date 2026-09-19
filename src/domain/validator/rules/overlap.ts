import { convexOverlap } from "../../geometry/obb";
import type { FurnitureItem } from "../../schemas/design";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { ALLOWED_OVERLAPS } from "../clearances";
import { moveHint } from "../hints";
import type { Rule } from "../types";

const allowed = (a: FurnitureItem, b: FurnitureItem) =>
  ALLOWED_OVERLAPS.some(([x, y]) => (a.category === x && b.category === y) || (a.category === y && b.category === x));

/** Floor items may not overlap, except chairs tucked under tables and desks. */
export const overlapRule: Rule = ({ floorItems, footprints }) => {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < floorItems.length; i++) {
    for (let j = i + 1; j < floorItems.length; j++) {
      const a = floorItems[i]!;
      const b = floorItems[j]!;
      if (allowed(a, b)) continue;
      const o = convexOverlap(footprints.get(a.id)!, footprints.get(b.id)!);
      if (!o) continue;
      issues.push({
        code: "OVERLAP",
        severity: "error",
        itemIds: [a.id, b.id],
        message: `${a.name} overlaps ${b.name} by ${Math.round(o.depth)} cm`,
        measured: Math.round(o.depth),
        required: 0,
        hint: moveHint(a.name, o),
      });
    }
  }
  return issues;
};
