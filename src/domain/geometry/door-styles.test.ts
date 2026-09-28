import { describe, expect, it } from "vitest";
import type { Door, Opening, Radiator, Window } from "../schemas/room";
import { doorLeaves, doorSwings, slideRun } from "./openings";
import { area, containsPoint } from "./polygon";
import { keepClearZones } from "./zones";
import { wallsOf } from "./walls";

// 400 × 300 room; wall 2 runs from (400,300) to (0,300), the room is above it.
const room = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];
const walls = wallsOf(room);
const door = (o: Partial<Door> = {}): Door => ({ id: "d1", kind: "door", wallIndex: 2, offset: 100, width: 140, height: 200, hinge: "start", swing: "in", ...o });

describe("doorLeaves", () => {
  it("gives a double door two half-width leaves hinged at both ends", () => {
    const leaves = doorLeaves(walls, door({ style: "double" }));
    expect(leaves).toHaveLength(2);
    expect(leaves.map((l) => l.radius)).toEqual([70, 70]);
    expect(leaves.map((l) => l.hinge.x).sort()).toEqual([160, 300]);
  });

  it("folds a bifold door to half its width", () => {
    const [leaf] = doorLeaves(walls, door({ style: "bifold" }));
    expect(leaf!.radius).toBe(70);
  });

  it("swings glazed and balcony doors like hinged ones", () => {
    for (const style of ["glazed", "balcony"] as const) expect(doorLeaves(walls, door({ style }))[0]!.radius).toBe(140);
  });

  it("has no leaves for sliding styles or pass-throughs", () => {
    for (const style of ["sliding", "pocket", "barn"] as const) expect(doorLeaves(walls, door({ style, swing: "sliding" }))).toEqual([]);
    expect(doorLeaves(walls, door({ swing: "none" }))).toEqual([]);
  });

  it("keeps only leaves that open into this room as swing areas", () => {
    expect(doorSwings(walls, door({ style: "double" }))).toHaveLength(2);
    expect(doorSwings(walls, door({ style: "double", swing: "out" }))).toEqual([]);
    for (const sw of doorSwings(walls, door({ style: "double" }))) for (const p of sw.polygon) expect(containsPoint(room, p)).toBe(true);
  });
});

describe("slideRun", () => {
  it("is the stretch of wall the leaf parks on, on the hinge side", () => {
    const run = slideRun(walls, door({ style: "sliding", swing: "sliding" }))!;
    // Hinge "start" is at x = 300; the leaf parks on the next 140 cm towards the wall start (x 300 → 400, clipped).
    const xs = run.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(300);
    expect(Math.max(...xs)).toBeCloseTo(400);
    expect(area(run)).toBeGreaterThan(0);
  });

  it("parks on the other side when hinged at the end", () => {
    const xs = slideRun(walls, door({ style: "barn", swing: "sliding", hinge: "end" }))!.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(20);
    expect(Math.max(...xs)).toBeCloseTo(160);
  });

  it("is null for pocket doors (the leaf is inside the wall) and swinging doors", () => {
    expect(slideRun(walls, door({ style: "pocket", swing: "sliding" }))).toBeNull();
    expect(slideRun(walls, door())).toBeNull();
  });
});

describe("keepClearZones by style", () => {
  const zones = (openings: Opening[]) => keepClearZones({ polygon: room, openings, fixedElements: [] });

  it("gives sliding doors a slide run and a path but no swing", () => {
    const kinds = zones([door({ style: "sliding", swing: "sliding" })]).map((z) => z.kind);
    expect(kinds.sort()).toEqual(["door_path", "door_slide"]);
  });

  it("gives a double door two swing areas", () => {
    expect(zones([door({ style: "double" })]).filter((z) => z.kind === "door_swing")).toHaveLength(2);
  });

  it("lets low pieces stand in front of full-height glazing", () => {
    const w: Window = { id: "w", kind: "window", wallIndex: 0, offset: 50, width: 200, height: 260, sillHeight: 0, openable: true, style: "floor_to_ceiling" };
    expect(zones([w])[0]).toMatchObject({ kind: "window", minBlockingHeight: 50 });
    const balcony = zones([door({ style: "balcony" })]).find((z) => z.kind === "window");
    expect(balcony).toMatchObject({ minBlockingHeight: 50 });
  });

  it("has no keep-clear area for a floor convector", () => {
    const r: Radiator = { id: "r", kind: "radiator", wallIndex: 0, offset: 50, width: 200, height: 12, depth: 25, style: "convector" };
    expect(zones([r])).toEqual([]);
  });
});
