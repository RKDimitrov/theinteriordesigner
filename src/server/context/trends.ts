import "server-only";
import { topStyles } from "@/domain/profile/quiz";
import { CachedTrends } from "@/domain/schemas/context";
import type { StyleKey } from "@/domain/schemas/profile";
import { PROMPTS } from "@/prompts";
import { anthropic, MODELS } from "../llm/client";
import { buildPrompt } from "../llm/prompts";
import { logLlmCall } from "../llm/usage";
import { hitRateLimit, LIMITS } from "../rate-limit";
import { getApartment } from "../repo/apartments";
import { getProfile } from "../repo/profiles";
import { cacheKeys, getCached, putCached } from "./cache";
import { researchTrends, TrendsResearchError } from "./trends-research";

export const TRENDS_TTL_DAYS = 90;

export async function getCachedTrends(country: string, style: StyleKey): Promise<CachedTrends | null> {
  const hit = await getCached(cacheKeys.trends(country, style), CachedTrends);
  return hit?.value ?? null;
}

export class TrendsUnavailableError extends Error {}

/**
 * Research trends for the apartment's country and top style, cache them for
 * 90 days and log the call. Rate-limited per user.
 */
export async function refreshTrends(userId: string, apartmentId: string): Promise<CachedTrends> {
  const [apartment, profile] = await Promise.all([getApartment(userId, apartmentId), getProfile(userId, apartmentId)]);
  if (!apartment) throw new TrendsUnavailableError("Apartment not found");
  const styles = profile ? topStyles(profile.scores, 3) : [];
  const main = styles[0];
  if (!main) throw new TrendsUnavailableError("Complete the style quiz first, so trends can match your style");

  const limit = await hitRateLimit(userId, "trends", LIMITS.trends);
  if (!limit.ok) throw new TrendsUnavailableError(`Trend research limit reached. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`);

  const def = PROMPTS.trendsResearch;
  const prompt = await buildPrompt(def, {
    country: apartment.country,
    city: apartment.city,
    style: main.style,
    secondaryStyles: styles.slice(1).map((s) => s.style).join(", ") || "none",
    tenure: apartment.tenure === "rent" ? "renting" : "owner",
    today: new Date().toISOString().slice(0, 10),
  });

  const model = MODELS.light;
  const started = Date.now();
  const client = anthropic();
  try {
    const { result, usage } = await researchTrends((p) => client.messages.create(p), model, prompt);
    await logLlmCall({ userId, apartmentId, purpose: "trends", model, prompt: def, usage, durationMs: Date.now() - started });
    const cached: CachedTrends = { ...result, country: apartment.country, style: main.style, model, fetchedAt: new Date().toISOString() };
    await putCached(cacheKeys.trends(apartment.country, main.style), "trends", cached, TRENDS_TTL_DAYS);
    return cached;
  } catch (e) {
    const usage = e instanceof TrendsResearchError ? e.usage : { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, webSearchRequests: 0 };
    await logLlmCall({
      userId,
      apartmentId,
      purpose: "trends",
      model,
      prompt: def,
      usage,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
