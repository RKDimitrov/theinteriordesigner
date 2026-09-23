import type { FurnitureCategory } from "../schemas/design";

/** Single source of truth for every number the validator enforces (cm, EUR ratios, risk). */
export const CLEARANCE = {
  /** Minimum free walkway width. The grid check allows ~5 cm tolerance at 5 cm resolution. */
  walkway: 80,
  /** Door path kept free in front of every door. */
  doorPath: 80,
  /** Free strip beside the long sides of a bed and at its foot. */
  bedSide: 60,
  /** Free strip behind the chair sides of a dining table. */
  diningBehindChairs: 75,
  /** Distance from a front face within which a walkway must reach. */
  accessReach: 90,
  /** Wall items: max gap between back edge and wall, and max angle deviation. */
  wallGap: 5,
  wallAngleDeg: 5,
  /** Door span: wall items must stay above this height where they cross a door. */
  doorHeightFallback: 200,
  /** Must-keep dimension tolerance. */
  mustKeepTolerance: 2,
} as const;

/** Ergonomic distances the layout solver uses between related pieces (cm). */
export const PLACEMENT_GAP = {
  /** Coffee table front edge to sofa front edge. */
  frontOf: 45,
  /** Side gap between a piece and the one it stands beside. */
  beside: 5,
  /** How far a chair seat reaches under its table or desk. */
  chairTuck: 15,
  /** Items whose back is this close to a wall get snapped onto it. */
  wallSnap: 15,
  /** Eye height that wall items are centred on. */
  wallItemCentre: 150,
  /** Lowest bottom edge for wall items. */
  wallItemMinElevation: 10,
} as const;

export const RADIATOR_COVER = { warning: 0, error: 0.3 } as const;
export const BUDGET_WARNING_FACTOR = 1.1;
export const MAX_ANCHOR_TREND_RISK = 0.3;
export const PALETTE_TARGET = { base: 0.6, secondary: 0.3, accent: 0.1 } as const;
export const PALETTE_TOLERANCE = 0.1;
export const PALETTE_SUM_TOLERANCE = 0.05;

/** Floor items that must be reachable from a door via an 80 cm walkway. */
export const NEEDS_ACCESS: ReadonlySet<FurnitureCategory> = new Set([
  "sofa",
  "armchair",
  "bed",
  "wardrobe",
  "dresser",
  "desk",
  "bookshelf",
  "sideboard",
  "storage",
  "tv_unit",
  "dining_table",
]);

/** Pairs that may overlap in plan (chairs tucked under tables/desks). Order-independent. */
export const ALLOWED_OVERLAPS: readonly (readonly [FurnitureCategory, FurnitureCategory])[] = [
  ["dining_chair", "dining_table"],
  ["office_chair", "desk"],
];

export const overlapAllowed = (a: FurnitureCategory, b: FurnitureCategory): boolean =>
  ALLOWED_OVERLAPS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

/** Beds at least this wide need access on both long sides. */
export const DOUBLE_BED_MIN_WIDTH = 120;

/** Room types where drilling usually hits tiles. */
export const TILED_ROOM_TYPES: ReadonlySet<string> = new Set(["bath", "kitchen"]);
