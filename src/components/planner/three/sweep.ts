import * as THREE from "three";

/** A 2D point in cm. */
export type P2 = readonly [number, number];

/**
 * Sweeps a closed cross-section along a path in the x–y plane, the way a
 * joiner runs a moulding: the result has exactly the path's length, corners
 * are mitred, and open ends are capped.
 *
 * - Profile point (u, v): u is the offset to the left of the path's
 *   direction (in the x–y plane), v is height along +z.
 * - A counter-clockwise closed path (see rectPath) therefore puts the
 *   profile inside it: a frame whose outer edge is the path.
 * - UVs are in cm: x along the run, y around the profile, so wood grain
 *   follows each member.
 * - `before` / `after` (open paths): the points the run would continue to.
 *   Its ends are then mitred to meet those neighbours and left uncapped, so
 *   one run can be drawn in pieces that still join.
 */
export function sweep(
  profile: readonly P2[],
  run0: readonly P2[],
  opts: { closed?: boolean; smoothDeg?: number; before?: P2; after?: P2 } = {},
): THREE.BufferGeometry {
  const closed = opts.closed ?? false;
  const prof = counterClockwise(profile);
  const before = closed ? undefined : opts.before;
  const after = closed ? undefined : opts.after;
  const path = [...(before ? [before] : []), ...run0, ...(after ? [after] : [])];
  const n = path.length;
  const first = before ? 1 : 0;
  const segs = closed ? n : n - 1 - (after ? 1 : 0);
  if (segs - first < 1 || prof.length < 3) throw new Error("sweep needs a path segment and a profile polygon");

  const dir = (k: number) => unit(sub(path[(k + 1) % n]!, path[k]!));
  const left = (d: P2): P2 => [-d[1], d[0]];

  /** Offset direction at path vertex k, scaled so offsets keep their distance from both segments. */
  function mitre(k: number): P2 {
    const hasIn = closed || k > 0;
    const hasOut = closed || k < n - 1;
    const nIn = hasIn ? left(dir((k - 1 + n) % n)) : null;
    const nOut = hasOut ? left(dir(k % n)) : null;
    if (!nIn) return nOut!;
    if (!nOut) return nIn;
    const m = unit([nIn[0] + nOut[0], nIn[1] + nOut[1]]);
    const cos = m[0] * nIn[0] + m[1] * nIn[1];
    return [m[0] / cos, m[1] / cos];
  }

  const edgeNormals = profileEdgeNormals(prof);
  const cornerCos = Math.cos(((opts.smoothDeg ?? 30) * Math.PI) / 180);
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  // Cumulative profile perimeter, for the v texture coordinate.
  const perim = [0];
  for (let i = 0; i < prof.length; i++) perim.push(perim[i]! + dist(prof[i]!, prof[(i + 1) % prof.length]!));

  let run = 0;
  for (let k = first; k < segs; k++) {
    const a = path[k]!;
    const b = path[(k + 1) % n]!;
    const d = dir(k);
    const segN = left(d);
    const ma = mitre(k);
    const mb = mitre((k + 1) % n);
    const len = dist(a, b);
    for (let i = 0; i < prof.length; i++) {
      const j = (i + 1) % prof.length;
      const p0 = prof[i]!;
      const p1 = prof[j]!;
      // Smooth across gentle profile corners, crisp across sharp ones.
      const n0 = vertexNormal(edgeNormals, i, -1, cornerCos);
      const n1 = vertexNormal(edgeNormals, i, +1, cornerCos);
      const base = pos.length / 3;
      for (const [vertex, m, p, pn, along, v] of [
        [a, ma, p0, n0, run, perim[i]!],
        [a, ma, p1, n1, run, perim[i + 1]!],
        [b, mb, p1, n1, run + len, perim[i + 1]!],
        [b, mb, p0, n0, run + len, perim[i]!],
      ] as const) {
        pos.push(vertex[0] + m[0] * p[0], vertex[1] + m[1] * p[0], p[1]);
        const nx = pn[0] * segN[0];
        const ny = pn[0] * segN[1];
        const nz = pn[1];
        const l = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / l, ny / l, nz / l);
        uvs.push(along, v);
      }
      pushQuad(idx, pos, base, [nor[base * 3]!, nor[base * 3 + 1]!, nor[base * 3 + 2]!]);
    }
    run += len;
  }

  if (!closed && !before) cap(path[0]!, mitre(0), [-dir(0)[0], -dir(0)[1]]);
  if (!closed && !after) cap(path[n - 1]!, mitre(n - 1), dir(n - 2));

  function cap(p: P2, m: P2, outward: P2) {
    const tris = THREE.ShapeUtils.triangulateShape(
      prof.map(([u, v]) => new THREE.Vector2(u, v)),
      [],
    );
    const base = pos.length / 3;
    for (const [u, v] of prof) {
      pos.push(p[0] + m[0] * u, p[1] + m[1] * u, v);
      nor.push(outward[0], outward[1], 0);
      uvs.push(u, v);
    }
    for (const t of tris) orient(idx, pos, base + t[0]!, base + t[1]!, base + t[2]!, [outward[0], outward[1], 0]);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Two triangles over a quad, wound to face along `normal`. */
function pushQuad(idx: number[], pos: number[], base: number, normal: [number, number, number]) {
  orient(idx, pos, base, base + 1, base + 2, normal);
  orient(idx, pos, base, base + 2, base + 3, normal);
}

function orient(idx: number[], pos: number[], a: number, b: number, c: number, normal: readonly [number, number, number]) {
  const v = (i: number) => [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!] as const;
  const [pa, pb, pc] = [v(a), v(b), v(c)];
  const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
  const cx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
  const cy = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
  const cz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
  if (cx * normal[0] + cy * normal[1] + cz * normal[2] >= 0) idx.push(a, b, c);
  else idx.push(a, c, b);
}

/** Outward normal of each profile edge (the polygon is counter-clockwise). */
function profileEdgeNormals(prof: readonly P2[]): P2[] {
  return prof.map((p, i) => {
    const q = prof[(i + 1) % prof.length]!;
    return unit([q[1] - p[1], -(q[0] - p[0])]);
  });
}

/** Normal at one end of edge i: shared with the neighbouring edge when the corner between them is gentle. */
function vertexNormal(edges: readonly P2[], i: number, end: -1 | 1, cornerCos: number): P2 {
  const e = edges[i]!;
  const k = (i + end + edges.length) % edges.length;
  const o = edges[k]!;
  if (e[0] * o[0] + e[1] * o[1] < cornerCos) return e;
  return unit([e[0] + o[0], e[1] + o[1]]);
}

function counterClockwise(p: readonly P2[]): P2[] {
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area >= 0 ? [...p] : [...p].reverse();
}

const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function unit(v: P2): P2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** A counter-clockwise rectangle, so a swept profile lies inside it. */
export const rectPath = (x0: number, y0: number, x1: number, y1: number): P2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
