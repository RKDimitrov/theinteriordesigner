"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pruneToRooms } from "@/domain/profile/status";
import { scoreQuiz } from "@/domain/profile/quiz";
import { type StyleProfile, StyleProfileInput } from "@/domain/schemas/profile";
import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireUserId } from "../auth";
import { upsertProfile } from "../repo/profiles";
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
