import "server-only";
import type { z } from "zod";
import { db } from "../db";
import { toJson } from "../repo/json";

export type CacheKind = "geocode" | "climate" | "trends";

const DAY_MS = 86_400_000;

/** Unexpired cache entry parsed with `schema`, or null (missing, expired or no longer valid). */
export async function getCached<S extends z.ZodType>(key: string, schema: S): Promise<{ value: z.infer<S>; fetchedAt: Date } | null> {
  const row = await db.contextCache.findUnique({ where: { key } });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  const parsed = schema.safeParse(row.payload);
  return parsed.success ? { value: parsed.data, fetchedAt: row.fetchedAt } : null;
}

export async function putCached<T extends object>(key: string, kind: CacheKind, payload: T, ttlDays: number): Promise<void> {
  const now = new Date();
  const data = { kind, payload: toJson(payload), fetchedAt: now, expiresAt: new Date(now.getTime() + ttlDays * DAY_MS) };
  await db.contextCache.upsert({ where: { key }, create: { key, ...data }, update: data });
}

export async function deleteCached(keys: readonly string[]): Promise<void> {
  await db.contextCache.deleteMany({ where: { key: { in: [...keys] } } });
}

export const cacheKeys = {
  geocode: (country: string, city: string) => `geocode:${country.toUpperCase()}:${city.trim().toLowerCase()}`,
  climate: (lat: number, lng: number) => `climate:${lat.toFixed(2)}:${lng.toFixed(2)}`,
  trends: (country: string, style: string) => `trends:${country.toUpperCase()}:${style}`,
};
