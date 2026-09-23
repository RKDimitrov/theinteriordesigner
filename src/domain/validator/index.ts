import { itemFootprint } from "../geometry/obb";
import { wallsOf } from "../geometry/walls";
import { keepClearZones } from "../geometry/zones";
import type { DesignContent, FurnitureItem } from "../schemas/design";
import type { RoomShape } from "../schemas/room";
import type { ValidationIssue } from "../schemas/validation-issue";
import { bedAccessRule, diningRule } from "./rules/bed-dining";
import { boundsRule } from "./rules/bounds";
import { budgetRule, longevityRule, mustKeepRule, paletteRule, renterRule } from "./rules/budget-style";
import { doorsRule, fixedElementsRule, radiatorsRule, windowsRule } from "./rules/openings";
import { overlapRule } from "./rules/overlap";
import { referencesRule } from "./rules/references";
import { walkwayRule } from "./rules/walkway";
import { wallItemsRule } from "./rules/wall-items";
import type { Rule, RuleContext, ValidateInput } from "./types";

export type { ValidateInput } from "./types";
export { designCost } from "./rules/budget-style";

export const RULES: readonly Rule[] = [
  referencesRule,
  boundsRule,
  overlapRule,
  doorsRule,
  windowsRule,
  radiatorsRule,
  fixedElementsRule,
  wallItemsRule,
  walkwayRule,
  bedAccessRule,
  diningRule,
  budgetRule,
  longevityRule,
  renterRule,
  mustKeepRule,
  paletteRule,
];

/** The geometric rules: the only ones a layout change can fix. */
export const LAYOUT_RULES: readonly Rule[] = [
  boundsRule,
  overlapRule,
  doorsRule,
  windowsRule,
  radiatorsRule,
  fixedElementsRule,
  wallItemsRule,
  walkwayRule,
  bedAccessRule,
  diningRule,
];

const EMPTY_DESIGN: Omit<DesignContent, "furniture"> = {
  concept: { title: "", summary: "" },
  zones: [],
  palette: {
    base: { name: "", hex: "#000000", paint: { system: "none" }, share: 0.6, usage: [] },
    secondary: { name: "", hex: "#000000", paint: { system: "none" }, share: 0.3, usage: [] },
    accent: { name: "", hex: "#000000", paint: { system: "none" }, share: 0.1, usage: [] },
    rationale: "-",
  },
  surfaces: [],
  lighting: [],
  textiles: [],
  longevity: { summary: "-", trendItems: [] },
};

/** Geometric rules only, for the layout solver and autofix. */
export function validateLayout(room: RoomShape, furniture: readonly FurnitureItem[]): ValidationIssue[] {
  const design: DesignContent = { ...EMPTY_DESIGN, furniture: [...furniture] };
  const ctx: RuleContext = {
    room,
    design,
    mustKeep: [],
    budgetEur: null,
    renter: null,
    walls: wallsOf(room.polygon),
    zones: keepClearZones(room),
    footprints: new Map(furniture.map((f) => [f.id, itemFootprint(f)])),
    floorItems: furniture.filter((f) => f.placement === "floor"),
  };
  return LAYOUT_RULES.flatMap((rule) => rule(ctx));
}

/** Run every rule. Pure and deterministic: the model never decides whether its own design is valid. */
export function validateDesign(input: ValidateInput): ValidationIssue[] {
  const ctx: RuleContext = {
    ...input,
    walls: wallsOf(input.room.polygon),
    zones: keepClearZones(input.room),
    footprints: new Map(input.design.furniture.map((f) => [f.id, itemFootprint(f)])),
    floorItems: input.design.furniture.filter((f) => f.placement === "floor"),
  };
  return RULES.flatMap((rule) => rule(ctx));
}

export type DesignStatus = "valid" | "valid_with_warnings" | "invalid";

export function summarizeIssues(issues: readonly ValidationIssue[]): { status: DesignStatus; errors: number; warnings: number } {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  return { status: errors > 0 ? "invalid" : warnings > 0 ? "valid_with_warnings" : "valid", errors, warnings };
}
