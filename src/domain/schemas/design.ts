import { z } from "zod";
import { Cm, Hex } from "./common";
import { ValidationIssue } from "./validation-issue";

/** 0 = timeless, 1 = short-lived fad. */
const Risk = z.number().min(0).max(1);

export const PriceRange = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    currency: z.literal("EUR"),
  })
  .refine((p) => p.max >= p.min, { message: "max must be >= min" });
export type PriceRange = z.infer<typeof PriceRange>;

const Rationale = z.string().min(1).max(400);

export const PaintRef = z.object({
  system: z.enum(["RAL", "NCS", "none"]),
  code: z.string().optional(),
});

export const PaletteColor = z.object({
  name: z.string(),
  hex: Hex,
  paint: PaintRef,
  /** Target share of the room, for the 60/30/10 rule. */
  share: z.number().min(0).max(1),
  /** Where the colour is used: "walls", "sofa", "cushions" … */
  usage: z.array(z.string()),
});

export const Palette = z.object({
  base: PaletteColor,
  secondary: PaletteColor,
  accent: PaletteColor,
  rationale: Rationale,
});

export const FurnitureCategory = z.enum([
  "sofa",
  "armchair",
  "coffee_table",
  "side_table",
  "tv_unit",
  "bed",
  "nightstand",
  "wardrobe",
  "dresser",
  "desk",
  "office_chair",
  "dining_table",
  "dining_chair",
  "bookshelf",
  "sideboard",
  "storage",
  "floor_lamp",
  "plant",
  "rug",
  "mirror",
  "wall_shelf",
  "art",
  "other",
]);
export type FurnitureCategory = z.infer<typeof FurnitureCategory>;

/**
 * floor          -> collision and clearance checks
 * floor_covering -> rugs: bounds only, may sit under furniture
 * wall           -> must touch a wall; checked against openings by height band
 * ceiling        -> pendants etc.; no floor footprint checks
 */
export const Placement = z.enum(["floor", "floor_covering", "wall", "ceiling"]);
export type Placement = z.infer<typeof Placement>;

/** anchor = big-ticket, hard to replace, must be low trend risk. */
export const InvestmentTier = z.enum(["anchor", "mid", "swappable"]);
export type InvestmentTier = z.infer<typeof InvestmentTier>;

export const PaletteRole = z.enum(["base", "secondary", "accent", "neutral"]);

export const FurnitureItem = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,32}$/),
  category: FurnitureCategory,
  name: z.string(),
  placement: Placement,
  /** Width along local x, depth along local y (front face is +y before rotation), height. */
  w: Cm,
  d: Cm,
  h: Cm,
  /** Footprint centre in room coordinates. */
  x: z.number(),
  y: z.number(),
  /** Clockwise degrees. */
  rotation: z.number().min(0).lt(360),
  /** Bottom height above floor, for wall items. */
  elevation: Cm.default(0),
  zoneId: z.string().optional(),
  material: z.string(),
  colorHex: Hex,
  paletteRole: PaletteRole,
  price: PriceRange,
  /** Search query for local retailers, e.g. "Sofa 3-Sitzer Bouclé beige 220 cm". */
  productQuery: z.string().optional(),
  investmentTier: InvestmentTier,
  trendRisk: Risk,
  renterFriendly: z.boolean(),
  requiresDrilling: z.boolean(),
  /** The user's must-keep piece. */
  existing: z.boolean().default(false),
  rationale: Rationale,
});
export type FurnitureItem = z.infer<typeof FurnitureItem>;

export const Zone = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.enum(["relax", "sleep", "work", "dine", "cook", "storage", "circulation", "play", "other"]),
  rect: z.object({ x: z.number(), y: z.number(), w: Cm, d: Cm }),
  rationale: Rationale,
});

export const Surface = z.object({
  surface: z.enum(["floor", "walls", "accent_wall", "ceiling", "trim"]),
  wallIndices: z.array(z.number().int()).optional(),
  material: z.string(),
  finish: z.string(),
  colorHex: Hex,
  paint: PaintRef.optional(),
  trendRisk: Risk,
  renterFriendly: z.boolean(),
  price: PriceRange.optional(),
  rationale: Rationale,
});

export const Light = z.object({
  id: z.string(),
  layer: z.enum(["ambient", "task", "accent"]),
  fixture: z.string(),
  mount: z.enum(["ceiling", "wall", "floor", "table", "under_cabinet"]),
  /** Floor and table lamps reference a FurnitureItem. */
  itemId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  colorTempK: z.number().int().min(1800).max(6500),
  lumens: z.number().int().positive(),
  dimmable: z.boolean(),
  requiresDrilling: z.boolean(),
  price: PriceRange,
  trendRisk: Risk,
  rationale: Rationale,
});

export const Textile = z.object({
  id: z.string(),
  type: z.enum(["curtain", "sheer", "cushion", "throw", "bedding", "upholstery_cover"]),
  material: z.string(),
  colorHex: Hex,
  paletteRole: PaletteRole,
  size: z.string().optional(),
  price: PriceRange,
  trendRisk: Risk,
  rationale: Rationale,
});

/** What the model returns (tool input). */
export const DesignContent = z.object({
  concept: z.object({ title: z.string(), summary: z.string().max(800) }),
  zones: z.array(Zone),
  furniture: z.array(FurnitureItem),
  palette: Palette,
  surfaces: z.array(Surface),
  lighting: z.array(Light),
  textiles: z.array(Textile),
  longevity: z.object({
    summary: Rationale,
    /** Ids of deliberate trend pieces. */
    trendItems: z.array(z.string()),
  }),
});
export type DesignContent = z.infer<typeof DesignContent>;

/** What we store. The server adds everything except `content`. */
export const Design = z.object({
  schemaVersion: z.literal(1),
  roomId: z.string(),
  version: z.number().int().positive(),
  parentVersion: z.number().int().nullable(),
  content: DesignContent,
  validation: z.object({
    status: z.enum(["valid", "valid_with_warnings", "invalid"]),
    issues: z.array(ValidationIssue),
    repairAttempts: z.number().int().min(0).max(3),
  }),
  source: z.object({ model: z.string(), promptId: z.string(), promptVersion: z.string() }),
  createdAt: z.iso.datetime(),
});
export type Design = z.infer<typeof Design>;
