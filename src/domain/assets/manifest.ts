import { z } from "zod";
import { isAttribution, LICENCES, SOURCES } from "./licence.ts";

/**
 * The hand-edited list of every 3D asset (assets/manifest/*.json).
 * scripts/fetch-assets.mjs downloads and processes each entry; see
 * docs/superpowers/specs/2026-09-28-asset-pipeline-design.md.
 *
 * Imported by scripts/assets with a relative path, so keep it free of `@/`.
 */

/** Safe as a file name and a URL segment. */
const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
/** Dotted, lower case: "furniture.armchair", "floor.wood", "style.japandi". */
const Tag = z.string().regex(/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/);
/** A regular expression matched against file names inside a downloaded zip. */
const Pattern = z.string().min(1);

const Base = z.object({
  id: Id,
  source: z.enum(SOURCES),
  /** The source's own id, Sketchfab uid, or a download URL for "url"-like sources. */
  ref: z.string().min(1),
  title: z.string().min(1),
  author: z.string(),
  sourceUrl: z.url(),
  licence: z.enum(LICENCES),
  tags: z.array(Tag),
  /** Preview image URL, for sources whose API does not give one. */
  thumb: z.url().optional(),
});

export const ModelEntry = Base.extend({
  kind: z.literal("model"),
  /** Largest texture side in px: 1024 by default, 512 to fit the budget, 2048 for hero pieces. */
  textureSize: z.union([z.literal(512), z.literal(1024), z.literal(2048)]).optional(),
  /** Which .glb/.gltf to take from a zip download. */
  pick: Pattern.optional(),
  /** Which image in that zip to use as the thumbnail. */
  thumbPick: Pattern.optional(),
  /**
   * Keep only the nodes whose name matches (and what they contain), for
   * packs that model many pieces in one file. Their placement is kept.
   */
  node: Pattern.optional(),
});

export const MAP_NAMES = ["diff", "nor", "arm", "ao", "rough", "metal"] as const;
export type MapName = (typeof MAP_NAMES)[number];

export const TextureEntry = Base.extend({
  kind: z.literal("texture"),
  /** Real-world size one tile covers, in cm. Poly Haven reports it; other sources need it here. */
  tileCm: z.number().positive().optional(),
  /** DirectX normal maps have green flipped relative to three.js (OpenGL). */
  normal: z.enum(["gl", "dx"]).optional(),
  /** Overrides for which zip entry holds which map. */
  maps: z.partialRecord(z.enum(MAP_NAMES), Pattern).optional(),
}).refine((e) => e.source === "polyhaven" || e.tileCm !== undefined, { message: "tileCm is required unless the source reports it", path: ["tileCm"] });

export const HdriEntry = Base.extend({ kind: z.literal("hdri") });

export const ManifestEntry = z.discriminatedUnion("kind", [ModelEntry, TextureEntry, HdriEntry]);
export type ManifestEntry = z.infer<typeof ManifestEntry>;
export type ModelEntry = z.infer<typeof ModelEntry>;
export type TextureEntry = z.infer<typeof TextureEntry>;
export type HdriEntry = z.infer<typeof HdriEntry>;

export const Manifest = z.array(ManifestEntry);

/** Problems that span entries or that the licence adds; empty when the manifest is sound. */
export function manifestIssues(entries: readonly ManifestEntry[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.id)) issues.push(`duplicate id ${e.id}`);
    seen.add(e.id);
    if (isAttribution(e.licence) && !e.author.trim()) issues.push(`${e.id}: CC-BY needs an author`);
  }
  return issues;
}
