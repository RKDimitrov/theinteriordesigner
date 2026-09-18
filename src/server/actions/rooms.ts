"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { RoomInput } from "@/domain/room/check-room";
import type { Room } from "@/domain/schemas/room";
import { requireUserId } from "../auth";
import * as repo from "../repo/rooms";

const Uuid = z.uuid();

export async function createRoomAction(apartmentId: unknown, input: unknown): Promise<ActionResult<Room>> {
  const userId = await requireUserId();
  const aptId = Uuid.safeParse(apartmentId);
  if (!aptId.success) return fail("Invalid apartment id");
  const parsed = RoomInput.safeParse(input);
  if (!parsed.success) return fail("Room has problems", zodFieldErrors(parsed.error));
  const room = await repo.createRoom(userId, aptId.data, parsed.data);
  if (!room) return fail("Apartment not found");
  revalidatePath(`/apartments/${aptId.data}`, "layout");
  return ok(room);
}

export async function updateRoomAction(roomId: unknown, input: unknown): Promise<ActionResult<Room>> {
  const userId = await requireUserId();
  const id = Uuid.safeParse(roomId);
  if (!id.success) return fail("Invalid room id");
  const parsed = RoomInput.safeParse(input);
  if (!parsed.success) return fail("Room has problems", zodFieldErrors(parsed.error));
  const room = await repo.updateRoom(userId, id.data, parsed.data);
  if (!room) return fail("Room not found");
  revalidatePath(`/apartments/${room.apartmentId}`, "layout");
  return ok(room);
}

export async function deleteRoomAction(roomId: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const id = Uuid.safeParse(roomId);
  if (!id.success) return fail("Invalid room id");
  const room = await repo.getRoom(userId, id.data);
  if (!room || !(await repo.deleteRoom(userId, id.data))) return fail("Room not found");
  revalidatePath(`/apartments/${room.apartmentId}`, "layout");
  return ok(null);
}
