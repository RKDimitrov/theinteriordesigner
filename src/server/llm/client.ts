import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "../env";

export const MODELS = {
  /** Cheaper calls: trend research, later chat edits. */
  light: "claude-sonnet-5",
} as const;

/** Design models and thinking depth, overridable in .env (see src/server/env.ts). */
export const designModels = () => ({
  base: serverEnv.DESIGN_MODEL,
  escalate: serverEnv.DESIGN_ESCALATE_MODEL,
  effort: serverEnv.DESIGN_EFFORT,
  maxRepairs: serverEnv.DESIGN_MAX_REPAIRS,
});

export class LlmConfigError extends Error {}

let client: Anthropic | null = null;

/** Shared Anthropic client. Throws a readable error when the API key is missing. */
export function anthropic(): Anthropic {
  if (client) return client;
  if (!serverEnv.ANTHROPIC_API_KEY) throw new LlmConfigError("ANTHROPIC_API_KEY is not set in .env");
  client = new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  return client;
}
