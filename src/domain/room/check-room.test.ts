import { describe, expect, it } from "vitest";
import type { Opening, RoomShape } from "../schemas/room";
import { blockingIssues, checkRoom, RoomInput } from "./check-room";
import { rectRoom, resizeRect } from "./factory";

const base = (): RoomShape => rectRoom({ name: "Living", type: "living", widthCm: 420, lengthCm: 380 });

const door = (o: Partial<Extract<Opening, { kind: "door" }>> = {}): Opening => ({
  id: "d1",
  kind: "door",
  wallIndex: 2,
  offset: 20,
  width: 90,
  height: 200,
  hinge: "start",
  swing: "in",
  ...o,
});

const win = (o: Partial<Extract<Opening, { kind: "window" }>> = {}): Opening => ({
  id: "w1",
  kind: "window",
  wallIndex: 0,
  offset: 100,
  width: 120,
  height: 140,
  sillHeight: 90,
  openable: true,
  ...o,
});

describe("rectRoom", () => {
  it("snaps dimensions to the 5 cm grid", () => {
    const r = rectRoom({ name: "x", type: "office", widthCm: 301, lengthCm: 299 });
    expect(r.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ]);
  });

  it("resizes keeping openings", () => {
    const r = resizeRect({ ...base(), openings: [door()] }, 500, 400);
    expect(r.polygon[2]).toEqual({ x: 500, y: 400 });
    expect(r.openings).toHaveLength(1);
  });
});

describe("checkRoom", () => {
  it("accepts a valid room", () => {
    expect(checkRoom({ ...base(), openings: [door(), win(), win({ id: "w2", wallIndex: 1, offset: 50 })] })).toEqual([]);
  });

  it("rejects tiny rooms", () => {
    const r = rectRoom({ name: "x", type: "storage", widthCm: 50, lengthCm: 50 });
    expect(checkRoom(r)[0]?.message).toMatch(/1 m²/);
  });

  it("rejects self-intersecting outlines", () => {
    const r = { ...base(), polygon: [{ x: 0, y: 0 }, { x: 300, y: 300 }, { x: 300, y: 0 }, { x: 0, y: 300 }] };
    expect(checkRoom(r)[0]?.message).toMatch(/crosses/);
  });

  it("rejects openings that do not fit on their wall", () => {
    const issues = checkRoom({ ...base(), openings: [door({ offset: 380 })] });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["openings", 0, "width"]);
  });

  it("rejects openings on missing walls", () => {
    expect(checkRoom({ ...base(), openings: [door({ wallIndex: 4 })] })[0]?.message).toMatch(/does not exist/);
  });

  it("rejects overlapping door and window on the same wall", () => {
    const issues = checkRoom({ ...base(), openings: [door({ wallIndex: 0, offset: 50 }), win({ offset: 100 })] });
    expect(issues.map((i) => i.message)).toContain("Window overlaps door on wall 1");
  });

  it("allows a radiator under a window", () => {
    const rad: Opening = { id: "r1", kind: "radiator", wallIndex: 0, offset: 110, width: 100, height: 60, depth: 10 };
    expect(checkRoom({ ...base(), openings: [win(), rad] })).toEqual([]);
  });

  it("rejects a window above the ceiling", () => {
    expect(checkRoom({ ...base(), openings: [win({ sillHeight: 200 })] })[0]?.message).toMatch(/ceiling/);
  });

  it("rejects duplicate ids", () => {
    expect(checkRoom({ ...base(), openings: [win(), win({ wallIndex: 1 })] })[0]?.message).toBe("Duplicate id");
  });

  it("rejects fixed elements outside the room", () => {
    const r: RoomShape = {
      ...base(),
      fixedElements: [{ id: "f1", label: "Chimney", kind: "chimney", rect: { x: 400, y: 0, w: 40, d: 40 }, height: 250 }],
    };
    expect(checkRoom(r)[0]?.message).toMatch(/outside/);
  });
});

describe("RoomInput schema", () => {
  it("surfaces checkRoom issues as Zod issues", () => {
    const res = RoomInput.safeParse({ ...base(), openings: [door({ offset: 400 })] });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(["openings", 0, "width"]);
  });

  it("accepts a room whose only problems are warnings, such as a very short wall", () => {
    const polygon = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 4, y: 300 }, { x: 0, y: 296 }];
    const issues = checkRoom({ ...base(), polygon });
    // The cut corner (wall 4) is under 6 cm long.
    expect(issues.map((i) => [i.message, i.warning])).toEqual([["Wall 4 is shorter than 10 cm", true]]);
    expect(blockingIssues(issues)).toEqual([]);
    expect(RoomInput.safeParse({ ...base(), polygon }).success).toBe(true);
  });

  it("applies defaults", () => {
    const res = RoomInput.parse({ name: "B", type: "bedroom", polygon: base().polygon, ceilingHeight: 260 });
    expect(res.openings).toEqual([]);
    expect(res.wallOrientationOverrides).toEqual({});
  });
});

describe("roof slopes", () => {
  // 420 wide, 380 long, 260 high; wall 3 is the left wall.
  const sloped = (over: Partial<RoomShape> = {}): RoomShape => ({ ...base(), roofSlopes: [{ wallIndex: 3, kneeHeight: 170, depth: 90 }], ...over });

  it("accepts a slope along an existing wall, lower than the ceiling", () => {
    expect(checkRoom(sloped())).toEqual([]);
  });

  it("rejects a slope on a missing wall, one as high as the ceiling, one deeper than the room, and two on one wall", () => {
    const msg = (r: RoomShape) => checkRoom(r).map((i) => i.message).join(" | ");
    expect(msg(sloped({ roofSlopes: [{ wallIndex: 7, kneeHeight: 170, depth: 90 }] }))).toMatch(/Wall 8 does not exist/);
    expect(msg(sloped({ roofSlopes: [{ wallIndex: 3, kneeHeight: 260, depth: 90 }] }))).toMatch(/lower than the ceiling/);
    expect(msg(sloped({ roofSlopes: [{ wallIndex: 3, kneeHeight: 170, depth: 500 }] }))).toMatch(/deeper than the room/);
    expect(msg(sloped({ roofSlopes: [{ wallIndex: 3, kneeHeight: 170, depth: 90 }, { wallIndex: 3, kneeHeight: 150, depth: 60 }] }))).toMatch(/already has a roof slope/);
  });

  it("rejects a door or window that reaches above the roof", () => {
    const tooTall = checkRoom(sloped({ openings: [{ ...door(), wallIndex: 3, offset: 50 }] }));
    expect(tooTall.map((i) => i.message)).toContain("Door reaches above the roof slope");
    const knee = checkRoom(sloped({ openings: [{ ...win({ sillHeight: 60, height: 100 }), wallIndex: 3, offset: 50 }] }));
    expect(knee).toEqual([]);
  });

  it("defaults to no slopes", () => {
    expect(RoomInput.parse({ name: "B", type: "bedroom", polygon: base().polygon, ceilingHeight: 260 }).roofSlopes).toEqual([]);
  });
});

describe("inner walls and floor areas", () => {
  const wall = { id: "iw-1", a: { x: 200, y: 0 }, b: { x: 200, y: 380 }, thickness: 12, openings: [] as Opening[] };
  const msgs = (r: RoomShape) => checkRoom(r).map((i) => i.message).join(" | ");

  it("accepts a partition across the room with a passage on it", () => {
    const pass: Opening = { ...door({ id: "pass-1", wallIndex: 0, offset: 100, width: 120 }), swing: "none" } as Opening;
    expect(checkRoom({ ...base(), innerWalls: [{ ...wall, openings: [pass] }] })).toEqual([]);
  });

  it("rejects an inner wall outside the room, a very short one, and an opening that does not fit on it", () => {
    expect(msgs({ ...base(), innerWalls: [{ ...wall, b: { x: 200, y: 600 } }] })).toMatch(/inside the room/);
    expect(msgs({ ...base(), innerWalls: [{ ...wall, b: { x: 200, y: 10 } }] })).toMatch(/at least 20 cm/);
    expect(msgs({ ...base(), innerWalls: [{ ...wall, openings: [door({ id: "d9", wallIndex: 0, offset: 350, width: 90 })] }] })).toMatch(/does not fit/);
  });

  it("rejects duplicate ids between the outline's openings and an inner wall's", () => {
    expect(msgs({ ...base(), openings: [door()], innerWalls: [{ ...wall, openings: [door({ wallIndex: 0, offset: 10 })] }] })).toMatch(/Duplicate id/);
  });

  it("accepts floor areas inside the room, and rejects ones outside or overlapping", () => {
    const zone = { id: "z1", rect: { x: 10, y: 10, w: 100, d: 80 }, height: 15 };
    expect(checkRoom({ ...base(), floorZones: [zone] })).toEqual([]);
    expect(msgs({ ...base(), floorZones: [{ ...zone, rect: { x: 400, y: 10, w: 100, d: 80 } }] })).toMatch(/outside the room/);
    expect(msgs({ ...base(), floorZones: [zone, { ...zone, id: "z2", rect: { x: 50, y: 50, w: 100, d: 80 } }] })).toMatch(/overlap/);
  });
});