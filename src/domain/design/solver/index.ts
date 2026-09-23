import { convexOverlap } from "../../geometry/obb";
import { bbox } from "../../geometry/polygon";
import { dot } from "../../geometry/vec";
import { wallsOf } from "../../geometry/walls";
import { keepClearZones } from "../../geometry/zones";
import type { DroppedItem } from "../../schemas/design";
import type { RoomShape } from "../../schemas/room";
import type { ValidationIssue } from "../../schemas/validation-issue";
import { summarizeIssues, validateLayout } from "../../validator";
import { isRelational, type PlannedItem, type Pose, toFurnitureItem } from "../plan";
import { candidates, type Choice, poseFor, type SolverCtx, zoneTarget } from "./candidates";
import { cheapCost, footprintOf, HARD, type Placed } from "./cost";
import { hashSeed, mulberry32 } from "./random";

type DropReason = DroppedItem["reason"];

export interface SolveInput {
  room: RoomShape & { id?: string };
  items: readonly PlannedItem[];
  /** Most pieces to place (from `maxItems`); extra low-priority pieces are dropped up front. */
  cap?: number;
  /** Local search iterations over all drop passes. */
  maxIterations?: number;
}

export interface SolveResult {
  poses: Map<string, Pose>;
  dropped: DroppedItem[];
  /** Geometric issues of the final layout. */
  issues: ValidationIssue[];
  iterations: number;
  evaluations: number;
}

/** Full validations of the best cheap candidates per item in the greedy step. */
const TOP_K = 6;
/** Stop local search after this many iterations without improvement. */
const STALL = 60;
const DEFAULT_ITERATIONS = 400;
/** Score penalty for a piece left unplaced, by priority: a must-have costs more than one validator error. */
const UNPLACED_COST: Readonly<Record<number, number>> = { 1: 3000, 2: 1500, 3: 700 };

function makeCtx(room: RoomShape, items: readonly PlannedItem[]): SolverCtx {
  const walls = wallsOf(room.polygon);
  const b = bbox(room.polygon);
  const windows = new Map(room.openings.flatMap((o) => (o.kind === "window" ? [[o.id, { bottom: o.sillHeight, top: o.sillHeight + o.height }] as const] : [])));
  return {
    room,
    walls,
    zones: keepClearZones(room),
    items: new Map(items.map((i) => [i.id, i])),
    bounds: b,
    centre: { x: b.x + b.w / 2, y: b.y + b.d / 2 },
    maxWallLength: Math.max(...walls.map((w) => w.length)),
    doorWalls: new Set(room.openings.filter((o) => o.kind === "door").map((o) => o.wallIndex)),
    windows,
  };
}

const area = (i: PlannedItem) => i.w * i.d;
const byPriority = (a: PlannedItem, b: PlannedItem) => Number(b.existing) - Number(a.existing) || a.priority - b.priority || area(b) - area(a);

/**
 * Placement order: floor anchors (existing, then priority, then biggest),
 * each followed directly by the pieces placed relative to it (chairs after
 * their desk), then wall-mounted pieces, rugs and ceiling pieces, which fit
 * around the furniture.
 */
function placementOrder(items: readonly PlannedItem[]): PlannedItem[] {
  const out: PlannedItem[] = [];
  const done = new Set<string>();
  const visit = (i: PlannedItem) => {
    if (done.has(i.id)) return;
    out.push(i);
    done.add(i.id);
    for (const dep of items.filter((d) => d.intent.relativeTo === i.id && isRelational(d.intent)).sort(byPriority)) visit(dep);
  };
  const roots = items.filter((i) => !isRelational(i.intent)).sort(byPriority);
  for (const r of roots) if (r.placement === "floor") visit(r);
  for (const r of roots) visit(r);
  // Anything left points at a missing anchor; it goes last and will not be placed.
  return [...out, ...items.filter((i) => !done.has(i.id))];
}

/** Items that (transitively) hang off `id`. */
function dependentsOf(items: readonly PlannedItem[], id: string): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length > 0) {
    const next = items.filter((i) => i.intent.relativeTo !== undefined && frontier.includes(i.intent.relativeTo) && !out.has(i.id)).map((i) => i.id);
    next.forEach((n) => out.add(n));
    frontier = next;
  }
  return out;
}

interface State {
  choices: Map<string, Choice>;
  poses: Map<string, Pose>;
  issues: ValidationIssue[];
  score: number;
}

class Pass {
  evaluations = 0;
  iterations = 0;
  readonly order: PlannedItem[];

  constructor(
    private readonly ctx: SolverCtx,
    items: readonly PlannedItem[],
    private readonly rng: () => number,
  ) {
    this.order = placementOrder(items);
  }

  placedOf(poses: ReadonlyMap<string, Pose>, skip: ReadonlySet<string> = new Set()): Placed[] {
    return this.order.flatMap((item) => {
      const pose = poses.get(item.id);
      return pose && !skip.has(item.id) ? [{ item, pose, poly: footprintOf(item, pose) }] : [];
    });
  }

  /** Poses for every choice, in placement order so dependents follow their anchor. */
  realize(choices: ReadonlyMap<string, Choice>): Map<string, Pose> {
    const poses = new Map<string, Pose>();
    for (const item of this.order) {
      const c = choices.get(item.id);
      if (!c) continue;
      const p = poseFor(this.ctx, item, c, poses);
      if (p) poses.set(item.id, p);
    }
    return poses;
  }

  evaluate(choices: ReadonlyMap<string, Choice>, poses: ReadonlyMap<string, Pose>): { issues: ValidationIssue[]; score: number } {
    this.evaluations++;
    const furniture = this.order.flatMap((i) => {
      const p = poses.get(i.id);
      return p ? [toFurnitureItem(i, p)] : [];
    });
    const issues = validateLayout(this.ctx.room, furniture);
    const s = summarizeIssues(issues);
    let soft = 0;
    for (const c of choices.values()) soft += c.soft;
    for (const i of this.order) if (i.placement !== "ceiling" && !poses.has(i.id)) soft += UNPLACED_COST[i.priority]!;
    return { issues, score: s.errors * 1000 + s.warnings * 10 + soft };
  }

  /** Candidates for `item` ranked by cheap cost + preference, against everything except `skip`. */
  ranked(item: PlannedItem, poses: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>, sample?: number): { choice: Choice; pose: Pose; cost: number }[] {
    let list = candidates(this.ctx, item, poses);
    if (sample !== undefined && list.length > sample) list = Array.from({ length: sample }, () => list[Math.floor(this.rng() * list.length)]!);
    const placed = this.placedOf(poses, skip);
    const out: { choice: Choice; pose: Pose; cost: number }[] = [];
    for (const choice of list) {
      const pose = poseFor(this.ctx, item, choice, poses);
      if (!pose) continue;
      const cost = cheapCost(this.ctx, item, pose, placed);
      if (Number.isFinite(cost)) out.push({ choice, pose, cost: cost + choice.soft });
    }
    return out.sort((a, b) => a.cost - b.cost);
  }

  /** Place items one by one: the best of the top cheap candidates by full validation. Items that do not fit stay unplaced. */
  greedy(): State {
    const choices = new Map<string, Choice>();
    const poses = new Map<string, Pose>();
    for (const item of this.order) {
      if (isRelational(item.intent) && !poses.has(item.intent.relativeTo ?? "")) continue;
      if (item.placement === "ceiling") {
        const t = zoneTarget(this.ctx, item, poses);
        choices.set(item.id, { kind: "free", x: t.x, y: t.y, rotation: 0, soft: 0 });
        poses.set(item.id, { x: t.x, y: t.y, rotation: 0 });
        continue;
      }
      const ranked = this.ranked(item, poses, new Set([item.id]));
      let best: { choice: Choice; pose: Pose; score: number } | null = null;
      for (const r of ranked.slice(0, TOP_K)) {
        choices.set(item.id, r.choice);
        poses.set(item.id, r.pose);
        const score = this.evaluate(choices, poses).score + r.cost * 0.1;
        if (!best || score < best.score) best = { choice: r.choice, pose: r.pose, score };
      }
      if (best) {
        choices.set(item.id, best.choice);
        poses.set(item.id, best.pose);
      } else {
        choices.delete(item.id);
        poses.delete(item.id);
      }
    }
    return { choices, poses, ...this.evaluate(choices, poses) };
  }

  /** Try to place every unplaced item whose anchor is placed, where it causes no hard conflict. */
  private fill(choices: Map<string, Choice>): Map<string, Pose> {
    let poses = this.realize(choices);
    for (const item of this.order) {
      if (choices.has(item.id) || item.placement === "ceiling") continue;
      if (isRelational(item.intent) && !poses.has(item.intent.relativeTo ?? "")) continue;
      const top = this.ranked(item, poses, new Set([item.id]))[0];
      if (!top || top.cost - top.choice.soft >= HARD) continue;
      choices.set(item.id, top.choice);
      poses = this.realize(choices);
    }
    return poses;
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rng() * list.length)]!;
  }

  /** One random change of one item's choice. */
  private move(state: State, item: PlannedItem): Choice | null {
    const c = state.choices.get(item.id)!;
    const r = this.rng();
    if (r < 0.4) {
      const skip = new Set([item.id, ...dependentsOf(this.order, item.id)]);
      const top = this.ranked(item, state.poses, skip, 60).slice(0, 4);
      return top.length > 0 ? this.pick(top).choice : null;
    }
    // Informed move: push out of the deepest overlap with another floor item.
    if (r < 0.6 && (c.kind === "wall" || c.kind === "free")) {
      const pose = state.poses.get(item.id)!;
      const poly = footprintOf(item, pose);
      let deepest: { depth: number; axis: { x: number; y: number } } | null = null;
      for (const p of this.placedOf(state.poses, new Set([item.id]))) {
        if (p.item.placement !== "floor") continue;
        const o = convexOverlap(poly, p.poly);
        if (o && (!deepest || o.depth > deepest.depth)) deepest = o;
      }
      for (const z of this.ctx.zones) {
        const o = convexOverlap(poly, z.polygon);
        if (o && (!deepest || o.depth > deepest.depth)) deepest = o;
      }
      if (deepest) {
        const step = deepest.depth + 2;
        if (c.kind === "free") return { ...c, x: c.x + deepest.axis.x * step, y: c.y + deepest.axis.y * step };
        const along = dot(deepest.axis, this.ctx.walls[c.wallIndex]!.dir);
        if (Math.abs(along) > 0.2) return { ...c, t: Math.min(c.hi, Math.max(c.lo, c.t + Math.sign(along) * step)) };
      }
    }
    const d = this.pick([-20, -10, -5, 5, 10, 20]);
    switch (c.kind) {
      case "wall":
        return { ...c, t: Math.min(c.hi, Math.max(c.lo, c.t + this.pick([-40, -20, -10, -5, 5, 10, 20, 40]))) };
      case "free":
        return this.rng() < 0.5 ? { ...c, x: c.x + d } : { ...c, y: c.y + d };
      case "front":
        return this.rng() < 0.5 ? { ...c, lateral: c.lateral + d } : { ...c, gap: Math.max(20, c.gap + Math.abs(d) / 2) };
      case "beside":
        return this.rng() < 0.3 ? { ...c, side: c.side === 1 ? -1 : 1 } : { ...c, gap: Math.max(0, c.gap + d / 2) };
      case "seat":
        return { ...c, offset: c.offset + d / 2 };
      case "on":
        return this.rng() < 0.5 ? { ...c, shift: c.shift + d } : { ...c, lateral: c.lateral + d };
    }
  }

  /** Improve by random local moves; keeps the best state. */
  search(start: State, maxIterations: number): State {
    let cur = start;
    let best = start;
    let stall = 0;
    const movable = this.order.filter((i) => i.placement !== "ceiling" && cur.choices.has(i.id));
    if (movable.length === 0) return start;
    const complete = (st: State) => this.order.every((i) => st.poses.has(i.id));
    for (let it = 0; it < maxIterations; it++) {
      const s = summarizeIssues(cur.issues);
      if ((s.errors === 0 && s.warnings === 0 && complete(cur)) || stall >= STALL) break;
      this.iterations++;
      const offenders = new Set(cur.issues.filter((i) => i.severity === "error").flatMap((i) => i.itemIds));
      // Relative pieces can barely move on their own: their anchor is a suspect too.
      for (const i of this.order) {
        if (i.intent.relativeTo !== undefined && (!cur.poses.has(i.id) || offenders.has(i.id))) offenders.add(i.intent.relativeTo);
      }
      const hot = movable.filter((i) => offenders.has(i.id));
      const item = hot.length > 0 && this.rng() < 0.7 ? this.pick(hot) : this.pick(movable);
      const next = this.move(cur, item);
      if (!next) {
        stall++;
        continue;
      }
      const choices = new Map(cur.choices).set(item.id, next);
      const poses = this.fill(choices);
      const ev = this.evaluate(choices, poses);
      if (ev.score <= cur.score) {
        stall = ev.score < cur.score ? 0 : stall + 1;
        cur = { choices, poses, ...ev };
        if (cur.score < best.score) best = cur;
      } else {
        stall++;
      }
    }
    return best;
  }
}

const errorsOf = (issues: readonly ValidationIssue[]) => summarizeIssues(issues).errors;

/** Lowest-priority piece among the offenders (never an existing one), for the drop pass. */
function victim(items: readonly PlannedItem[], state: State): PlannedItem | null {
  const mentions = new Map<string, number>();
  for (const i of state.issues) if (i.severity === "error") for (const id of i.itemIds) mentions.set(id, (mentions.get(id) ?? 0) + 1);
  const placed = items.filter((i) => state.poses.has(i.id) && !i.existing && i.placement !== "ceiling");
  // Walkway errors name the piece that cannot be reached, not the one in the way: then every piece is a suspect.
  const blind = state.issues.some((i) => i.severity === "error" && (i.code === "WALKWAY_TOO_NARROW" || i.itemIds.length === 0));
  const offenders = placed.filter((i) => mentions.has(i.id));
  const pool = offenders.length > 0 && !blind ? offenders : placed;
  const sorted = [...pool].sort(
    (a, b) => b.priority - a.priority || (mentions.get(b.id) ?? 0) - (mentions.get(a.id) ?? 0) || area(b) - area(a) || a.id.localeCompare(b.id),
  );
  return sorted[0] ?? null;
}

/**
 * Deterministic layout solver: cap → greedy placement → local search →
 * drop the lowest-priority offender and repeat until the layout has no
 * geometric errors or nothing droppable is left.
 */
export function solveLayout(input: SolveInput): SolveResult {
  const { room } = input;
  const dropped: DroppedItem[] = [];
  const drop = (i: PlannedItem, reason: DropReason) => dropped.push({ id: i.id, name: i.name, category: i.category, reason });

  // 1. Item cap: keep existing pieces, then by priority, then plan order.
  let active = [...input.items];
  if (input.cap !== undefined && active.length > input.cap) {
    const ranked = active.map((item, index) => ({ item, index })).sort((a, b) => Number(b.item.existing) - Number(a.item.existing) || a.item.priority - b.item.priority || a.index - b.index);
    const keep = new Set(ranked.slice(0, input.cap).map((r) => r.item.id));
    for (const i of active) if (!keep.has(i.id)) drop(i, "over_item_cap");
    active = active.filter((i) => keep.has(i.id));
  }

  const seed = hashSeed(`${room.id ?? room.name}|${input.items.map((i) => i.id).join(",")}`);
  const rng = mulberry32(seed);
  let budget = input.maxIterations ?? DEFAULT_ITERATIONS;
  let iterations = 0;
  let evaluations = 0;
  let result: State | null = null;

  for (;;) {
    const pass = new Pass(makeCtx(room, active), active, rng);
    const searched = pass.search(pass.greedy(), Math.max(60, budget));
    budget = Math.max(0, budget - pass.iterations);
    iterations += pass.iterations;
    evaluations += pass.evaluations;
    // Pieces that found no place at all are left out.
    const unplaced = active.filter((i) => !searched.poses.has(i.id));
    for (const i of unplaced) drop(i, i.intent.relativeTo !== undefined && !searched.poses.has(i.intent.relativeTo) ? "anchor_dropped" : "no_space");
    active = active.filter((i) => searched.poses.has(i.id));
    result = searched;
    if (errorsOf(searched.issues) === 0) break;
    const v = victim(active, searched);
    if (!v) break;
    const gone = new Set([v.id, ...dependentsOf(active, v.id)]);
    drop(v, "no_space");
    for (const i of active) if (i.id !== v.id && gone.has(i.id)) drop(i, "anchor_dropped");
    active = active.filter((i) => !gone.has(i.id));
  }

  return { poses: result!.poses, dropped, issues: result!.issues, iterations, evaluations };
}
