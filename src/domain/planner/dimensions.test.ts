import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import { fitLabel, openingChain, sharedWalls } from "./dimensions";

describe("sharedWalls", () => {
  // A 400 × 300 living room with a 160 × 300 hall against its right wall (12 cm wall between them).
  const rooms = [
    { id: "living", polygon: rectPolygon(400, 300) },
    { id: "hall", polygon: rectPolygon(160, 300) },
  ];
  const origins = { living: { x: 0, y: 0 }, hall: { x: 412, y: 0 } };

  it("marks the walls whose dimension lines would land in the room next door", () => {
    const shared = sharedWalls(rooms, origins, [30, 52]);
    // Clockwise from the top-left corner: top, right, bottom, left.
    expect(shared["living"]).toEqual([false, true, false, false]);
    expect(shared["hall"]).toEqual([false, false, false, true]);
  });

  it("leaves every wall of a room on its own outside", () => {
    expect(sharedWalls([rooms[0]!], origins, [30, 52])["living"]).toEqual([false, false, false, false]);
  });

  it("counts a wall that only partly faces a neighbour", () => {
    const small = [rooms[0]!, { id: "hall", polygon: rectPolygon(160, 100) }];
    expect(sharedWalls(small, origins, [30, 52])["living"]![1]).toBe(true);
  });

  it("ignores a room that stands further away than the dimension lines reach", () => {
    expect(sharedWalls(rooms, { ...origins, hall: { x: 500, y: 0 } }, [30, 52])["living"]).toEqual([false, false, false, false]);
  });
});

describe("openingChain", () => {
  it("splits a wall into the stretches between and across its openings", () => {
    expect(
      openingChain(300, [
        { offset: 135, width: 120 },
        { offset: 10, width: 80 },
      ]),
    ).toEqual([
      { from: 0, to: 10, opening: null },
      { from: 10, to: 90, opening: 1 },
      { from: 90, to: 135, opening: null },
      { from: 135, to: 255, opening: 0 },
      { from: 255, to: 300, opening: null },
    ]);
  });

  it("has nothing to say about a wall without openings", () => {
    expect(openingChain(300, [])).toEqual([]);
  });

  it("leaves out stretches of a centimetre or less", () => {
    expect(openingChain(200, [{ offset: 0, width: 200 }])).toEqual([{ from: 0, to: 200, opening: 0 }]);
  });
});

describe("fitLabel", () => {
  it("takes the first wording that fits the stretch", () => {
    expect(fitLabel(["80 opening", "80"], 80, 10, 6)).toBe("80 opening");
    expect(fitLabel(["120 window", "120"], 40, 10, 6)).toBe("120");
  });

  it("gives up when even the shortest wording is wider than the stretch", () => {
    expect(fitLabel(["10"], 10, 10, 6)).toBeNull();
  });
});
