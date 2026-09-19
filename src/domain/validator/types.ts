import type { Vec } from "../geometry/vec";
import type { KeepClearZone } from "../geometry/zones";
import type { Wall } from "../geometry/walls";
import type { RenterRules } from "../schemas/context";
import type { DesignContent, FurnitureItem } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import type { RoomShape } from "../schemas/room";
import type { ValidationIssue } from "../schemas/validation-issue";

export interface ValidateInput {
  room: RoomShape;
  design: DesignContent;
  /** Must-keep items assigned to this room. */
  mustKeep: readonly MustKeepItem[];
  /** Room budget in EUR, or null when not set. */
  budgetEur: number | null;
  /** Renter rules, or null when unknown (treated as owner). */
  renter: RenterRules | null;
}

/** Precomputed geometry shared by all rules. */
export interface RuleContext extends ValidateInput {
  walls: Wall[];
  zones: KeepClearZone[];
  /** Footprint polygon per furniture id. */
  footprints: Map<string, Vec[]>;
  /** Furniture with placement "floor". */
  floorItems: FurnitureItem[];
}

export type Rule = (ctx: RuleContext) => ValidationIssue[];
