import type { FurnitureCategory } from "@/domain/schemas/design";
import type { FloorFinish } from "../state";
import MODEL_SIZES from "./model-sizes.json";

/** Native size of each model in public/models, in cm as [w, h, d]; written by scripts/fetch-assets.mjs. */
export type ModelId = keyof typeof MODEL_SIZES;
export const MODEL_SIZE = MODEL_SIZES as unknown as Readonly<Record<ModelId, readonly [number, number, number]>>;

export interface ModelVariant {
  id: ModelId;
  /** Degrees to turn the model so its front faces +z (the piece's front). */
  turn?: number;
}

/**
 * How each catalogue category looks in the realistic 3D view. Files live in
 * public/ and are fetched by scripts/fetch-assets.mjs (Poly Haven, CC0).
 *
 * - "models": glTFs stretched to exactly the piece's w × h × d; when there are
 *   several, the one needing the least distortion is used (see pickVariant).
 * - "built": assembled in code from real PBR textures (three/pieces.tsx), so
 *   it matches the size by construction and takes the piece's colour.
 */
export type PieceAsset = { kind: "models"; variants: readonly [ModelVariant, ...ModelVariant[]] } | { kind: "built" };

const models = (...variants: [ModelVariant, ...ModelVariant[]]): PieceAsset => ({ kind: "models", variants });
const built: PieceAsset = { kind: "built" };

export const PIECE_ASSETS: Readonly<Record<FurnitureCategory, PieceAsset>> = {
  sofa: built,
  armchair: models({ id: "modern_arm_chair_01" }),
  // Modelled with its long side front to back.
  coffee_table: models({ id: "modern_coffee_table_01", turn: 90 }),
  side_table: models({ id: "side_table_01" }),
  tv_unit: models({ id: "modern_wooden_cabinet" }),
  bed: built,
  nightstand: models({ id: "side_table_01" }),
  wardrobe: built,
  dresser: built,
  desk: built,
  office_chair: models({ id: "dining_chair_02" }),
  dining_table: built,
  dining_chair: models({ id: "painted_wooden_chair_01" }),
  bookshelf: built,
  sideboard: models({ id: "modern_wooden_cabinet" }),
  storage: built,
  floor_lamp: built,
  plant: models({ id: "potted_plant_01" }, { id: "potted_plant_02" }),
  rug: built,
  mirror: built,
  wall_shelf: built,
  art: models({ id: "hanging_picture_frame_02" }),
  bench: built,
  shoe_cabinet: built,
  coat_rack: built,
  other: built,
};

/** A variant's native [w, h, d] after its turn (a quarter turn swaps width and depth). */
export function nativeFootprint(v: ModelVariant): [number, number, number] {
  const [w, h, d] = MODEL_SIZE[v.id];
  return Math.round((v.turn ?? 0) / 90) % 2 ? [d, h, w] : [w, h, d];
}

/**
 * The variant that needs the least non-uniform stretching to fill w × d × h.
 * Distortion is the spread of the three log scale factors, so a uniformly
 * scaled copy counts as undistorted.
 */
export function pickVariant<V extends ModelVariant>(variants: readonly V[], w: number, d: number, h: number): V {
  let best = variants[0]!;
  let bestCost = Infinity;
  for (const v of variants) {
    const [nw, nh, nd] = nativeFootprint(v);
    const logs = [Math.log(w / nw), Math.log(h / nh), Math.log(d / nd)];
    const cost = Math.max(...logs) - Math.min(...logs);
    if (cost < bestCost) [best, bestCost] = [v, cost];
  }
  return best;
}

/** PBR texture sets in public/textures/<id>/, with the real-world size one tile covers. */
export const TEXTURE_CM = {
  wood_floor: 170,
  laminate_floor_02: 170,
  terracotta_floor_tiles: 208,
  plastered_wall_04: 320,
  oak_veneer_01: 183,
  poly_wool_herringbone: 27,
} as const;
export type TextureId = keyof typeof TEXTURE_CM;

/** Mean sRGB colour of each diffuse map, so a tint can land on a target colour. */
export const TEXTURE_MEAN: Readonly<Record<TextureId, readonly [number, number, number]>> = {
  wood_floor: [128, 96, 66],
  laminate_floor_02: [155, 129, 99],
  terracotta_floor_tiles: [77, 39, 26],
  plastered_wall_04: [141, 138, 135],
  oak_veneer_01: [161, 126, 87],
  poly_wool_herringbone: [121, 117, 113],
};

export const FLOOR_TEXTURE: Readonly<Record<FloorFinish, TextureId>> = {
  oak: "wood_floor",
  ash: "laminate_floor_02",
  terracotta: "terracotta_floor_tiles",
  microcement: "plastered_wall_04",
};
