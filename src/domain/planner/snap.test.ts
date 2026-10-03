import { describe, expect, it } from "vitest";
import { snapOffset, snapPoint, snapStraight, type SnapTargets } from "./snap";

// Another room's corners at (0,0), (300,0), (300,200), (0,200).
const targets: SnapTargets = {
  points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
  segments: [
    [{ x: 0, y: 0 }, { x: 300, y: 0 }],
    [{ x: 300, y: 0 }, { x: 300, y: 200 }],
  ],
};

describe("snapPoint", () => {
  it("lands exactly on a corner within reach, with a ring to show it", () => {
    const s = snapPoint({ x: 304, y: 197 }, targets, 8);
    expect(s.p).toEqual({ x: 300, y: 200 });
    expect(s.ring).toEqual({ x: 300, y: 200 });
  });

  it("lands on a wall when no corner is in reach", () => {
    const s = snapPoint({ x: 150, y: 5 }, targets, 8);
    expect(s.p).toEqual({ x: 150, y: 0 });
  });

  it("lines up across and down with corners further away, with a guide to each", () => {
    const s = snapPoint({ x: 296, y: 500 }, targets, 8);
    expect(s.p).toEqual({ x: 300, y: 500 });
    expect(s.guides).toEqual([{ from: { x: 300, y: 200 }, to: { x: 300, y: 500 } }]);
    const both = snapPoint({ x: 503, y: 197 }, { points: [{ x: 500, y: 0 }, { x: 0, y: 200 }], segments: [] }, 8);
    expect(both.p).toEqual({ x: 500, y: 200 });
    expect(both.guides).toHaveLength(2);
  });

  it("leaves the point alone when nothing is in reach", () => {
    const s = snapPoint({ x: 150, y: 100 }, targets, 8);
    expect(s.p).toEqual({ x: 150, y: 100 });
    expect(s.guides).toEqual([]);
    expect(s.snapped).toBe(false);
  });
});

describe("snapStraight", () => {
  it("keeps the point straight across, down or at 45° from the nearest anchor", () => {
    expect(snapStraight({ x: 200, y: 12 }, [{ x: 0, y: 0 }], { points: [], segments: [] }, 8).p).toEqual({ x: 200, y: 0 });
    expect(snapStraight({ x: 9, y: 150 }, [{ x: 0, y: 0 }], { points: [], segments: [] }, 8).p).toEqual({ x: 0, y: 150 });
    expect(snapStraight({ x: 100, y: 104 }, [{ x: 0, y: 0 }], { points: [], segments: [] }, 8).p).toEqual({ x: 102, y: 102 });
  });

  it("still lines up along the free direction", () => {
    // Straight across from (0,500), and lined up with the corner at x = 300.
    const s = snapStraight({ x: 297, y: 506 }, [{ x: 0, y: 500 }], targets, 8);
    expect(s.p).toEqual({ x: 300, y: 500 });
  });
});

describe("snapOffset", () => {
  it("moves a whole shape so its nearest corner lines up, in each direction separately", () => {
    const room = [{ x: 305, y: 50 }, { x: 505, y: 50 }, { x: 505, y: 196 }, { x: 305, y: 196 }];
    const s = snapOffset(room, targets, 8);
    expect(s.dx).toBe(-5);
    expect(s.dy).toBe(4);
    expect(s.guides.length).toBeGreaterThan(0);
  });

  it("does not move it when nothing is near", () => {
    expect(snapOffset([{ x: 1000, y: 1000 }], targets, 8)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});
