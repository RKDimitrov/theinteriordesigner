import { z } from "zod";
import { kindsConflict, spansOverlap } from "../geometry/openings";
import { area, containsPoint, isSelfIntersecting, rectPolygon } from "../geometry/polygon";
import { EPS } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";
import { RoomShape } from "../schemas/room";
import { wallTop } from "./roof";
import { innerWallFace } from "./inner-walls";

export interface RoomIssue {
  path: (string | number)[];
  message: string;
  /**
   * Shown in the planner's checks but not blocking: the room is still saved.
   * Only problems that break the outline or the data (a crossing outline, a
   * room under 1 m², duplicate ids, openings off their wall, impossible roof
   * slopes) block; everything else the user may leave and fix later.
   */
  warning?: true;
}

/** The issues that stop a room from being saved. */
export const blockingIssues = (issues: readonly RoomIssue[]): RoomIssue[] => issues.filter((i) => !i.warning);

export const MIN_ROOM_AREA_CM2 = 10_000; // 1 m²
export const MIN_WALL_CM = 10;
/** Smallest side of a rectangular room entered by size. */
export const MIN_ROOM_SIDE_CM = 50;

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
    if (w.length < MIN_WALL_CM) issues.push({ path: ["polygon", w.index], message: `Wall ${w.index + 1} is shorter than ${MIN_WALL_CM} cm`, warning: true });
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
      issues.push({ path: [...path, "height"], message: "Window top is above the ceiling", warning: true });
    }
    if (o.kind === "door" && o.height > room.ceilingHeight) {
      issues.push({ path: [...path, "height"], message: "Door is taller than the ceiling", warning: true });
    }
  });

  for (let i = 0; i < room.openings.length; i++) {
    for (let j = i + 1; j < room.openings.length; j++) {
      const a = room.openings[i]!;
      const b = room.openings[j]!;
      if (a.wallIndex === b.wallIndex && kindsConflict(a.kind, b.kind) && spansOverlap(a, b)) {
        issues.push({ path: ["openings", j], message: `${label(b.kind)} overlaps ${label(a.kind).toLowerCase()} on wall ${a.wallIndex + 1}`, warning: true });
      }
    }
  }

  // Roof slopes: on a real wall, lower than the ceiling, inside the room, one per wall.
  const sloped = new Set<number>();
  const slopes = room.roofSlopes ?? [];
  slopes.forEach((r, i) => {
    const path = ["roofSlopes", i];
    const wall = walls[r.wallIndex];
    if (!wall) {
      issues.push({ path: [...path, "wallIndex"], message: `Wall ${r.wallIndex + 1} does not exist` });
      return;
    }
    if (sloped.has(r.wallIndex)) issues.push({ path: [...path, "wallIndex"], message: `Wall ${r.wallIndex + 1} already has a roof slope` });
    sloped.add(r.wallIndex);
    if (r.kneeHeight >= room.ceilingHeight) issues.push({ path: [...path, "kneeHeight"], message: "The height at the wall must be lower than the ceiling" });
    const reach = Math.max(...poly.map((p) => (p.x - wall.a.x) * wall.inward.x + (p.y - wall.a.y) * wall.inward.y));
    if (r.depth >= reach) issues.push({ path: [...path, "depth"], message: "The roof slope is deeper than the room" });
  });
  if (slopes.length > 0 && issues.length === 0) {
    room.openings.forEach((o, i) => {
      if (o.kind !== "door" && o.kind !== "window") return;
      const wall = walls[o.wallIndex];
      if (!wall) return;
      const top = o.kind === "door" ? o.height : o.sillHeight + o.height;
      // The lowest point of the wall's top over the opening.
      const profile = wallTop(room, wall);
      const heightAt = (t: number) => {
        for (let k = 1; k < profile.length; k++) {
          const a = profile[k - 1]!;
          const b = profile[k]!;
          if (t <= b.t + EPS) return a.h + ((b.h - a.h) * (t - a.t)) / Math.max(EPS, b.t - a.t);
        }
        return profile[profile.length - 1]!.h;
      };
      const ts = [o.offset, o.offset + o.width, ...profile.map((p) => p.t).filter((t) => t > o.offset && t < o.offset + o.width)];
      if (top > Math.min(...ts.map(heightAt)) + EPS) {
        issues.push({ path: ["openings", i, "height"], message: `${label(o.kind)} reaches above the roof slope`, warning: true });
      }
    });
  }

  // Inner walls: inside the room, long enough, their openings on them.
  (room.innerWalls ?? []).forEach((w, i) => {
    const path = ["innerWalls", i];
    if (ids.has(w.id)) issues.push({ path: [...path, "id"], message: "Duplicate id" });
    ids.add(w.id);
    const face = innerWallFace(w);
    if (face.length < 20) issues.push({ path, message: "An inner wall must be at least 20 cm long", warning: true });
    const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    // Ends may touch the outline; the middle and points just inside the ends must be in the room.
    const nearEnd = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: p.x + (q.x - p.x) * 0.02, y: p.y + (q.y - p.y) * 0.02 });
    if (![mid, nearEnd(w.a, w.b), nearEnd(w.b, w.a)].every((p) => containsPoint(poly, p))) issues.push({ path, message: "An inner wall must stand inside the room", warning: true });
    w.openings.forEach((o, j) => {
      if (ids.has(o.id)) issues.push({ path: [...path, "openings", j, "id"], message: "Duplicate id" });
      ids.add(o.id);
      if (o.offset + o.width > face.length + EPS) issues.push({ path: [...path, "openings", j, "width"], message: `${label(o.kind)} does not fit on the inner wall` });
    });
  });

  // Floor areas: inside the room and apart from each other.
  const zones = room.floorZones ?? [];
  zones.forEach((z, i) => {
    const corners = rectPolygon(z.rect.w, z.rect.d, z.rect.x, z.rect.y);
    if (!corners.every((c) => containsPoint(poly, c))) issues.push({ path: ["floorZones", i, "rect"], message: "A floor area lies outside the room", warning: true });
    for (let j = 0; j < i; j++) {
      const o = zones[j]!.rect;
      const r = z.rect;
      if (r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.d && o.y < r.y + r.d) issues.push({ path: ["floorZones", i, "rect"], message: "Floor areas overlap", warning: true });
    }
  });

  room.fixedElements.forEach((f, i) => {
    if (ids.has(f.id)) issues.push({ path: ["fixedElements", i, "id"], message: "Duplicate id" });
    ids.add(f.id);
    const corners = rectPolygon(f.rect.w, f.rect.d, f.rect.x, f.rect.y);
    if (!corners.every((c) => containsPoint(poly, c))) {
      issues.push({ path: ["fixedElements", i, "rect"], message: `"${f.label}" lies outside the room`, warning: true });
    }
  });

  return issues;
}

function label(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** RoomShape plus structural checks. Use at every boundary where a room enters the system. */
export const RoomInput = RoomShape.superRefine((room, ctx) => {
  for (const issue of blockingIssues(checkRoom(room))) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});
export type RoomInput = z.infer<typeof RoomInput>;
