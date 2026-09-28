import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { rectPath, sweep, type P2 } from "./sweep";

/** Signed volume by the divergence theorem: positive when every face points outwards. */
function volume(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute("position");
  const idx = g.getIndex()!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  return [min.x, min.y, min.z, max.x, max.y, max.z].map((n) => Math.round(n * 1000) / 1000 + 0);
};

const SQUARE: P2[] = [
  [0, 0],
  [2, 0],
  [2, 1],
  [0, 1],
];

describe("sweep", () => {
  it("sweeps a profile along a straight run, capped, at exact size", () => {
    const g = sweep(SQUARE, [
      [0, 0],
      [10, 0],
    ]);
    // u offsets to the left of the path (+y here), v is height (+z).
    expect(bounds(g)).toEqual([0, 0, 0, 10, 2, 1]);
    expect(volume(g)).toBeCloseTo(20, 6);
  });

  it("mitres a closed frame so its outside is the path and its inside is inset by the profile", () => {
    const g = sweep(SQUARE, rectPath(0, 0, 10, 6), { closed: true });
    expect(bounds(g)).toEqual([0, 0, 0, 10, 6, 1]);
    // A 10 × 6 frame of 2 wide members: the ring's area times the 1 cm depth.
    expect(volume(g)).toBeCloseTo((10 * 6 - 6 * 2) * 1, 6);
  });

  it("turns an open corner with a mitre and keeps both ends square", () => {
    // An architrave: up one jamb, across the head, down the other.
    const g = sweep(SQUARE, [
      [0, 0],
      [0, 20],
      [10, 20],
      [10, 0],
    ]);
    // Walking up the left jamb, "left" is −x, so the profile lies outside the path.
    expect(bounds(g)).toEqual([-2, 0, 0, 12, 22, 1]);
    expect(volume(g)).toBeGreaterThan(0);
  });

  it("gives unit normals and UVs in cm along the run", () => {
    const g = sweep(SQUARE, [
      [0, 0],
      [50, 0],
    ]);
    const n = g.getAttribute("normal");
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
    const uv = g.getAttribute("uv");
    let maxU = 0;
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
    expect(maxU).toBeCloseTo(50, 5);
  });

  it("draws a run in pieces that still meet in a mitre", () => {
    const whole = sweep(SQUARE, [
      [0, 0],
      [10, 0],
      [10, 8],
    ]);
    const a = sweep(SQUARE, [[0, 0], [10, 0]], { after: [10, 8] });
    const b = sweep(SQUARE, [[10, 0], [10, 8]], { before: [0, 0] });
    // The pieces together bound the same solid (their open joint faces cancel out).
    expect(volume(a) + volume(b)).toBeCloseTo(volume(whole), 6);
    expect(bounds(a)).toEqual([0, 0, 0, 10, 2, 1]);
  });

  it("accepts profiles in either winding", () => {
    const g = sweep([...SQUARE].reverse(), [
      [0, 0],
      [10, 0],
    ]);
    expect(volume(g)).toBeCloseTo(20, 6);
  });
});
