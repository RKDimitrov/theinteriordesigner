import "server-only";
import { estimateCostEur, type UsageCounts } from "@/domain/llm/cost";
import type { PromptDef } from "@/prompts";
import { db } from "../db";

export interface LlmCallLog {
  userId: string;
  apartmentId: string | null;
  purpose: string;
  model: string;
  prompt: PromptDef;
  usage: UsageCounts;
  durationMs: number;
  error?: string;
}

/** Persist one call's tokens and estimated cost. Returns the row id. Never throws: logging must not break the feature. */
export async function logLlmCall(c: LlmCallLog): Promise<string | null> {
  try {
    const row = await db.llmCall.create({
      data: {
        userId: c.userId,
        apartmentId: c.apartmentId,
        purpose: c.purpose,
        model: c.model,
        promptId: c.prompt.id,
        promptVersion: c.prompt.version,
        ...c.usage,
        costEstimateEur: estimateCostEur(c.model, c.usage),
        durationMs: Math.round(c.durationMs),
        status: c.error ? "error" : "ok",
        error: c.error?.slice(0, 1000) ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.error("Failed to log LLM call", e);
    return null;
  }
}

export interface MonthlyUsage {
  /** Calls and estimated EUR per purpose ("design", "repair", "trends", …). */
  byPurpose: { purpose: string; calls: number; costEur: number }[];
  totalEur: number;
}

/** The user's Claude usage since the first of this month (UTC). */
export async function monthlyUsage(userId: string, now = new Date()): Promise<MonthlyUsage> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db.llmCall.groupBy({
    by: ["purpose"],
    where: { userId, createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { costEstimateEur: true },
  });
  const byPurpose = rows.map((r) => ({ purpose: r.purpose, calls: r._count._all, costEur: r._sum.costEstimateEur ?? 0 }));
  return { byPurpose, totalEur: byPurpose.reduce((s, r) => s + r.costEur, 0) };
}
