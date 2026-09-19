import { bbox, containsPoint } from "./polygon";
import type { Vec } from "./vec";

/** Occupancy grid over a room, for walkway checks. */
export interface Grid {
  x0: number;
  y0: number;
  cell: number;
  cols: number;
  rows: number;
  /** 1 = blocked (outside room or occupied). */
  blocked: Uint8Array;
}

export const GRID_CELL_CM = 5;

export function cellCenter(g: Grid, i: number): Vec {
  const c = i % g.cols;
  const r = Math.floor(i / g.cols);
  return { x: g.x0 + (c + 0.5) * g.cell, y: g.y0 + (r + 0.5) * g.cell };
}

export function cellIndex(g: Grid, p: Vec): number | null {
  const c = Math.floor((p.x - g.x0) / g.cell);
  const r = Math.floor((p.y - g.y0) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
  return r * g.cols + c;
}

/** Rasterise: a cell is free when its centre is inside the room and outside every obstacle. */
export function rasterise(room: readonly Vec[], obstacles: readonly (readonly Vec[])[], cell = GRID_CELL_CM): Grid {
  const b = bbox(room);
  const cols = Math.max(1, Math.ceil(b.w / cell));
  const rows = Math.max(1, Math.ceil(b.d / cell));
  const g: Grid = { x0: b.x, y0: b.y, cell, cols, rows, blocked: new Uint8Array(cols * rows) };
  const boxes = obstacles.map((o) => ({ poly: o, box: bbox(o) }));
  for (let i = 0; i < cols * rows; i++) {
    const p = cellCenter(g, i);
    if (!containsPoint(room, p)) {
      g.blocked[i] = 1;
      continue;
    }
    for (const { poly, box } of boxes) {
      if (p.x < box.x || p.x > box.x + box.w || p.y < box.y || p.y > box.y + box.d) continue;
      if (containsPoint(poly, p)) {
        g.blocked[i] = 1;
        break;
      }
    }
  }
  return g;
}

/**
 * Approximate Euclidean distance (cm) from each free cell centre to the
 * nearest blocked cell or room edge (two-pass chamfer 3-4 transform).
 */
export function clearance(g: Grid): Float32Array {
  const { cols, rows } = g;
  const INF = 1e9;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = g.blocked[i] ? 0 : INF;
  const a = 1;
  const diag = Math.SQRT2;
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : d[r * cols + c]!);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, at(c - 1, r) + a, at(c, r - 1) + a, at(c - 1, r - 1) + diag, at(c + 1, r - 1) + diag);
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, at(c + 1, r) + a, at(c, r + 1) + a, at(c + 1, r + 1) + diag, at(c - 1, r + 1) + diag);
    }
  }
  // Cells → cm. A free cell next to an obstacle has distance 1 cell; its centre sits half a cell from it.
  for (let i = 0; i < d.length; i++) if (d[i]! > 0) d[i] = (d[i]! - 0.5) * g.cell;
  return d;
}

/** Flood fill (4-neighbour) over cells with clearance ≥ `minClear`, starting from `seeds`. */
export function reachable(g: Grid, clear: Float32Array, minClear: number, seeds: readonly number[]): Uint8Array {
  const seen = new Uint8Array(g.cols * g.rows);
  const stack: number[] = [];
  for (const s of seeds) {
    if (clear[s]! >= minClear && !seen[s]) {
      seen[s] = 1;
      stack.push(s);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    const next = [c > 0 ? i - 1 : -1, c < g.cols - 1 ? i + 1 : -1, r > 0 ? i - g.cols : -1, r < g.rows - 1 ? i + g.cols : -1];
    for (const n of next) {
      if (n < 0 || seen[n] || clear[n]! < minClear) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

/** Cells whose centre lies inside `poly`. */
export function cellsIn(g: Grid, poly: readonly Vec[]): number[] {
  const b = bbox(poly);
  const out: number[] = [];
  const c0 = Math.max(0, Math.floor((b.x - g.x0) / g.cell));
  const c1 = Math.min(g.cols - 1, Math.floor((b.x + b.w - g.x0) / g.cell));
  const r0 = Math.max(0, Math.floor((b.y - g.y0) / g.cell));
  const r1 = Math.min(g.rows - 1, Math.floor((b.y + b.d - g.y0) / g.cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * g.cols + c;
      if (containsPoint(poly, cellCenter(g, i))) out.push(i);
    }
  }
  return out;
}
