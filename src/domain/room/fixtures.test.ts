import { describe, expect, it } from "vitest";
import { keepClearZones } from "../geometry/zones";
import { bbox } from "../geometry/polygon";
import { wallsOf } from "../geometry/walls";
import { FixedElement } from "../schemas/room";
import { FIXTURE_KINDS, FIXTURE_SPEC, fixtureFront, fixtureSize, fixtureWall, frontZone, isCeilingKind, kitchenSlots, placeCeilingFixture, placeFixture, resizeFixture } from "./fixtures";

// A 400 × 300 room, clockwise in y-down plan coordinates: wall 0 runs along the top (y = 0).
const room = {
  polygon: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ],
};

describe("placeFixture", () => {
  it("puts a fixture's back against the wall, facing into the room", () => {
    const wc = placeFixture(room, "wc", "wc-1", "WC", 0, 100)!;
    expect(wc.rect).toEqual({ x: 81, y: 0, w: 38, d: 60 });
    expect(wc.facing).toBe(180);
    expect(fixtureFront(wc)).toEqual({ x: 0, y: 1 });
    expect(FixedElement.safeParse(wc).success).toBe(true);
  });

  it("turns its footprint on side walls", () => {
    const bath = placeFixture(room, "bathtub", "bath-1", "Bath", 1, 150)!;
    // Wall 1 runs down the right side (x = 400); the bath faces west.
    expect(bath.rect).toEqual({ x: 325, y: 65, w: 75, d: 170 });
    expect(bath.facing).toBe(270);
  });

  it("keeps the fixture on its wall and shrinks it to short walls", () => {
    expect(placeFixture(room, "kitchen_run", "k-1", "Kitchen", 0, 390)!.rect.x).toBe(160);
    const short = { polygon: [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 300 }, { x: 0, y: 300 }] };
    expect(placeFixture(short, "kitchen_run", "k-1", "Kitchen", 0, 75)!.rect.w).toBe(150);
  });

  it("starts a kitchen run with a sink, hob, oven and wall units", () => {
    expect(placeFixture(room, "kitchen_run", "k-1", "Kitchen", 0, 200)!.kitchen).toEqual({ sink: true, hob: true, oven: true, wallUnits: true });
  });

  it("refuses slanted walls", () => {
    const slanted = { polygon: [{ x: 0, y: 0 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 0, y: 300 }] };
    expect(placeFixture(slanted, "wc", "wc-1", "WC", 0, 100)).toBeNull();
  });
});

describe("ceiling fixtures", () => {
  it("centres a light on the point and marks it as ceiling-mounted", () => {
    const lamp = placeCeilingFixture("pendant", "p-1", "Pendant", { x: 200, y: 150 });
    expect(lamp.rect).toEqual({ x: 180, y: 130, w: 40, d: 40 });
    expect(isCeilingKind(lamp.kind)).toBe(true);
  });

  it("never blocks the floor", () => {
    const lamp = placeCeilingFixture("chandelier", "c-1", "Light", { x: 200, y: 150 });
    expect(keepClearZones({ ...room, openings: [], fixedElements: [lamp] })).toEqual([]);
  });
});

describe("frontZone", () => {
  it("keeps the fixture's own clearance free in front of it", () => {
    const wc = placeFixture(room, "wc", "wc-1", "WC", 0, 100)!;
    expect(bbox(frontZone(wc)!)).toEqual({ x: 81, y: 60, w: 38, d: FIXTURE_SPEC.wc.front });
    const kinds = keepClearZones({ ...room, openings: [], fixedElements: [wc] }).map((z) => z.kind);
    expect(kinds).toEqual(["fixed", "fixture_front"]);
  });

  it("has none for older fixed elements without a front", () => {
    const chimney = { id: "c", label: "Chimney", kind: "chimney" as const, rect: { x: 0, y: 0, w: 40, d: 40 }, height: 250 };
    expect(frontZone(chimney)).toBeNull();
  });
});

describe("FIXTURE_SPEC", () => {
  it("gives every floor fixture a real size and clearance", () => {
    for (const k of FIXTURE_KINDS) {
      const s = FIXTURE_SPEC[k];
      expect(s.w * s.d * s.h, k).toBeGreaterThan(0);
      if (!isCeilingKind(k)) expect(s.front, k).toBeGreaterThanOrEqual(60);
    }
  });

  it("fits walls from the room's own geometry", () => {
    expect(wallsOf(room.polygon)).toHaveLength(4);
  });
});

describe("kitchenSlots", () => {
  const widths = (l: number, o = { sink: true, cooker: true }) => kitchenSlots(l, o).map((s) => [s.unit, Math.round((s.to - s.from) * 10) / 10]);

  it("fills the run exactly with standard modules", () => {
    for (const l of [120, 180, 240, 300, 347]) {
      const slots = kitchenSlots(l, { sink: true, cooker: true });
      expect(slots[0]!.from).toBe(0);
      expect(slots.at(-1)!.to).toBeCloseTo(l, 6);
      for (let i = 1; i < slots.length; i++) expect(slots[i]!.from).toBeCloseTo(slots[i - 1]!.to, 6);
    }
  });

  it("puts the sink and cooker between base units", () => {
    expect(widths(300)).toEqual([["base", 53.3], ["sink", 80], ["base", 53.3], ["cooker", 60], ["base", 53.3]]);
  });

  it("leaves out what does not fit or is not wanted", () => {
    expect(widths(240, { sink: false, cooker: false })).toEqual([["base", 60], ["base", 60], ["base", 60], ["base", 60]]);
    expect(widths(100).map(([u]) => u)).toEqual(["sink"]);
  });
});

describe("fixtureWall", () => {
  const walls = wallsOf(room.polygon);
  it("finds the wall a fixture stands against", () => {
    expect(fixtureWall(walls, placeFixture(room, "wc", "wc-1", "WC", 0, 100)!)?.index).toBe(0);
    expect(fixtureWall(walls, placeFixture(room, "bathtub", "b", "Bath", 1, 150)!)?.index).toBe(1);
    expect(fixtureWall(walls, placeFixture(room, "basin", "b", "Basin", 2, 150)!)?.index).toBe(2);
  });
  it("has none for lights", () => {
    expect(fixtureWall(walls, placeCeilingFixture("pendant", "p", "P", { x: 100, y: 100 }))).toBeNull();
  });
});

describe("resizeFixture", () => {
  it("keeps the back against the wall and the middle where it was", () => {
    const wc = placeFixture(room, "wc", "wc-1", "WC", 0, 100)!;
    expect(resizeFixture(wc, { w: 50, d: 70 }).rect).toEqual({ x: 75, y: 0, w: 50, d: 70 });
    const bath = placeFixture(room, "bathtub", "b", "Bath", 1, 150)!;
    const r = resizeFixture(bath, { w: 180, d: 80 }).rect;
    // The bath stands against the right wall (x = 400), so its back stays at x = 400.
    expect(r).toEqual({ x: 320, y: 60, w: 80, d: 180 });
    expect(fixtureSize(resizeFixture(bath, { w: 180, d: 80 }))).toEqual({ w: 180, d: 80 });
  });

  it("resizes lights and structure about their middle", () => {
    const lamp = placeCeilingFixture("pendant", "p", "P", { x: 200, y: 150 });
    expect(resizeFixture(lamp, { w: 60, d: 60 }).rect).toEqual({ x: 170, y: 120, w: 60, d: 60 });
  });
});
