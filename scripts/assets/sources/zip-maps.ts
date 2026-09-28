import type { MapName, TextureEntry } from "../../../src/domain/assets/manifest.ts";

/**
 * File-name patterns for each PBR map inside a texture zip. They cover
 * ambientCG (`_Color`, `_NormalGL`, `_AmbientOcclusion`) and the usual names
 * elsewhere; a manifest entry can override any of them with `maps`.
 */
const DEFAULTS: Readonly<Record<MapName, string>> = {
  diff: "[_-](color|col|diff(use)?|albedo|base_?colou?r)[_.-]",
  nor: "[_-](normal_?gl|nor_gl|normal|nrm|nor)[_.-]",
  arm: "[_-]arm[_.-]",
  ao: "[_-](ambient_?occlusion|ao)[_.-]",
  rough: "[_-](roughness|rough)[_.-]",
  metal: "[_-](metalness|metallic|metal)[_.-]",
};

const IMAGE = /\.(jpe?g|png|webp)$/i;

/**
 * Which zip entry holds each map. Diffuse and normal are required; for the
 * normal map, an OpenGL variant wins over a DirectX one when both exist.
 */
export function zipMaps(names: readonly string[], e: Pick<TextureEntry, "maps">): Partial<Record<MapName, string>> {
  const images = names.filter((n) => IMAGE.test(n));
  const out: Partial<Record<MapName, string>> = {};
  for (const map of Object.keys(DEFAULTS) as MapName[]) {
    const re = new RegExp(e.maps?.[map] ?? DEFAULTS[map], "i");
    let hits = images.filter((n) => re.test(`_${n.split("/").pop()!}`));
    if (map === "nor" && hits.length > 1) hits = hits.filter((n) => !/(normal_?dx|nor_dx)/i.test(n));
    if (hits.length > 1) throw new Error(`several ${map} maps: ${hits.join(", ")}`);
    if (hits[0]) out[map] = hits[0];
  }
  if (!out.diff || !out.nor) throw new Error(`diffuse or normal map missing among: ${images.join(", ")}`);
  return out;
}
