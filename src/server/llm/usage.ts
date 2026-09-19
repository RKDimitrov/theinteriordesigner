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
