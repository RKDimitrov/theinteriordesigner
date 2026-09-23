import { SAMPLE_PLAN } from "@/lib/dev/sample-plan";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import type { DesignPlanInput, PlanItem } from "../../schemas/design";
import type { MustKeepItem } from "../../schemas/profile";
import type { RoomShape } from "../../schemas/room";

/** Test fixtures: rooms and plans the solver must lay out with zero validator errors. */

type Sketch = Pick<PlanItem, "id" | "category" | "sizeClass" | "intent" | "priority"> & Partial<PlanItem>;

export function planItem(s: Sketch): PlanItem {
  return {
    name: s.id,
    material: "Oak",
    colorHex: "#C19A6B",
    paletteRole: "base",
    placement: "floor",
    price: { min: 50, max: 100, currency: "EUR" },
    trendRisk: 0.2,
    investmentTier: "mid",
    renterFriendly: true,
    requiresDrilling: false,
    existing: false,
    rationale: "Fixture piece.",
    ...s,
  };
}

const plan = (items: PlanItem[]): DesignPlanInput => ({ ...SAMPLE_PLAN, zones: [], items, longevity: { ...SAMPLE_PLAN.longevity, trendItems: [] } });

/** The real failing case: 300 × 160 cm hallway, six pieces requested. */
export const HALLWAY: RoomShape = {
  name: "Hallway",
  type: "hallway",
  polygon: [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 160 },
    { x: 0, y: 160 },
  ],
  ceilingHeight: 260,
  openings: [
    { id: "entrance", kind: "door", wallIndex: 3, offset: 35, width: 90, height: 210, hinge: "start", swing: "in" },
    { id: "door-bath", kind: "door", wallIndex: 2, offset: 40, width: 80, height: 200, hinge: "end", swing: "out" },
  ],
  fixedElements: [],
  wallOrientationOverrides: {},
};

export const HALLWAY_PLAN = plan([
  planItem({ id: "bench", category: "bench", sizeClass: "medium", intent: { anchor: "wall" }, priority: 1 }),
  planItem({ id: "shoe-cabinet", category: "shoe_cabinet", sizeClass: "medium", intent: { anchor: "wall" }, priority: 2 }),
  planItem({ id: "armchair", category: "armchair", sizeClass: "small", intent: { anchor: "free" }, priority: 3 }),
  planItem({ id: "side-table", category: "side_table", sizeClass: "small", intent: { anchor: "beside", relativeTo: "armchair" }, priority: 3 }),
  planItem({ id: "planter", category: "plant", sizeClass: "medium", intent: { anchor: "corner" }, priority: 3 }),
  planItem({ id: "sideboard", category: "sideboard", sizeClass: "medium", intent: { anchor: "wall" }, priority: 2 }),
]);

export const LIVING: RoomShape = SAMPLE_ROOMS[0]!;
export const LIVING_PLAN = SAMPLE_PLAN;
export const LIVING_KEEP: MustKeepItem[] = [
  { id: "keep-1", name: "Grandma's sideboard", category: "sideboard", w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: null },
];

export const BEDROOM: RoomShape = SAMPLE_ROOMS[1]!;
export const BEDROOM_PLAN = plan([
  planItem({ id: "bed", category: "bed", sizeClass: "medium", intent: { anchor: "wall" }, priority: 1 }),
  planItem({ id: "nightstand-l", category: "nightstand", sizeClass: "small", intent: { anchor: "beside", relativeTo: "bed" }, priority: 2 }),
  planItem({ id: "nightstand-r", category: "nightstand", sizeClass: "small", intent: { anchor: "beside", relativeTo: "bed" }, priority: 2 }),
  planItem({ id: "wardrobe", category: "wardrobe", sizeClass: "medium", intent: { anchor: "wall" }, priority: 1 }),
  planItem({ id: "rug", category: "rug", sizeClass: "small", placement: "floor_covering", intent: { anchor: "under", relativeTo: "bed" }, priority: 3 }),
  planItem({ id: "plant", category: "plant", sizeClass: "small", intent: { anchor: "corner" }, priority: 3 }),
  planItem({ id: "mirror", category: "mirror", sizeClass: "medium", placement: "wall", intent: { anchor: "wall" }, priority: 3 }),
]);

export const KITCHEN: RoomShape = SAMPLE_ROOMS[3]!;
export const KITCHEN_PLAN = plan([
  planItem({ id: "table", category: "dining_table", sizeClass: "medium", intent: { anchor: "free" }, priority: 1 }),
  planItem({ id: "chair-1", category: "dining_chair", sizeClass: "medium", intent: { anchor: "under", relativeTo: "table" }, priority: 2 }),
  planItem({ id: "chair-2", category: "dining_chair", sizeClass: "medium", intent: { anchor: "under", relativeTo: "table" }, priority: 2 }),
  planItem({ id: "chair-3", category: "dining_chair", sizeClass: "medium", intent: { anchor: "under", relativeTo: "table" }, priority: 2 }),
  planItem({ id: "shelf", category: "wall_shelf", sizeClass: "medium", placement: "wall", intent: { anchor: "wall" }, priority: 3 }),
  planItem({ id: "plant", category: "plant", sizeClass: "small", intent: { anchor: "corner" }, priority: 3 }),
]);

export const OFFICE: RoomShape = SAMPLE_ROOMS[2]!;
export const OFFICE_PLAN = plan([
  planItem({ id: "desk", category: "desk", sizeClass: "medium", intent: { anchor: "wall" }, priority: 1 }),
  planItem({ id: "chair", category: "office_chair", sizeClass: "medium", intent: { anchor: "under", relativeTo: "desk" }, priority: 1 }),
  planItem({ id: "bookshelf", category: "bookshelf", sizeClass: "medium", intent: { anchor: "wall" }, priority: 2 }),
  planItem({ id: "armchair", category: "armchair", sizeClass: "small", intent: { anchor: "free" }, priority: 3 }),
  planItem({ id: "lamp", category: "floor_lamp", sizeClass: "small", intent: { anchor: "beside", relativeTo: "armchair" }, priority: 3 }),
]);

export const FIXTURES: readonly { name: string; room: RoomShape; plan: DesignPlanInput; mustKeep: MustKeepItem[] }[] = [
  { name: "300 × 160 hallway", room: HALLWAY, plan: HALLWAY_PLAN, mustKeep: [] },
  { name: "420 × 380 living room", room: LIVING, plan: LIVING_PLAN, mustKeep: LIVING_KEEP },
  { name: "350 × 320 bedroom with double bed", room: BEDROOM, plan: BEDROOM_PLAN, mustKeep: [] },
  { name: "kitchen with fixed kitchen run", room: KITCHEN, plan: KITCHEN_PLAN, mustKeep: [] },
  { name: "office with chimney", room: OFFICE, plan: OFFICE_PLAN, mustKeep: [] },
];
