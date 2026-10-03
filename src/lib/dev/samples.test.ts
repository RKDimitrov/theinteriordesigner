import { describe, expect, it } from "vitest";
import { RoomInput } from "@/domain/room/check-room";
import { isQuizComplete } from "@/domain/profile/quiz";
import { profileStatus } from "@/domain/profile/status";
import { ApartmentInput } from "@/domain/schemas/apartment";
import { StyleProfileInput } from "@/domain/schemas/profile";
import { FitOut } from "@/domain/room/fit-out";
import { PIECE_MODELS } from "@/components/planner/three/assets";
import { FurnitureCategory } from "@/domain/schemas/design";
import { pickSample, SAMPLE_APARTMENTS, sampleRoofSlopes, SAMPLE_FIT_OUTS, SAMPLE_MODELS, SAMPLE_PROFILES, SAMPLE_ROOMS, sampleModel } from "./samples";

describe("sample data", () => {
  it.each(SAMPLE_APARTMENTS.map((a) => [a.name, a] as const))("apartment %s is valid", (_, a) => {
    expect(ApartmentInput.safeParse(a).error?.issues ?? []).toEqual([]);
  });

  it.each(SAMPLE_FIT_OUTS.map((f) => [f.name, f.fitOut] as const))("fit-out %s is valid", (_, f) => {
    expect(FitOut.safeParse(f).error?.issues ?? []).toEqual([]);
    expect(FitOut.parse(f)).toEqual(f);
  });

  it.each(SAMPLE_ROOMS.map((r) => [r.name, r] as const))("room %s is valid", (_, r) => {
    expect(RoomInput.safeParse(r).error?.issues ?? []).toEqual([]);
  });

  const rooms = [
    { id: "r-living", type: "living" },
    { id: "r-bed", type: "bedroom" },
    { id: "r-office", type: "office" },
    { id: "r-bath", type: "bath" },
  ];

  it.each(SAMPLE_PROFILES.map((f, i) => [i, f] as const))("profile %i is valid, completes the quiz and budgets every room", (_, f) => {
    const p = f(rooms);
    expect(StyleProfileInput.safeParse(p).error?.issues ?? []).toEqual([]);
    expect(isQuizComplete(p.quizAnswers)).toBe(true);
    expect(profileStatus(p, rooms.map((r) => r.id)).done).toBe(true);
    for (const m of p.mustKeep) expect(m.roomId === null || rooms.some((r) => r.id === m.roomId)).toBe(true);
  });

  it("profiles work for an apartment without rooms", () => {
    for (const f of SAMPLE_PROFILES) expect(StyleProfileInput.safeParse(f([])).success).toBe(true);
  });

  it.each(Object.entries(SAMPLE_MODELS))("sample models for %s are real models of that category", (category, ids) => {
    const models = PIECE_MODELS[FurnitureCategory.parse(category)].map((m) => m.id);
    for (const id of ids) expect(models, id).toContain(id);
  });

  it("arms a preset model, or one of the category's own when it has no preset", () => {
    expect(sampleModel("sofa", ["sofa_01", "sofa_02", "glam_velvet_sofa"], 0)).toBe("sofa_02");
    expect(sampleModel("sofa", ["sofa_01", "sofa_02", "glam_velvet_sofa"], 1)).toBe("glam_velvet_sofa");
    expect(sampleModel("desk", ["a", "b"], 3)).toBe("b");
  });

  it.each(SAMPLE_ROOMS.map((r) => [r.name, r] as const))("roof slope samples are valid for room %s", (_, r) => {
    for (let n = 0; n < 3; n++) {
      const roofSlopes = sampleRoofSlopes(r.polygon, n);
      expect(RoomInput.safeParse({ ...r, ceilingHeight: Math.max(r.ceilingHeight, 210), roofSlopes, openings: [] }).error?.issues ?? []).toEqual([]);
    }
    expect(sampleRoofSlopes(r.polygon, 2)).toEqual([]);
  });

  it("cycles and returns copies", () => {
    const a = pickSample(SAMPLE_ROOMS, 0);
    expect(pickSample(SAMPLE_ROOMS, SAMPLE_ROOMS.length).name).toBe(a.name);
    a.openings.pop();
    expect(SAMPLE_ROOMS[0]!.openings.length).toBeGreaterThan(a.openings.length);
  });
});
