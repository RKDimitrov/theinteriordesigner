import { containsPoint } from "@/domain/geometry/polygon";
import type { Vec } from "@/domain/geometry/vec";
import { wallsOf } from "@/domain/geometry/walls";
import { nextItemId, turn } from "@/domain/planner/items";
import { allOpenings, findOpening, innerWallFace, nearestInnerWall, updateOpening } from "@/domain/room/inner-walls";
import { nextId } from "@/domain/room/openings-edit";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { FixedElement, FloorZone, InnerWall, Opening } from "@/domain/schemas/room";
import type { Plan, PlanRoom, Selection } from "./state";

/*
 * The planner's keyboard edits: copy, paste, duplicate, nudge and turn the
 * selected piece, fixed element or opening. Pure, so they are tested; the key
 * handler dispatches them as one edit each, which makes each one undo step.
 */

export type Clip =
  | { kind: "item"; roomId: string; item: FurnitureItem }
  | { kind: "fixed"; roomId: string; fixed: FixedElement }
  /** `host` is "outer", or the id of the inner wall the opening was copied from. */
  | { kind: "opening"; roomId: string; opening: Opening; host: string }
  | { kind: "innerWall"; roomId: string; wall: InnerWall }
  | { kind: "zone"; roomId: string; zone: FloorZone };

/** How far a pasted or duplicated copy lands from the original when no spot is given. */
export const PASTE_OFFSET_CM = 30;

const roomOf = (plan: Plan, roomId: string) => plan.rooms.find((r) => r.room.id === roomId);

function withRoom(plan: Plan, roomId: string, fn: (r: PlanRoom) => PlanRoom): Plan {
  return { ...plan, rooms: plan.rooms.map((r) => (r.room.id === roomId ? fn(r) : r)) };
}

export function copySelection(plan: Plan, sel: Selection): Clip | null {
  if (!sel) return null;
  const r = roomOf(plan, sel.roomId);
  if (!r) return null;
  if (sel.kind === "item") {
    const item = r.furniture.find((f) => f.id === sel.id);
    return item ? { kind: "item", roomId: r.room.id, item } : null;
  }
  if (sel.kind === "fixed") {
    const fixed = r.room.fixedElements.find((f) => f.id === sel.id);
    return fixed ? { kind: "fixed", roomId: r.room.id, fixed } : null;
  }
  if (sel.kind === "innerWall") {
    const wall = r.room.innerWalls.find((w) => w.id === sel.id);
    return wall ? { kind: "innerWall", roomId: r.room.id, wall } : null;
  }
  if (sel.kind === "zone") {
    const zone = r.room.floorZones.find((z) => z.id === sel.id);
    return zone ? { kind: "zone", roomId: r.room.id, zone } : null;
  }
  const found = findOpening(r.room, sel.id);
  return found ? { kind: "opening", roomId: r.room.id, opening: found.opening, host: found.host } : null;
}

/** Where a paste goes: a point on the plan (apartment cm), or nothing for "next to the original". */
export interface PasteTarget {
  at?: Vec;
}

/** The room whose outline holds the apartment point `p`. */
function roomAtPoint(plan: Plan, p: Vec): PlanRoom | undefined {
  return plan.rooms.find((r) => {
    const o = plan.origins[r.room.id] ?? { x: 0, y: 0 };
    return containsPoint(r.room.polygon, { x: p.x - o.x, y: p.y - o.y });
  });
}

/** The nearest wall of `room` to a room-local point, and how far along it the point lies. */
function nearestWallOf(room: PlanRoom, local: Vec): { index: number; along: number; length: number; distance: number } {
  let best = { index: 0, along: 0, length: 0, distance: Infinity };
  for (const w of wallsOf(room.room.polygon)) {
    const along = Math.max(0, Math.min(w.length, (local.x - w.a.x) * w.dir.x + (local.y - w.a.y) * w.dir.y));
    const px = w.a.x + w.dir.x * along;
    const py = w.a.y + w.dir.y * along;
    const distance = Math.hypot(local.x - px, local.y - py);
    if (distance < best.distance) best = { index: w.index, along, length: w.length, distance };
  }
  return best;
}

const clampAlong = (offset: number, width: number, length: number) => Math.round(Math.max(0, Math.min(Math.max(0, length - width), offset)));

/** Pastes a copy; returns the new plan and the copy's selection, or null when it cannot go anywhere. */
export function pasteClip(plan: Plan, clip: Clip, target: PasteTarget = {}): { plan: Plan; selection: NonNullable<Selection> } | null {
  const intoRoom = (target.at && roomAtPoint(plan, target.at)) || roomOf(plan, clip.roomId);
  if (!intoRoom) return null;
  const origin = plan.origins[intoRoom.room.id] ?? { x: 0, y: 0 };
  const local = target.at ? { x: Math.round(target.at.x - origin.x), y: Math.round(target.at.y - origin.y) } : null;

  if (clip.kind === "item") {
    const taken = plan.rooms.flatMap((r) => r.furniture.map((f) => f.id));
    const id = nextItemId(clip.item.category, taken);
    const pos = local ?? { x: clip.item.x + PASTE_OFFSET_CM, y: clip.item.y + PASTE_OFFSET_CM };
    const item: FurnitureItem = { ...clip.item, id, x: pos.x, y: pos.y, existing: false };
    return { plan: withRoom(plan, intoRoom.room.id, (r) => ({ ...r, furniture: [...r.furniture, item] })), selection: { kind: "item", roomId: intoRoom.room.id, id } };
  }

  if (clip.kind === "fixed") {
    const id = nextId(clip.fixed.kind, intoRoom.room.fixedElements.map((f) => f.id));
    const { w, d } = clip.fixed.rect;
    const rect = local ? { x: local.x - w / 2, y: local.y - d / 2, w, d } : { ...clip.fixed.rect, x: clip.fixed.rect.x + PASTE_OFFSET_CM, y: clip.fixed.rect.y + PASTE_OFFSET_CM };
    const fixed: FixedElement = { ...clip.fixed, id, rect };
    return { plan: withRoom(plan, intoRoom.room.id, (r) => ({ ...r, room: { ...r.room, fixedElements: [...r.room.fixedElements, fixed] } })), selection: { kind: "fixed", roomId: intoRoom.room.id, id } };
  }

  if (clip.kind === "innerWall") {
    const id = nextId("iw", intoRoom.room.innerWalls.map((w) => w.id));
    const { a, b } = clip.wall;
    const shift = local ? { x: local.x - (a.x + b.x) / 2, y: local.y - (a.y + b.y) / 2 } : { x: PASTE_OFFSET_CM, y: PASTE_OFFSET_CM };
    const move = (p: Vec) => ({ x: Math.round(p.x + shift.x), y: Math.round(p.y + shift.y) });
    // Opening ids are unique across the room, so the copy's doors get fresh ones.
    const taken = allOpenings(intoRoom.room).map((x) => x.opening.id);
    const openings = clip.wall.openings.map((o) => {
      const oid = nextId(o.kind === "door" && o.swing === "none" ? "pass" : o.kind, taken);
      taken.push(oid);
      return { ...o, id: oid };
    });
    const wall: InnerWall = { ...clip.wall, id, a: move(a), b: move(b), openings };
    return { plan: withRoom(plan, intoRoom.room.id, (r) => ({ ...r, room: { ...r.room, innerWalls: [...r.room.innerWalls, wall] } })), selection: { kind: "innerWall", roomId: intoRoom.room.id, id } };
  }

  if (clip.kind === "zone") {
    const id = nextId("zone", intoRoom.room.floorZones.map((z) => z.id));
    const { w, d } = clip.zone.rect;
    const rect = local ? { x: Math.round(local.x - w / 2), y: Math.round(local.y - d / 2), w, d } : { ...clip.zone.rect, x: clip.zone.rect.x + PASTE_OFFSET_CM, y: clip.zone.rect.y + PASTE_OFFSET_CM };
    const zone: FloorZone = { ...clip.zone, id, rect };
    return { plan: withRoom(plan, intoRoom.room.id, (r) => ({ ...r, room: { ...r.room, floorZones: [...r.room.floorZones, zone] } })), selection: { kind: "zone", roomId: intoRoom.room.id, id } };
  }

  const o = clip.opening;
  const prefix = o.kind === "door" && o.swing === "none" ? "pass" : o.kind;
  const id = nextId(prefix, allOpenings(intoRoom.room).map((x) => x.opening.id));
  let placed: Opening;
  let host = "outer";
  if (local) {
    // On the wall nearest the pointer, centred on it: an outer wall, or an inner wall when that is nearer.
    const w = nearestWallOf(intoRoom, local);
    const inner = nearestInnerWall(intoRoom.room, local, Infinity);
    if (inner && inner.distance < w.distance) {
      host = inner.wall.id;
      placed = { ...o, id, wallIndex: 0, offset: clampAlong(inner.offset - o.width / 2, o.width, inner.face.length), width: Math.min(o.width, Math.floor(inner.face.length)) };
    } else {
      placed = { ...o, id, wallIndex: w.index, offset: clampAlong(w.along - o.width / 2, o.width, w.length), width: Math.min(o.width, Math.floor(w.length)) };
    }
  } else {
    // Next to the original on the same wall, wrapping to its start when there is no room after it.
    const innerHost = clip.host !== "outer" ? intoRoom.room.innerWalls.find((iw) => iw.id === clip.host) : undefined;
    const wall = innerHost ? innerWallFace(innerHost) : wallsOf(intoRoom.room.polygon)[o.wallIndex];
    if (!wall) return null;
    if (innerHost) host = innerHost.id;
    const after = o.offset + o.width + 10;
    const offset = after + o.width <= wall.length ? after : 0;
    placed = { ...o, id, offset: clampAlong(offset, o.width, wall.length) };
  }
  const put = (r: PlanRoom): PlanRoom =>
    host === "outer"
      ? { ...r, room: { ...r.room, openings: [...r.room.openings, placed] } }
      : { ...r, room: { ...r.room, innerWalls: r.room.innerWalls.map((iw) => (iw.id === host ? { ...iw, openings: [...iw.openings, placed] } : iw)) } };
  return { plan: withRoom(plan, intoRoom.room.id, put), selection: { kind: "opening", roomId: intoRoom.room.id, id } };
}

/** Moves the selection by (dx, dy) cm; an opening slides along its wall by the part of the move along it. */
export function nudgeSelection(plan: Plan, sel: Selection, dx: number, dy: number): Plan {
  if (!sel) return plan;
  return withRoom(plan, sel.roomId, (r) => {
    if (sel.kind === "item") return { ...r, furniture: r.furniture.map((f) => (f.id === sel.id ? { ...f, x: f.x + dx, y: f.y + dy } : f)) };
    if (sel.kind === "fixed") return { ...r, room: { ...r.room, fixedElements: r.room.fixedElements.map((f) => (f.id === sel.id ? { ...f, rect: { ...f.rect, x: f.rect.x + dx, y: f.rect.y + dy } } : f)) } };
    if (sel.kind === "innerWall") {
      const move = (p: Vec) => ({ x: p.x + dx, y: p.y + dy });
      return { ...r, room: { ...r.room, innerWalls: r.room.innerWalls.map((w) => (w.id === sel.id ? { ...w, a: move(w.a), b: move(w.b) } : w)) } };
    }
    if (sel.kind === "zone") return { ...r, room: { ...r.room, floorZones: r.room.floorZones.map((z) => (z.id === sel.id ? { ...z, rect: { ...z.rect, x: z.rect.x + dx, y: z.rect.y + dy } } : z)) } };
    const found = findOpening(r.room, sel.id);
    if (!found) return r;
    const w = found.wall;
    const along = dx * w.dir.x + dy * w.dir.y;
    return { ...r, room: updateOpening(r.room, sel.id, (o) => ({ ...o, offset: clampAlong(o.offset + along, o.width, w.length) })) };
  });
}

/** Turns a selected piece by `deg` (other selections are left as they are). */
export function turnSelection(plan: Plan, sel: Selection, deg: number): Plan {
  if (sel?.kind !== "item") return plan;
  return withRoom(plan, sel.roomId, (r) => ({ ...r, furniture: r.furniture.map((f) => (f.id === sel.id ? { ...f, rotation: turn(f.rotation, deg) } : f)) }));
}
