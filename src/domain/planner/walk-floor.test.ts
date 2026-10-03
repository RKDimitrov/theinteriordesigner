import { describe, expect, it } from "vitest";
import { Floor, floorRooms } from "../room/floor";
import VRAJDEBNA from "../../../scripts/floors/vrajdebna-3.json";
import { canStand, sharedWallInfo, type WalkRoom } from "./walls3d";

// The imported third floor, as the walkthrough sees it.
const rooms: WalkRoom[] = floorRooms(Floor.parse(VRAJDEBNA)).map((r) => ({
  id: r.key,
  room: { ...r.shape, id: r.key, apartmentId: "a", sortOrder: 0, finishes: { wallOverrides: {} }, wallOutlooks: {}, plan: r.origin },
  origin: r.origin,
  furniture: [],
}));
const room = (key: string) => rooms.find((r) => r.id === key)!;

/** Points every 5 cm on the straight line from a to b; the ones where the walker may not stand. */
function blockedOn(a: { x: number; y: number }, b: { x: number; y: number }, isOpen: (roomId: string, id: string) => boolean) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (!canStand(p, rooms, isOpen)) out.push(p);
  }
  return out;
}

describe("walking the Vrajdebna floor", () => {
  it("goes from the living room through its door into the corridor", () => {
    const living = room("living");
    const door = living.room.openings.find((o) => o.kind === "door" && o.swing !== "none")!;
    const corridor = room("corridor");
    // The living room's door wall, and the middle of the door on it.
    const walls = [...living.room.polygon.keys()].map((i) => ({ a: living.room.polygon[i]!, b: living.room.polygon[(i + 1) % living.room.polygon.length]! }));
    const w = walls[door.wallIndex]!;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const dir = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
    const inward = { x: -dir.y, y: dir.x };
    const mid = { x: living.origin.x + w.a.x + dir.x * (door.offset + door.width / 2), y: living.origin.y + w.a.y + dir.y * (door.offset + door.width / 2) };
    const inside = { x: mid.x + inward.x * 80, y: mid.y + inward.y * 80 };
    const beyond = { x: mid.x - inward.x * 80, y: mid.y - inward.y * 80 };
    expect(corridor).toBeDefined();
    expect(blockedOn(inside, beyond, () => true)).toEqual([]);
  });
});

describe("walking an L-shaped room", () => {
  it("can stand anywhere well inside the corridor, also where another wall's line would cross", () => {
    const c = room("corridor");
    // Middle of the corridor's wide part, far from every wall segment.
    const p = { x: c.origin.x + 280, y: c.origin.y + 60 };
    expect(canStand(p, rooms, () => false)).toBe(true);
  });
});

describe("shared walls", () => {
  const info = sharedWallInfo(rooms.map((r) => ({ id: r.id, polygon: r.room.polygon, origin: r.origin, openings: r.room.openings })), 12);

  it("finds the wall between the living room and the corridor from both sides", () => {
    const living = room("living");
    const door = living.room.openings.find((o) => o.kind === "door" && o.swing !== "none")!;
    expect(info.living![door.wallIndex]!.shared).toBe(true);
    // The living room's outer wall with the window is not shared.
    const win = living.room.openings.find((o) => o.kind === "window")!;
    expect(info.living![win.wallIndex]!.shared).toBe(false);
  });

  it("cuts the neighbour's doorways through this room's half of the wall", () => {
    const living = room("living");
    const door = living.room.openings.find((o) => o.kind === "door" && o.swing !== "none")!;
    const corridor = info.corridor!;
    const cut = corridor.flatMap((w) => w.cuts).find((c) => Math.abs(c.width - door.width) < 1);
    expect(cut).toBeDefined();
  });
});
