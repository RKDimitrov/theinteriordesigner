import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import type { Room } from "../schemas/room";
import { canStand, roomAt, startSpot, wallPieces, type WalkRoom } from "./walls3d";

describe("wallPieces", () => {
  it("leaves a full wall alone", () => {
    expect(wallPieces(400, 250, [])).toEqual([{ from: 0, to: 400, y0: 0, y1: 250 }]);
  });

  it("cuts a door gap and keeps the lintel", () => {
    const door = { id: "d", kind: "door" as const, wallIndex: 0, offset: 100, width: 90, height: 200, hinge: "start" as const, swing: "in" as const };
    expect(wallPieces(400, 250, [door])).toEqual([
      { from: 0, to: 100, y0: 0, y1: 250 },
      { from: 100, to: 190, y0: 200, y1: 250 },
      { from: 190, to: 400, y0: 0, y1: 250 },
    ]);
  });

  it("keeps the parapet below and the head above a window", () => {
    const win = { id: "w", kind: "window" as const, wallIndex: 0, offset: 50, width: 120, height: 140, sillHeight: 90, openable: true };
    expect(wallPieces(300, 250, [win])).toEqual([
      { from: 0, to: 50, y0: 0, y1: 250 },
      { from: 50, to: 170, y0: 0, y1: 90 },
      { from: 50, to: 170, y0: 230, y1: 250 },
      { from: 170, to: 300, y0: 0, y1: 250 },
    ]);
  });

  it("ignores sockets and radiators", () => {
    const socket = { id: "s", kind: "socket" as const, wallIndex: 0, offset: 50, width: 10, height: 30, socketType: "power" as const };
    expect(wallPieces(300, 250, [socket])).toHaveLength(1);
  });
});

const room = (id: string, openings: Room["openings"] = []): Room => ({
  id,
  apartmentId: "a",
  sortOrder: 0,
  name: id,
  type: "other",
  polygon: rectPolygon(300, 300),
  ceilingHeight: 250,
  openings,
  fixedElements: [],
  wallOrientationOverrides: {},
});

describe("walkthrough collision", () => {
  // Two rooms side by side, one wall (12 cm) apart, joined by a door on A's east wall (wall 1).
  const door = { id: "d", kind: "door" as const, wallIndex: 1, offset: 100, width: 90, height: 200, hinge: "start" as const, swing: "in" as const };
  const rooms: WalkRoom[] = [
    { id: "A", room: room("A", [door]), origin: { x: 0, y: 0 }, furniture: [] },
    { id: "B", room: room("B"), origin: { x: 312, y: 0 }, furniture: [] },
  ];
  const closed = () => false;
  const open = () => true;

  it("stays inside rooms and away from walls", () => {
    expect(canStand({ x: 150, y: 150 }, rooms, closed)).toBe(true);
    expect(canStand({ x: 10, y: 150 }, rooms, closed)).toBe(false);
    expect(canStand({ x: -50, y: 150 }, rooms, closed)).toBe(false);
  });

  it("passes a doorway only when the door is open", () => {
    const inDoorway = { x: 306, y: 145 };
    expect(canStand(inDoorway, rooms, closed)).toBe(false);
    expect(canStand(inDoorway, rooms, open)).toBe(true);
  });

  it("does not walk through furniture", () => {
    const withSofa: WalkRoom[] = [
      {
        ...rooms[0]!,
        furniture: [
          {
            id: "sofa-1",
            category: "sofa",
            name: "Sofa",
            placement: "floor",
            w: 200,
            d: 90,
            h: 85,
            x: 150,
            y: 150,
            rotation: 0,
            elevation: 0,
            material: "",
            colorHex: "#b9a58a",
            paletteRole: "neutral",
            price: { min: 0, max: 0, currency: "EUR" },
            investmentTier: "mid",
            trendRisk: 0,
            renterFriendly: true,
            requiresDrilling: false,
            existing: false,
            rationale: "-",
          },
        ],
      },
    ];
    expect(canStand({ x: 150, y: 150 }, withSofa, closed)).toBe(false);
  });

  it("finds a free starting spot and names the room", () => {
    const p = startSpot(rooms, closed)!;
    expect(canStand(p, rooms, closed)).toBe(true);
    expect(roomAt(p, rooms)?.id).toBe("A");
  });
});
