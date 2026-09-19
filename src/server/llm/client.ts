import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "../env";

export const MODELS = {
  /** Design generation and repair. */
  design: "claude-opus-5",
  /** Cheaper calls: trend research, later chat edits. */
  light: "claude-sonnet-5",
} as const;

export class LlmConfigError extends Error {}

let client: Anthropic | null = null;

/** Shared Anthropic client. Throws a readable error when the API key is missing. */
export function anthropic(): Anthropic {
  if (client) return client;
  if (!serverEnv.ANTHROPIC_API_KEY) throw new LlmConfigError("ANTHROPIC_API_KEY is not set in .env");
  client = new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  return client;
}
