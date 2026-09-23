import { area, bbox } from "../geometry/polygon";
import type { RenterRules } from "../schemas/context";
import type { DesignContent, DesignPlanInput, SolverStats } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import type { RoomShape } from "../schemas/room";
import type { ValidationIssue } from "../schemas/validation-issue";
import { type DesignStatus, summarizeIssues, validateDesign } from "../validator";
import { autofix } from "./autofix";
import { maxItems } from "./catalogue";
import { resolvePlan, toDesignContent } from "./plan";
import { solveLayout } from "./solver";
import { freeFloorRect } from "./solver/slots";

export interface PipelineInput {
  plan: DesignPlanInput;
  room: RoomShape & { id?: string };
  mustKeep: readonly MustKeepItem[];
  budgetEur: number | null;
  renter: RenterRules | null;
}

export interface PipelineResult {
  content: DesignContent;
  issues: ValidationIssue[];
  status: DesignStatus;
  stats: SolverStats;
}

/**
 * Model plan → catalogue → solver → stored design → autofix → validator.
 * Deterministic for the same input; no model call.
 */
export function runPipeline(input: PipelineInput): PipelineResult {
  const started = performance.now();
  const { room, mustKeep } = input;
  const planned = resolvePlan(input.plan, { mustKeep, ceilingHeight: room.ceilingHeight });
  const cap = maxItems(area(room.polygon) / 10_000, room.type);
  const solved = solveLayout({ room, items: planned.items, cap });
  const content = toDesignContent(planned, solved.poses, { room: bbox(room.polygon), fallback: freeFloorRect(room) });
  const validate = (design: DesignContent) => validateDesign({ room, design, mustKeep, budgetEur: input.budgetEur, renter: input.renter });
  const fixed = autofix(content, room, validate);
  return {
    content: fixed.content,
    issues: fixed.issues,
    status: summarizeIssues(fixed.issues).status,
    stats: {
      durationMs: Math.round(performance.now() - started),
      iterations: solved.iterations,
      evaluations: solved.evaluations,
      autofixPasses: fixed.passes,
      dropped: [...solved.dropped, ...fixed.dropped],
      autofixLog: fixed.log,
    },
  };
}
