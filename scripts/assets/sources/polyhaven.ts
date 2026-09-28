import { join } from "node:path";
import { getBytes, getJson, writeFile } from "../io.ts";
import type { Adapter } from "./types.ts";

/** Poly Haven (https://polyhaven.com): everything is CC0. */
const API = "https://api.polyhaven.com";

interface FileRef {
  url: string;
}
interface Info {
  /** Real-world size in mm; for textures, one tile. */
  dimensions?: number[];
  thumbnail_url?: string;
}
type Files = Record<string, Record<string, Record<string, FileRef & { include?: Record<string, FileRef> }>>>;

const info = (id: string) => getJson<Info>(`${API}/info/${id}`);
const files = (id: string) => getJson<Files>(`${API}/files/${id}`);

/** Diffuse, OpenGL normal, and AO/roughness/metal packed as three.js reads them. */
const MAPS = { Diffuse: "diff", nor_gl: "nor", arm: "arm" } as const;

export const polyhaven: Adapter = {
  async model(e, tmp) {
    const [i, f] = await Promise.all([info(e.ref), files(e.ref)]);
    const gltf = f["gltf"]?.["1k"]?.["gltf"];
    if (!gltf) throw new Error(`no 1k glTF for ${e.ref}`);
    const file = join(tmp, `${e.ref}.gltf`);
    writeFile(file, await getBytes(gltf.url));
    for (const [rel, inc] of Object.entries(gltf.include ?? {})) writeFile(join(tmp, rel), await getBytes(inc.url));
    return { file, licence: "cc0", thumbUrl: i.thumbnail_url };
  },

  async texture(e) {
    const [i, f] = await Promise.all([info(e.ref), files(e.ref)]);
    const maps: Record<string, Uint8Array> = {};
    for (const [key, name] of Object.entries(MAPS)) {
      const ref = f[key]?.["1k"]?.["jpg"];
      if (!ref) throw new Error(`no 1k ${key} for ${e.ref}`);
      maps[name] = await getBytes(ref.url);
    }
    const mm = i.dimensions?.[0];
    return { maps, tileCm: mm ? Math.round(mm) / 10 : undefined, licence: "cc0", thumbUrl: i.thumbnail_url };
  },

  async hdri(e) {
    const [i, f] = await Promise.all([info(e.ref), files(e.ref)]);
    const ref = f["hdri"]?.["1k"]?.["hdr"];
    if (!ref) throw new Error(`no 1k HDR for ${e.ref}`);
    return { hdr: await getBytes(ref.url), licence: "cc0", thumbUrl: i.thumbnail_url };
  },
};
