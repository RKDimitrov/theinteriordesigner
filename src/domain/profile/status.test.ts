import { describe, expect, it } from "vitest";
import type { StyleProfileInput } from "../schemas/profile";
import { QUIZ_PAIRS } from "./quiz";
import { budgetTotal, profileStatus, pruneToRooms } from "./status";

const base = (): StyleProfileInput => ({
  household: { adults: 2, kids: [], pets: [], wfhDaysPerWeek: 0 },
  budgetPerRoom: { r1: 3000, r2: 1500, gone: 999 },
  quizAnswers: QUIZ_PAIRS.map((p) => ({ pairId: p.id, choice: p.a })),
  colorsLiked: [],
  colorsDisliked: [],
  mustKeep: [{ id: "k1", name: "Desk", category: "desk", w: 140, d: 70, h: 75, colorHex: "#C19A6B", roomId: "gone" }],
});

describe("budgetTotal", () => {
  it("only counts existing rooms", () => {
    expect(budgetTotal(base().budgetPerRoom, ["r1", "r2"])).toBe(4500);
  });
});

describe("profileStatus", () => {
  it("is not done without a profile", () => {
    expect(profileStatus(null, ["r1"])).toMatchObject({ exists: false, done: false, missingBudgetRoomIds: ["r1"] });
  });

  it("is done with complete quiz and all budgets", () => {
    expect(profileStatus(base(), ["r1", "r2"]).done).toBe(true);
  });

  it("lists rooms without budget", () => {
    const s = profileStatus(base(), ["r1", "r3"]);
    expect(s.done).toBe(false);
    expect(s.missingBudgetRoomIds).toEqual(["r3"]);
  });

  it("treats a zero budget as missing", () => {
    const p = { ...base(), budgetPerRoom: { r1: 0 } };
    expect(profileStatus(p, ["r1"]).missingBudgetRoomIds).toEqual(["r1"]);
  });

  it("is not done with an incomplete quiz or no rooms", () => {
    expect(profileStatus({ ...base(), quizAnswers: [] }, ["r1"]).done).toBe(false);
    expect(profileStatus(base(), []).done).toBe(false);
  });
});

describe("pruneToRooms", () => {
  it("drops unknown budgets and unassigns unknown must-keep rooms", () => {
    const p = pruneToRooms(base(), ["r1", "r2"]);
    expect(Object.keys(p.budgetPerRoom)).toEqual(["r1", "r2"]);
    expect(p.mustKeep[0]!.roomId).toBeNull();
  });
});
