"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { summarizeIssues, validateDesign } from "@/domain/validator";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { samplePreset } from "@/lib/dev/samples";
import { SAMPLE_DESIGNS } from "@/lib/dev/sample-design";
import { requireUserId } from "../auth";
import { buildDesignContext } from "../context/build";
import { getApartment } from "../repo/apartments";
import { createDesign, getDesign } from "../repo/designs";
import { getProfile } from "../repo/profiles";
import { getRoom } from "../repo/rooms";

const Input = z.object({ apartmentId: z.uuid(), roomId: z.uuid(), preset: z.number().int().min(0) });

/**
 * Dev only: save a hand-made sample design through the real validator, so the
 * design page can be tested without calling the API.
 */
export async function insertSampleDesignAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  if (process.env.NODE_ENV === "production") return fail("Not available");
  const userId = await requireUserId();
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const { apartmentId, roomId, preset } = parsed.data;
  const [apartment, room, profile, ctx] = await Promise.all([
    getApartment(userId, apartmentId),
    getRoom(userId, roomId),
    getProfile(userId, apartmentId),
    buildDesignContext(userId, apartmentId),
  ]);
  if (!apartment || !room || !ctx || room.apartmentId !== apartment.id) return fail("Room not found");

  const content = samplePreset(SAMPLE_DESIGNS, preset);
  const issues = validateDesign({
    room,
    design: content,
    mustKeep: (profile?.mustKeep ?? []).filter((m) => m.roomId === room.id),
    budgetEur: profile?.budgetPerRoom[room.id] ?? null,
    renter: ctx.renter,
  });
  const previous = await getDesign(userId, roomId);
  const saved = await createDesign(userId, roomId, {
    content,
    validation: { status: summarizeIssues(issues).status, issues, repairAttempts: 0 },
    source: { model: "sample", promptId: "sample-design", promptVersion: "v1" },
    costEstimateEur: 0,
    durationMs: 0,
    parentVersion: previous?.version ?? null,
  });
  if (!saved) return fail("Room not found");
  revalidatePath(`/apartments/${apartmentId}`, "layout");
  return ok({ version: saved.version });
}
