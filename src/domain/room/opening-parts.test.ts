import { describe, expect, it } from "vitest";
import { wallsOf } from "../geometry/walls";
import type { Door, Window } from "../schemas/room";
import { DoorDesign } from "../schemas/room";
import { leafParts, radiatorParts, type Rect, skirtingPaths, skirtingPieces, windowParts } from "./opening-parts";

const area = (r: Rect) => (r.x1 - r.x0) * (r.y1 - r.y0);
const inside = (r: Rect, w: number, h: number) => r.x0 >= -w / 2 - 1e-9 && r.x1 <= w / 2 + 1e-9 && r.y0 >= -1e-9 && r.y1 <= h + 1e-9;

describe("leafParts", () => {
  it.each(DoorDesign.options)("%s tiles the whole leaf with no overlaps", (design) => {
    for (const [w, h] of [
      [82, 198],
      [40, 198],
      [120, 230],
    ] as const) {
      const p = leafParts(design, w, h);
      const rects = [...p.solid, ...p.panels.map((x) => x.rect)];
      for (const r of rects) expect(inside(r, w, h), `${design} ${JSON.stringify(r)}`).toBe(true);
      expect(rects.reduce((s, r) => s + area(r), 0)).toBeCloseTo(w * h, 6);
    }
  });

  it("gives each design its panels", () => {
    expect(leafParts("flush", 82, 198).panels).toEqual([]);
    expect(leafParts("shaker", 82, 198).panels.map((p) => p.kind)).toEqual(["flat"]);
    expect(leafParts("four_panel", 82, 198).panels.map((p) => p.kind)).toEqual(["raised", "raised", "raised", "raised"]);
    expect(leafParts("three_lite", 82, 198).panels.map((p) => p.kind)).toEqual(["glass", "glass", "glass"]);
    expect(leafParts("full_lite", 82, 198).panels.map((p) => p.kind)).toEqual(["glass"]);
    expect(leafParts("planks", 82, 198).joints.length).toBeGreaterThan(3);
  });

  it("puts a solid kick panel under the glass of a balcony door", () => {
    const glass = leafParts("full_lite", 90, 215, { balcony: true }).panels[0]!.rect;
    expect(glass.y0).toBeGreaterThanOrEqual(30);
  });

  it("keeps stiles in proportion on narrow bifold panels", () => {
    const p = leafParts("shaker", 40, 198);
    expect(p.panels[0]!.rect.x1 - p.panels[0]!.rect.x0).toBeGreaterThan(20);
  });
});

const win = (o: Partial<Window>): Window => ({ id: "w", kind: "window", wallIndex: 0, offset: 0, width: 120, height: 140, sillHeight: 90, openable: true, ...o });

describe("windowParts", () => {
  it("splits wide casements into sashes about 75 cm wide", () => {
    expect(windowParts(win({ style: "casement", width: 150 }), "plain").sashes).toHaveLength(2);
    expect(windowParts(win({ style: "tilt_turn", width: 70 }), "plain").sashes).toHaveLength(1);
  });

  it("glazes a fixed window straight into the frame", () => {
    const p = windowParts(win({ style: "fixed" }), "plain");
    expect(p.sashes).toEqual([]);
    expect(p.lites).toHaveLength(1);
  });

  it("puts sliding sashes on two tracks, overlapping in the middle", () => {
    const [a, b] = windowParts(win({ style: "sliding", width: 200 }), "plain").sashes;
    expect([a!.track, b!.track]).toEqual([0, 1]);
    expect(a!.rect.x1).toBeGreaterThan(b!.rect.x0);
  });

  it("adds a fixed top light over a transom", () => {
    const p = windowParts(win({ style: "casement", height: 160 }), "transom");
    expect(p.transom).not.toBeNull();
    expect(p.lites).toHaveLength(1);
    expect(p.lites[0]!.y0).toBeGreaterThan(p.sashes[0]!.rect.y1);
  });

  it("divides panes into a grid of glazing bars", () => {
    expect(windowParts(win({ style: "casement", width: 150 }), "grid").bars.length).toBeGreaterThan(0);
    expect(windowParts(win({ style: "casement", width: 150 }), "plain").bars).toEqual([]);
  });

  it("keeps every sash and lite inside the frame", () => {
    for (const style of ["casement", "tilt_turn", "sliding", "fixed", "floor_to_ceiling"] as const) {
      const w = win({ style, width: 180, height: 150 });
      const p = windowParts(w, "transom");
      for (const r of [...p.sashes.map((s) => s.rect), ...p.lites]) {
        expect(r.x0).toBeGreaterThanOrEqual(p.frame - 1e-9);
        expect(r.x1).toBeLessThanOrEqual(w.width - p.frame + 1e-9);
        expect(r.y1).toBeLessThanOrEqual(w.height - p.frame + 1e-9);
      }
    }
  });
});

describe("radiatorParts", () => {
  it("fills the width exactly with whole sections", () => {
    for (const style of ["panel", "column", "vertical", "convector"] as const) {
      const p = radiatorParts(style, 100, 60);
      expect(p.count * p.pitch).toBeCloseTo(100, 6);
    }
  });

  it("uses real section pitches", () => {
    expect(radiatorParts("column", 100, 60).pitch).toBeCloseTo(100 / 22, 6);
    expect(radiatorParts("panel", 100, 60).pitch).toBeGreaterThan(3);
  });

  it("stacks towel-rail bars in groups with gaps for towels", () => {
    const { bars } = radiatorParts("towel", 50, 120);
    const gaps = bars.slice(1).map((y, i) => y - bars[i]!);
    expect(Math.max(...gaps)).toBeGreaterThan(Math.min(...gaps) * 1.5);
    expect(bars.every((y) => y > 0 && y < 120)).toBe(true);
  });
});

describe("skirtingPaths", () => {
  // A 400 × 300 room, clockwise in y-down plan coordinates.
  const square = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ];
  const walls = wallsOf(square);
  const door = (o: Partial<Door>): Door => ({ id: "d", kind: "door", wallIndex: 0, offset: 100, width: 90, height: 200, hinge: "start", swing: "in", ...o });

  it("runs all the way round a room without doors", () => {
    expect(skirtingPaths(walls, [], 8)).toEqual([{ closed: true, points: square }]);
  });

  it("breaks at a door and turns every corner in between", () => {
    const [run] = skirtingPaths(walls, [door({})], 8);
    expect(run!.closed).toBe(false);
    expect(run!.points[0]).toEqual({ x: 190, y: 0 });
    expect(run!.points.at(-1)).toEqual({ x: 100, y: 0 });
    expect(run!.points).toHaveLength(6);
  });

  it("breaks at floor-level glazing but not under ordinary windows", () => {
    const low = win({ wallIndex: 1, offset: 50, width: 100, sillHeight: 0 });
    const high = win({ wallIndex: 2, offset: 50, width: 100, sillHeight: 90 });
    expect(skirtingPaths(walls, [low, high], 8)).toHaveLength(1);
    expect(skirtingPaths(walls, [low, high], 8)[0]!.closed).toBe(false);
  });

  it("treats overlapping openings as one gap", () => {
    const paths = skirtingPaths(walls, [door({ offset: 100, width: 90 }), door({ id: "e", offset: 150, width: 90 })], 8);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.points[0]).toEqual({ x: 240, y: 0 });
  });

  it("drops runs too short to fit a board", () => {
    const paths = skirtingPaths(walls, [door({ offset: 0, width: 90 }), door({ id: "e", offset: 91, width: 90 })], 8);
    expect(paths.every((p) => p.points.length >= 2)).toBe(true);
    expect(paths).toHaveLength(1);
  });
});

describe("skirtingPieces", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ];
  const walls = wallsOf(square);

  it("gives each wall its piece, mitred to both neighbours in a closed room", () => {
    const pieces = skirtingPieces(walls, [], 8);
    expect(pieces.map((p) => p.wallIndex)).toEqual([0, 1, 2, 3]);
    expect(pieces[0]).toEqual({ wallIndex: 0, a: square[0], b: square[1], before: square[3], after: square[2] });
  });

  it("leaves the ends at a door square", () => {
    const door: Door = { id: "d", kind: "door", wallIndex: 0, offset: 100, width: 90, height: 200, hinge: "start", swing: "in" };
    const pieces = skirtingPieces(walls, [door], 8);
    expect(pieces).toHaveLength(5);
    expect(pieces[0]!.before).toBeUndefined();
    expect(pieces.at(-1)!.after).toBeUndefined();
    expect(pieces.map((p) => p.wallIndex)).toEqual([0, 1, 2, 3, 0]);
  });
});
