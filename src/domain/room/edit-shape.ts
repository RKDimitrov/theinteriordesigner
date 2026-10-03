import { add, dot, scale, sub, type Vec } from "../geometry/vec";
import { pointOnWall, wallsOf } from "../geometry/walls";
import type { RoomShape } from "../schemas/room";
import { blockingIssues, checkRoom } from "./check-room";
import { dropVanishedWalls, type EditResult, fitOpenings } from "./edit-dimensions";

/*
 * Changing a room's outline by its corners and walls: removing a corner,
 * collapsing a wall, moving either. Pure, so every edit is tested. Whatever
 * refers to walls by number (openings, roof slopes, orientations, finishes,
 * outlooks) is renumbered to match, and openings slide back onto walls that
 * got shorter. As with typed dimensions, only an outline that cannot be a
 * room is refused; anything else odd comes back as a warning.
 */

const TOO_FEW = "A room needs at least three walls";

/** Fields a full room has besides its shape that refer to walls by number. */
interface WallKeyed {
  wallOrientationOverrides?: Readonly<Record<string, unknown>>;
  wallOutlooks?: Readonly<Record<string, unknown>>;
  finishes?: { wallOverrides?: Readonly<Record<string, unknown>> };
}

/** Renumbers a record keyed by wall number; entries whose wall is gone (null) are dropped, and the first one to land on a number wins. */
function remapRecord<V>(rec: Readonly<Record<string, V>>, map: (old: number) => number | null): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(rec)) {
    const i = Number(k);
    if (!Number.isInteger(i)) {
      out[k] = v;
      continue;
    }
    const to = map(i);
    if (to !== null && !(String(to) in out)) out[String(to)] = v;
  }
  return out;
}

function finish<R extends RoomShape>(next: R): EditResult<R> {
  const room = fitOpenings(next);
  const issues = checkRoom(room);
  const blocking = blockingIssues(issues);
  if (blocking.length > 0) return { ok: false, reason: blocking[0]!.message };
  const warning = issues.find((i) => i.warning)?.message;
  return warning ? { ok: true, room, warning } : { ok: true, room };
}

/** Removes corner `i`: the two walls meeting there become one straight wall between its neighbours. */
export function removeCorner<R extends RoomShape>(room: R, i: number): EditResult<R> {
  const n = room.polygon.length;
  if (n <= 3) return { ok: false, reason: TOO_FEW };
  if (i < 0 || i >= n) return { ok: false, reason: "That corner does not exist" };
  const before = (i - 1 + n) % n;
  const oldWalls = wallsOf(room.polygon);
  const polygon = room.polygon.filter((_, k) => k !== i);
  // Old wall `before` and old wall `i` are joined; it is wall i-1, or the last wall when corner 0 goes.
  const joined = i > 0 ? i - 1 : n - 2;
  const map = (old: number): number => (old === before || old === i ? joined : old < i ? old : old - 1);
  const newWall = wallsOf(polygon)[joined]!;
  const openings = room.openings.map((o) => {
    if (o.wallIndex !== before && o.wallIndex !== i) return { ...o, wallIndex: map(o.wallIndex) };
    // Keep an opening on the joined wall where its middle was.
    const old = oldWalls[o.wallIndex]!;
    const middle = pointOnWall(old, o.offset + o.width / 2);
    const along = dot(sub(middle, newWall.a), newWall.dir);
    return { ...o, wallIndex: joined, offset: Math.round(along - o.width / 2) };
  });
  const seen = new Set<number>();
  const roofSlopes = (room.roofSlopes ?? [])
    .map((s) => ({ ...s, wallIndex: map(s.wallIndex) }))
    .filter((s) => (seen.has(s.wallIndex) ? false : (seen.add(s.wallIndex), true)));
  const keyed = room as R & WallKeyed;
  return finish({
    ...room,
    polygon,
    openings,
    roofSlopes,
    ...(keyed.wallOrientationOverrides ? { wallOrientationOverrides: remapRecord(keyed.wallOrientationOverrides, map) } : {}),
    ...(keyed.wallOutlooks ? { wallOutlooks: remapRecord(keyed.wallOutlooks, map) } : {}),
    ...(keyed.finishes ? { finishes: { ...keyed.finishes, wallOverrides: remapRecord(keyed.finishes.wallOverrides ?? {}, map) } } : {}),
  } as R);
}

/** Collapses wall `i`: its two corners meet at its middle, so the walls either side join there. Its openings go with it. */
export function collapseWall<R extends RoomShape>(room: R, i: number): EditResult<R> {
  const n = room.polygon.length;
  if (n <= 3) return { ok: false, reason: TOO_FEW };
  const a = room.polygon[i];
  const b = room.polygon[(i + 1) % n];
  if (!a || !b) return { ok: false, reason: "That wall does not exist" };
  const mid = { x: Math.round(((a.x + b.x) / 2) * 10) / 10, y: Math.round(((a.y + b.y) / 2) * 10) / 10 };
  const polygon = room.polygon.map((p, k) => (k === i || k === (i + 1) % n ? mid : p));
  return finish(dropVanishedWalls({ ...room, polygon }));
}

/** Moves corner `i` to `p` (room coordinates). */
export function moveCorner<R extends RoomShape>(room: R, i: number, p: Vec): EditResult<R> {
  const n = room.polygon.length;
  const prev = room.polygon[(i - 1 + n) % n];
  const next = room.polygon[(i + 1) % n];
  if (!prev || !next || !room.polygon[i]) return { ok: false, reason: "That corner does not exist" };
  // A corner on its neighbour would leave a wall with no length.
  if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1 || Math.hypot(p.x - next.x, p.y - next.y) < 1) return { ok: false, reason: "A wall must keep some length" };
  return finish({ ...room, polygon: room.polygon.map((q, k) => (k === i ? p : q)) });
}

/** Moves wall `i` square to itself by the part of `d` across it, taking both its corners along. */
export function moveWall<R extends RoomShape>(room: R, i: number, d: Vec): EditResult<R> {
  const wall = wallsOf(room.polygon)[i];
  if (!wall) return { ok: false, reason: "That wall does not exist" };
  const shift = scale(wall.inward, dot(d, wall.inward));
  const n = room.polygon.length;
  const polygon = room.polygon.map((q, k) => (k === i || k === (i + 1) % n ? add(q, shift) : q));
  return finish({ ...room, polygon });
}
