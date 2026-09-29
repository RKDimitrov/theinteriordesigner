import { z } from "zod";
import { LICENCES, SOURCES } from "./licence.ts";

/**
 * The generated asset catalogue (src/components/planner/three/asset-catalogue.json),
 * written by scripts/fetch-assets.mjs from the manifest and the processed files.
 *
 * Imported by scripts/assets with a relative path, so keep it free of `@/`.
 */

const Rgb = z.tuple([z.number().int().min(0).max(255), z.number().int().min(0).max(255), z.number().int().min(0).max(255)]);

const Common = z.object({
  title: z.string(),
  author: z.string(),
  source: z.enum(SOURCES),
  sourceUrl: z.url(),
  licence: z.enum(LICENCES),
  tags: z.array(z.string()),
  /** Total size of the files the browser downloads. */
  bytes: z.number().int().positive(),
  /** Public path of a 256 px preview, when the source offers one. */
  thumb: z.string().startsWith("/thumbs/").optional(),
});

export const CatalogueEntry = z.discriminatedUnion("kind", [
  Common.extend({
    kind: z.literal("model"),
    /** Native bounds in cm as [width x, height y, depth z]. */
    size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  }),
  Common.extend({
    kind: z.literal("texture"),
    /** Real-world size one tile covers, in cm. */
    tileCm: z.number().positive(),
    /** Mean sRGB colour of the diffuse map, for tinting. */
    mean: Rgb,
  }),
  Common.extend({ kind: z.literal("hdri"), backplate: z.boolean().optional() }),
]);
export type CatalogueEntry = z.infer<typeof CatalogueEntry>;

export const Catalogue = z.record(z.string(), CatalogueEntry);
export type Catalogue = z.infer<typeof Catalogue>;

/** A model at most this big keeps a typical room scene near 30 MB. */
export const MODEL_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** Public URL of each asset's files. */
export const assetPaths = {
  model: (id: string) => `/models/${id}.glb`,
  texture: (id: string) => ["diff", "nor", "arm"].map((m) => `/textures/${id}/${m}.webp`),
  hdri: (id: string) => `/hdris/${id}.hdr`,
  backplate: (id: string) => `/hdris/${id}.jpg`,
  thumb: (id: string) => `/thumbs/${id}.webp`,
};
