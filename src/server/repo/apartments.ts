import "server-only";
import type { Apartment as ApartmentRow } from "@/generated/prisma/client";
import { Apartment, type ApartmentInput } from "@/domain/schemas/apartment";
import { db } from "../db";
import { isUuid } from "./ids";

/** Every function takes the owner's userId and never returns another user's data. */

function toDomain(row: ApartmentRow): Apartment {
  return Apartment.parse({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    country: row.country,
    floorLevel: row.floorLevel,
    tenure: row.tenure,
    totalAreaM2: row.totalAreaM2,
    yearBuilt: row.yearBuilt,
    northAngleDeg: row.northAngleDeg,
    lat: row.lat,
    lng: row.lng,
  });
}

export async function listApartments(userId: string): Promise<(Apartment & { roomCount: number })[]> {
  const rows = await db.apartment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rooms: true } } },
  });
  return rows.map((r) => ({ ...toDomain(r), roomCount: r._count.rooms }));
}

export async function getApartment(userId: string, id: string): Promise<Apartment | null> {
  if (!isUuid(id)) return null;
  const row = await db.apartment.findFirst({ where: { id, userId } });
  return row ? toDomain(row) : null;
}

export async function createApartment(userId: string, input: ApartmentInput): Promise<Apartment> {
  const row = await db.apartment.create({ data: { ...input, userId } });
  return toDomain(row);
}

export async function updateApartment(userId: string, id: string, input: ApartmentInput): Promise<Apartment | null> {
  const before = await getApartment(userId, id);
  if (!before) return null;
  // A new city means the stored coordinates (and the climate derived from them) are stale.
  const moved = before.city.trim().toLowerCase() !== input.city.trim().toLowerCase() || before.country !== input.country;
  await db.apartment.updateMany({ where: { id, userId }, data: moved ? { ...input, lat: null, lng: null } : input });
  return getApartment(userId, id);
}

/** Store (or clear) geocoded coordinates. */
export async function setApartmentLocation(userId: string, id: string, loc: { lat: number; lng: number } | null): Promise<void> {
  if (!isUuid(id)) return;
  await db.apartment.updateMany({ where: { id, userId }, data: { lat: loc?.lat ?? null, lng: loc?.lng ?? null } });
}

export async function deleteApartment(userId: string, id: string): Promise<boolean> {
  const { count } = await db.apartment.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Last change to the apartment, its rooms or their designs. */
export async function apartmentRevisedAt(userId: string, id: string): Promise<Date | null> {
  if (!isUuid(id)) return null;
  const [apt, room, design] = await Promise.all([
    db.apartment.findFirst({ where: { id, userId }, select: { updatedAt: true } }),
    db.room.aggregate({ where: { apartmentId: id, apartment: { userId } }, _max: { updatedAt: true } }),
    db.design.aggregate({ where: { room: { apartmentId: id, apartment: { userId } } }, _max: { createdAt: true } }),
  ]);
  if (!apt) return null;
  const dates = [apt.updatedAt, room._max.updatedAt, design._max.createdAt].filter((d): d is Date => d != null);
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}
