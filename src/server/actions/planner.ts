"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WallOutlooks } from "@/domain/context/outside";
import { renterRules } from "@/domain/context/renter-rules";
import { RoomFinishes } from "@/domain/materials/library";
import { FitOut } from "@/domain/room/fit-out";
import { blankDesign, PLANNER_SOURCE, withFurniture } from "@/domain/planner/items";
import { FurnitureItem } from "@/domain/schemas/design";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { summarizeIssues, validateDesign } from "@/domain/validator";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUserId } from "../auth";
import { getApartment, setApartmentFitOut } from "../repo/apartments";
import { createDesign, type DesignStatus, getDesign, updateDesign } from "../repo/designs";
import { getProfile } from "../repo/profiles";
import { getRoom, setRoomFinishes, setRoomOutlooks } from "../repo/rooms";

const FitOutInput = z.object({ apartmentId: z.uuid(), fitOut: FitOut });

/** Save the apartment's default door, window and radiator styles and finishes. */
export async function saveFitOutAction(input: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = FitOutInput.safeParse(input);
  if (!parsed.success) return fail("Invalid fit-out");
  if (!(await setApartmentFitOut(userId, parsed.data.apartmentId, parsed.data.fitOut))) return fail("Apartment not found");
  revalidatePath(`/apartments/${parsed.data.apartmentId}/planner`);
  return ok(null);
}

const FinishesInput = z.object({
  apartmentId: z.uuid(),
  rooms: z.array(z.object({ roomId: z.uuid(), finishes: RoomFinishes })).min(1).max(40),
});

/** Save floor, wall and ceiling materials for one or more rooms (the rooms in view). */
export async function saveRoomFinishesAction(input: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = FinishesInput.safeParse(input);
  if (!parsed.success) return fail("Invalid finishes");
  const saved = await Promise.all(parsed.data.rooms.map((r) => setRoomFinishes(userId, r.roomId, r.finishes)));
  if (saved.some((s) => !s)) return fail("Room not found");
  revalidatePath(`/apartments/${parsed.data.apartmentId}/planner`);
  return ok(null);
}

const OutlooksInput = z.object({ apartmentId: z.uuid(), roomId: z.uuid(), outlooks: WallOutlooks });

/** Save what each wall of a room looks onto (street, courtyard, garden, open). */
export async function saveRoomOutlooksAction(input: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = OutlooksInput.safeParse(input);
  if (!parsed.success) return fail("Invalid outlooks");
  if (!(await setRoomOutlooks(userId, parsed.data.roomId, parsed.data.outlooks))) return fail("Room not found");
  revalidatePath(`/apartments/${parsed.data.apartmentId}/planner`);
  return ok(null);
}

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
