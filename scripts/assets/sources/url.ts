import { basename, join } from "node:path";
import { getBytes, pickOne, unzip, writeFile } from "../io.ts";
import type { Adapter } from "./types.ts";
import { zipMaps } from "./zip-maps.ts";

/**
 * Sources without a usable download API (Khronos samples, Poly Pizza, Kenney,
 * Quaternius, cgbookcase, 3dtextures.me): the manifest pins the file or zip
 * URL in `ref`. There is nothing to read a licence from, so the manifest's
 * licence stands; whoever adds the entry checks it on the source page.
 */
const isZip = (url: string) => /\.zip($|\?)/i.test(url);

/** Kits ship many models in one zip; download each zip once per run. */
const zips = new Map<string, Promise<Record<string, Uint8Array>>>();
const getZip = (url: string) => {
  if (!zips.has(url)) zips.set(url, getBytes(url).then(unzip));
  return zips.get(url)!;
};

export const url: Adapter = {
  async model(e, tmp) {
    const thumbUrl = e.thumb;
    if (!isZip(e.ref)) {
      const file = join(tmp, basename(new URL(e.ref).pathname));
      writeFile(file, await getBytes(e.ref));
      return { file, licence: e.licence, thumbUrl };
    }
    const files = await getZip(e.ref);
    const names = Object.keys(files);
    const main = pickOne(names, new RegExp(e.pick ?? "\\.gl(b|tf)$", "i"), "glTF");
    // A .gltf may point at buffers and images beside it; a .glb is self-contained.
    const dir = main.slice(0, main.lastIndexOf("/") + 1);
    for (const [name, bytes] of Object.entries(files)) if (main.endsWith(".glb") ? name === main : name.startsWith(dir)) writeFile(join(tmp, name), bytes);
    const thumbData = e.thumbPick ? files[pickOne(names, new RegExp(e.thumbPick, "i"), "thumbnail")] : undefined;
    return { file: join(tmp, main), licence: e.licence, thumbUrl, thumbData };
  },

  async texture(e) {
    if (!isZip(e.ref)) throw new Error(`${e.id}: texture ref must be a zip of maps`);
    const files = await getZip(e.ref);
    const which = zipMaps(Object.keys(files), e);
    const maps = Object.fromEntries(Object.entries(which).map(([map, name]) => [map, files[name]!]));
    return { maps, licence: e.licence, thumbUrl: e.thumb };
  },

  async hdri(e) {
    return { hdr: await getBytes(e.ref), licence: e.licence, thumbUrl: e.thumb };
  },
};
