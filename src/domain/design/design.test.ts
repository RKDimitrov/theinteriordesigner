import { describe, expect, it } from "vitest";
import { SAMPLE_PROFILES, SAMPLE_ROOMS } from "@/lib/dev/samples";
import { assembleContext } from "../context/assemble";
import { roomDaylight } from "../context/daylight";
import { renterRules } from "../context/renter-rules";
import { scoreQuiz, topStyles } from "../profile/quiz";
import { designBrief } from "./brief";
import { roomFacts } from "./room-facts";

const living = { ...SAMPLE_ROOMS[0]!, id: "r-living" };

describe("roomFacts", () => {
  const facts = roomFacts(living, 0);

  it("gives the back-against rotation for each wall", () => {
    expect(facts.walls.map((w) => w.backAgainstRotation)).toEqual([0, 90, 180, 270]);
    expect(facts.walls.map((w) => w.facing)).toEqual(["N", "E", "S", "W"]);
  });

  it("lists openings as segments and keep-clear bounds", () => {
    const door = facts.openings.find((o) => o.kind === "door")!;
    expect(door.from).toEqual({ x: 390, y: 380 });
    expect(facts.keepClear.find((z) => z.kind === "door_swing")!.bounds).toMatchObject({ x: 300, w: 90 });
    expect(facts.keepClear.find((z) => z.kind === "window")!.blocksItemsTallerThanCm).toBe(80);
    expect(facts.widthCm).toBe(420);
  });
});

describe("designBrief", () => {
  it("filters must-keep items and budget to the room", () => {
    const rooms = [{ id: "r-living", type: "living" }, { id: "r-bed", type: "bedroom" }];
    const input = SAMPLE_PROFILES[0]!(rooms);
    const profile = { ...input, apartmentId: "a", scores: scoreQuiz(input.quizAnswers) };
    const ctx = assembleContext({
      apartmentId: "a",
      now: new Date(),
      location: null,
      climate: null,
      rooms: [roomDaylight(living, 0, 52.5, 3)],
      renter: renterRules("DE", "rent"),
      topStyles: topStyles(profile.scores, 3),
      trends: null,
    });
    const b = designBrief("r-living", ctx, profile);
    expect(b.budgetEur).toBe(4500);
    expect(b.mustKeep.map((m) => m.name)).toEqual(["Grandma's sideboard"]);
    expect(b.daylight?.mainWindowsFace).toBe("N");
    expect(b.renter?.drilling).toBe("limited");
    expect(designBrief("r-bed", ctx, profile).mustKeep).toEqual([]);
  });

  it("works without a profile", () => {
    const ctx = assembleContext({ apartmentId: "a", now: new Date(), location: null, climate: null, rooms: [], renter: renterRules("BG", "own"), topStyles: null, trends: null });
    const b = designBrief("x", ctx, null);
    expect(b).toMatchObject({ household: null, budgetEur: null, renter: null, mustKeep: [] });
  });
});
