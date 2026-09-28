import { describe, expect, it } from "vitest";
import type { Door, Radiator, Window } from "../schemas/room";
import { applyDoorStyle, applyRadiatorStyle, applyWindowStyle, DEFAULT_FIT_OUT, doorStyle, finishOf, FitOut, radiatorStyle, slides, STYLE_SHAPE, windowStyle } from "./fit-out";

const door = (o: Partial<Door> = {}): Door => ({ id: "d", kind: "door", wallIndex: 0, offset: 0, width: 90, height: 200, hinge: "start", swing: "in", ...o });
const win = (o: Partial<Window> = {}): Window => ({ id: "w", kind: "window", wallIndex: 0, offset: 0, width: 120, height: 140, sillHeight: 90, openable: true, ...o });
const rad = (o: Partial<Radiator> = {}): Radiator => ({ id: "r", kind: "radiator", wallIndex: 0, offset: 0, width: 100, height: 60, depth: 10, ...o });

describe("styles of openings saved before styles existed", () => {
  it("reads an old sliding door as a sliding style", () => {
    expect(doorStyle(door({ swing: "sliding" }))).toBe("sliding");
  });

  it("defaults everything else to the plain style", () => {
    expect(doorStyle(door())).toBe("hinged");
    expect(windowStyle(win())).toBe("casement");
    expect(radiatorStyle(rad())).toBe("panel");
  });

  it("keeps an explicit style", () => {
    expect(doorStyle(door({ style: "pocket", swing: "sliding" }))).toBe("pocket");
  });
});

describe("slides", () => {
  it("is true for leaves that run along the wall", () => {
    expect(["sliding", "pocket", "barn"].map((style) => slides(door({ style: style as Door["style"] })))).toEqual([true, true, true]);
    expect(slides(door({ style: "double" }))).toBe(false);
  });
});

describe("finishOf", () => {
  it("uses the apartment default until the opening overrides it", () => {
    const fitOut = { ...DEFAULT_FIT_OUT, doors: { style: "hinged" as const, finish: "walnut" as const } };
    expect(finishOf(door(), fitOut)).toBe("walnut");
    expect(finishOf(door({ finish: "black" }), fitOut)).toBe("black");
    expect(finishOf(win(), fitOut)).toBe(DEFAULT_FIT_OUT.windows.finish);
    expect(finishOf(rad({ finish: "chrome" }), fitOut)).toBe("chrome");
  });
});

describe("FitOut", () => {
  it("fills missing groups from the defaults, so '{}' in the database parses", () => {
    expect(FitOut.parse({})).toEqual(DEFAULT_FIT_OUT);
    expect(FitOut.parse({ doors: { style: "pocket" } }).doors).toEqual({ style: "pocket", finish: DEFAULT_FIT_OUT.doors.finish });
  });
});

describe("STYLE_SHAPE", () => {
  it("gives full-height windows no sill", () => {
    expect(STYLE_SHAPE.window.floor_to_ceiling).toMatchObject({ sillHeight: 0 });
  });

  it("puts convectors in the floor, not on the wall", () => {
    expect(STYLE_SHAPE.radiator.convector.height).toBeLessThan(20);
  });
});

describe("applying a style", () => {
  it("turns a sliding door back into a swinging one", () => {
    const d = applyDoorStyle(door({ style: "sliding", swing: "sliding" }), "hinged");
    expect(d).toMatchObject({ style: "hinged", swing: "in" });
  });

  it("makes sliding styles slide and widens a door made double", () => {
    expect(applyDoorStyle(door(), "pocket")).toMatchObject({ style: "pocket", swing: "sliding" });
    expect(applyDoorStyle(door({ width: 90 }), "double").width).toBe(140);
    expect(applyDoorStyle(door({ width: 160 }), "double").width).toBe(160);
  });

  it("runs a full-height window from floor to ceiling", () => {
    expect(applyWindowStyle(win(), "floor_to_ceiling", 260)).toMatchObject({ sillHeight: 0, height: 260, openable: true });
    expect(applyWindowStyle(win(), "fixed", 260)).toMatchObject({ style: "fixed", openable: false });
  });

  it("reshapes a radiator for its style", () => {
    expect(applyRadiatorStyle(rad(), "towel")).toMatchObject({ style: "towel", width: 50, height: 120 });
  });
});
