import { z } from "zod";

export const IssueCode = z.enum([
  "OUT_OF_BOUNDS",
  "OVERLAP",
  "DOOR_SWING_BLOCKED",
  "DOOR_PATH_BLOCKED",
  "WINDOW_BLOCKED",
  "RADIATOR_BLOCKED",
  "FIXED_ELEMENT_COLLISION",
  "WALKWAY_TOO_NARROW",
  "BED_ACCESS",
  "DINING_CLEARANCE",
  "WALL_ITEM_NOT_ON_WALL",
  "OVER_BUDGET",
  "ANCHOR_TREND_RISK",
  "RENTER_VIOLATION",
  "MUST_KEEP_MISSING",
  "PALETTE_SHARES",
  "DANGLING_REFERENCE",
]);
export type IssueCode = z.infer<typeof IssueCode>;

export const ValidationIssue = z.object({
  code: IssueCode,
  severity: z.enum(["error", "warning"]),
  itemIds: z.array(z.string()),
  /** Readable by both the user and the model during repair. */
  message: z.string(),
  /** Measured and required values, in cm or EUR depending on the code. */
  measured: z.number().optional(),
  required: z.number().optional(),
  /** Concrete fix suggestion, e.g. "move sofa ≥ 12 cm toward y+". */
  hint: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssue>;
