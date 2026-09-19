import "server-only";
import { z } from "zod";
import type { UserProfile as ProfileRow } from "@/generated/prisma/client";
import { type StyleProfile, StyleProfileInput, StyleScores } from "@/domain/schemas/profile";
import { db } from "../db";
import { isUuid } from "./ids";
import { toJson } from "./json";

const StoredProfile = z.object({ input: StyleProfileInput, scores: StyleScores });

function toDomain(row: ProfileRow): StyleProfile {
  const { input, scores } = StoredProfile.parse({
    input: {
      household: row.household,
      budgetPerRoom: row.budgetPerRoom,
      quizAnswers: row.quizAnswers,
      colorsLiked: row.colorsLiked,
      colorsDisliked: row.colorsDisliked,
      mustKeep: row.mustKeep,
    },
    scores: row.styleScores,
  });
  return { ...input, apartmentId: row.apartmentId, scores };
}

/** Profile of an apartment the user owns, or null. */
export async function getProfile(userId: string, apartmentId: string): Promise<StyleProfile | null> {
  if (!isUuid(apartmentId)) return null;
  const row = await db.userProfile.findFirst({ where: { apartmentId, apartment: { userId } } });
  return row ? toDomain(row) : null;
}

/** Create or replace the whole profile. Returns null when the apartment is not the user's. */
export async function upsertProfile(
  userId: string,
  apartmentId: string,
  input: StyleProfileInput,
  scores: StyleScores,
): Promise<StyleProfile | null> {
  if (!isUuid(apartmentId)) return null;
  const owner = await db.apartment.findFirst({ where: { id: apartmentId, userId }, select: { id: true } });
  if (!owner) return null;
  const data = {
    household: toJson(input.household),
    budgetPerRoom: toJson(input.budgetPerRoom),
    quizAnswers: toJson(input.quizAnswers),
    styleScores: toJson(scores),
    colorsLiked: toJson(input.colorsLiked),
    colorsDisliked: toJson(input.colorsDisliked),
    mustKeep: toJson(input.mustKeep),
  };
  const row = await db.userProfile.upsert({ where: { apartmentId }, create: { ...data, apartmentId }, update: data });
  return toDomain(row);
}
