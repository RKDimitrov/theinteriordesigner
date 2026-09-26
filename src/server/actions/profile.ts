"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pruneToRooms } from "@/domain/profile/status";
import { scoreQuiz } from "@/domain/profile/quiz";
import { MAX_BUDGET_EUR, type StyleProfile, StyleProfileInput } from "@/domain/schemas/profile";
import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireUserId } from "../auth";
import { getProfile, upsertProfile } from "../repo/profiles";
import { listRooms } from "../repo/rooms";

const Uuid = z.uuid();

export async function saveProfileAction(apartmentId: unknown, input: unknown): Promise<ActionResult<StyleProfile>> {
  const userId = await requireUserId();
  const aptId = Uuid.safeParse(apartmentId);
  if (!aptId.success) return fail("Invalid apartment id");
  const parsed = StyleProfileInput.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", zodFieldErrors(parsed.error));

  const rooms = await listRooms(userId, aptId.data);
  const clean = pruneToRooms(parsed.data, rooms.map((r) => r.id));
  // Scores are always derived here; the client never sends them.
  const profile = await upsertProfile(userId, aptId.data, clean, scoreQuiz(clean.quizAnswers));
  if (!profile) return fail("Apartment not found");
  revalidatePath(`/apartments/${aptId.data}`, "layout");
  return ok(profile);
}

const Budget = z.number().int().min(0).max(MAX_BUDGET_EUR);

/** Set one room's budget in an existing style profile (e.g. from the new-room form). */
export async function setRoomBudgetAction(apartmentId: unknown, roomId: unknown, eur: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const aptId = Uuid.safeParse(apartmentId);
  const rId = Uuid.safeParse(roomId);
  const budget = Budget.safeParse(eur);
  if (!aptId.success || !rId.success) return fail("Invalid id");
  if (!budget.success) return fail("Invalid budget");

  const [profile, rooms] = await Promise.all([getProfile(userId, aptId.data), listRooms(userId, aptId.data)]);
  if (!profile) return fail("No style profile yet");
  if (!rooms.some((r) => r.id === rId.data)) return fail("Room not found");

  const input: StyleProfileInput = {
    household: profile.household,
    budgetPerRoom: { ...profile.budgetPerRoom, [rId.data]: budget.data },
    quizAnswers: profile.quizAnswers,
    colorsLiked: profile.colorsLiked,
    colorsDisliked: profile.colorsDisliked,
    mustKeep: profile.mustKeep,
  };
  const saved = await upsertProfile(userId, aptId.data, input, profile.scores);
  if (!saved) return fail("Apartment not found");
  revalidatePath(`/apartments/${aptId.data}`, "layout");
  return ok(null);
}
