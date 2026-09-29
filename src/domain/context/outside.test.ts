import { describe, expect, it } from "vitest";
import { backplateFor, defaultOutlook, dominantOutlook, groundBelowCm, heightBand, OPPOSITE_DISTANCE_CM, Surroundings, WallOutlooks } from "./outside";

describe("heightBand", () => {
  it("groups floors by what you see from them", () => {
    expect([-1, 0, 1, 3, 4, 8, 9, 30].map(heightBand)).toEqual(["ground", "ground", "low", "low", "mid", "mid", "high", "high"]);
  });
});

describe("groundBelowCm", () => {
  it("puts the ground three metres per storey below the flat's floor", () => {
    expect(groundBelowCm(0)).toBe(0);
    expect(groundBelowCm(4)).toBe(1200);
    expect(groundBelowCm(-1)).toBe(0);
  });
});

describe("Surroundings", () => {
  it("defaults to an urban street", () => {
    expect(Surroundings.parse({})).toEqual({ kind: "urban", waterfront: false, mountains: false });
  });

  it("only allows the known kinds", () => {
    expect(Surroundings.safeParse({ kind: "moon" }).success).toBe(false);
  });
});

describe("backplateFor", () => {
  const s = (o: Partial<Surroundings> = {}) => Surroundings.parse(o);

  it("chooses the view by surroundings and height", () => {
    expect(backplateFor(s({ kind: "city_centre" }), "ground")).toBe("potsdamer_platz");
    expect(backplateFor(s({ kind: "urban" }), "low")).toBe("urban_street_03");
    expect(backplateFor(s({ kind: "suburban" }), "high")).toBe("stuttgart_hillside");
    expect(backplateFor(s({ kind: "rural" }), "ground")).toBe("farm_field");
  });

  it("sees over the rooftops from the middle floors up", () => {
    expect(backplateFor(s({ kind: "urban" }), "mid")).toBe(backplateFor(s({ kind: "urban" }), "high"));
  });

  it("lets water and mountains win over the kind of area", () => {
    expect(backplateFor(s({ kind: "urban", waterfront: true }), "low")).toBe("binnenalster");
    expect(backplateFor(s({ kind: "rural", mountains: true }), "high")).toBe("fouriesburg_mountain_lookout");
  });

  it("looks into the courtyard or garden from the lower floors", () => {
    expect(backplateFor(s({ kind: "city_centre" }), "low", "courtyard")).toBe("urban_courtyard");
    expect(backplateFor(s({ kind: "urban" }), "ground", "garden")).toBe("residential_garden");
    // From high up, a courtyard is just a gap between roofs.
    expect(backplateFor(s({ kind: "urban" }), "high", "courtyard")).toBe(backplateFor(s({ kind: "urban" }), "high"));
  });
});

describe("outlooks", () => {
  it("defaults each wall to what the area usually offers", () => {
    expect(defaultOutlook("city_centre")).toBe("street");
    expect(defaultOutlook("suburban")).toBe("garden");
    expect(defaultOutlook("rural")).toBe("open");
  });

  it("takes the most common outlook of the windows in view, with the area's default for unset walls", () => {
    expect(dominantOutlook([{ street: 1 }, { courtyard: 2 }], "street")).toBe("courtyard");
    expect(dominantOutlook([], "garden")).toBe("garden");
  });

  it("parses per-wall outlooks keyed by wall index", () => {
    expect(WallOutlooks.parse({ "0": "street", "2": "courtyard" })).toEqual({ "0": "street", "2": "courtyard" });
    expect(WallOutlooks.safeParse({ x: "street" }).success).toBe(false);
  });

  it("places buildings across streets and courtyards, not gardens or open land", () => {
    expect(OPPOSITE_DISTANCE_CM.street).toBeGreaterThan(OPPOSITE_DISTANCE_CM.courtyard!);
    expect(OPPOSITE_DISTANCE_CM.garden).toBeNull();
    expect(OPPOSITE_DISTANCE_CM.open).toBeNull();
  });
});
