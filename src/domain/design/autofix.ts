import { convexOverlap, itemFootprint, polygonInside } from "../geometry/obb";
import type { Vec } from "../geometry/vec";
import { add, dot, scale, sub } from "../geometry/vec";
import { backAgainstRotation, nearestWall, type Wall, wallsOf } from "../geometry/walls";
import { type KeepClearZone, keepClearZones } from "../geometry/zones";
import type { DesignContent, DroppedItem, FurnitureItem } from "../schemas/design";
import type { RoomShape } from "../schemas/room";
import type { ValidationIssue } from "../schemas/validation-issue";
import { summarizeIssues } from "../validator";
import { overlapAllowed, PLACEMENT_GAP } from "../validator/clearances";
import { removeFurniture } from "./plan";

export interface AutofixResult {
  content: DesignContent;
  issues: ValidationIssue[];
  /** Human-readable list of every change. */
  log: string[];
  passes: number;
  dropped: DroppedItem[];
}

const ZONE_CODES: Readonly<Partial<Record<ValidationIssue["code"], readonly KeepClearZone["kind"][]>>> = {
  DOOR_SWING_BLOCKED: ["door_swing"],
  DOOR_PATH_BLOCKED: ["door_path"],
  WINDOW_BLOCKED: ["window"],
  RADIATOR_BLOCKED: ["radiator"],
  FIXED_ELEMENT_COLLISION: ["fixed"],
};

const round = (n: number) => Math.round(n * 10) / 10;
const priorityOf = (f: FurnitureItem) => f.priority ?? 2;
const onWall = (f: FurnitureItem) => f.placement === "wall" || f.intent?.anchor === "wall" || f.intent?.anchor === "corner";

/** Wall whose line the back edge of `f` is closest to (within `maxDist`), facing into the room. */
function backWall(walls: readonly Wall[], f: FurnitureItem, maxDist: number): Wall | null {
  const back = itemFootprint(f).slice(0, 2);
  const mid = scale(add(back[0]!, back[1]!), 0.5);
  return nearestWall(walls, mid, maxDist)?.wall ?? null;
}

const DIRECTIONS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Shortest move (5 cm steps, up to 2 m) that gets `f` inside the room and
 * clear of every blocker. Tries the separation axis first, then the four
 * room axes; wall pieces only slide along their wall so they stay on it.
 */
function escape(room: RoomShape, walls: readonly Wall[], f: FurnitureItem, blockers: readonly Vec[][], hint?: Vec): FurnitureItem | null {
  const wall = onWall(f) ? backWall(walls, f, PLACEMENT_GAP.wallSnap) : null;
  const dirs = wall ? [wall.dir, scale(wall.dir, -1)] : [...(hint ? [hint] : []), ...DIRECTIONS];
  const ok = (g: FurnitureItem) => {
    const poly = itemFootprint(g);
    return polygonInside(room.polygon, poly) && blockers.every((b) => !convexOverlap(poly, b));
  };
  for (let dist = 5; dist <= 200; dist += 5) {
    for (const dir of dirs) {
      const g = { ...f, x: round(f.x + dir.x * dist), y: round(f.y + dir.y * dist) };
      if (ok(g)) return g;
    }
  }
  return null;
}

/** Everything a floor piece may not overlap: keep-clear zones that apply to it and the other floor pieces. */
function blockersFor(f: FurnitureItem, zones: readonly KeepClearZone[], items: ReadonlyMap<string, FurnitureItem>): Vec[][] {
  if (f.placement !== "floor") return [];
  const out = zones.filter((z) => z.kind !== "window" || f.h > (z.minBlockingHeight ?? 0)).map((z) => z.polygon);
  for (const o of items.values()) {
    if (o.id === f.id || o.placement !== "floor" || overlapAllowed(o.category, f.category)) continue;
    out.push(itemFootprint(o));
  }
  return out;
}

/** Put the back of `f` flush on the nearest wall within snapping distance. */
function snapped(walls: readonly Wall[], f: FurnitureItem): FurnitureItem | null {
  const back = itemFootprint(f).slice(0, 2);
  const mid = scale(add(back[0]!, back[1]!), 0.5);
  const hit = nearestWall(walls, mid, PLACEMENT_GAP.wallSnap);
  if (!hit) return null;
  const rotation = backAgainstRotation(hit.wall);
  const alongC = dot(sub(f, hit.wall.a), hit.wall.dir);
  const c = add(add(hit.wall.a, scale(hit.wall.dir, alongC)), scale(hit.wall.inward, f.d / 2));
  const next = { ...f, x: round(c.x), y: round(c.y), rotation };
  return Math.abs(next.x - f.x) < 0.5 && Math.abs(next.y - f.y) < 0.5 && next.rotation === f.rotation ? null : next;
}

/** Push corners that stick out of the room back inside, wall by wall. */
function pulledInside(walls: readonly Wall[], f: FurnitureItem): FurnitureItem | null {
  let x = f.x;
  let y = f.y;
  for (const w of walls) {
    const corners = itemFootprint({ ...f, x, y });
    let worst = 0;
    for (const p of corners) {
      const rel = sub(p, w.a);
      const along = dot(rel, w.dir);
      if (along < 0 || along > w.length) continue;
      worst = Math.min(worst, dot(rel, w.inward));
    }
    if (worst < -0.5) {
      x += w.inward.x * (-worst + 0.5);
      y += w.inward.y * (-worst + 0.5);
    }
  }
  return x === f.x && y === f.y ? null : { ...f, x: round(x), y: round(y) };
}

/** One round of local fixes for every error. */
function fixPass(room: RoomShape, content: DesignContent, issues: readonly ValidationIssue[], log: string[]): DesignContent {
  const walls = wallsOf(room.polygon);
  const zones = keepClearZones(room);
  const items = new Map(content.furniture.map((f) => [f.id, f]));
  const set = (next: FurnitureItem | null, why: string) => {
    if (!next) return;
    const prev = items.get(next.id)!;
    items.set(next.id, next);
    const dist = Math.round(Math.hypot(next.x - prev.x, next.y - prev.y));
    log.push(`${why}: moved ${next.name} ${dist} cm`);
  };

  for (const issue of issues) {
    if (issue.severity !== "error") continue;
    switch (issue.code) {
      case "WALL_ITEM_NOT_ON_WALL":
        for (const id of issue.itemIds) set(snapped(walls, items.get(id)!), "snapped to wall");
        break;
      case "OUT_OF_BOUNDS":
        for (const id of issue.itemIds) set(pulledInside(walls, items.get(id)!), "pulled inside the room");
        break;
      case "OVERLAP": {
        const [a, b] = issue.itemIds.map((id) => items.get(id));
        if (!a || !b) break;
        // Move the piece that matters less: not the existing one, then lower priority, then smaller.
        const moverFirst = Number(a.existing) - Number(b.existing) || priorityOf(b) - priorityOf(a) || a.w * a.d - b.w * b.d;
        const [mover, other] = moverFirst <= 0 ? [a, b] : [b, a];
        const o = convexOverlap(itemFootprint(mover), itemFootprint(other));
        if (o) set(escape(room, walls, mover, blockersFor(mover, zones, items), o.axis), `separated from ${other.name}`);
        break;
      }
      default: {
        const kinds = ZONE_CODES[issue.code];
        if (!kinds) break;
        for (const id of issue.itemIds) {
          const f = items.get(id);
          if (!f || f.placement !== "floor") continue;
          const zone = zones.find((z) => kinds.includes(z.kind) && convexOverlap(itemFootprint(f), z.polygon));
          if (!zone) continue;
          const o = convexOverlap(itemFootprint(f), zone.polygon)!;
          set(escape(room, walls, f, blockersFor(f, zones, items), o.axis), `cleared ${zone.kind.replace("_", " ")} ${zone.refId}`);
        }
      }
    }
  }
  // Pieces meant for a wall that ended up close to one: flush them.
  for (const f of items.values()) if (onWall(f)) set(snapped(walls, f), "snapped to wall");
  return { ...content, furniture: content.furniture.map((f) => items.get(f.id)!) };
}

const errors = (issues: readonly ValidationIssue[]) => summarizeIssues(issues).errors;
const better = (a: readonly ValidationIssue[], b: readonly ValidationIssue[]) =>
  errors(a) < errors(b) || (errors(a) === errors(b) && summarizeIssues(a).warnings < summarizeIssues(b).warnings);

/**
 * Deterministic repair without the model: snap, separate and slide pieces
 * out of keep-clear zones, re-validating after each pass; as a last resort
 * drop the lowest-priority offending piece (never an existing one).
 */
export function autofix(content: DesignContent, room: RoomShape, validate: (c: DesignContent) => ValidationIssue[], maxPasses = 4): AutofixResult {
  const log: string[] = [];
  const dropped: DroppedItem[] = [];
  let cur = content;
  let issues = validate(cur);
  let passes = 0;
  while (errors(issues) > 0 && passes < maxPasses) {
    passes++;
    const passLog: string[] = [];
    const next = fixPass(room, cur, issues, passLog);
    const nextIssues = validate(next);
    if (passLog.length > 0 && better(nextIssues, issues)) {
      log.push(...passLog);
      cur = next;
      issues = nextIssues;
      continue;
    }
    // Moving did not help: drop the least important offender.
    const offenders = new Set(issues.filter((i) => i.severity === "error").flatMap((i) => i.itemIds));
    const candidates = cur.furniture.filter((f) => offenders.has(f.id) && !f.existing);
    const victim = [...candidates].sort((a, b) => priorityOf(b) - priorityOf(a) || b.w * b.d - a.w * a.d || a.id.localeCompare(b.id))[0];
    if (!victim) break;
    const after = removeFurniture(cur, new Set([victim.id]));
    const afterIssues = validate(after);
    if (!better(afterIssues, issues)) break;
    log.push(`removed ${victim.name}: no room for it`);
    dropped.push({ id: victim.id, name: victim.name, category: victim.category, reason: "no_space" });
    cur = after;
    issues = afterIssues;
  }
  return { content: cur, issues, log, passes, dropped };
}
