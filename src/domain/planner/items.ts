import { CATALOGUE, catalogueSize, nearestSizeClass, wallElevation } from "../design/catalogue";
import { normDeg, snap } from "../geometry/units";
import type { DesignContent, FurnitureCategory, FurnitureItem, SizeClass } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";

/** Plan symbol drawn for a category (see the planner's symbol renderer). */
export type SymbolKind = "sofa" | "armchair" | "table" | "tv" | "rug" | "lamp" | "shelf" | "plant" | "bed" | "dining" | "desk" | "wardrobe" | "box";

export const SYMBOL_OF: Readonly<Record<FurnitureCategory, SymbolKind>> = {
  sofa: "sofa",
  armchair: "armchair",
  coffee_table: "table",
  side_table: "table",
  tv_unit: "tv",
  bed: "bed",
  nightstand: "box",
  wardrobe: "wardrobe",
  dresser: "shelf",
  desk: "desk",
  office_chair: "armchair",
  dining_table: "dining",
  dining_chair: "box",
  bookshelf: "shelf",
  sideboard: "shelf",
  storage: "shelf",
  floor_lamp: "lamp",
  plant: "plant",
  rug: "rug",
  mirror: "box",
  wall_shelf: "shelf",
  art: "box",
  bench: "table",
  shoe_cabinet: "shelf",
  coat_rack: "box",
  other: "box",
};

/** Default colour of a freshly placed piece: woods, linen and plant green from the Atelier palette. */
export const PIECE_COLOR: Readonly<Record<FurnitureCategory, string>> = {
  sofa: "#b9a58a",
  armchair: "#c8794a",
  coffee_table: "#a57a52",
  side_table: "#a57a52",
  tv_unit: "#6b4a32",
  bed: "#d8c9ae",
  nightstand: "#a57a52",
  wardrobe: "#8a6a4a",
  dresser: "#8a6a4a",
  desk: "#a57a52",
  office_chair: "#6f6152",
  dining_table: "#a57a52",
  dining_chair: "#8a6a4a",
  bookshelf: "#8a6a4a",
  sideboard: "#6b4a32",
  storage: "#8a6a4a",
  floor_lamp: "#efe3cf",
  plant: "#5d6b3c",
  rug: "#e2cfae",
  mirror: "#dbe6ee",
  wall_shelf: "#a57a52",
  art: "#efe3cf",
  bench: "#a57a52",
  shoe_cabinet: "#6b4a32",
  coat_rack: "#6b4a32",
  other: "#b9a58a",
};

/** Catalogue categories grouped the way the drawer filters them. */
export const CATALOGUE_GROUPS = {
  living: ["sofa", "armchair", "coffee_table", "side_table", "tv_unit", "rug"],
  bedroom: ["bed", "nightstand", "wardrobe", "dresser"],
  dining: ["dining_table", "dining_chair", "sideboard"],
  office: ["desk", "office_chair", "bookshelf"],
  storage: ["bookshelf", "sideboard", "storage", "shoe_cabinet", "coat_rack", "wardrobe", "wall_shelf"],
  lighting: ["floor_lamp"],
  textiles: ["rug"],
  plants: ["plant"],
} as const satisfies Record<string, readonly FurnitureCategory[]>;
export type CatalogueGroup = keyof typeof CATALOGUE_GROUPS | "mine";

/** A piece in the planner catalogue: a catalogue size or one of the user's own pieces. */
export interface CataloguePiece {
  key: string;
  category: FurnitureCategory;
  sizeClass: SizeClass;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  /** Name of the user's own piece; catalogue pieces are named from the category in the UI. */
  name?: string;
  mine?: MustKeepItem["id"];
}

export function cataloguePieces(mustKeep: readonly MustKeepItem[]): CataloguePiece[] {
  const own: CataloguePiece[] = mustKeep.map((m) => ({
    key: `mine-${m.id}`,
    category: m.category,
    sizeClass: nearestSizeClass(m.category, m.w, m.d),
    w: m.w,
    d: m.d,
    h: m.h,
    colorHex: m.colorHex,
    name: m.name,
    mine: m.id,
  }));
  const stock = (Object.keys(CATALOGUE) as FurnitureCategory[]).flatMap((category) =>
    (["small", "medium", "large"] as const).map((sizeClass) => ({
      key: `${category}-${sizeClass}`,
      category,
      sizeClass,
      ...catalogueSize(category, sizeClass),
      colorHex: PIECE_COLOR[category],
    })),
  );
  return [...own, ...stock];
}

/** Free item id like "sofa-2", within the schema's id pattern. */
export function nextItemId(category: FurnitureCategory, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = category.replace(/_/g, "-").slice(0, 26);
  for (let i = 1; ; i++) {
    const id = `${base}-${i}`;
    if (!used.has(id)) return id;
  }
}

/**
 * A piece placed by hand at (x, y) in room coordinates. `name` is the display
 * name (the category label, or the user's own piece's name).
 */
export function newPlannerItem(piece: CataloguePiece, at: { x: number; y: number }, name: string, taken: Iterable<string>): FurnitureItem {
  const placement = CATALOGUE[piece.category].placement;
  return {
    id: nextItemId(piece.category, taken),
    category: piece.category,
    name,
    placement,
    w: piece.w,
    d: piece.d,
    h: piece.h,
    x: at.x,
    y: at.y,
    rotation: 0,
    elevation: placement === "wall" ? wallElevation(piece.h) : 0,
    material: "",
    colorHex: piece.colorHex,
    paletteRole: "neutral",
    price: { min: 0, max: 0, currency: "EUR" },
    investmentTier: piece.mine ? "anchor" : "mid",
    trendRisk: 0,
    renterFriendly: placement !== "wall",
    requiresDrilling: placement === "wall",
    existing: !!piece.mine,
    locked: true,
    rationale: "Placed by hand in the planner.",
    sizeClass: piece.sizeClass,
    intent: { anchor: CATALOGUE[piece.category].wants.anchor },
    priority: CATALOGUE[piece.category].priority,
  };
}

/** Swap a piece for another catalogue piece, keeping where it stands and how it is turned. */
export function swapItem(item: FurnitureItem, piece: CataloguePiece, name: string): FurnitureItem {
  const fresh = newPlannerItem(piece, item, name, []);
  return { ...fresh, id: item.id, rotation: item.rotation, x: item.x, y: item.y };
}

/** Snap a position to `step` cm (0 = no snapping). */
export const snapTo = (v: number, step: number): number => (step > 0 ? snap(v, step) : Math.round(v));

export const turn = (rotation: number, by: number): number => {
  const r = normDeg(rotation + by);
  return r >= 360 ? 0 : r;
};

/**
 * The stored design with the planner's furniture. References to removed pieces
 * (lamps in the lighting plan, trend items) are dropped so the validator does not
 * report dangling references for pieces the user deleted on purpose.
 */
export function withFurniture(content: DesignContent, furniture: readonly FurnitureItem[]): DesignContent {
  const ids = new Set(furniture.map((f) => f.id));
  return {
    ...content,
    furniture: [...furniture],
    lighting: content.lighting.map((l) => (l.itemId && !ids.has(l.itemId) ? { ...l, itemId: undefined } : l)),
    longevity: { ...content.longevity, trendItems: content.longevity.trendItems.filter((id) => ids.has(id)) },
  };
}

/** Source of design versions saved from the planner. Later planner edits update that version in place. */
export const PLANNER_SOURCE = { model: "planner", promptId: "planner", promptVersion: "v1" } as const;

/** Content for a room that has no design yet: only the planner's pieces. */
export function blankDesign(title: string, furniture: readonly FurnitureItem[]): DesignContent {
  const color = (name: string, hex: string, share: number) => ({ name, hex, paint: { system: "none" as const }, share, usage: [] });
  return {
    concept: { title, summary: "" },
    zones: [],
    furniture: [...furniture],
    palette: {
      base: color("Warm white", "#f5efe4", 0.6),
      secondary: color("Oak", "#a57a52", 0.3),
      accent: color("Clay", "#c8794a", 0.1),
      rationale: "Neutral starting palette for a hand-drawn room.",
    },
    surfaces: [],
    lighting: [],
    textiles: [],
    longevity: { summary: "Pieces placed by hand.", trendItems: [] },
  };
}
