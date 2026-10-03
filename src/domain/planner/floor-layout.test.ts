import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import { floorBounds, floorOrigins } from "./floor-layout";

describe("floorOrigins", () => {
  it("keeps saved positions and lines the other rooms up after them", () => {
    const rooms = [
      { id: "a", polygon: rectPolygon(400, 300), plan: { x: 100, y: 50 } },
      { id: "b", polygon: rectPolygon(200, 200), plan: null },
    ];
    const o = floorOrigins(rooms);
    expect(o.get("a")).toEqual({ x: 100, y: 50 });
    // Placed below the saved rooms, one wall apart.
    expect(o.get("b")!.y).toBe(50 + 300 + 12);
  });

  it("measures the whole floor", () => {
    const rooms = [
      { id: "a", polygon: rectPolygon(400, 300), plan: { x: 0, y: 0 } },
      { id: "b", polygon: rectPolygon(200, 300), plan: { x: 412, y: 0 } },
    ];
    expect(floorBounds(rooms, floorOrigins(rooms))).toEqual({ x: 0, y: 0, w: 612, d: 300 });
  });
});
