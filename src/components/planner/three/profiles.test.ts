import { describe, expect, it } from "vitest";
import { TrimProfile } from "@/domain/room/fit-out";
import { architrave, GLAZING_BEAD, PANEL_MOULD, RAISED_FIELD, SASH, skirting, WINDOW_BOARD, WINDOW_FRAME } from "./profiles";
import { sweep, type P2 } from "./sweep";

const box = (p: readonly P2[]) => [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];

/** True when no two non-adjacent edges cross. */
function simple(p: readonly P2[]): boolean {
  const cross = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const n = p.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, d] = [p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  return true;
}

const all: [string, P2[]][] = [
  ...TrimProfile.options.flatMap((t) => [
    [`architrave ${t}`, architrave(t)] as [string, P2[]],
    [`skirting ${t}`, skirting(t, 10)] as [string, P2[]],
  ]),
  ["bead", GLAZING_BEAD],
  ["panel mould", PANEL_MOULD],
  ["raised field", RAISED_FIELD(1.4)],
  ["window frame", WINDOW_FRAME],
  ["sash", SASH],
  ["window board", WINDOW_BOARD(18)],
];

describe("profiles", () => {
  it.each(all)("%s is a simple polygon that sweeps cleanly", (_, p) => {
    expect(simple(p)).toBe(true);
    const g = sweep(p, [
      [0, 0],
      [30, 0],
    ]);
    expect(g.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("sits on its base line at u, v ≥ 0", () => {
    for (const [name, p] of all) {
      const [u0, v0] = box(p);
      expect(u0, name).toBeGreaterThanOrEqual(0);
      expect(v0, name).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("makes skirting exactly the chosen height and architraves 7 cm wide", () => {
    for (const t of TrimProfile.options) {
      expect(box(skirting(t, 12))[3]).toBeCloseTo(12, 6);
      expect(box(architrave(t))[2]).toBeCloseTo(7, 6);
    }
  });
});
