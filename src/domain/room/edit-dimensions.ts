import type { Vec } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";
import type { RoomShape } from "../schemas/room";
import { blockingIssues, checkRoom } from "./check-room";

/*
 * Typing a new value into a dimension on the plan. Each figure on a wall's
 * dimension line means one thing: the whole wall, an opening's width, or the
 * stretch of wall before or after an opening. Pure, so every edit is tested.
 * The user may set any length: only an edit that leaves no room at all (an
 * outline crossing itself, under 1 m²) is refused. Anything else odd it leaves
 * behind, such as a very short wall, comes back as a warning.
 */

export type DimensionTarget =
  | { kind: "wall"; wallIndex: number }
  | { kind: "opening"; openingId: string }
  | { kind: "before"; openingId: string }
  | { kind: "after"; openingId: string };

export type EditResult<R extends RoomShape = RoomShape> = { ok: true; room: R; warning?: string } | { ok: false; reason: string };

const EPS = 0.5;

/** True when every wall runs straight across or straight down: walls can then be lengthened by moving whole sides. */
export function isRightAngled(polygon: readonly Vec[]): boolean {
  return wallsOf(polygon).every((w) => Math.abs(w.dir.x) < 1e-6 || Math.abs(w.dir.y) < 1e-6);
}

/** Shorter walls than this are treated as gone: their corner is removed. */
const GONE_CM = 0.5;

const tidy = (n: number) => Math.round(n * 10) / 10;

/** Openings moved and narrowed as needed so each fits on its wall. */
export function fitOpenings<R extends RoomShape>(room: R): R {
  const walls = wallsOf(room.polygon);
  let changed = false;
  const openings = room.openings.map((o) => {
    const wall = walls[o.wallIndex];
    if (!wall) return o;
    const width = Math.max(1, Math.min(o.width, Math.floor(wall.length)));
    const offset = Math.max(0, Math.min(o.offset, Math.floor(wall.length - width)));
    if (width === o.width && offset === o.offset) return o;
    changed = true;
    return { ...o, width, offset };
  });
  return changed ? { ...room, openings } : room;
}

/** Renumbers a record keyed by wall number after wall `gone` was removed. */
function renumber<V>(rec: Readonly<Record<string, V>>, gone: number): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(rec)) {
    const i = Number(k);
    if (!Number.isInteger(i)) out[k] = v;
    else if (i !== gone) out[String(i < gone ? i : i - 1)] = v;
  }
  return out;
}

/**
 * Removes walls that have shrunk to nothing (their start corner goes), and
 * renumbers everything that refers to walls by number: openings, roof slopes,
 * orientations, finishes and outlooks.
 */
/** Fields a full room has besides its shape that refer to walls by number. */
interface WallKeyed {
  wallOutlooks?: Readonly<Record<string, unknown>>;
  finishes?: { wallOverrides?: Readonly<Record<string, unknown>> };
}

export function dropVanishedWalls<R extends RoomShape>(room: R): R {
  let r: R & WallKeyed = room;
  for (;;) {
    if (r.polygon.length <= 3) return r;
    // Measured corner to corner: a wall of length 0 has no direction, so wallsOf cannot describe it.
    const poly = r.polygon;
    const gone = poly.findIndex((p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      return Math.hypot(q.x - p.x, q.y - p.y) < GONE_CM;
    });
    if (gone < 0) return r;
    const map = (i: number) => (i < gone ? i : i - 1);
    r = {
      ...r,
      polygon: r.polygon.filter((_, i) => i !== gone),
      openings: r.openings.filter((o) => o.wallIndex !== gone).map((o) => ({ ...o, wallIndex: map(o.wallIndex) })),
      roofSlopes: (r.roofSlopes ?? []).filter((x) => x.wallIndex !== gone).map((x) => ({ ...x, wallIndex: map(x.wallIndex) })),
      wallOrientationOverrides: renumber(r.wallOrientationOverrides ?? {}, gone),
      ...(r.wallOutlooks ? { wallOutlooks: renumber(r.wallOutlooks, gone) } : {}),
      ...(r.finishes ? { finishes: { ...r.finishes, wallOverrides: renumber(r.finishes.wallOverrides ?? {}, gone) } } : {}),
    };
  }
}

export function editDimension<R extends RoomShape>(room: R, target: DimensionTarget, value: number): EditResult<R> {
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: "Enter a length above 0 cm" };
  const v = Math.round(value);
  let next: R;

  if (target.kind === "wall") {
    const wall = wallsOf(room.polygon)[target.wallIndex];
    if (!wall) return { ok: false, reason: "That wall does not exist" };
    const delta = v - wall.length;
    const moved = (p: Vec) => ({ x: tidy(p.x + wall.dir.x * delta), y: tidy(p.y + wall.dir.y * delta) });
    let polygon: Vec[];
    if (isRightAngled(room.polygon)) {
      // Everything beyond the wall's end, along the wall, moves with it, so the corners stay square.
      const end = wall.b.x * wall.dir.x + wall.b.y * wall.dir.y;
      polygon = room.polygon.map((p) => (p.x * wall.dir.x + p.y * wall.dir.y >= end - EPS ? moved(p) : p));
    } else {
      // Slanted walls: only the wall's end corner moves, and the next wall turns to meet it.
      const endIndex = (target.wallIndex + 1) % room.polygon.length;
      polygon = room.polygon.map((p, i) => (i === endIndex ? moved(p) : p));
    }
    next = fitOpenings(dropVanishedWalls({ ...room, polygon }));
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
  const blocking = blockingIssues(issues);
  if (blocking.length > 0) return { ok: false, reason: blocking[0]!.message };
  const warning = issues.find((i) => i.warning)?.message;
  return warning ? { ok: true, room: next, warning } : { ok: true, room: next };
}
