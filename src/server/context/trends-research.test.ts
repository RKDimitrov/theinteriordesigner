import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { type CreateMessage, researchTrends, TrendsResearchError } from "./trends-research";

const usage = (input: number, output: number, searches = 0): Anthropic.Usage =>
  ({
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: { web_search_requests: searches, web_fetch_requests: 0 },
  }) as unknown as Anthropic.Usage;

/** Minimal recorded-shape messages. Only the fields researchTrends reads matter. */
function message(content: unknown[], stop: string, u: Anthropic.Usage): Anthropic.Message {
  return { id: "msg", type: "message", role: "assistant", model: "claude-sonnet-5", content, stop_reason: stop, usage: u } as unknown as Anthropic.Message;
}

const searchResult = {
  type: "web_search_tool_result",
  tool_use_id: "srv_1",
  content: [
    { type: "web_search_result", url: "https://www.example.de/wohntrends-2026", title: "Wohntrends 2026", encrypted_content: "x" },
    { type: "web_search_result", url: "https://www.example.de/wohntrends-2026", title: "dup", encrypted_content: "x" },
    { type: "web_search_result", url: "https://magazine.example.com/japandi", title: "Japandi now", encrypted_content: "x" },
  ],
};

const submit = (input: unknown) => ({ type: "tool_use", id: "tu_1", name: "submit_trends", input });

const goodInput = {
  trends: [
    { name: "Warm minimalism", description: "Soft whites with oak and linen.", category: "color", longevity: "lasting" },
    { name: "Bouclé everything", description: "Nubby fabric on chairs.", category: "material", longevity: "fad" },
  ],
  regionalCues: ["Rental flats: freestanding furniture dominates.", "  "],
};

const prompt = { system: "sys", user: "user" };

describe("researchTrends", () => {
  it("parses the submitted trends and takes sources from search results", async () => {
    const create: CreateMessage = vi.fn(async () =>
      message([{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } }, searchResult, submit(goodInput)], "tool_use", usage(1200, 400, 2)),
    );
    const out = await researchTrends(create, "claude-sonnet-5", prompt);
    expect(out.result.trends).toHaveLength(2);
    expect(out.result.regionalCues).toEqual(["Rental flats: freestanding furniture dominates."]);
    expect(out.result.sources.map((s) => s.url)).toEqual(["https://www.example.de/wohntrends-2026", "https://magazine.example.com/japandi"]);
    expect(out.usage).toMatchObject({ inputTokens: 1200, outputTokens: 400, webSearchRequests: 2 });

    const params = vi.mocked(create).mock.calls[0]![0];
    expect(params.tools?.map((t) => ("name" in t ? t.name : t.type))).toEqual(["web_search", "submit_trends"]);
    expect(params.tool_choice).toEqual({ type: "auto" });
  });

  it("continues after pause_turn and sums usage", async () => {
    const create = vi
      .fn<CreateMessage>()
      .mockResolvedValueOnce(message([searchResult], "pause_turn", usage(1000, 100, 3)))
      .mockResolvedValueOnce(message([submit(goodInput)], "tool_use", usage(500, 300, 1)));
    const out = await researchTrends(create, "m", prompt);
    expect(create).toHaveBeenCalledTimes(2);
    const second = create.mock.calls[1]![0];
    expect(second.messages).toHaveLength(2);
    expect(second.messages[1]!.role).toBe("assistant");
    expect(out.usage).toMatchObject({ inputTokens: 1500, outputTokens: 400, webSearchRequests: 4 });
    expect(out.result.sources).toHaveLength(2);
  });

  it("fails when the model answers without calling the tool", async () => {
    const create: CreateMessage = async () => message([{ type: "text", text: "Here are trends…" }], "end_turn", usage(10, 10));
    await expect(researchTrends(create, "m", prompt)).rejects.toMatchObject({ reason: "no_result" });
  });

  it("fails on refusal and on unusable input", async () => {
    await expect(researchTrends(async () => message([], "refusal", usage(1, 1)), "m", prompt)).rejects.toMatchObject({ reason: "refused" });
    await expect(researchTrends(async () => message([submit({ trends: [], regionalCues: [] })], "tool_use", usage(1, 1)), "m", prompt)).rejects.toBeInstanceOf(TrendsResearchError);
    await expect(researchTrends(async () => message([submit({ nope: true })], "tool_use", usage(1, 1)), "m", prompt)).rejects.toMatchObject({ reason: "invalid_result" });
  });

  it("gives up after too many continuations", async () => {
    const create: CreateMessage = async () => message([], "pause_turn", usage(1, 1));
    await expect(researchTrends(create, "m", prompt)).rejects.toMatchObject({ reason: "too_many_continuations" });
  });
});
