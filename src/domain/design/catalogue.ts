import { clamp } from "../geometry/units";
import type { FurnitureCategory, Intent, Placement, Priority, SizeClass } from "../schemas/design";
import type { RoomType } from "../schemas/room";
import { CLEARANCE, DOUBLE_BED_MIN_WIDTH, NEEDS_ACCESS, PLACEMENT_GAP } from "../validator/clearances";

/** Width along the wall (local x), depth away from it (local y), height; all cm. */
export type Size = readonly [w: number, d: number, h: number];

/** Where a category wants to go when the model gives no better intent. */
export type Wants =
  | { anchor: "wall" | "corner" | "free" }
  | { anchor: "front_of" | "beside" | "under"; of: readonly FurnitureCategory[] };

export interface CatalogueEntry {
  sizes: Readonly<Record<SizeClass, Size>>;
  placement: Placement;
  wants: Wants;
  /** Default priority: anchors 1, plants and side tables 3. */
  priority: Priority;
}

const wall: Wants = { anchor: "wall" };
const corner: Wants = { anchor: "corner" };
const free: Wants = { anchor: "free" };
const frontOf = (...of: FurnitureCategory[]): Wants => ({ anchor: "front_of", of });
const beside = (...of: FurnitureCategory[]): Wants => ({ anchor: "beside", of });
const under = (...of: FurnitureCategory[]): Wants => ({ anchor: "under", of });

const entry = (placement: Placement, wants: Wants, priority: Priority, small: Size, medium: Size, large: Size): CatalogueEntry => ({
  sizes: { small, medium, large },
  placement,
  wants,
  priority,
});

/**
 * Realistic dimensions per category and size class. Heights are ergonomic
 * defaults (desk 74, dining table 75, sofa back 85, bed with headboard 90).
 */
export const CATALOGUE: Readonly<Record<FurnitureCategory, CatalogueEntry>> = {
  sofa: entry("floor", wall, 1, [180, 90, 85], [220, 95, 85], [260, 100, 85]),
  armchair: entry("floor", free, 2, [70, 75, 85], [80, 85, 90], [90, 90, 95]),
  coffee_table: entry("floor", frontOf("sofa", "armchair"), 2, [80, 50, 40], [110, 55, 40], [130, 65, 40]),
  side_table: entry("floor", beside("sofa", "armchair", "bed"), 3, [40, 40, 55], [45, 45, 55], [55, 55, 55]),
  tv_unit: entry("floor", wall, 2, [120, 40, 50], [160, 40, 50], [200, 45, 50]),
  bed: entry("floor", wall, 1, [90, 200, 90], [140, 200, 90], [180, 200, 90]),
  nightstand: entry("floor", beside("bed"), 2, [40, 35, 55], [45, 40, 55], [55, 40, 55]),
  wardrobe: entry("floor", wall, 1, [100, 60, 200], [150, 60, 210], [200, 60, 220]),
  dresser: entry("floor", wall, 2, [80, 45, 85], [120, 50, 85], [160, 50, 85]),
  desk: entry("floor", wall, 1, [100, 60, 74], [120, 70, 74], [160, 80, 74]),
  office_chair: entry("floor", under("desk"), 2, [55, 55, 95], [60, 60, 100], [65, 65, 110]),
  dining_table: entry("floor", free, 1, [80, 80, 75], [140, 90, 75], [200, 100, 75]),
  dining_chair: entry("floor", under("dining_table"), 2, [42, 50, 85], [45, 52, 85], [50, 55, 90]),
  bookshelf: entry("floor", wall, 2, [60, 30, 180], [80, 35, 190], [120, 40, 200]),
  sideboard: entry("floor", wall, 2, [120, 45, 80], [160, 45, 80], [200, 50, 85]),
  storage: entry("floor", wall, 3, [40, 35, 90], [80, 40, 90], [120, 45, 100]),
  floor_lamp: entry("floor", corner, 3, [30, 30, 150], [40, 40, 160], [50, 50, 175]),
  plant: entry("floor", corner, 3, [30, 30, 80], [45, 45, 120], [60, 60, 160]),
  rug: entry("floor_covering", under("coffee_table", "dining_table", "bed", "sofa"), 3, [120, 170, 1], [160, 230, 1], [200, 300, 1]),
  mirror: entry("wall", wall, 2, [40, 3, 60], [50, 3, 150], [80, 3, 180]),
  wall_shelf: entry("wall", wall, 3, [60, 20, 25], [90, 22, 30], [120, 25, 30]),
  art: entry("wall", wall, 3, [40, 3, 50], [60, 3, 80], [100, 3, 70]),
  bench: entry("floor", wall, 1, [80, 35, 45], [100, 38, 45], [120, 40, 45]),
  shoe_cabinet: entry("floor", wall, 2, [60, 24, 100], [80, 30, 100], [120, 35, 100]),
  coat_rack: entry("wall", wall, 2, [40, 8, 20], [60, 8, 20], [100, 10, 20]),
  other: entry("floor", wall, 3, [50, 40, 75], [80, 45, 80], [120, 50, 90]),
};

export const SIZE_CLASSES: readonly SizeClass[] = ["small", "medium", "large"];

export function catalogueSize(category: FurnitureCategory, sizeClass: SizeClass): { w: number; d: number; h: number } {
  const [w, d, h] = CATALOGUE[category].sizes[sizeClass];
  return { w, d, h };
}

/** Size class whose width (either orientation) is closest to `w` × `d`. Used for must-keep and stored pieces. */
export function nearestSizeClass(category: FurnitureCategory, w: number, d: number): SizeClass {
  const score = (s: SizeClass) => {
    const [cw, cd] = CATALOGUE[category].sizes[s];
    return Math.min(Math.abs(cw - w) + Math.abs(cd - d), Math.abs(cw - d) + Math.abs(cd - w));
  };
  return SIZE_CLASSES.reduce((best, s) => (score(s) < score(best) ? s : best));
}

/** Bottom edge of a wall item: centred on eye height, never below the minimum. */
export const wallElevation = (h: number): number =>
  Math.round(clamp(PLACEMENT_GAP.wallItemCentre - h / 2, PLACEMENT_GAP.wallItemMinElevation, 250));

export const needsFrontAccess = (category: FurnitureCategory): boolean => NEEDS_ACCESS.has(category);

/** Intent for a category when the model gave none (or a broken one). */
export function defaultIntent(category: FurnitureCategory): Intent {
  return { anchor: CATALOGUE[category].wants.anchor };
}

/**
 * Wall run (`length`) and depth into the room (`depth`) a piece needs,
 * including the clearance the validator enforces around it.
 */
export function minFreeSpan(category: FurnitureCategory, sizeClass: SizeClass): { length: number; depth: number } {
  const { w, d } = catalogueSize(category, sizeClass);
  if (category === "bed") {
    const sides = w >= DOUBLE_BED_MIN_WIDTH ? 2 : 1;
    return { length: w + sides * CLEARANCE.bedSide, depth: d + CLEARANCE.bedSide };
  }
  if (category === "dining_table") {
    return { length: w + 2 * CLEARANCE.diningBehindChairs, depth: d + 2 * CLEARANCE.diningBehindChairs };
  }
  if (needsFrontAccess(category)) return { length: w, depth: d + CLEARANCE.walkway };
  return { length: w, depth: d };
}

/**
 * Most pieces of furniture a room of this size and type should get. Rugs,
 * art and wall pieces count too: every piece costs space or wall.
 */
export function maxItems(areaM2: number, roomType: RoomType): number {
  if (roomType === "hallway") return areaM2 < 6 ? 3 : 5;
  if (roomType === "bath" || roomType === "storage") return 3;
  if (areaM2 < 6) return 4;
  if (areaM2 <= 12) return 8;
  return Math.min(14, 8 + Math.floor((areaM2 - 12) / 4));
}

/**
 * The catalogue as compact prompt text, one line per category:
 * "- sofa (floor, wall, priority 1): small 180×90 · medium 220×95 · large 260×100, h 85".
 * Deterministic, so the system prompt that embeds it stays cacheable.
 */
export function catalogueTable(): string {
  return (Object.keys(CATALOGUE) as FurnitureCategory[])
    .map((c) => {
      const e = CATALOGUE[c];
      const wants = "of" in e.wants ? `${e.wants.anchor} ${e.wants.of.join("/")}` : e.wants.anchor;
      const sizes = SIZE_CLASSES.map((s) => `${s} ${e.sizes[s][0]}×${e.sizes[s][1]}`).join(" · ");
      const heights = [...new Set(SIZE_CLASSES.map((s) => e.sizes[s][2]))].join("/");
      return `- ${c} (${e.placement}, ${wants}, priority ${e.priority}): ${sizes}, h ${heights}`;
    })
    .join("\n");
}
