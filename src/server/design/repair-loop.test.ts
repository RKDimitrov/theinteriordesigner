import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { renterRules } from "@/domain/context/renter-rules";
import type { DesignContent } from "@/domain/schemas/design";
import { validateDesign } from "@/domain/validator";
import { SAMPLE_DESIGN, SAMPLE_DESIGN_BROKEN } from "@/lib/dev/sample-design";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { modelForAttempt } from "./model-choice";
import { DesignGenerationError, type DesignTurn, type LoopDeps, runDesignLoop, SUBMIT_DESIGN_TOOL } from "./repair-loop";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/** Shape of a recorded response: thinking + forced tool call. Only fields the loop reads matter. */
function response(input: unknown, stop = "tool_use", id = "toolu_1"): BetaMessage {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: stop,
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id, name: "submit_design", input },
    ],
    usage: { input_tokens: 9000, output_tokens: 6000 },
  } as unknown as BetaMessage;
}

const validate = (d: DesignContent) =>
  validateDesign({ room: SAMPLE_ROOMS[0]!, design: d, mustKeep: [], budgetEur: null, renter: renterRules("DE", "rent") });

const deps = (turn: DesignTurn, extra: Partial<LoopDeps> = {}): LoopDeps => ({
  turn,
  validate,
  repairMessage: (issues, attempt) => `attempt ${attempt}: ${issues}`,
  ...extra,
});

describe("SUBMIT_DESIGN_TOOL", () => {
  it("exposes the DesignContent schema", () => {
    expect(SUBMIT_DESIGN_TOOL.input_schema.required).toEqual(expect.arrayContaining(["furniture", "palette", "longevity"]));
    expect(JSON.stringify(SUBMIT_DESIGN_TOOL.input_schema)).toContain("\"rotation\"");
    expect(JSON.stringify(SUBMIT_DESIGN_TOOL.input_schema)).not.toContain("$schema");
  });
});

describe("runDesignLoop", () => {
  it("returns a valid first design without repairs", async () => {
    const turn = vi.fn<DesignTurn>(async () => response(SAMPLE_DESIGN));
    const events: string[] = [];
    const r = await runDesignLoop("brief", deps(turn, { onProgress: (e) => events.push(e.stage) }));
    expect(r).toMatchObject({ status: "valid", repairAttempts: 0 });
    expect(turn).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["generating", "validating", "validating"]);
  });

  it("repairs an invalid design and sends issues back as an error tool_result", async () => {
    const turn = vi.fn<DesignTurn>().mockResolvedValueOnce(response(SAMPLE_DESIGN_BROKEN, "tool_use", "toolu_a")).mockResolvedValueOnce(response(SAMPLE_DESIGN));
    const r = await runDesignLoop("brief", deps(turn));
    expect(r).toMatchObject({ status: "valid", repairAttempts: 1 });
    const second = turn.mock.calls[1]![0];
    expect(second).toHaveLength(3);
    expect(second[1]!.role).toBe("assistant");
    const toolResult = (second[2]!.content as Anthropic.Beta.Messages.BetaToolResultBlockParam[])[0]!;
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "toolu_a", is_error: true });
    expect(String(toolResult.content)).toMatch(/attempt 1: .*OVERLAP/s);
  });

  it("keeps the best design and reports invalid after 3 repairs", async () => {
    const worse: DesignContent = {
      ...SAMPLE_DESIGN_BROKEN,
      furniture: SAMPLE_DESIGN_BROKEN.furniture.map((f) => (f.id === "tv-unit" ? { ...f, y: 250 } : f)),
    };
    const turn = vi.fn<DesignTurn>().mockResolvedValueOnce(response(worse)).mockResolvedValue(response(SAMPLE_DESIGN_BROKEN));
    const onTurn = vi.fn();
    const r = await runDesignLoop("brief", deps(turn, { onTurn }));
    expect(turn).toHaveBeenCalledTimes(4);
    expect(onTurn).toHaveBeenCalledTimes(4);
    expect(r.status).toBe("invalid");
    expect(r.content.concept.title).toBe(SAMPLE_DESIGN_BROKEN.concept.title);
    expect(r.content.furniture.find((f) => f.id === "tv-unit")!.y).toBe(190);
  });

  it("repairs schema errors", async () => {
    const bad = { ...SAMPLE_DESIGN, palette: { ...SAMPLE_DESIGN.palette, base: { ...SAMPLE_DESIGN.palette.base, hex: "white" } } };
    const turn = vi.fn<DesignTurn>().mockResolvedValueOnce(response(bad)).mockResolvedValueOnce(response(SAMPLE_DESIGN));
    const r = await runDesignLoop("brief", deps(turn));
    expect(r.repairAttempts).toBe(1);
    const feedback = (turn.mock.calls[1]![0][2]!.content as Anthropic.Beta.Messages.BetaToolResultBlockParam[])[0]!.content;
    expect(String(feedback)).toContain("palette.base.hex");
  });

  it("fails clearly on refusal, missing tool call and truncation", async () => {
    await expect(runDesignLoop("b", deps(async () => response(SAMPLE_DESIGN, "refusal")))).rejects.toMatchObject({ reason: "refused" });
    const noTool = { ...response(SAMPLE_DESIGN), content: [] } as BetaMessage;
    await expect(runDesignLoop("b", deps(async () => noTool))).rejects.toBeInstanceOf(DesignGenerationError);
    await expect(runDesignLoop("b", deps(async () => ({ ...noTool, stop_reason: "max_tokens" }) as BetaMessage))).rejects.toMatchObject({ reason: "truncated" });
  });

  it("fails when no attempt matches the schema", async () => {
    await expect(runDesignLoop("b", deps(async () => response({ nope: 1 })))).rejects.toMatchObject({ reason: "schema" });
  });
});

describe("modelForAttempt", () => {
  const models = { base: "claude-sonnet-5", escalate: "claude-opus-5" };
  it("uses the cheap model until the last repair", () => {
    expect([0, 1, 2, 3].map((a) => modelForAttempt(a, 3, models))).toEqual(["claude-sonnet-5", "claude-sonnet-5", "claude-sonnet-5", "claude-opus-5"]);
  });
  it("never escalates the first attempt", () => {
    expect(modelForAttempt(0, 0, models)).toBe("claude-sonnet-5");
  });
});
