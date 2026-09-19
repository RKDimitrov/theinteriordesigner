/**
 * Rough cost estimate for logging. Prices in USD per million tokens (Anthropic
 * list prices); converted with a fixed rate. Not for billing.
 */
export const PRICES_USD: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
};

export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;
/** Estimate: USD per web search request. */
export const WEB_SEARCH_USD = 10 / 1000;
export const USD_TO_EUR = 0.92;

export interface UsageCounts {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearchRequests: number;
}

export function estimateCostEur(model: string, u: UsageCounts): number {
  const p = PRICES_USD[model];
  if (!p) return 0;
  const perToken = (usdPerMTok: number) => usdPerMTok / 1_000_000;
  const usd =
    u.inputTokens * perToken(p.input) +
    u.cacheWriteTokens * perToken(p.input) * CACHE_WRITE_MULTIPLIER +
    u.cacheReadTokens * perToken(p.input) * CACHE_READ_MULTIPLIER +
    u.outputTokens * perToken(p.output) +
    u.webSearchRequests * WEB_SEARCH_USD;
  return Math.round(usd * USD_TO_EUR * 10_000) / 10_000;
}

export function addUsage(a: UsageCounts, b: UsageCounts): UsageCounts {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    webSearchRequests: a.webSearchRequests + b.webSearchRequests,
  };
}

export const ZERO_USAGE: UsageCounts = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, webSearchRequests: 0 };
