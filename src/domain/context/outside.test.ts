import { describe, expect, it } from "vitest";
import { Surroundings, WallOutlooks } from "./outside";

describe("Surroundings", () => {
  it("defaults to an urban street", () => {
    expect(Surroundings.parse({})).toEqual({ kind: "urban", waterfront: false, mountains: false });
  });

  it("only allows the known kinds", () => {
    expect(Surroundings.safeParse({ kind: "moon" }).success).toBe(false);
  });
});

describe("WallOutlooks", () => {
  it("parses per-wall outlooks keyed by wall index", () => {
    expect(WallOutlooks.parse({ "0": "street", "2": "courtyard" })).toEqual({ "0": "street", "2": "courtyard" });
    expect(WallOutlooks.safeParse({ x: "street" }).success).toBe(false);
  });
});
