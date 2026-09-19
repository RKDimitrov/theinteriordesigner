import { axes, itemFootprint } from "../../geometry/obb";
import { dot, sub } from "../../geometry/vec";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { CLEARANCE } from "../clearances";
import type { Rule } from "../types";

/** Wall items hang with their back against a wall and never across a door. */
export const wallItemsRule: Rule = ({ design, walls, room }) => {
  const issues: ValidationIssue[] = [];
  const cosTol = Math.cos((CLEARANCE.wallAngleDeg * Math.PI) / 180);
  for (const f of design.furniture) {
    if (f.placement !== "wall") continue;
    const { v } = axes(f);
    const back = itemFootprint(f).slice(0, 2);
    const backMid = { x: (back[0]!.x + back[1]!.x) / 2, y: (back[0]!.y + back[1]!.y) / 2 };
    const wall = walls.find((w) => {
      // Front must face into the room (same direction as the wall's inward normal).
      if (dot(v, w.inward) < cosTol) return false;
      const rel = sub(backMid, w.a);
      const along = dot(rel, w.dir);
      const gap = dot(rel, w.inward);
      return along >= -1 && along <= w.length + 1 && Math.abs(gap) <= CLEARANCE.wallGap;
    });
    if (!wall) {
      issues.push({
        code: "WALL_ITEM_NOT_ON_WALL",
        severity: "error",
        itemIds: [f.id],
        message: `${f.name} is a wall item but its back is not against a wall`,
        hint: `set rotation to the wall's backAgainstRotation and place its back edge on the wall line`,
      });
      continue;
    }
    for (const door of room.openings) {
      if (door.kind !== "door" || door.wallIndex !== wall.index) continue;
      const along = dot(sub(backMid, wall.a), wall.dir);
      const half = f.w / 2;
      const overlapsSpan = along + half > door.offset && along - half < door.offset + door.width;
      if (overlapsSpan && f.elevation < door.height) {
        issues.push({
          code: "WALL_ITEM_NOT_ON_WALL",
          severity: "error",
          itemIds: [f.id],
          message: `${f.name} is mounted across door ${door.id}`,
          hint: `move ${f.name} along the wall away from the door or above ${door.height} cm`,
        });
      }
    }
  }
  return issues;
};
