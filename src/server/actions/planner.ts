"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { renterRules } from "@/domain/context/renter-rules";
import { blankDesign, PLANNER_SOURCE, withFurniture } from "@/domain/planner/items";
import { FurnitureItem } from "@/domain/schemas/design";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { summarizeIssues, validateDesign } from "@/domain/validator";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUserId } from "../auth";
import { getApartment } from "../repo/apartments";
import { createDesign, type DesignStatus, getDesign, updateDesign } from "../repo/designs";
import { getProfile } from "../repo/profiles";
import { getRoom } from "../repo/rooms";

const SaveInput = z.object({
  apartmentId: z.uuid(),
  roomId: z.uuid(),
  furniture: z.array(FurnitureItem).max(40),
});

export interface SavedPlan {
  version: number | null;
  status: DesignStatus | null;
  issues: ValidationIssue[];
}

/**
 * Save the pieces the user placed in the planner, checked by the real validator.
 * The first edit on top of a generated design becomes a new version; later edits
 * update that planner version.
 */
export async function savePlannerRoomAction(input: unknown): Promise<ActionResult<SavedPlan>> {
  const userId = await requireUserId();
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return fail("Invalid plan");
  const { apartmentId, roomId, furniture } = parsed.data;
  const ids = new Set<string>();
  for (const f of furniture) {
    if (ids.has(f.id)) return fail("Duplicate piece id");
    ids.add(f.id);
  }

  const [apartment, room, profile, latest] = await Promise.all([
    getApartment(userId, apartmentId),
    getRoom(userId, roomId),
    getProfile(userId, apartmentId),
    getDesign(userId, roomId),
  ]);
  if (!apartment || !room || room.apartmentId !== apartment.id) return fail("Room not found");
  if (!latest && furniture.length === 0) return ok({ version: null, status: null, issues: [] });

  const started = performance.now();
  const content = latest ? withFurniture(latest.content, furniture) : blankDesign(room.name, furniture);
  const issues = validateDesign({
    room,
    design: content,
    mustKeep: (profile?.mustKeep ?? []).filter((m) => m.roomId === room.id),
    budgetEur: profile?.budgetPerRoom[room.id] ?? null,
    renter: renterRules(apartment.country, apartment.tenure),
  });
  const validation = { status: summarizeIssues(issues).status, issues, repairAttempts: 0 };
  const durationMs = performance.now() - started;

  const saved =
    latest && latest.source.promptId === PLANNER_SOURCE.promptId
      ? await updateDesign(userId, latest.id, { content, validation, durationMs })
      : await createDesign(userId, roomId, {
          content,
          validation,
          source: PLANNER_SOURCE,
          costEstimateEur: 0,
          durationMs,
          parentVersion: latest?.version ?? null,
        });
  if (!saved) return fail("Room not found");
  revalidatePath(`/apartments/${apartmentId}`);
  revalidatePath(`/apartments/${apartmentId}/design/${roomId}`);
  return ok({ version: saved.version, status: validation.status, issues });
}
