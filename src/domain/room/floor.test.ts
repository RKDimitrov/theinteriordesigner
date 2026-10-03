import { describe, expect, it } from "vitest";
import { checkRoom, RoomInput } from "./check-room";
import { Floor, floorRooms } from "./floor";
import VRAJDEBNA from "../../../scripts/floors/vrajdebna-3.json";

const apartment = { name: "Test", address: "Street 1", city: "Sofia", country: "BG", floorLevel: 3, tenure: "own" as const };

describe("floorRooms", () => {
  it("keeps an unturned rectangle as drawn", () => {
    const [r] = floorRooms(Floor.parse({ apartment, rooms: [{ key: "a", name: "A", type: "living", ceilingHeight: 250, x: 10, y: 20, w: 400, d: 300, openings: [{ kind: "door", wall: 2, offset: 30, width: 90 }] }] }));
    expect(r!.origin).toEqual({ x: 10, y: 20 });
    expect(r!.shape.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ]);
    expect(r!.shape.openings[0]).toMatchObject({ kind: "door", wallIndex: 2, offset: 30, width: 90, swing: "in" });
  });

  it("turns the sketch a quarter clockwise: the top wall becomes the right wall, offsets kept", () => {
    const floor = Floor.parse({
      apartment,
      rotate: 90,
      rooms: [
        {
          key: "a",
          name: "A",
          type: "living",
          ceilingHeight: 210,
          x: 0,
          y: 0,
          w: 400,
          d: 300,
          openings: [{ kind: "window", wall: 0, offset: 50, width: 120, height: 100, sillHeight: 80 }],
          roofSlopes: [{ wallIndex: 3, kneeHeight: 170, depth: 90 }],
          fixed: [{ label: "Chimney", kind: "chimney", x: 360, y: 100, w: 40, d: 60, height: 210 }],
        },
      ],
    });
    const [r] = floorRooms(floor);
    // 400 wide × 300 deep becomes 300 wide × 400 deep.
    expect(r!.shape.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 400 },
    ]);
    expect(r!.shape.openings[0]).toMatchObject({ wallIndex: 1, offset: 50 });
    // The left wall becomes the top wall.
    expect(r!.shape.roofSlopes).toEqual([{ wallIndex: 0, kneeHeight: 170, depth: 90 }]);
    // A chimney against the old right wall stands against the new bottom wall.
    expect(r!.shape.fixedElements[0]!.rect).toEqual({ x: 140, y: 360, w: 60, d: 40 });
    expect(checkRoom(r!.shape)).toEqual([]);
  });

  it("places neighbouring rooms one wall apart after turning", () => {
    const rooms = floorRooms(
      Floor.parse({
        apartment,
        rotate: 90,
        rooms: [
          { key: "a", name: "A", type: "living", ceilingHeight: 250, x: 0, y: 0, w: 400, d: 300 },
          { key: "b", name: "B", type: "bedroom", ceilingHeight: 250, x: 0, y: 312, w: 400, d: 200 },
        ],
      }),
    );
    // B was below A; turned clockwise it stands to A's left.
    expect(rooms[1]!.origin.x + 200 + 12).toBeCloseTo(rooms[0]!.origin.x);
  });
});

describe("the Vrajdebna third floor", () => {
  const rooms = floorRooms(Floor.parse(VRAJDEBNA));

  it.each(rooms.map((r) => [r.shape.name, r] as const))("%s is a valid room", (_, r) => {
    expect(RoomInput.safeParse(r.shape).error?.issues ?? []).toEqual([]);
  });

  it("has every room once", () => {
    expect(new Set(rooms.map((r) => r.key)).size).toBe(rooms.length);
  });
});
