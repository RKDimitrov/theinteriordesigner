import { headroomUnder } from "../../room/roof";
import type { ValidationIssue } from "../../schemas/validation-issue";
import type { Rule } from "../types";

/** Under a roof slope the ceiling comes down: pieces must fit under it where they stand. */
export const headroomRule: Rule = ({ room, design, footprints }) => {
  if ((room.roofSlopes ?? []).length === 0) return [];
  const issues: ValidationIssue[] = [];
  for (const f of design.furniture) {
    if (f.placement === "ceiling" || f.placement === "floor_covering") continue;
    const poly = footprints.get(f.id);
    if (!poly) continue;
    const top = f.placement === "wall" ? f.elevation + f.h : f.h;
    const ceiling = headroomUnder(room, poly);
    if (top <= ceiling) continue;
    issues.push({
      code: "LOW_HEADROOM",
      severity: "warning",
      itemIds: [f.id],
      message: `${f.name} (${Math.round(top)} cm) does not fit under the roof slope: only ${Math.round(ceiling)} cm headroom there`,
      measured: Math.round(ceiling),
      required: Math.round(top),
      hint: `move ${f.name} away from the sloped wall, or use a piece lower than ${Math.floor(ceiling)} cm`,
    });
  }
  return issues;
};
