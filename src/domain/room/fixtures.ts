import { rectPolygon } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import { add, scale } from "../geometry/vec";
import { planAngle, pointOnWall, type Wall, wallsOf } from "../geometry/walls";
import type { FixedElement, FixedKind, RoomShape } from "../schemas/room";

/*
 * Kitchen and bathroom fixtures and ceiling lights. They are fixed elements:
 * the user places them in the planner, the designer works around them and
 * never moves them. Floor fixtures stand with their back to a wall and keep
 * a clearance free in front of them.
 */

export const FIXTURE_KINDS = ["kitchen_run", "fridge", "wc", "basin", "shower", "bathtub", "pendant", "chandelier"] as const satisfies readonly FixedKind[];
export type FixtureKind = (typeof FIXTURE_KINDS)[number];

export interface FixtureSpec {
  /** Width along its front, depth from the wall, height, in cm. */
  w: number;
  d: number;
  h: number;
  /** Space kept free in front of it (activity space, after DIN 18022 and kitchen practice). */
  front: number;
  mount: "floor" | "ceiling";
}

export const FIXTURE_SPEC: Readonly<Record<FixtureKind, FixtureSpec>> = {
  kitchen_run: { w: 240, d: 60, h: 90, front: 100, mount: "floor" },
  fridge: { w: 60, d: 65, h: 185, front: 100, mount: "floor" },
  wc: { w: 38, d: 60, h: 80, front: 70, mount: "floor" },
  basin: { w: 60, d: 48, h: 85, front: 70, mount: "floor" },
  shower: { w: 90, d: 90, h: 200, front: 75, mount: "floor" },
  bathtub: { w: 170, d: 75, h: 58, front: 75, mount: "floor" },
  pendant: { w: 40, d: 40, h: 90, front: 0, mount: "ceiling" },
  chandelier: { w: 70, d: 70, h: 85, front: 0, mount: "ceiling" },
};

export const isFixtureKind = (k: FixedKind): k is FixtureKind => (FIXTURE_KINDS as readonly string[]).includes(k);
/** Ceiling fixtures are drawn in plan but never block the floor. */
export const isCeilingKind = (k: FixedKind): boolean => isFixtureKind(k) && FIXTURE_SPEC[k].mount === "ceiling";

type Facing = 0 | 90 | 180 | 270;
const FRONT: Readonly<Record<Facing, Vec>> = { 0: { x: 0, y: -1 }, 90: { x: 1, y: 0 }, 180: { x: 0, y: 1 }, 270: { x: -1, y: 0 } };

/** Unit vector the fixture's front faces, or null for elements placed without one. */
export const fixtureFront = (f: Pick<FixedElement, "facing">): Vec | null => (f.facing === undefined ? null : FRONT[f.facing]);

/**
 * A floor fixture of `kind` with its back against wall `wallIndex`, centred
 * `centerOffset` cm along it and kept on the wall. Only walls parallel to the
 * plan axes can take one (fixed elements are axis-aligned); null otherwise.
 */
export function placeFixture(room: Pick<RoomShape, "polygon">, kind: FixtureKind, id: string, label: string, wallIndex: number, centerOffset: number): FixedElement | null {
  const wall = wallsOf(room.polygon)[wallIndex];
  if (!wall) return null;
  const axisAligned = Math.abs(wall.dir.x) > 0.999 || Math.abs(wall.dir.y) > 0.999;
  if (!axisAligned) return null;
  const spec = FIXTURE_SPEC[kind];
  const w = Math.min(spec.w, wall.length);
  const offset = Math.min(Math.max(0, centerOffset - w / 2), wall.length - w);
  const a = pointOnWall(wall, offset);
  const b = pointOnWall(wall, offset + w);
  const inward = scale(wall.inward, spec.d);
  const corners = [a, b, add(b, inward), add(a, inward)];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const r = (n: number) => Math.round(n * 10) / 10;
  const x = r(Math.min(...xs));
  const y = r(Math.min(...ys));
  const facing = (Math.round(planAngle(wall.inward) / 90) * 90) % 360;
  return {
    id,
    label,
    kind,
    rect: { x, y, w: r(Math.max(...xs)) - x, d: r(Math.max(...ys)) - y },
    height: spec.h,
    facing: facing as Facing,
    ...(kind === "kitchen_run" ? { kitchen: { sink: true, hob: true, oven: true, wallUnits: true } } : {}),
  };
}

/** A ceiling light centred on `at`. `height` is how far it hangs down. */
export function placeCeilingFixture(kind: "pendant" | "chandelier", id: string, label: string, at: Vec): FixedElement {
  const { w, d, h } = FIXTURE_SPEC[kind];
  return { id, label, kind, rect: { x: at.x - w / 2, y: at.y - d / 2, w, d }, height: h };
}

/** The clearance in front of a floor fixture, as a plan polygon; null when it has none. */
export function frontZone(f: FixedElement): Vec[] | null {
  const front = fixtureFront(f);
  if (!front || !isFixtureKind(f.kind)) return null;
  const depth = FIXTURE_SPEC[f.kind].front;
  if (depth <= 0) return null;
  const { x, y, w, d } = f.rect;
  if (front.y < 0) return rectPolygon(w, depth, x, y - depth);
  if (front.y > 0) return rectPolygon(w, depth, x, y + d);
  if (front.x < 0) return rectPolygon(depth, d, x - depth, y);
  return rectPolygon(depth, d, x + w, y);
}

/* ---------------- kitchen runs ---------------- */

export interface KitchenSlot {
  unit: "base" | "sink" | "cooker";
  /** Along the run from its start, in cm. */
  from: number;
  to: number;
}

/** Standard module widths: an 80 cm sink unit, a 60 cm cooker, base units near 60 cm. */
export const KITCHEN_MODULE = { sink: 80, cooker: 60, base: 60 } as const;

/**
 * Units along a kitchen run `length` cm long, filling it exactly: the sink
 * about a third of the way along, the cooker two thirds, base units between
 * them sized as close to 60 cm as the length allows.
 */
export function kitchenSlots(length: number, opts: { sink: boolean; cooker: boolean }): KitchenSlot[] {
  const fixed: ("sink" | "cooker")[] = [];
  if (opts.sink && length >= KITCHEN_MODULE.sink) fixed.push("sink");
  if (opts.cooker && length >= fixed.reduce((s, u) => s + KITCHEN_MODULE[u], 0) + KITCHEN_MODULE.cooker) fixed.push("cooker");
  const rest = length - fixed.reduce((s, u) => s + KITCHEN_MODULE[u], 0);
  // Base units: whole modules near 60 cm; a run too short for one widens the fixed units instead.
  const bases = rest >= 30 ? Math.max(1, Math.round(rest / KITCHEN_MODULE.base)) : 0;
  const stretch = bases ? 1 : length / (length - rest || length);
  const baseW = bases ? rest / bases : 0;
  // Positions in the sequence: fixed units at ~1/3 and ~2/3 of the base units.
  const seq: KitchenSlot["unit"][] = Array.from({ length: bases }, () => "base");
  fixed.forEach((u, i) => seq.splice(Math.min(seq.length, Math.round(((i + 1) * bases) / (fixed.length + 1)) + i), 0, u));
  let x = 0;
  return seq.map((unit) => {
    const w = unit === "base" ? baseW : KITCHEN_MODULE[unit] * stretch;
    const slot = { unit, from: x, to: x + w };
    x += w;
    return slot;
  });
}

/**
 * The wall a floor fixture stands against: facing the same way as the
 * fixture and touching its back edge. Null for lights and older elements.
 */
export function fixtureWall(walls: readonly Wall[], f: FixedElement): Wall | null {
  const front = fixtureFront(f);
  if (!front) return null;
  const { x, y, w, d } = f.rect;
  // Middle of the back edge.
  const back = { x: x + w / 2 - (front.x * w) / 2, y: y + d / 2 - (front.y * d) / 2 };
  let best: Wall | null = null;
  let bestD = 2;
  for (const wall of walls) {
    if (wall.inward.x * front.x + wall.inward.y * front.y < 0.99) continue;
    const t = (back.x - wall.a.x) * wall.dir.x + (back.y - wall.a.y) * wall.dir.y;
    if (t < -1 || t > wall.length + 1) continue;
    const dist = Math.abs((back.x - wall.a.x) * wall.inward.x + (back.y - wall.a.y) * wall.inward.y);
    if (dist < bestD) [best, bestD] = [wall, dist];
  }
  return best;
}

/** Width along the fixture's front and depth from its back, whatever way it faces. */
export function fixtureSize(f: Pick<FixedElement, "rect" | "facing">): { w: number; d: number } {
  const side = f.facing === 90 || f.facing === 270;
  return side ? { w: f.rect.d, d: f.rect.w } : { w: f.rect.w, d: f.rect.d };
}

/**
 * The fixture at a new width and depth, its back still against the wall and
 * its middle still at the same place along it. Lights and structure resize
 * about their centre.
 */
export function resizeFixture(f: FixedElement, size: { w: number; d: number }): FixedElement {
  const front = fixtureFront(f);
  const { x, y, w, d } = f.rect;
  const cx = x + w / 2;
  const cy = y + d / 2;
  if (!front) return { ...f, rect: { x: cx - size.w / 2, y: cy - size.d / 2, w: size.w, d: size.d } };
  const side = f.facing === 90 || f.facing === 270;
  const rw = side ? size.d : size.w;
  const rd = side ? size.w : size.d;
  // The back edge is on the side opposite the front.
  const nx = front.x > 0 ? x : front.x < 0 ? x + w - rw : cx - rw / 2;
  const ny = front.y > 0 ? y : front.y < 0 ? y + d - rd : cy - rd / 2;
  return { ...f, rect: { x: nx, y: ny, w: rw, d: rd } };
}
