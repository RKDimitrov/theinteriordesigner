import { describe, expect, it } from "vitest";
import { RoomInput } from "@/domain/room/check-room";
import { isQuizComplete } from "@/domain/profile/quiz";
import { profileStatus } from "@/domain/profile/status";
import { ApartmentInput } from "@/domain/schemas/apartment";
import { StyleProfileInput } from "@/domain/schemas/profile";
import { pickSample, SAMPLE_APARTMENTS, SAMPLE_PROFILES, SAMPLE_ROOMS } from "./samples";

describe("sample data", () => {
  it.each(SAMPLE_APARTMENTS.map((a) => [a.name, a] as const))("apartment %s is valid", (_, a) => {
    expect(ApartmentInput.safeParse(a).error?.issues ?? []).toEqual([]);
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

  it("cycles and returns copies", () => {
    const a = pickSample(SAMPLE_ROOMS, 0);
    expect(pickSample(SAMPLE_ROOMS, SAMPLE_ROOMS.length).name).toBe(a.name);
    a.openings.pop();
    expect(SAMPLE_ROOMS[0]!.openings.length).toBeGreaterThan(a.openings.length);
  });
});
