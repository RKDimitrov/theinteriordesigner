import type { DesignPlanInput, PlanItem } from "@/domain/schemas/design";
import { SAMPLE_DESIGN } from "./sample-design";

type ItemTaste = Pick<PlanItem, "material" | "colorHex" | "paletteRole" | "price" | "investmentTier" | "trendRisk">;

const taste = (t: ItemTaste) => ({ renterFriendly: true, requiresDrilling: false, existing: false, ...t });

/**
 * The sample living room design as the v2 model would return it: the same
 * taste as SAMPLE_DESIGN, but intents instead of coordinates. Used by solver
 * tests, the cost regression test and mocked model responses.
 */
export const SAMPLE_PLAN: DesignPlanInput = {
  concept: SAMPLE_DESIGN.concept,
  zones: [
    { id: "relax", name: "Lounge", purpose: "relax", rationale: "Sofa, rug and coffee table form one conversation area." },
    { id: "media", name: "Media wall", purpose: "relax", rationale: "TV unit on the wall with the TV socket." },
  ],
  items: [
    {
      id: "sofa",
      category: "sofa",
      sizeClass: "medium",
      name: "3-seat sofa",
      placement: "floor",
      intent: { anchor: "wall", wallIndex: 3, zoneId: "relax" },
      priority: 1,
      ...taste({ material: "Wool blend, oak legs", colorHex: "#BEB5A7", paletteRole: "neutral", price: { min: 1200, max: 1800, currency: "EUR" }, investmentTier: "anchor", trendRisk: 0.15 }),
      rationale: "Timeless shape in a washable fabric that suits kids and a dog.",
    },
    {
      id: "coffee-table",
      category: "coffee_table",
      sizeClass: "medium",
      name: "Oak coffee table",
      placement: "floor",
      intent: { anchor: "front_of", relativeTo: "sofa", zoneId: "relax" },
      priority: 2,
      ...taste({ material: "Solid oak, oiled", colorHex: "#C19A6B", paletteRole: "base", price: { min: 200, max: 350, currency: "EUR" }, investmentTier: "mid", trendRisk: 0.1 }),
      rationale: "Within reach of the sofa, still easy to pass.",
    },
    {
      id: "tv-unit",
      category: "tv_unit",
      sizeClass: "medium",
      name: "Low TV sideboard",
      placement: "floor",
      intent: { anchor: "wall", wallIndex: 1, zoneId: "media" },
      priority: 2,
      ...taste({ material: "Oak veneer", colorHex: "#C19A6B", paletteRole: "base", price: { min: 300, max: 500, currency: "EUR" }, investmentTier: "mid", trendRisk: 0.15 }),
      rationale: "On the wall with the TV socket, facing the sofa.",
    },
    {
      id: "rug",
      category: "rug",
      sizeClass: "medium",
      name: "Wool rug 160 × 230",
      placement: "floor_covering",
      intent: { anchor: "under", relativeTo: "coffee-table", zoneId: "relax" },
      priority: 3,
      ...taste({ material: "Hand-woven wool", colorHex: "#E6DCCB", paletteRole: "base", price: { min: 250, max: 400, currency: "EUR" }, investmentTier: "mid", trendRisk: 0.2 }),
      rationale: "Warms the floor in a long heating season and zones the lounge.",
    },
    {
      id: "floor-lamp",
      category: "floor_lamp",
      sizeClass: "medium",
      name: "Linen floor lamp",
      placement: "floor",
      intent: { anchor: "corner", zoneId: "relax" },
      priority: 3,
      ...taste({ material: "Linen shade, brass", colorHex: "#F4EFE6", paletteRole: "base", price: { min: 120, max: 200, currency: "EUR" }, investmentTier: "swappable", trendRisk: 0.2 }),
      rationale: "Reading light at the sofa end.",
    },
    {
      id: "plant",
      category: "plant",
      sizeClass: "medium",
      name: "Olive tree",
      placement: "floor",
      intent: { anchor: "corner" },
      priority: 3,
      ...taste({ material: "Ceramic pot", colorHex: "#7A7D4A", paletteRole: "secondary", price: { min: 40, max: 80, currency: "EUR" }, investmentTier: "swappable", trendRisk: 0.3 }),
      rationale: "Green corner in bright light.",
    },
    {
      id: "sideboard",
      category: "sideboard",
      sizeClass: "medium",
      name: "Grandma's sideboard",
      placement: "floor",
      intent: { anchor: "wall", wallIndex: 2 },
      priority: 1,
      ...taste({ material: "Walnut", colorHex: "#5C4033", paletteRole: "neutral", price: { min: 0, max: 0, currency: "EUR" }, investmentTier: "anchor", trendRisk: 0.1 }),
      existing: true,
      rationale: "The family piece gets the wall facing the lounge.",
    },
    {
      id: "art",
      category: "art",
      sizeClass: "large",
      name: "Framed print",
      placement: "wall",
      intent: { anchor: "wall", wallIndex: 3, zoneId: "relax" },
      priority: 3,
      ...taste({ material: "Oak frame", colorHex: "#C0683F", paletteRole: "accent", price: { min: 60, max: 150, currency: "EUR" }, investmentTier: "swappable", trendRisk: 0.4 }),
      requiresDrilling: true,
      rationale: "Above the sofa; two dowel holes in plaster are fine for renters.",
    },
  ],
  palette: SAMPLE_DESIGN.palette,
  surfaces: SAMPLE_DESIGN.surfaces,
  lighting: SAMPLE_DESIGN.lighting.map((light) => {
    const copy = { ...light };
    delete copy.position;
    return copy;
  }),
  textiles: SAMPLE_DESIGN.textiles,
  longevity: SAMPLE_DESIGN.longevity,
};
