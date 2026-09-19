"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUserId } from "../auth";
import { resetLocation } from "../context/build";
import { refreshTrends, TrendsUnavailableError } from "../context/trends";
import { TrendsResearchError } from "../context/trends-research";
import { LlmConfigError } from "../llm/client";

const Uuid = z.uuid();

export async function refreshTrendsAction(apartmentId: unknown): Promise<ActionResult<{ count: number }>> {
  const userId = await requireUserId();
  const id = Uuid.safeParse(apartmentId);
  if (!id.success) return fail("Invalid apartment id");
  try {
    const trends = await refreshTrends(userId, id.data);
    revalidatePath(`/apartments/${id.data}`, "layout");
    return ok({ count: trends.trends.length });
  } catch (e) {
    if (e instanceof TrendsUnavailableError || e instanceof LlmConfigError || e instanceof TrendsResearchError) return fail(e.message);
    if (e instanceof Anthropic.RateLimitError) return fail("The AI service is busy. Try again in a minute.");
    if (e instanceof Anthropic.AuthenticationError) return fail("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.APIError) return fail(`AI service error (${e.status ?? "network"}). Try again later.`);
    throw e;
  }
}

export async function refreshLocationAction(apartmentId: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const id = Uuid.safeParse(apartmentId);
  if (!id.success) return fail("Invalid apartment id");
  if (!(await resetLocation(userId, id.data))) return fail("Apartment not found");
  revalidatePath(`/apartments/${id.data}`, "layout");
  return ok(null);
}
