import { pointOnWall, type Wall } from "../geometry/walls";
import type { Vec } from "../geometry/vec";
import type { DoorDesign, Opening, RadiatorStyle, Window, WindowDesign } from "../schemas/room";
import { windowStyle } from "./fit-out";

/*
 * How doors, windows and radiators are put together, in real joinery
 * proportions. Pure layout in cm; three/doors3d.tsx and friends turn it into
 * geometry, so every part keeps the exact size set in the planner.
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

/* ---------------- door leaves ---------------- */

export interface LeafParts {
  /** Stiles, rails and slabs at full leaf thickness. */
  solid: Rect[];
  /** Openings in the frame of stiles and rails. */
  panels: { rect: Rect; kind: "flat" | "raised" | "glass" }[];
  /** x of the V-grooves between boards (planks only). */
  joints: number[];
}

/**
 * A leaf `w` × `h`, centred on x = 0 and standing on y = 0. Stiles and rails
 * follow joinery practice: 12 cm stiles and top rail, a 22 cm bottom rail
 * (30 cm under glass on balcony doors) and a lock rail near handle height.
 * Solid parts and panels tile the leaf exactly.
 */
export function leafParts(design: DoorDesign, w: number, h: number, opts: { balcony?: boolean } = {}): LeafParts {
  const L = -w / 2;
  const R = w / 2;
  const stile = Math.min(12, w * 0.18);
  const top = Math.min(12, h * 0.07);
  const bottom = opts.balcony ? 30 : Math.min(22, h * 0.12);
  const inner = { x0: L + stile, x1: R - stile, y0: bottom, y1: h - top };
  // The frame round the inner field: two stiles, top and bottom rail.
  const frame = [rect(L, 0, L + stile, h), rect(R - stile, 0, R, h), rect(inner.x0, h - top, inner.x1, h), rect(inner.x0, 0, inner.x1, bottom)];

  switch (design) {
    case "flush":
      return { solid: [rect(L, 0, R, h)], panels: [], joints: [] };
    case "planks": {
      // Tongue-and-groove boards about 12 cm wide.
      const n = Math.max(2, Math.round(w / 12));
      return { solid: [rect(L, 0, R, h)], panels: [], joints: Array.from({ length: n - 1 }, (_, i) => L + (w / n) * (i + 1)) };
    }
    case "shaker":
    case "full_lite":
      return { solid: frame, panels: [{ rect: rect(inner.x0, inner.y0, inner.x1, inner.y1), kind: design === "shaker" ? "flat" : "glass" }], joints: [] };
    case "three_lite": {
      // Three panes stacked, split by 6 cm glazing bars.
      const bar = 6;
      const pane = (inner.y1 - inner.y0 - 2 * bar) / 3;
      const ys = [0, 1, 2].map((i) => inner.y0 + i * (pane + bar));
      return {
        solid: [...frame, ...[1, 2].map((i) => rect(inner.x0, ys[i]! - bar, inner.x1, ys[i]!))],
        panels: ys.map((y) => ({ rect: rect(inner.x0, y, inner.x1, y + pane), kind: "glass" as const })),
        joints: [],
      };
    }
    case "four_panel": {
      // A lock rail at about 95 cm and a centre muntin make four raised panels.
      const lock = 16;
      const ly = Math.min(Math.max(inner.y0 + 20, 95 - lock / 2), inner.y1 - lock - 20);
      const mid = Math.min(10, (inner.x1 - inner.x0) * 0.2);
      const mx0 = -mid / 2;
      const mx1 = mid / 2;
      return {
        solid: [...frame, rect(inner.x0, ly, inner.x1, ly + lock), rect(mx0, inner.y0, mx1, ly), rect(mx0, ly + lock, mx1, inner.y1)],
        panels: [rect(inner.x0, inner.y0, mx0, ly), rect(mx1, inner.y0, inner.x1, ly), rect(inner.x0, ly + lock, mx0, inner.y1), rect(mx1, ly + lock, inner.x1, inner.y1)].map((r) => ({
          rect: r,
          kind: "raised" as const,
        })),
        joints: [],
      };
    }
  }
}

/* ---------------- windows ---------------- */

export interface Sash {
  rect: Rect;
  /** Which side the handle is on; the hinges are on the other. */
  handle: "left" | "right";
  /** Sliding windows: 0 runs on the inner track, 1 on the outer. */
  track: 0 | 1;
}

export interface WindowParts {
  /** Width of the outer frame members. */
  frame: number;
  sashes: Sash[];
  /** Glass set straight into the frame (fixed windows, top lights). */
  lites: Rect[];
  /** The horizontal frame member under a top light. */
  transom: Rect | null;
  /** Glazing bars, in window coordinates. */
  bars: Rect[];
}

/** A window `w` × `h` in its own frame: x from 0 along the wall, y up from the sill. */
export function windowParts(win: Window, design: WindowDesign): WindowParts {
  const style = windowStyle(win);
  const { width: w, height: h } = win;
  const f = style === "fixed" ? 5 : 6.5;
  const x0 = f;
  const x1 = w - f;
  let top = h - f;
  let transom: Rect | null = null;
  const lites: Rect[] = [];

  // A top light needs enough height left for an opening sash below it.
  if (design === "transom" && h >= 100) {
    const light = Math.min(45, Math.max(30, h * 0.25));
    transom = rect(x0, top - light - f, x1, top - light);
    lites.push(rect(x0, top - light, x1, top));
    top = transom.y0;
  }

  const sashes: Sash[] = [];
  const iw = x1 - x0;
  if (style === "fixed") {
    lites.push(rect(x0, f, x1, top));
  } else if (style === "sliding") {
    // Two sashes a little over half the width, overlapping at the meeting stiles.
    const sw = iw * 0.52;
    sashes.push({ rect: rect(x0, f, x0 + sw, top), handle: "right", track: 0 }, { rect: rect(x1 - sw, f, x1, top), handle: "left", track: 1 });
  } else {
    const n = Math.max(1, Math.round(iw / (style === "floor_to_ceiling" ? 90 : 75)));
    const sw = iw / n;
    for (let i = 0; i < n; i++) sashes.push({ rect: rect(x0 + i * sw, f, x0 + (i + 1) * sw, top), handle: i % 2 === 0 ? "right" : "left", track: 0 });
  }

  const bars: Rect[] = [];
  if (design === "grid") {
    const sashFrame = 5.5;
    const panes = [...sashes.map((s) => inset(s.rect, sashFrame)), ...lites.filter((l) => !transom || l.y0 < transom.y0)];
    for (const p of panes) bars.push(...gridBars(p));
  }
  return { frame: f, sashes, lites, transom, bars };
}

const inset = (r: Rect, d: number): Rect => rect(r.x0 + d, r.y0 + d, r.x1 - d, r.y1 - d);

/** Glazing bars dividing a pane into cells of roughly 35 × 40 cm. */
function gridBars(p: Rect): Rect[] {
  const bar = 2.5;
  const cols = Math.max(1, Math.round((p.x1 - p.x0) / 35));
  const rows = Math.max(1, Math.round((p.y1 - p.y0) / 40));
  const out: Rect[] = [];
  for (let i = 1; i < cols; i++) {
    const x = p.x0 + ((p.x1 - p.x0) * i) / cols;
    out.push(rect(x - bar / 2, p.y0, x + bar / 2, p.y1));
  }
  for (let j = 1; j < rows; j++) {
    const y = p.y0 + ((p.y1 - p.y0) * j) / rows;
    out.push(rect(p.x0, y - bar / 2, p.x1, y + bar / 2));
  }
  return out;
}

/* ---------------- radiators ---------------- */

/** Typical pitch of the repeated part of each radiator type, in cm. */
const PITCH: Readonly<Record<Exclude<RadiatorStyle, "towel">, number>> = {
  panel: 3.3, // pressed channels
  column: 4.6, // one cast or tubular section
  vertical: 8, // flat-oval tubes
  convector: 1.6, // grille bars
};

export interface RadiatorParts {
  /** How many repeated parts fill the width, and their exact pitch. */
  count: number;
  pitch: number;
  /** Towel rails: heights of the bars, bottom up. */
  bars: number[];
}

export function radiatorParts(style: RadiatorStyle, w: number, h: number): RadiatorParts {
  if (style === "towel") {
    // Groups of four bars 6 cm apart, with 14 cm gaps to hang towels.
    const bars: number[] = [];
    let y = 4;
    while (y < h - 3) {
      for (let i = 0; i < 4 && y < h - 3; i++, y += 6) bars.push(y);
      y += 8;
    }
    return { count: 2, pitch: w, bars };
  }
  const count = Math.max(2, Math.round(w / PITCH[style]));
  return { count, pitch: w / count, bars: [] };
}

/* ---------------- skirting ---------------- */

/** A skirting run in plan coordinates; closed when it goes all the way round. */
export interface SkirtingPath {
  closed: boolean;
  points: Vec[];
}

const MIN_RUN = 10;

/**
 * Where skirting boards run: along every wall, broken at doors and at glazing
 * that reaches down past the board. Corners stay joined, so the 3D boards
 * can be mitred like a fitter would.
 */
export function skirtingPaths(walls: readonly Wall[], openings: readonly Opening[], boardHeight: number): SkirtingPath[] {
  const n = walls.length;
  const starts: number[] = [];
  let perimeter = 0;
  for (const w of walls) {
    starts.push(perimeter);
    perimeter += w.length;
  }
  // Gaps as perimeter intervals, overlapping ones merged.
  const raw = openings
    .filter((o) => o.kind === "door" || (o.kind === "window" && o.sillHeight < boardHeight))
    .flatMap((o) => (walls[o.wallIndex] ? [[starts[o.wallIndex]! + Math.max(0, o.offset), starts[o.wallIndex]! + Math.min(walls[o.wallIndex]!.length, o.offset + o.width)] as const] : []))
    .sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  for (const [a, b] of raw) {
    const last = gaps.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else gaps.push([a, b]);
  }
  if (!gaps.length) return [{ closed: true, points: walls.map((w) => w.a) }];

  const at = (t: number): Vec => {
    const u = ((t % perimeter) + perimeter) % perimeter;
    let i = n - 1;
    while (i > 0 && starts[i]! > u) i--;
    return pointOnWall(walls[i]!, u - starts[i]!);
  };
  /** Wall corners strictly between perimeter positions a < b (b may pass the start). */
  const cornersBetween = (a: number, b: number): Vec[] => {
    const out: Vec[] = [];
    for (let lap = 0; lap <= 1; lap++)
      for (let i = 0; i < n; i++) {
        const t = starts[i]! + lap * perimeter;
        if (t > a + 1e-6 && t < b - 1e-6) out.push(walls[i]!.a);
      }
    return out;
  };

  const paths: SkirtingPath[] = [];
  for (let g = 0; g < gaps.length; g++) {
    const from = gaps[g]![1];
    let to = gaps[(g + 1) % gaps.length]![0];
    if (g === gaps.length - 1) to += perimeter;
    if (to - from < MIN_RUN) continue;
    paths.push({ closed: false, points: [at(from), ...cornersBetween(from, to), at(to)] });
  }
  return paths;
}

/** One wall's share of a skirting run, with the points it mitres into. */
export interface SkirtingPiece {
  wallIndex: number;
  a: Vec;
  b: Vec;
  before?: Vec;
  after?: Vec;
}

/**
 * skirtingPaths split wall by wall, so each piece can hide with its wall in
 * the cut-away view while its ends are still mitred to the next.
 */
export function skirtingPieces(walls: readonly Wall[], openings: readonly Opening[], boardHeight: number): SkirtingPiece[] {
  const onWall = (a: Vec, b: Vec) => {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let best = 0;
    let bestD = Infinity;
    for (const w of walls) {
      const t = Math.max(0, Math.min(w.length, (m.x - w.a.x) * w.dir.x + (m.y - w.a.y) * w.dir.y));
      const p = pointOnWall(w, t);
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bestD) [best, bestD] = [w.index, d];
    }
    return best;
  };
  return skirtingPaths(walls, openings, boardHeight).flatMap(({ closed, points: p }) => {
    const k = p.length;
    const segs = closed ? k : k - 1;
    return Array.from({ length: segs }, (_, i) => {
      const a = p[i]!;
      const b = p[(i + 1) % k]!;
      const before = i > 0 ? p[i - 1] : closed ? p[k - 1] : undefined;
      const after = i + 2 < k ? p[i + 2] : closed ? p[(i + 2) % k] : undefined;
      return { wallIndex: onWall(a, b), a, b, ...(before ? { before } : {}), ...(after ? { after } : {}) };
    });
  });
}
