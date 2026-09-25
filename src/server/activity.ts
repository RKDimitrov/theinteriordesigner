import "server-only";
import { topStyles } from "@/domain/profile/quiz";
import type { Apartment } from "@/domain/schemas/apartment";
import { Climate } from "@/domain/schemas/context";
import type { StyleKey } from "@/domain/schemas/profile";
import { cacheKeys, getCached } from "./context/cache";
import { getCachedTrends } from "./context/trends";
import { db } from "./db";
import { DesignStatus } from "./repo/designs";
import { getProfile } from "./repo/profiles";

export type ActivityEntry = { at: Date; key: string } & (
  | { kind: "design"; room: string; version: number; status: DesignStatus }
  | { kind: "room"; room: string }
  | { kind: "climate"; city: string }
  | { kind: "trends"; style: StyleKey }
);

/**
 * Recent entries across the user's apartments: saved designs, added rooms,
 * climate fetches and trend research. Reads stored data only.
 */
export async function recentActivity(userId: string, apartments: readonly Apartment[], limit = 6): Promise<ActivityEntry[]> {
  const [designs, rooms, context] = await Promise.all([
    db.design.findMany({
      where: { room: { apartment: { userId } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, version: true, status: true, createdAt: true, room: { select: { name: true } } },
    }),
    db.room.findMany({
      where: { apartment: { userId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, createdAt: true },
    }),
    Promise.all(apartments.map((a) => contextEntries(userId, a))),
  ]);

  const entries: ActivityEntry[] = [
    ...designs.map((d) => ({
      kind: "design" as const,
      key: `design-${d.id}`,
      at: d.createdAt,
      room: d.room.name,
      version: d.version,
      status: DesignStatus.parse(d.status),
    })),
    ...rooms.map((r) => ({ kind: "room" as const, key: `room-${r.id}`, at: r.createdAt, room: r.name })),
    ...context.flat(),
  ];
  // Apartments in the same city share one cache row; show it once.
  const seen = new Set<string>();
  return entries
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)))
    .slice(0, limit);
}

async function contextEntries(userId: string, apt: Apartment): Promise<ActivityEntry[]> {
  const out: ActivityEntry[] = [];
  const [climate, profile] = await Promise.all([
    apt.lat !== null && apt.lng !== null ? getCached(cacheKeys.climate(apt.lat, apt.lng), Climate) : null,
    getProfile(userId, apt.id),
  ]);
  if (climate) out.push({ kind: "climate", key: `climate-${apt.lat}-${apt.lng}`, at: climate.fetchedAt, city: apt.city });
  const main = profile ? topStyles(profile.scores, 1)[0] : undefined;
  const trends = main ? await getCachedTrends(apt.country, main.style) : null;
  if (main && trends) out.push({ kind: "trends", key: `trends-${apt.country}-${main.style}`, at: new Date(trends.fetchedAt), style: main.style });
  return out;
}
