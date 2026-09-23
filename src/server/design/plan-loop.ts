import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { PipelineResult } from "@/domain/design/pipeline";
import { applyPatch } from "@/domain/design/plan";
import { DesignPatch, DesignPlanInput } from "@/domain/schemas/design";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { summarizeIssues } from "@/domain/validator";
import { DesignGenerationError } from "./repair-loop";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type ToolUse = Anthropic.Beta.Messages.BetaToolUseBlock;

export const SUBMIT_PLAN = "submit_design_plan";
export const SUBMIT_PATCH = "submit_patch";
export const DEFAULT_MAX_REPAIRS = 1;

function toolFor(name: string, description: string, zodSchema: z.ZodType): BetaTool {
  const schema = z.toJSONSchema(zodSchema, { io: "input" });
  return {
    name,
    description,
    input_schema: { type: "object", properties: schema.properties, required: schema.required, $defs: schema.$defs },
    eager_input_streaming: true,
  };
}

/** Forced tool for the first turn: taste and intents, no coordinates. Validated with Zod afterwards. */
export const SUBMIT_PLAN_TOOL = toolFor(
  SUBMIT_PLAN,
  "Submit the room design as pieces with size classes and placement intents. The app sizes, places and validates them.",
  DesignPlanInput,
);

/** Forced tool for repair turns: a small edit to the plan. */
export const SUBMIT_PATCH_TOOL = toolFor(SUBMIT_PATCH, "Submit a small change to your plan so the placed layout passes the validator.", DesignPatch);

/** Both tools are sent on every turn so the cached prefix (tools → system) never changes. */
export const PLAN_TOOLS: readonly BetaTool[] = [SUBMIT_PLAN_TOOL, SUBMIT_PATCH_TOOL];

export type PlanProgress =
  | { stage: "designing" | "fixing"; attempt: number; maxAttempts: number; chars?: number }
  | { stage: "placing"; attempt: number }
  | { stage: "checking"; attempt: number; errors?: number; warnings?: number };

/** One model turn with the named tool forced. Anthropic client in production, mocked in tests. */
export type PlanTurn = (messages: BetaMessageParam[], attempt: number, tool: typeof SUBMIT_PLAN | typeof SUBMIT_PATCH, onChars: (chars: number) => void) => Promise<BetaMessage>;

export interface RepairPrompt {
  issues: string;
  dropped: string;
  layout: string;
  errorCount: number;
}

export interface PlanLoopDeps {
  turn: PlanTurn;
  /** Catalogue → solver → autofix → validator. Pure, no model call. */
  pipeline: (plan: DesignPlanInput) => PipelineResult;
  repairMessage: (p: RepairPrompt, attempt: number) => string;
  onProgress?: (e: PlanProgress) => void;
  onTurn?: (message: BetaMessage, attempt: number) => void | Promise<void>;
}

export interface PlanLoopResult extends PipelineResult {
  plan: DesignPlanInput;
  /** Patch turns used (0 = the first plan placed without errors). */
  repairAttempts: number;
}

const score = (issues: readonly ValidationIssue[]) => {
  const s = summarizeIssues(issues);
  return s.errors * 1000 + s.warnings;
};

const compact = (value: unknown) => JSON.stringify(value);

/** What the model needs to write a patch: the problems, what was dropped, where things ended up. */
export function repairPrompt(r: PipelineResult): RepairPrompt {
  const errors = r.issues.filter((i) => i.severity === "error");
  return {
    errorCount: errors.length,
    issues: compact(r.issues.map((i) => ({ code: i.code, severity: i.severity, itemIds: i.itemIds, message: i.message, hint: i.hint }))),
    dropped: r.stats.dropped.length > 0 ? compact(r.stats.dropped.map((d) => ({ id: d.id, category: d.category, reason: d.reason }))) : "none",
    layout: compact(
      r.content.furniture.map((f) => ({
        id: f.id,
        category: f.category,
        sizeClass: f.sizeClass,
        w: f.w,
        d: f.d,
        intent: f.intent,
      })),
    ),
  };
}

function schemaFeedback(error: z.ZodError): string {
  return compact(error.issues.slice(0, 30).map((i) => ({ code: "SCHEMA", path: i.path.join("."), message: i.message })));
}

function toolCall(res: BetaMessage, name: string): ToolUse {
  if (res.stop_reason === "refusal") throw new DesignGenerationError("refused", "The model declined to design this room");
  const call = res.content.find((b): b is ToolUse => b.type === "tool_use" && b.name === name);
  if (call) return call;
  if (res.stop_reason === "max_tokens") throw new DesignGenerationError("truncated", "The design was cut off (output too long)");
  throw new DesignGenerationError("no_design", "The model did not submit a design");
}

/** The new plan from a turn: the first plan itself, or the current plan with the patch applied. */
function parseTurn(plan: DesignPlanInput | null, input: unknown): DesignPlanInput | z.ZodError {
  if (!plan) {
    const p = DesignPlanInput.safeParse(input);
    return p.success ? p.data : p.error;
  }
  const p = DesignPatch.safeParse(input);
  return p.success ? applyPatch(plan, p.data) : p.error;
}

/**
 * One call in the happy path: plan → pipeline → done. Only when the placed
 * layout still has errors does the model get a compact repair request and
 * answer with a patch (at most `maxRepairs` times). Keeps the best result.
 */
export async function runPlanLoop(initialUser: string, deps: PlanLoopDeps, maxRepairs = DEFAULT_MAX_REPAIRS): Promise<PlanLoopResult> {
  const messages: BetaMessageParam[] = [{ role: "user", content: initialUser }];
  const maxAttempts = maxRepairs + 1;
  let plan: DesignPlanInput | null = null;
  let best: PlanLoopResult | null = null;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const tool = plan ? SUBMIT_PATCH : SUBMIT_PLAN;
    deps.onProgress?.({ stage: attempt === 0 ? "designing" : "fixing", attempt, maxAttempts });
    const res = await deps.turn(messages, attempt, tool, (chars) =>
      deps.onProgress?.({ stage: attempt === 0 ? "designing" : "fixing", attempt, maxAttempts, chars }),
    );
    await deps.onTurn?.(res, attempt);
    const call = toolCall(res, tool);

    let feedback: string;
    const next = parseTurn(plan, call.input);
    if (next instanceof z.ZodError) {
      feedback = `Your ${tool} input did not match the schema. Call ${tool} again with valid input.\n${schemaFeedback(next)}`;
    } else {
      plan = next;
      deps.onProgress?.({ stage: "placing", attempt });
      const result = deps.pipeline(next);
      const s = summarizeIssues(result.issues);
      deps.onProgress?.({ stage: "checking", attempt, errors: s.errors, warnings: s.warnings });
      const candidate: PlanLoopResult = { ...result, plan: next, repairAttempts: attempt };
      if (!best || score(result.issues) < score(best.issues)) best = candidate;
      if (s.errors === 0) return candidate;
      feedback = deps.repairMessage(repairPrompt(result), attempt + 1);
    }

    if (attempt === maxRepairs) break;
    // Full assistant turn back unchanged (thinking included), then the problems as the tool result.
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: feedback }] });
  }

  if (!best) throw new DesignGenerationError("schema", "The model never produced a design in the expected format");
  return best;
}
