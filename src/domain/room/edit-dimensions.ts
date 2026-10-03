import type { Vec } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";
import type { RoomShape } from "../schemas/room";
import { checkRoom } from "./check-room";

/*
 * Typing a new value into a dimension on the plan. Each figure on a wall's
 * dimension line means one thing: the whole wall, an opening's width, or the
 * stretch of wall before or after an opening. Pure, so every edit is tested;
 * an edit that would break the room is refused with the reason.
 */

export type DimensionTarget =
  | { kind: "wall"; wallIndex: number }
  | { kind: "opening"; openingId: string }
  | { kind: "before"; openingId: string }
  | { kind: "after"; openingId: string };

export type EditResult = { ok: true; room: RoomShape } | { ok: false; reason: string };

const EPS = 0.5;

/** True when every wall runs straight across or straight down: walls can then be lengthened by moving whole sides. */
export function isRightAngled(polygon: readonly Vec[]): boolean {
  return wallsOf(polygon).every((w) => Math.abs(w.dir.x) < 1e-6 || Math.abs(w.dir.y) < 1e-6);
}

export function editDimension<R extends RoomShape>(room: R, target: DimensionTarget, value: number): { ok: true; room: R } | { ok: false; reason: string } {
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: "Enter a length above 0 cm" };
  const v = Math.round(value);
  let next: R;

  if (target.kind === "wall") {
    if (!isRightAngled(room.polygon)) return { ok: false, reason: "Only walls of right-angled rooms can be lengthened here; drag the room's corners instead" };
    const wall = wallsOf(room.polygon)[target.wallIndex];
    if (!wall) return { ok: false, reason: "That wall does not exist" };
    const delta = v - wall.length;
    // Everything beyond the wall's end, along the wall, moves with it.
    const end = wall.b.x * wall.dir.x + wall.b.y * wall.dir.y;
    const polygon = room.polygon.map((p) => (p.x * wall.dir.x + p.y * wall.dir.y >= end - EPS ? { x: p.x + wall.dir.x * delta, y: p.y + wall.dir.y * delta } : p));
    next = { ...room, polygon };
  } else {
    const o = room.openings.find((x) => x.id === target.openingId);
    if (!o) return { ok: false, reason: "That opening no longer exists" };
    const wall = wallsOf(room.polygon)[o.wallIndex];
    if (!wall) return { ok: false, reason: "That wall does not exist" };
    const update = (patch: { offset?: number; width?: number }) => ({ ...room, openings: room.openings.map((x) => (x.id === o.id ? { ...x, ...patch } : x)) });
    if (target.kind === "opening") next = update({ width: v });
    else if (target.kind === "before") {
      // The stretch before this opening starts where the previous opening on the wall ends.
      const prevEnd = Math.max(0, ...room.openings.filter((x) => x.wallIndex === o.wallIndex && x.id !== o.id && (x.kind === "door" || x.kind === "window") && x.offset + x.width <= o.offset + EPS).map((x) => x.offset + x.width));
      next = update({ offset: prevEnd + v });
    } else next = update({ offset: Math.round(wall.length - v - o.width) });
  }

  const issues = checkRoom(next);
  if (issues.length > 0) return { ok: false, reason: issues[0]!.message };
  return { ok: true, room: next };
}
