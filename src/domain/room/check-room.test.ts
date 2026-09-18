import { describe, expect, it } from "vitest";
import type { Opening, RoomShape } from "../schemas/room";
import { checkRoom, RoomInput } from "./check-room";
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

  it("applies defaults", () => {
    const res = RoomInput.parse({ name: "B", type: "bedroom", polygon: base().polygon, ceilingHeight: 260 });
    expect(res.openings).toEqual([]);
    expect(res.wallOrientationOverrides).toEqual({});
  });
});
