import { describe, expect, it } from "vitest";
import { StyleProfileInput } from "./profile";

const valid = {
  household: { adults: 2, kids: [{ age: 4 }], pets: [{ type: "dog", count: 1 }], wfhDaysPerWeek: 2 },
  budgetPerRoom: { r1: 2500 },
  quizAnswers: [{ pairId: "p1", choice: "scandinavian" }],
  colorsLiked: ["#A3B09A"],
  colorsDisliked: ["#141414"],
  mustKeep: [{ id: "k1", name: "Piano", category: "other", w: 150, d: 60, h: 120, colorHex: "#141414", roomId: null }],
};

describe("StyleProfileInput", () => {
  it("accepts a valid profile", () => {
    expect(StyleProfileInput.safeParse(valid).success).toBe(true);
  });

  it("rejects a colour that is both liked and disliked (case-insensitive)", () => {
    const r = StyleProfileInput.safeParse({ ...valid, colorsDisliked: ["#a3b09a"] });
    expect(r.error?.issues[0]?.path).toEqual(["colorsDisliked", 0]);
  });

  it("rejects duplicate must-keep ids", () => {
    const item = valid.mustKeep[0]!;
    const r = StyleProfileInput.safeParse({ ...valid, mustKeep: [item, { ...item, name: "Other" }] });
    expect(r.error?.issues[0]?.message).toBe("Duplicate id");
  });

  it("enforces bounds", () => {
    expect(StyleProfileInput.safeParse({ ...valid, household: { ...valid.household, adults: 0 } }).success).toBe(false);
    expect(StyleProfileInput.safeParse({ ...valid, budgetPerRoom: { r1: -1 } }).success).toBe(false);
    expect(StyleProfileInput.safeParse({ ...valid, quizAnswers: [{ pairId: "p1", choice: "rococo" }] }).success).toBe(false);
  });
});
