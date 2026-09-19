import { cellsIn, clearance, GRID_CELL_CM, rasterise, reachable } from "../../geometry/grid";
import { stripBeside } from "../../geometry/obb";
import type { Vec } from "../../geometry/vec";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { CLEARANCE, NEEDS_ACCESS } from "../clearances";
import type { Rule } from "../types";

/** A cell centre this far from any obstacle lies on an 80 cm walkway (half a cell of grid tolerance). */
export const MIN_CENTRE_CLEARANCE = CLEARANCE.walkway / 2 - GRID_CELL_CM / 2;

/**
 * 80 cm walkways: every door connects to every other door, and the front of
 * each item that needs access is reachable from a door.
 */
export const walkwayRule: Rule = ({ room, zones, floorItems, footprints }) => {
  const doorPaths = zones.filter((z) => z.kind === "door_path");
  if (doorPaths.length === 0) return [];

  const obstacles: Vec[][] = [...floorItems.map((f) => footprints.get(f.id)!), ...zones.filter((z) => z.kind === "fixed").map((z) => z.polygon)];
  const grid = rasterise(room.polygon, obstacles);
  const clear = clearance(grid);
  const seedsPerDoor = doorPaths.map((z) => cellsIn(grid, z.polygon));
  const reach = reachable(grid, clear, MIN_CENTRE_CLEARANCE, seedsPerDoor.flat());
  const issues: ValidationIssue[] = [];

  // Doors must connect to each other.
  if (doorPaths.length > 1) {
    const fromFirst = reachable(grid, clear, MIN_CENTRE_CLEARANCE, seedsPerDoor[0]!);
    doorPaths.slice(1).forEach((z, i) => {
      if (!seedsPerDoor[i + 1]!.some((c) => fromFirst[c])) {
        issues.push({
          code: "WALKWAY_TOO_NARROW",
          severity: "error",
          itemIds: [],
          message: `No ${CLEARANCE.walkway} cm walkway connects door ${doorPaths[0]!.refId} and door ${z.refId}`,
          required: CLEARANCE.walkway,
          hint: "move furniture so an 80 cm wide route runs between the doors",
        });
      }
    });
  }

  for (const f of floorItems) {
    if (!NEEDS_ACCESS.has(f.category)) continue;
    const sides = f.category === "bed" ? (["front", "left", "right"] as const) : (["front"] as const);
    const ok = sides.some((side) => cellsIn(grid, stripBeside(f, side, CLEARANCE.accessReach)).some((c) => reach[c]));
    if (ok) continue;
    issues.push({
      code: "WALKWAY_TOO_NARROW",
      severity: "error",
      itemIds: [f.id],
      message: `No ${CLEARANCE.walkway} cm walkway from a door reaches ${f.category === "bed" ? "the sides or foot of" : "the front of"} ${f.name}`,
      required: CLEARANCE.walkway,
      hint: `free a route at least ${CLEARANCE.walkway} cm wide from the door to the ${f.category === "bed" ? "bed" : "front"} of ${f.name}`,
    });
  }
  return issues;
};
