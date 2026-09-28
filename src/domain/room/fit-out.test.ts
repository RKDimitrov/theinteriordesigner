import { describe, expect, it } from "vitest";
import type { Door, Radiator, Window } from "../schemas/room";
import { applyDoorStyle, applyRadiatorStyle, applyWindowStyle, DEFAULT_FIT_OUT, doorDesign, doorStyle, finishOf, FitOut, radiatorStyle, slides, STYLE_SHAPE, windowDesign, windowStyle } from "./fit-out";

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
    const fitOut = { ...DEFAULT_FIT_OUT, doors: { ...DEFAULT_FIT_OUT.doors, finish: "walnut" as const } };
    expect(finishOf(door(), fitOut)).toBe("walnut");
    expect(finishOf(door({ finish: "black" }), fitOut)).toBe("black");
    expect(finishOf(win(), fitOut)).toBe(DEFAULT_FIT_OUT.windows.finish);
    expect(finishOf(rad({ finish: "chrome" }), fitOut)).toBe("chrome");
  });
});

describe("FitOut", () => {
  it("fills missing groups from the defaults, so '{}' in the database parses", () => {
    expect(FitOut.parse({})).toEqual(DEFAULT_FIT_OUT);
    expect(FitOut.parse({ doors: { style: "pocket" } }).doors).toEqual({ ...DEFAULT_FIT_OUT.doors, style: "pocket" });
  });

  it("reads fit-outs saved before designs, handles and trim existed", () => {
    const old = { doors: { style: "hinged", finish: "walnut" }, windows: { style: "fixed", finish: "oak" }, radiators: { style: "column", finish: "chrome" } };
    const parsed = FitOut.parse(old);
    expect(parsed.doors).toEqual({ style: "hinged", finish: "walnut", design: "flush", handle: "lever_modern" });
    expect(parsed.windows.design).toBe("plain");
    expect(parsed.trim).toEqual({ profile: "square", finish: "white", skirting: true, skirtingHeight: 8 });
  });

  it("keeps skirting within real heights", () => {
    expect(FitOut.safeParse({ trim: { skirtingHeight: 2 } }).success).toBe(false);
    expect(FitOut.safeParse({ trim: { skirtingHeight: 20 } }).success).toBe(true);
  });
});

describe("designs", () => {
  it("uses the door's own design, then the style's natural one, then the apartment default", () => {
    const fitOut = { ...DEFAULT_FIT_OUT, doors: { ...DEFAULT_FIT_OUT.doors, design: "shaker" as const } };
    expect(doorDesign(door(), fitOut)).toBe("shaker");
    expect(doorDesign(door({ style: "glazed" }), fitOut)).toBe("full_lite");
    expect(doorDesign(door({ style: "balcony" }), fitOut)).toBe("full_lite");
    expect(doorDesign(door({ style: "barn", swing: "sliding" }), fitOut)).toBe("planks");
    expect(doorDesign(door({ style: "barn", design: "four_panel" }), fitOut)).toBe("four_panel");
  });

  it("gives glazed styles a glazed design even when the default is solid", () => {
    expect(doorDesign(door({ style: "glazed", design: "flush" }), DEFAULT_FIT_OUT)).toBe("full_lite");
    expect(doorDesign(door({ style: "glazed", design: "three_lite" }), DEFAULT_FIT_OUT)).toBe("three_lite");
  });

  it("reads window designs with the apartment default", () => {
    expect(windowDesign(win(), DEFAULT_FIT_OUT)).toBe("plain");
    expect(windowDesign(win({ design: "grid" }), DEFAULT_FIT_OUT)).toBe("grid");
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
