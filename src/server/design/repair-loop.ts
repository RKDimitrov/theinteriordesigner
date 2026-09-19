import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DesignContent } from "@/domain/schemas/design";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { summarizeIssues, type DesignStatus } from "@/domain/validator";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;

export const SUBMIT_DESIGN = "submit_design";
export const MAX_REPAIRS = 3;

const schema = z.toJSONSchema(DesignContent, { io: "input" });

/** Forced tool whose input is a complete DesignContent. Validated with Zod afterwards (not `strict`: the schema uses constraints strict mode does not support). */
export const SUBMIT_DESIGN_TOOL: Anthropic.Beta.Messages.BetaTool = {
  name: SUBMIT_DESIGN,
  description: "Submit the complete room design. The app validates it geometrically and may ask for fixes.",
  input_schema: { type: "object", properties: schema.properties, required: schema.required, $defs: schema.$defs },
  eager_input_streaming: true,
};

export type ProgressEvent =
  | { stage: "generating" | "repairing"; attempt: number; maxAttempts: number }
  | { stage: "writing"; attempt: number; chars: number }
  | { stage: "validating"; attempt: number; errors?: number; warnings?: number };

/** One model turn. Implemented with the Anthropic client in production and mocked in tests. */
export type DesignTurn = (messages: BetaMessageParam[], attempt: number, onChars: (chars: number) => void) => Promise<BetaMessage>;

export interface LoopDeps {
  turn: DesignTurn;
  validate: (design: DesignContent) => ValidationIssue[];
  repairMessage: (issues: string, attempt: number) => string;
  onProgress?: (e: ProgressEvent) => void;
  /** Called after every model turn, e.g. for usage logging. */
  onTurn?: (message: BetaMessage, attempt: number) => void | Promise<void>;
}

export interface LoopResult {
  content: DesignContent;
  issues: ValidationIssue[];
  status: DesignStatus;
  /** Number of repair turns used (0 = first design was valid). */
  repairAttempts: number;
}

export class DesignGenerationError extends Error {
  constructor(
    readonly reason: "refused" | "no_design" | "truncated" | "schema",
    message: string,
  ) {
    super(message);
  }
}

/** Issues as the model sees them: compact, with hints. */
function issuesForModel(issues: readonly ValidationIssue[]): string {
  return JSON.stringify(
    issues.map((i) => ({ code: i.code, severity: i.severity, itemIds: i.itemIds, message: i.message, hint: i.hint })),
    null,
    1,
  );
}

function schemaIssuesForModel(error: z.ZodError): string {
  return JSON.stringify(
    error.issues.slice(0, 40).map((i) => ({ code: "SCHEMA", severity: "error", path: i.path.join("."), message: i.message })),
    null,
    1,
  );
}

const score = (issues: readonly ValidationIssue[]) => {
  const s = summarizeIssues(issues);
  return s.errors * 1000 + s.warnings;
};

/**
 * Generate → validate → repair (max 3). Keeps the best design seen (fewest
 * errors, then warnings). Never reports an invalid design as valid.
 */
export async function runDesignLoop(initialUser: string, deps: LoopDeps, maxRepairs = MAX_REPAIRS): Promise<LoopResult> {
  const messages: BetaMessageParam[] = [{ role: "user", content: initialUser }];
  let best: LoopResult | null = null;
  const maxAttempts = maxRepairs + 1;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    deps.onProgress?.({ stage: attempt === 0 ? "generating" : "repairing", attempt, maxAttempts });
    const res = await deps.turn(messages, attempt, (chars) => deps.onProgress?.({ stage: "writing", attempt, chars }));
    await deps.onTurn?.(res, attempt);

    if (res.stop_reason === "refusal") throw new DesignGenerationError("refused", "The model declined to design this room");
    const call = res.content.find((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use" && b.name === SUBMIT_DESIGN);
    if (!call) {
      if (res.stop_reason === "max_tokens") throw new DesignGenerationError("truncated", "The design was cut off (output too long)");
      throw new DesignGenerationError("no_design", "The model did not submit a design");
    }

    const parsed = DesignContent.safeParse(call.input);
    let feedback: string;
    if (!parsed.success) {
      feedback = schemaIssuesForModel(parsed.error);
    } else {
      deps.onProgress?.({ stage: "validating", attempt });
      const issues = deps.validate(parsed.data);
      const summary = summarizeIssues(issues);
      deps.onProgress?.({ stage: "validating", attempt, errors: summary.errors, warnings: summary.warnings });
      const candidate: LoopResult = { content: parsed.data, issues, status: summary.status, repairAttempts: attempt };
      if (!best || score(issues) < score(best.issues)) best = candidate;
      if (summary.errors === 0) return candidate;
      feedback = issuesForModel(issues);
    }

    if (attempt === maxRepairs) break;
    // Send the full assistant turn back unchanged (thinking blocks included), then the problems as the tool result.
    messages.push({ role: "assistant", content: res.content });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: deps.repairMessage(feedback, attempt + 1) }],
    });
  }

  if (!best) throw new DesignGenerationError("schema", "The model never produced a design in the expected format");
  return best;
}
