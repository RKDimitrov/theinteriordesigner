import { convexOverlap, itemFootprint } from "../../geometry/obb";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { RADIATOR_COVER } from "../clearances";
import { moveHint } from "../hints";
import type { Rule } from "../types";

/** Door swings and the path in front of doors stay free of floor items. */
export const doorsRule: Rule = ({ zones, floorItems, footprints }) => {
  const issues: ValidationIssue[] = [];
  for (const z of zones) {
    if (z.kind !== "door_swing" && z.kind !== "door_path") continue;
    for (const f of floorItems) {
      const o = convexOverlap(footprints.get(f.id)!, z.polygon);
      if (!o) continue;
      issues.push({
        code: z.kind === "door_swing" ? "DOOR_SWING_BLOCKED" : "DOOR_PATH_BLOCKED",
        severity: "error",
        itemIds: [f.id],
        message:
          z.kind === "door_swing"
            ? `${f.name} is in the swing area of door ${z.refId}`
            : `${f.name} blocks the 80 cm path in front of door ${z.refId}`,
        hint: moveHint(f.name, o),
      });
    }
  }
  return issues;
};

/** Tall floor items in front of windows, and wall items across the window opening. */
export const windowsRule: Rule = ({ room, zones, floorItems, footprints, design }) => {
  const issues: ValidationIssue[] = [];
  for (const z of zones) {
    if (z.kind !== "window") continue;
    for (const f of floorItems) {
      if (f.h <= (z.minBlockingHeight ?? 0)) continue;
      const o = convexOverlap(footprints.get(f.id)!, z.polygon);
      if (!o) continue;
      issues.push({
        code: "WINDOW_BLOCKED",
        severity: "error",
        itemIds: [f.id],
        message: `${f.name} (${f.h} cm tall) stands in front of window ${z.refId} (sill ${z.minBlockingHeight} cm)`,
        measured: f.h,
        required: z.minBlockingHeight,
        hint: `${moveHint(f.name, o)}, or use a piece lower than ${z.minBlockingHeight} cm`,
      });
    }
  }
  // Wall-mounted items that cover the window opening itself.
  for (const f of design.furniture) {
    if (f.placement !== "wall") continue;
    for (const w of room.openings) {
      if (w.kind !== "window") continue;
      const zone = zones.find((z) => z.kind === "window" && z.refId === w.id);
      if (!zone) continue;
      const bottom = f.elevation;
      const top = f.elevation + f.h;
      if (top <= w.sillHeight || bottom >= w.sillHeight + w.height) continue;
      if (!convexOverlap(itemFootprint({ ...f, d: Math.max(f.d, 10) }), zone.polygon)) continue;
      issues.push({
        code: "WINDOW_BLOCKED",
        severity: "error",
        itemIds: [f.id],
        message: `${f.name} is mounted across window ${w.id}`,
        hint: `move ${f.name} beside the window or above ${w.sillHeight + w.height} cm`,
      });
    }
  }
  return issues;
};

/** Radiators need free air: coverage over 30 % of their width is an error, any coverage a warning. */
export const radiatorsRule: Rule = ({ zones, floorItems, footprints }) => {
  const issues: ValidationIssue[] = [];
  for (const z of zones) {
    if (z.kind !== "radiator" || !z.spanLength) continue;
    const [a, b] = [z.polygon[0]!, z.polygon[1]!];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    for (const f of floorItems) {
      const poly = footprints.get(f.id)!;
      if (!convexOverlap(poly, z.polygon)) continue;
      const ts = poly.map((p) => (p.x - a.x) * dir.x + (p.y - a.y) * dir.y);
      const covered = Math.max(0, Math.min(len, Math.max(...ts)) - Math.max(0, Math.min(...ts)));
      const share = covered / len;
      if (share <= RADIATOR_COVER.warning) continue;
      issues.push({
        code: "RADIATOR_BLOCKED",
        severity: share > RADIATOR_COVER.error ? "error" : "warning",
        itemIds: [f.id],
        message: `${f.name} covers ${Math.round(share * 100)} % of radiator ${z.refId}`,
        measured: Math.round(covered),
        hint: `keep ${f.name} at least 30 cm away from the radiator`,
      });
    }
  }
  return issues;
};

/** Floor items may not stand on chimneys, columns or built-ins. */
export const fixedElementsRule: Rule = ({ zones, floorItems, footprints, room }) => {
  const issues: ValidationIssue[] = [];
  for (const z of zones) {
    if (z.kind !== "fixed") continue;
    const label = room.fixedElements.find((e) => e.id === z.refId)?.label ?? z.refId;
    for (const f of floorItems) {
      const o = convexOverlap(footprints.get(f.id)!, z.polygon);
      if (!o) continue;
      issues.push({
        code: "FIXED_ELEMENT_COLLISION",
        severity: "error",
        itemIds: [f.id],
        message: `${f.name} collides with ${label}`,
        hint: moveHint(f.name, o),
      });
    }
  }
  return issues;
};
