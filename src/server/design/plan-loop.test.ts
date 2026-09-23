import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { runPipeline, type PipelineResult } from "@/domain/design/pipeline";
import type { DesignPlanInput } from "@/domain/schemas/design";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { summarizeIssues } from "@/domain/validator";
import { SAMPLE_DESIGN } from "@/lib/dev/sample-design";
import { SAMPLE_PLAN } from "@/lib/dev/sample-plan";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { DesignGenerationError } from "./repair-loop";
import { type PlanLoopDeps, type PlanTurn, runPlanLoop, SUBMIT_PATCH, SUBMIT_PATCH_TOOL, SUBMIT_PLAN, SUBMIT_PLAN_TOOL } from "./plan-loop";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;

/** Recorded-shape response: thinking + forced tool call. */
function response(name: string, input: unknown, opts: { stop?: string; id?: string } = {}): BetaMessage {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    stop_reason: opts.stop ?? "tool_use",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: opts.id ?? "toolu_1", name, input },
    ],
    usage: { input_tokens: 6000, output_tokens: 2500 },
  } as unknown as BetaMessage;
}

const error = (code: ValidationIssue["code"], itemIds: string[] = []): ValidationIssue => ({ code, severity: "error", itemIds, message: code, hint: "fix it" });

/** Fake pipeline result with the given issues. */
const fake = (issues: ValidationIssue[]): PipelineResult => ({
  content: SAMPLE_DESIGN,
  issues,
  status: summarizeIssues(issues).status,
  stats: { durationMs: 5, iterations: 0, evaluations: 1, autofixPasses: 0, dropped: [], autofixLog: [] },
});

const room = SAMPLE_ROOMS[0]!;
const mustKeep = [{ id: "keep-1", name: "Grandma's sideboard", category: "sideboard" as const, w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: null }];
const realPipeline = (plan: DesignPlanInput) => runPipeline({ plan, room, mustKeep, budgetEur: null, renter: null });

const deps = (turn: PlanTurn, extra: Partial<PlanLoopDeps> = {}): PlanLoopDeps => ({
  turn,
  pipeline: realPipeline,
  repairMessage: (p, attempt) => `repair ${attempt}: ${p.errorCount} errors ${p.issues} dropped ${p.dropped}`,
  ...extra,
});

describe("plan tools", () => {
  it("ask for intents, never coordinates", () => {
    const plan = JSON.stringify(SUBMIT_PLAN_TOOL.input_schema);
    expect(plan).toContain('"intent"');
    expect(plan).toContain('"sizeClass"');
    expect(plan).not.toContain('"rotation"');
    expect(plan).not.toContain('"elevation"');
    expect(SUBMIT_PATCH_TOOL.input_schema.properties).toHaveProperty("remove");
  });
});

describe("runPlanLoop", () => {
  it("makes one call and no repair when the placed plan is valid", async () => {
    const turn = vi.fn<PlanTurn>(async () => response(SUBMIT_PLAN, SAMPLE_PLAN));
    const stages: string[] = [];
    const r = await runPlanLoop("brief", deps(turn, { onProgress: (e) => stages.push(e.stage) }));
    expect(turn).toHaveBeenCalledTimes(1);
    expect(turn.mock.calls[0]![2]).toBe(SUBMIT_PLAN);
    expect(r.repairAttempts).toBe(0);
    expect(summarizeIssues(r.issues).errors).toBe(0);
    expect(r.content.furniture.find((f) => f.id === "sofa")).toMatchObject({ w: 220, d: 95 });
    expect(stages).toEqual(["designing", "placing", "checking"]);
  });

  it("asks for one patch and applies it", async () => {
    const turn = vi
      .fn<PlanTurn>()
      .mockResolvedValueOnce(response(SUBMIT_PLAN, SAMPLE_PLAN, { id: "toolu_a" }))
      .mockResolvedValueOnce(response(SUBMIT_PATCH, { remove: ["plant"], resize: [{ id: "sofa", sizeClass: "small" }] }));
    const pipeline = vi.fn((plan: DesignPlanInput) => (plan.items.some((i) => i.id === "plant") ? fake([error("WINDOW_BLOCKED", ["plant"])]) : fake([])));
    const r = await runPlanLoop("brief", deps(turn, { pipeline }));
    expect(turn).toHaveBeenCalledTimes(2);
    expect(turn.mock.calls[1]![2]).toBe(SUBMIT_PATCH);
    const second = turn.mock.calls[1]![0];
    expect(second).toHaveLength(3);
    const toolResult = (second[2]!.content as ToolResult[])[0]!;
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "toolu_a", is_error: true });
    expect(String(toolResult.content)).toMatch(/repair 1: 1 errors .*WINDOW_BLOCKED/s);
    expect(r.repairAttempts).toBe(1);
    expect(r.status).toBe("valid");
    expect(r.plan.items.map((i) => i.id)).not.toContain("plant");
    expect(r.plan.items.find((i) => i.id === "sofa")!.sizeClass).toBe("small");
  });

  it("keeps the best result when the patch makes things worse", async () => {
    const turn = vi.fn<PlanTurn>().mockResolvedValueOnce(response(SUBMIT_PLAN, SAMPLE_PLAN)).mockResolvedValueOnce(response(SUBMIT_PATCH, { remove: ["rug"] }));
    const pipeline = vi
      .fn<(plan: DesignPlanInput) => PipelineResult>()
      .mockReturnValueOnce(fake([error("OVERLAP", ["sofa", "plant"])]))
      .mockReturnValueOnce(fake([error("OVERLAP", ["sofa", "plant"]), error("BED_ACCESS")]));
    const r = await runPlanLoop("brief", deps(turn, { pipeline }), 1);
    expect(turn).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("invalid");
    expect(r.issues).toHaveLength(1);
    expect(r.repairAttempts).toBe(0);
  });

  it("sends schema errors back and asks for the plan again", async () => {
    const turn = vi
      .fn<PlanTurn>()
      .mockResolvedValueOnce(response(SUBMIT_PLAN, { ...SAMPLE_PLAN, items: [{ id: "sofa" }] }))
      .mockResolvedValueOnce(response(SUBMIT_PLAN, SAMPLE_PLAN));
    const r = await runPlanLoop("brief", deps(turn));
    expect(turn.mock.calls[1]![2]).toBe(SUBMIT_PLAN);
    const feedback = (turn.mock.calls[1]![0][2]!.content as ToolResult[])[0]!;
    expect(String(feedback.content)).toContain("SCHEMA");
    expect(r.repairAttempts).toBe(1);
  });

  it("stops without a repair call when repairs are disabled", async () => {
    const turn = vi.fn<PlanTurn>(async () => response(SUBMIT_PLAN, SAMPLE_PLAN));
    const r = await runPlanLoop("brief", deps(turn, { pipeline: () => fake([error("OVERLAP", ["a", "b"])]) }), 0);
    expect(turn).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("invalid");
  });

  it("throws on refusal and on a missing tool call", async () => {
    await expect(runPlanLoop("brief", deps(async () => response(SUBMIT_PLAN, SAMPLE_PLAN, { stop: "refusal" })))).rejects.toBeInstanceOf(DesignGenerationError);
    await expect(runPlanLoop("brief", deps(async () => response("other_tool", {}, { stop: "max_tokens" })))).rejects.toThrow(/cut off/);
  });
});
