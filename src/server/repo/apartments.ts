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
  const { count } = await db.apartment.updateMany({ where: { id, userId }, data: input });
  return count === 0 ? null : getApartment(userId, id);
}

export async function deleteApartment(userId: string, id: string): Promise<boolean> {
  const { count } = await db.apartment.deleteMany({ where: { id, userId } });
  return count > 0;
}
