import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { addUsage, type UsageCounts, ZERO_USAGE } from "@/domain/llm/cost";
import { usageFromApi } from "../llm/usage-map";
import { TrendCategory, TrendLongevity, type TrendsResult, TrendsResult as TrendsResultSchema } from "@/domain/schemas/context";

/**
 * Trend research with Claude + server-side web search. The client call is
 * injected so tests can replay a recorded response without network or cost.
 */
export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export class TrendsResearchError extends Error {
  constructor(
    readonly reason: "refused" | "no_result" | "invalid_result" | "too_many_continuations",
    message: string,
    readonly usage: UsageCounts,
  ) {
    super(message);
  }
}

/** What the model fills in. No length limits here: strict tool schemas do not support them; limits apply afterwards. */
const LlmTrends = z.object({
  trends: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      category: TrendCategory,
      longevity: TrendLongevity,
    }),
  ),
  regionalCues: z.array(z.string()),
});

const schema = z.toJSONSchema(LlmTrends);

export const SUBMIT_TRENDS_TOOL: Anthropic.Tool = {
  name: "submit_trends",
  description: "Submit the researched interior trends and regional cues. Call exactly once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    properties: schema.properties,
    required: schema.required,
    additionalProperties: false,
  },
};

export const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20260209 = { type: "web_search_20260209", name: "web_search", max_uses: 5 };

export const MAX_CONTINUATIONS = 3;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Search result links from the response, deduplicated. Never trust URLs the model writes itself. */
function collectSources(content: readonly Anthropic.ContentBlock[], into: Map<string, string>) {
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r.type === "web_search_result" && !into.has(r.url)) into.set(r.url, r.title);
    }
  }
}

export interface ResearchOutput {
  result: TrendsResult;
  usage: UsageCounts;
}

export async function researchTrends(create: CreateMessage, model: string, prompt: { system: string; user: string }): Promise<ResearchOutput> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt.user }];
  const sources = new Map<string, string>();
  let usage = ZERO_USAGE;

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const res = await create({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
      tools: [WEB_SEARCH_TOOL, SUBMIT_TRENDS_TOOL],
      tool_choice: { type: "auto" },
      output_config: { effort: "medium" },
      messages,
    });
    usage = addUsage(usage, usageFromApi(res.usage));
    collectSources(res.content, sources);

    if (res.stop_reason === "refusal") throw new TrendsResearchError("refused", "The model declined the request", usage);

    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === SUBMIT_TRENDS_TOOL.name);
    if (call) return { result: normalise(call.input, sources, usage), usage };

    if (res.stop_reason === "pause_turn") {
      // Server-side search loop paused: send the partial turn back unchanged and it resumes.
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    throw new TrendsResearchError("no_result", `The model finished without submitting trends (stop: ${res.stop_reason})`, usage);
  }
  throw new TrendsResearchError("too_many_continuations", "Trend research did not finish in time", usage);
}

function normalise(input: unknown, sources: Map<string, string>, usage: UsageCounts): TrendsResult {
  const raw = LlmTrends.safeParse(input);
  if (!raw.success) throw new TrendsResearchError("invalid_result", "The model returned trends in an unexpected shape", usage);
  const result = TrendsResultSchema.safeParse({
    trends: raw.data.trends.slice(0, 12).map((t) => ({ ...t, name: clip(t.name.trim(), 80), description: clip(t.description.trim(), 400) })),
    regionalCues: raw.data.regionalCues.map((c) => clip(c.trim(), 300)).filter(Boolean).slice(0, 8),
    sources: [...sources.entries()]
      .filter(([url]) => z.url().safeParse(url).success)
      .slice(0, 20)
      .map(([url, title]) => ({ url, title: clip(title || url, 200) })),
  });
  if (!result.success) throw new TrendsResearchError("invalid_result", "The model returned no usable trends", usage);
  return result.data;
}
