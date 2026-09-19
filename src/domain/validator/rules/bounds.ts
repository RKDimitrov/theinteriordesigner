import { polygonInside } from "../../geometry/obb";
import type { ValidationIssue } from "../../schemas/validation-issue";
import type { Rule } from "../types";

/** Every floor, floor-covering and wall item lies inside the room outline. */
export const boundsRule: Rule = ({ room, design, footprints }) => {
  const issues: ValidationIssue[] = [];
  for (const f of design.furniture) {
    if (f.placement === "ceiling") continue;
    const poly = footprints.get(f.id);
    if (!poly || polygonInside(room.polygon, poly)) continue;
    issues.push({
      code: "OUT_OF_BOUNDS",
      severity: "error",
      itemIds: [f.id],
      message: `${f.name} extends outside the room`,
      hint: `move ${f.name} fully inside the room outline (centre ${Math.round(f.x)},${Math.round(f.y)}, footprint ${f.w}×${f.d} cm at ${f.rotation}°)`,
    });
  }
  return issues;
};
