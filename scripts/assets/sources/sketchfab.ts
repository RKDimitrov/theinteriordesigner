import { join } from "node:path";
import { sourceLicence } from "../../../src/domain/assets/licence.ts";
import { getBytes, getJson, pickOne, secret, unzip, writeFile } from "../io.ts";
import type { Adapter } from "./types.ts";

/**
 * Sketchfab (https://sketchfab.com), download API v3. Only CC0 and CC-BY
 * models are accepted; the licence is read from the API, never trusted from
 * the manifest. Needs SKETCHFAB_TOKEN (environment or .env.local).
 */
const API = "https://api.sketchfab.com/v3";

export interface SketchfabModel {
  uid: string;
  isDownloadable: boolean;
  license?: { slug?: string } | null;
  thumbnails?: { images: { width: number; url: string }[] };
}
interface Download {
  glb?: { url: string };
  gltf?: { url: string };
}

/** The smallest thumbnail at least 256 px wide. */
export function sketchfabThumb(m: SketchfabModel): string | undefined {
  const images = [...(m.thumbnails?.images ?? [])].sort((a, b) => a.width - b.width);
  return (images.find((i) => i.width >= 256) ?? images.at(-1))?.url;
}

export const sketchfab: Adapter = {
  async model(e, tmp) {
    const token = secret("SKETCHFAB_TOKEN");
    if (!token) throw new Error("SKETCHFAB_TOKEN is not set (add it to .env.local)");
    const meta = await getJson<SketchfabModel>(`${API}/models/${e.ref}`);
    const licence = sourceLicence("sketchfab", meta.license?.slug);
    // Stop before downloading anything we could not ship.
    if (!licence) throw new Error(`${e.ref}: licence "${meta.license?.slug ?? "none"}" may not be shipped`);
    if (!meta.isDownloadable) throw new Error(`${e.ref} is not downloadable`);
    const dl = await getJson<Download>(`${API}/models/${e.ref}/download`, { Authorization: `Token ${token}` });
    const thumbUrl = sketchfabThumb(meta);
    if (dl.glb) {
      const file = join(tmp, "model.glb");
      writeFile(file, await getBytes(dl.glb.url));
      return { file, licence, thumbUrl };
    }
    if (!dl.gltf) throw new Error(`${e.ref} offers no glTF download`);
    const files = unzip(await getBytes(dl.gltf.url));
    for (const [name, data] of Object.entries(files)) writeFile(join(tmp, name), data);
    const main = pickOne(Object.keys(files), new RegExp(e.pick ?? "\\.gl(b|tf)$", "i"), "glTF");
    return { file: join(tmp, main), licence, thumbUrl };
  },
};
