import "server-only";
import type { Room as RoomRow } from "@/generated/prisma/client";
import type { RoomInput } from "@/domain/room/check-room";
import type { WallOutlooks } from "@/domain/context/outside";
import type { RoomFinishes } from "@/domain/materials/library";
import { Room } from "@/domain/schemas/room";
import { db } from "../db";
import { isUuid } from "./ids";
import { toJson } from "./json";

function toDomain(row: RoomRow): Room {
  return Room.parse({
    id: row.id,
    apartmentId: row.apartmentId,
    sortOrder: row.sortOrder,
    name: row.name,
    type: row.type,
    polygon: row.polygon,
    ceilingHeight: row.ceilingHeight,
    openings: row.openings,
    fixedElements: row.fixedElements,
    wallOrientationOverrides: row.wallOrientationOverrides,
    finishes: row.finishes,
    wallOutlooks: row.wallOutlooks,
  });
}

function toData(room: RoomInput) {
  return {
    name: room.name,
    type: room.type,
    polygon: toJson(room.polygon),
    ceilingHeight: room.ceilingHeight,
    openings: toJson(room.openings),
    fixedElements: toJson(room.fixedElements),
    wallOrientationOverrides: toJson(room.wallOrientationOverrides),
  };
}

export async function listRooms(userId: string, apartmentId: string): Promise<Room[]> {
  if (!isUuid(apartmentId)) return [];
  const rows = await db.room.findMany({
    where: { apartmentId, apartment: { userId } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDomain);
}

export async function getRoom(userId: string, roomId: string): Promise<Room | null> {
  if (!isUuid(roomId)) return null;
  const row = await db.room.findFirst({ where: { id: roomId, apartment: { userId } } });
  return row ? toDomain(row) : null;
}

export async function createRoom(userId: string, apartmentId: string, room: RoomInput): Promise<Room | null> {
  const owner = await db.apartment.findFirst({ where: { id: apartmentId, userId }, select: { id: true } });
  if (!owner) return null;
  const sortOrder = await db.room.count({ where: { apartmentId } });
  const row = await db.room.create({ data: { ...toData(room), apartmentId, sortOrder } });
  return toDomain(row);
}

export async function updateRoom(userId: string, roomId: string, room: RoomInput): Promise<Room | null> {
  const { count } = await db.room.updateMany({ where: { id: roomId, apartment: { userId } }, data: toData(room) });
  return count === 0 ? null : getRoom(userId, roomId);
}

export async function deleteRoom(userId: string, roomId: string): Promise<boolean> {
  const { count } = await db.room.deleteMany({ where: { id: roomId, apartment: { userId } } });
  return count > 0;
}

/** Store what each wall looks onto. */
export async function setRoomOutlooks(userId: string, roomId: string, outlooks: WallOutlooks): Promise<boolean> {
  if (!isUuid(roomId)) return false;
  const { count } = await db.room.updateMany({ where: { id: roomId, apartment: { userId } }, data: { wallOutlooks: toJson(outlooks) } });
  return count > 0;
}

/** Store the room's floor, wall and ceiling materials. */
export async function setRoomFinishes(userId: string, roomId: string, finishes: RoomFinishes): Promise<boolean> {
  if (!isUuid(roomId)) return false;
  const { count } = await db.room.updateMany({ where: { id: roomId, apartment: { userId } }, data: { finishes: toJson(finishes) } });
  return count > 0;
}
