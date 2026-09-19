import type Anthropic from "@anthropic-ai/sdk";
import type { UsageCounts } from "@/domain/llm/cost";

/** Map an API usage object to our counters. */
export function usageFromApi(u: Anthropic.Usage): UsageCounts {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    webSearchRequests: u.server_tool_use?.web_search_requests ?? 0,
  };
}
