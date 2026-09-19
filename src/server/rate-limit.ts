import "server-only";
import { db } from "./db";

export interface Window {
  seconds: number;
  max: number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window limiter backed by RateLimitHit rows. Counts the user's hits in
 * each window and records a new hit only when every window has room.
 */
export async function hitRateLimit(userId: string, bucket: string, windows: readonly Window[]): Promise<RateLimitResult> {
  const now = Date.now();
  for (const w of windows) {
    const since = new Date(now - w.seconds * 1000);
    const hits = await db.rateLimitHit.findMany({
      where: { userId, bucket, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: w.max,
    });
    const oldest = hits[0];
    if (hits.length >= w.max && oldest) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest.createdAt.getTime() + w.seconds * 1000 - now) / 1000)) };
    }
  }
  await db.rateLimitHit.create({ data: { userId, bucket } });
  return { ok: true };
}

export const LIMITS = {
  trends: [{ seconds: 3600, max: 5 }],
  design: [
    { seconds: 3600, max: 5 },
    { seconds: 86_400, max: 10 },
  ],
} as const satisfies Record<string, readonly Window[]>;
