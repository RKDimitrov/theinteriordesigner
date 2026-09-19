import type { UsageCounts } from "@/domain/llm/cost";

/** The usage fields shared by regular and beta API responses. */
export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** Map an API usage object to our counters. */
export function usageFromApi(u: ApiUsage): UsageCounts {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    webSearchRequests: u.server_tool_use?.web_search_requests ?? 0,
  };
}
