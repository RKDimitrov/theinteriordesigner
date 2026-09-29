import { z } from "zod";

/*
 * Surface materials for walls, floors and ceilings. The 3D materials and the
 * picker swatches both read this list, so they cannot drift apart. Textures
 * are ids in the asset catalogue (scripts/fetch-assets.mjs); paint is a
 * colour over a fine plaster texture.
 */

export type Surface = "wall" | "floor" | "ceiling";
export const MATERIAL_GROUPS = ["paint", "plaster", "concrete", "brick", "wood", "panelling", "wallpaper", "tile", "stone", "terrazzo", "carpet", "beams"] as const;
export type MaterialGroup = (typeof MATERIAL_GROUPS)[number];

export interface Material {
  id: string;
  surfaces: readonly Surface[];
  group: MaterialGroup;
  /** Photographed PBR set; paint uses a fine plaster texture for its surface. */
  texture: string;
  /** Colour the texture is tinted to; unset keeps the photo's own colour. */
  tint?: string;
  /** Flat colour for swatches when there is no tint (from the photo's mean). */
  swatch?: string;
  roughness?: number;
}

const PAINT_BASE = "acg_plaster_001";
const paint = (id: string, tint: string, surfaces: readonly Surface[] = ["wall", "ceiling"]): Material => ({ id, surfaces, group: "paint", texture: PAINT_BASE, tint, roughness: 0.9 });
const tex = (id: string, group: MaterialGroup, texture: string, surfaces: readonly Surface[], tint?: string): Material => ({ id, surfaces, group, texture, ...(tint ? { tint } : {}) });

const W = ["wall"] as const;
const F = ["floor"] as const;

export const MATERIALS: readonly Material[] = [
  // Paint: a real-world palette. The first four are the finishes the planner had before.
  paint("limewash", "#e9e1d2"),
  paint("warmwhite", "#f5efe4"),
  paint("clay", "#d9a88a"),
  paint("sage", "#b9bfa3"),
  paint("chalk", "#f3f1ec"),
  paint("greige", "#d6cfc4"),
  paint("stone", "#b9b3a8"),
  paint("terracotta_paint", "#c07a5a", W),
  paint("olive", "#8a8a62", W),
  paint("teal", "#3f6b6b", W),
  paint("ink", "#2f3b4f", W),
  paint("charcoal", "#3c3b39", W),
  // Walls
  tex("limewash_plaster", "plaster", "painted_plaster_wall", ["wall", "ceiling"], "#e4dccd"),
  tex("clay_plaster", "plaster", "clay_plaster", W),
  tex("smooth_plaster", "plaster", "plastered_wall_04", ["wall", "ceiling"], "#e6e1d8"),
  tex("fair_faced_concrete", "concrete", "concrete_wall_004", ["wall", "ceiling"]),
  tex("red_brick", "brick", "acg_bricks_085", W),
  tex("old_brick", "brick", "brick_wall_02", W),
  tex("wood_slats", "panelling", "acg_wood_siding_008", ["wall", "ceiling"]),
  tex("textured_wallpaper", "wallpaper", "acg_wallpaper_001a", W, "#e8e0d0"),
  tex("subway_tiles", "tile", "long_white_tiles", W),
  tex("square_tiles", "tile", "acg_tiles_107", W),
  tex("marble_tiles", "tile", "acg_tiles_141", ["wall", "floor"]),
  // Floors. The first four are the finishes the planner had before.
  tex("oak", "wood", "wood_floor", F, "#cfa77a"),
  tex("ash", "wood", "laminate_floor_02", F, "#e6d3b3"),
  tex("terracotta", "tile", "terracotta_floor_tiles", F, "#c07a55"),
  tex("microcement", "concrete", "plastered_wall_04", F, "#cbc3b6"),
  tex("herringbone_oak", "wood", "herringbone_parquet", F),
  tex("diagonal_parquet", "wood", "diagonal_parquet", F),
  tex("wide_oak_planks", "wood", "oak_wood_planks", F),
  tex("dark_planks", "wood", "dark_wooden_planks", F),
  tex("pale_pine", "wood", "acg_wood_floor_040", F),
  tex("vinyl_plank", "wood", "acg_wood_floor_064", F),
  tex("large_grey_tiles", "tile", "large_grey_tiles", F),
  tex("chequer_tiles", "tile", "floor_tiles_06", F),
  tex("marble", "stone", "marble_01", F),
  tex("terrazzo", "terrazzo", "acg_terrazzo_013", F),
  tex("polished_concrete", "concrete", "concrete_floor_02", F),
  tex("wool_carpet", "carpet", "acg_carpet_016", F),
  tex("blue_carpet", "carpet", "acg_carpet_012", F),
  // Ceilings
  paint("ceiling_white", "#f7f5f0", ["ceiling"]),
  tex("exposed_beams", "beams", "oak_veneer_01", ["ceiling"], "#9a7350"),
];

export const MATERIAL_BY_ID: ReadonlyMap<string, Material> = new Map(MATERIALS.map((m) => [m.id, m]));

export const materialsFor = (surface: Surface): Material[] => MATERIALS.filter((m) => m.surfaces.includes(surface));

/* ---------------- a room's finishes ---------------- */

const MaterialId = z.string().regex(/^[a-z0-9_]{1,40}$/);

/**
 * A room's surfaces: floor, ceiling, a colour for all walls and any accent
 * walls (by wall index). Unset parts fall back to the defaults.
 */
export const RoomFinishes = z.object({
  floor: MaterialId.optional(),
  walls: MaterialId.optional(),
  ceiling: MaterialId.optional(),
  wallOverrides: z.record(z.string().regex(/^\d{1,2}$/), MaterialId).default({}),
});
export type RoomFinishes = z.infer<typeof RoomFinishes>;

export const DEFAULT_FINISHES = { floor: "oak", walls: "limewash", ceiling: "ceiling_white" } as const;

function pick(id: string | undefined, surface: Surface, fallback: string): Material {
  const m = id ? MATERIAL_BY_ID.get(id) : undefined;
  return m && m.surfaces.includes(surface) ? m : MATERIAL_BY_ID.get(fallback)!;
}

/** The material on each surface; unknown or misplaced ids fall back to the defaults. */
export function resolveFinishes(f: RoomFinishes | undefined) {
  const walls = pick(f?.walls, "wall", DEFAULT_FINISHES.walls);
  return {
    floor: pick(f?.floor, "floor", DEFAULT_FINISHES.floor),
    ceiling: pick(f?.ceiling, "ceiling", DEFAULT_FINISHES.ceiling),
    walls,
    wall: (index: number) => pick(f?.wallOverrides?.[String(index)], "wall", walls.id),
  };
}

/**
 * Finishes kept per browser before they moved to the database, as they were
 * stored: `{ floor, walls }` with the old ids. Null when there is nothing usable.
 */
export function fromLegacy(raw: unknown): RoomFinishes | null {
  const legacy = z.object({ floor: z.string().optional(), walls: z.string().optional() }).safeParse(raw);
  if (!legacy.success) return null;
  const floor = legacy.data.floor && MATERIAL_BY_ID.get(legacy.data.floor)?.surfaces.includes("floor") ? legacy.data.floor : undefined;
  const walls = legacy.data.walls && MATERIAL_BY_ID.get(legacy.data.walls)?.surfaces.includes("wall") ? legacy.data.walls : undefined;
  if (!floor && !walls) return null;
  return { ...(floor ? { floor } : {}), ...(walls ? { walls } : {}), wallOverrides: {} };
}
