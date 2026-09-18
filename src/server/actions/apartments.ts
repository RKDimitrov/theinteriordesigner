"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { ApartmentInput } from "@/domain/schemas/apartment";
import { requireUserId } from "../auth";
import * as repo from "../repo/apartments";

const Uuid = z.uuid();

export async function createApartmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = ApartmentInput.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", zodFieldErrors(parsed.error));
  const apt = await repo.createApartment(userId, parsed.data);
  revalidatePath("/apartments");
  return ok({ id: apt.id });
}

export async function updateApartmentAction(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const aptId = Uuid.safeParse(id);
  if (!aptId.success) return fail("Invalid apartment id");
  const parsed = ApartmentInput.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", zodFieldErrors(parsed.error));
  const apt = await repo.updateApartment(userId, aptId.data, parsed.data);
  if (!apt) return fail("Apartment not found");
  revalidatePath(`/apartments/${apt.id}`);
  return ok({ id: apt.id });
}

export async function deleteApartmentAction(id: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const aptId = Uuid.safeParse(id);
  if (!aptId.success) return fail("Invalid apartment id");
  if (!(await repo.deleteApartment(userId, aptId.data))) return fail("Apartment not found");
  revalidatePath("/apartments");
  return ok(null);
}
