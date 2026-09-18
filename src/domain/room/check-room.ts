import { z } from "zod";
import { kindsConflict, spansOverlap } from "../geometry/openings";
import { area, containsPoint, isSelfIntersecting, rectPolygon } from "../geometry/polygon";
import { EPS } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";
import { RoomShape } from "../schemas/room";

export interface RoomIssue {
  path: (string | number)[];
  message: string;
}

export const MIN_ROOM_AREA_CM2 = 10_000; // 1 m²
export const MIN_WALL_CM = 10;

/** Structural sanity checks for a room as entered by the user. Pure, no I/O. */
export function checkRoom(room: RoomShape): RoomIssue[] {
  const issues: RoomIssue[] = [];
  const poly = room.polygon;

  if (isSelfIntersecting(poly)) {
    issues.push({ path: ["polygon"], message: "Room outline crosses itself" });
    return issues;
  }
  if (area(poly) < MIN_ROOM_AREA_CM2) {
    issues.push({ path: ["polygon"], message: "Room must be at least 1 m²" });
    return issues;
  }

  const walls = wallsOf(poly);
  walls.forEach((w) => {
    if (w.length < MIN_WALL_CM) issues.push({ path: ["polygon", w.index], message: `Wall ${w.index + 1} is shorter than ${MIN_WALL_CM} cm` });
  });

  const ids = new Set<string>();
  room.openings.forEach((o, i) => {
    const path = ["openings", i];
    if (ids.has(o.id)) issues.push({ path: [...path, "id"], message: "Duplicate id" });
    ids.add(o.id);

    const wall = walls[o.wallIndex];
    if (!wall) {
      issues.push({ path: [...path, "wallIndex"], message: `Wall ${o.wallIndex + 1} does not exist` });
      return;
    }
    if (o.offset + o.width > wall.length + EPS) {
      issues.push({
        path: [...path, "width"],
        message: `${label(o.kind)} does not fit: ends at ${o.offset + o.width} cm, wall is ${Math.round(wall.length)} cm`,
      });
    }
    if (o.kind === "window" && o.sillHeight + o.height > room.ceilingHeight) {
      issues.push({ path: [...path, "height"], message: "Window top is above the ceiling" });
    }
    if (o.kind === "door" && o.height > room.ceilingHeight) {
      issues.push({ path: [...path, "height"], message: "Door is taller than the ceiling" });
    }
  });

  for (let i = 0; i < room.openings.length; i++) {
    for (let j = i + 1; j < room.openings.length; j++) {
      const a = room.openings[i]!;
      const b = room.openings[j]!;
      if (a.wallIndex === b.wallIndex && kindsConflict(a.kind, b.kind) && spansOverlap(a, b)) {
        issues.push({ path: ["openings", j], message: `${label(b.kind)} overlaps ${label(a.kind).toLowerCase()} on wall ${a.wallIndex + 1}` });
      }
    }
  }

  room.fixedElements.forEach((f, i) => {
    if (ids.has(f.id)) issues.push({ path: ["fixedElements", i, "id"], message: "Duplicate id" });
    ids.add(f.id);
    const corners = rectPolygon(f.rect.w, f.rect.d, f.rect.x, f.rect.y);
    if (!corners.every((c) => containsPoint(poly, c))) {
      issues.push({ path: ["fixedElements", i, "rect"], message: `"${f.label}" lies outside the room` });
    }
  });

  return issues;
}

function label(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** RoomShape plus structural checks. Use at every boundary where a room enters the system. */
export const RoomInput = RoomShape.superRefine((room, ctx) => {
  for (const issue of checkRoom(room)) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});
export type RoomInput = z.infer<typeof RoomInput>;
