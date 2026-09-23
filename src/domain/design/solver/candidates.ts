import { axes } from "../../geometry/obb";
import type { Rect } from "../../geometry/polygon";
import { normDeg } from "../../geometry/units";
import type { Vec } from "../../geometry/vec";
import { add, dot, length, scale, sub } from "../../geometry/vec";
import { backAgainstRotation, planAngle, type Wall } from "../../geometry/walls";
import type { KeepClearZone } from "../../geometry/zones";
import type { RoomShape } from "../../schemas/room";
import { PLACEMENT_GAP } from "../../validator/clearances";
import { CATALOGUE } from "../catalogue";
import type { PlannedItem, Pose } from "../plan";
import { type Interval, subtract, wallSlots } from "./slots";

export type Side = "front" | "back" | "left" | "right";

/**
 * How an item is placed. Wall and free choices are absolute; the others are
 * relative to the item's `intent.relativeTo`, so dependents follow their anchor.
 * `soft` is the preference cost of the choice (distance from intent etc.).
 */
export type Choice =
  | { kind: "wall"; wallIndex: number; t: number; lo: number; hi: number; soft: number }
  | { kind: "free"; x: number; y: number; rotation: number; soft: number }
  | { kind: "front"; gap: number; lateral: number; soft: number }
  | { kind: "beside"; side: 1 | -1; gap: number; soft: number }
  | { kind: "seat"; side: Side; offset: number; soft: number }
  | { kind: "on"; shift: number; lateral: number; turn: 0 | 90; soft: number };

export interface SolverCtx {
  room: RoomShape;
  walls: Wall[];
  zones: KeepClearZone[];
  items: ReadonlyMap<string, PlannedItem>;
  bounds: Rect;
  centre: Vec;
  maxWallLength: number;
  doorWalls: ReadonlySet<number>;
  /** Window openings by id: vertical band of the glass. */
  windows: ReadonlyMap<string, { bottom: number; top: number }>;
}

/** Rotation whose front (local +y) points along `dir`. */
export const facing = (dir: Vec): number => Math.round(normDeg(planAngle(dir) - 180)) % 360;

const CHAIRS = new Set(["dining_chair", "office_chair"]);

function sideFrame(anchor: PlannedItem, pose: Pose, side: Side): { n: Vec; tan: Vec; half: number; len: number } {
  const { u, v } = axes(pose);
  switch (side) {
    case "front":
      return { n: v, tan: u, half: anchor.d / 2, len: anchor.w };
    case "back":
      return { n: scale(v, -1), tan: u, half: anchor.d / 2, len: anchor.w };
    case "right":
      return { n: u, tan: v, half: anchor.w / 2, len: anchor.d };
    case "left":
      return { n: scale(u, -1), tan: v, half: anchor.w / 2, len: anchor.d };
  }
}

/** Pose of `item` for a choice, or null when its anchor has no pose. */
export function poseFor(ctx: SolverCtx, item: PlannedItem, choice: Choice, poses: ReadonlyMap<string, Pose>): Pose | null {
  if (choice.kind === "wall") {
    const w = ctx.walls[choice.wallIndex]!;
    const c = add(add(w.a, scale(w.dir, choice.t)), scale(w.inward, item.d / 2));
    return { x: c.x, y: c.y, rotation: backAgainstRotation(w) };
  }
  if (choice.kind === "free") return { x: choice.x, y: choice.y, rotation: choice.rotation };
  const anchor = item.intent.relativeTo !== undefined ? ctx.items.get(item.intent.relativeTo) : undefined;
  const ap = anchor ? poses.get(anchor.id) : undefined;
  if (!anchor || !ap) return null;
  const { u, v } = axes(ap);
  const c = { x: ap.x, y: ap.y };
  let p: Vec;
  let rotation: number;
  switch (choice.kind) {
    case "front":
      p = add(add(c, scale(v, anchor.d / 2 + choice.gap + item.d / 2)), scale(u, choice.lateral));
      rotation = (ap.rotation + 180) % 360;
      break;
    case "beside":
      p = add(add(c, scale(u, choice.side * (anchor.w / 2 + choice.gap + item.w / 2))), scale(v, -anchor.d / 2 + item.d / 2));
      rotation = ap.rotation;
      break;
    case "seat": {
      const f = sideFrame(anchor, ap, choice.side);
      p = add(add(c, scale(f.n, f.half + item.d / 2 - PLACEMENT_GAP.chairTuck)), scale(f.tan, choice.offset));
      rotation = facing(scale(f.n, -1));
      break;
    }
    case "on":
      p = add(add(c, scale(v, choice.shift)), scale(u, choice.lateral));
      rotation = (ap.rotation + choice.turn) % 360;
      break;
  }
  return { x: p.x, y: p.y, rotation };
}

/** Wall runs where a wall-mounted item may hang: clear of doors below its bottom edge and of window glass at its height. */
function mountRuns(ctx: SolverCtx, item: PlannedItem, wall: Wall): Interval[] {
  const blocked: Interval[] = [];
  for (const o of ctx.room.openings) {
    if (o.wallIndex !== wall.index) continue;
    if (o.kind === "door" && item.elevation < o.height) blocked.push([o.offset, o.offset + o.width]);
    if (o.kind === "window" && item.elevation < o.sillHeight + o.height && item.elevation + item.h > o.sillHeight) {
      blocked.push([o.offset - 2, o.offset + o.width + 2]);
    }
  }
  return subtract(wall.length, blocked);
}

function stepsBetween(lo: number, hi: number, step: number): number[] {
  const out = new Set<number>([lo, hi, (lo + hi) / 2]);
  for (let t = lo + step; t < hi; t += step) out.add(t);
  return [...out].sort((a, b) => a - b);
}

interface WallChoiceOpts {
  corner: boolean;
  /** Prefer the wall opposite this anchor's front, aligned with it. */
  opposite?: { anchor: PlannedItem; pose: Pose };
}

function wallChoices(ctx: SolverCtx, item: PlannedItem, opts: WallChoiceOpts): Choice[] {
  const runs: { wall: Wall; from: number; to: number }[] =
    item.placement === "wall"
      ? ctx.walls.flatMap((wall) => mountRuns(ctx, item, wall).map(([from, to]) => ({ wall, from, to })))
      : wallSlots(ctx.room, { depth: item.d, height: item.h, minLength: item.w }).map((s) => ({ wall: ctx.walls[s.wallIndex]!, from: s.from, to: s.to }));
  const pref = item.intent.wallIndex;
  const out: Choice[] = [];
  for (const { wall, from, to } of runs) {
    const lo = from + item.w / 2;
    const hi = to - item.w / 2;
    if (hi < lo - 0.01) continue;
    let base = 0;
    if (pref !== undefined && pref < ctx.walls.length && pref !== wall.index) base += 40;
    if (item.priority === 1 && item.placement === "floor") {
      base += (ctx.maxWallLength - wall.length) / 10;
      if (ctx.doorWalls.has(wall.index)) base += 15;
    }
    const ts = opts.corner ? [...new Set([lo, Math.max(lo, hi)])] : stepsBetween(lo, Math.max(lo, hi), 10);
    for (const t of ts) {
      let soft = base;
      if (opts.corner) {
        const trueCorner = (t === lo && from <= 1) || (t === hi && to >= wall.length - 1);
        soft += trueCorner ? 0 : 30;
      } else if (item.w >= 100) {
        soft += Math.abs(t - (from + to) / 2) / 20;
      }
      if (opts.opposite) {
        const { v, u } = axes(opts.opposite.pose);
        if (dot(wall.inward, v) > -0.7) soft += 200;
        const p = add(wall.a, scale(wall.dir, t));
        soft += Math.abs(dot(sub(p, opts.opposite.pose), u)) / 5;
      }
      out.push({ kind: "wall", wallIndex: wall.index, t, lo, hi: Math.max(lo, hi), soft });
    }
  }
  return out;
}

/** Centre of the placed pieces sharing the item's zone, if any. */
function zoneMates(ctx: SolverCtx, item: PlannedItem, poses: ReadonlyMap<string, Pose>): Vec | null {
  const zone = item.intent.zoneId;
  if (zone === undefined) return null;
  const mates = [...poses.entries()].filter(([id]) => id !== item.id && ctx.items.get(id)?.intent.zoneId === zone).map(([, p]) => p);
  return mates.length > 0 ? scale(mates.reduce<Vec>((s, p) => add(s, p), { x: 0, y: 0 }), 1 / mates.length) : null;
}

/** Where free-standing items should gravitate: the placed pieces of their zone, else the room centre. */
export const zoneTarget = (ctx: SolverCtx, item: PlannedItem, poses: ReadonlyMap<string, Pose>): Vec => zoneMates(ctx, item, poses) ?? ctx.centre;

/** Gap between an item centred at `p` and the nearest wall line. */
function wallGap(ctx: SolverCtx, p: Vec, half: number): number {
  let best = Infinity;
  for (const w of ctx.walls) {
    const rel = sub(p, w.a);
    const along = dot(rel, w.dir);
    if (along < 0 || along > w.length) continue;
    best = Math.min(best, Math.abs(dot(rel, w.inward)) - half);
  }
  return Number.isFinite(best) ? Math.max(0, best) : 0;
}

/**
 * Grid positions over the room. Pieces with zone mates gravitate to them;
 * others (except tables, which need space all round) hug a wall to keep
 * the middle of the room free for walking.
 */
function freeChoices(ctx: SolverCtx, item: PlannedItem, poses: ReadonlyMap<string, Pose>): Choice[] {
  const mates = zoneMates(ctx, item, poses);
  const hugWall = mates === null && item.category !== "dining_table";
  const target = mates ?? ctx.centre;
  const rotations = item.category === "armchair" ? [0, 90, 180, 270] : item.w === item.d ? [0] : [0, 90];
  const step = 20;
  const b = ctx.bounds;
  const out: Choice[] = [];
  for (let x = b.x + step / 2; x < b.x + b.w; x += step) {
    for (let y = b.y + step / 2; y < b.y + b.d; y += step) {
      const toTarget = sub(target, { x, y });
      const dist = length(toTarget);
      for (const rotation of rotations) {
        let soft = hugWall ? wallGap(ctx, { x, y }, Math.min(item.w, item.d) / 2) / 5 : dist / 10;
        if (item.category === "armchair" && dist > 1) soft += (1 - dot(axes({ rotation }).v, scale(toTarget, 1 / dist))) * 30;
        out.push({ kind: "free", x, y, rotation, soft });
      }
    }
  }
  return out;
}

function relationChoices(item: PlannedItem, anchor: PlannedItem): Choice[] {
  const out: Choice[] = [];
  switch (item.intent.anchor) {
    case "front_of": {
      const g0 = item.category === "coffee_table" ? PLACEMENT_GAP.frontOf : 60;
      for (const gap of [g0, g0 + 10, g0 + 20, g0 + 40]) {
        for (const lateral of [0, -20, 20, -40, 40]) out.push({ kind: "front", gap, lateral, soft: Math.abs(lateral) / 2 + (gap - g0) / 2 });
      }
      break;
    }
    case "beside":
      for (const gap of [PLACEMENT_GAP.beside, 15, 30]) {
        for (const side of [1, -1] as const) out.push({ kind: "beside", side, gap, soft: (gap - PLACEMENT_GAP.beside) / 2 + (side === -1 ? 1 : 0) });
      }
      break;
    case "under":
      if (CHAIRS.has(item.category)) {
        const sides: Side[] = anchor.category === "desk" ? ["front"] : ["front", "back", "left", "right"];
        for (const side of sides) {
          const len = side === "front" || side === "back" ? anchor.w : anchor.d;
          const long = len >= (side === "front" || side === "back" ? anchor.d : anchor.w);
          const n = anchor.category === "desk" ? 1 : Math.max(1, Math.floor(len / 55));
          for (let i = 0; i < n; i++) {
            const offset = (i + 0.5) * (len / n) - len / 2;
            out.push({ kind: "seat", side, offset, soft: long ? 0 : 10 });
          }
          if (anchor.category === "desk") for (const offset of [-20, 20]) out.push({ kind: "seat", side, offset, soft: 5 });
        }
      } else {
        const anchorLongU = anchor.w >= anchor.d;
        for (const turn of [0, 90] as const) {
          const itemLongU = item.w >= item.d;
          const parallel = (turn === 0) === (anchorLongU === itemLongU);
          for (const shift of [0, 20, 40, 60]) {
            for (const lateral of [0, -20, 20]) out.push({ kind: "on", shift, lateral, turn, soft: (parallel ? 0 : 20) + shift / 5 + Math.abs(lateral) / 5 });
          }
        }
      }
      break;
    default:
      break;
  }
  return out;
}

/** Every candidate placement for `item`, given the poses already fixed. Empty when its anchor is not placed. */
export function candidates(ctx: SolverCtx, item: PlannedItem, poses: ReadonlyMap<string, Pose>): Choice[] {
  const intent = item.intent;
  if (intent.anchor === "wall") return wallChoices(ctx, item, { corner: false });
  if (intent.anchor === "corner") {
    const corners = wallChoices(ctx, item, { corner: true });
    return corners.length > 0 ? corners : wallChoices(ctx, item, { corner: false });
  }
  if (intent.anchor === "free") return freeChoices(ctx, item, poses);
  const anchor = intent.relativeTo !== undefined ? ctx.items.get(intent.relativeTo) : undefined;
  const pose = anchor ? poses.get(anchor.id) : undefined;
  if (!anchor || !pose) return [];
  // Wall pieces "in front of" a sofa (TV unit, dresser) go on the opposite wall, not into the room.
  if (intent.anchor === "front_of" && (item.placement === "wall" || CATALOGUE[item.category].wants.anchor === "wall")) {
    return wallChoices(ctx, item, { corner: false, opposite: { anchor, pose } });
  }
  return relationChoices(item, anchor);
}
