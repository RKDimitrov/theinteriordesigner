import { getBytes, getJson, unzip } from "../io.ts";
import type { Adapter } from "./types.ts";
import { zipMaps } from "./zip-maps.ts";

/** ambientCG (https://ambientcg.com): everything is CC0. */
const API = "https://ambientcg.com/api/v2/full_json";

interface Download {
  attribute: string;
  downloadLink: string;
}
export interface AcgAsset {
  assetId: string;
  previewImage?: Record<string, string>;
  downloadFolders: { default: { downloadFiletypeCategories: { zip: { downloads: Download[] } } } };
}

/** The 1K JPG zip; larger ones would only be resized down. */
export function acgZipUrl(asset: AcgAsset): string {
  const d = asset.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find((x) => x.attribute === "1K-JPG");
  if (!d) throw new Error(`no 1K-JPG download for ${asset.assetId}`);
  return d.downloadLink;
}

export const ambientcg: Adapter = {
  async texture(e) {
    const res = await getJson<{ foundAssets: AcgAsset[] }>(`${API}?id=${encodeURIComponent(e.ref)}&include=downloadData,previewData`);
    const asset = res.foundAssets.find((a) => a.assetId.toLowerCase() === e.ref.toLowerCase());
    if (!asset) throw new Error(`ambientCG has no ${e.ref}`);
    const files = unzip(await getBytes(acgZipUrl(asset)));
    const which = zipMaps(Object.keys(files), e);
    const maps = Object.fromEntries(Object.entries(which).map(([map, name]) => [map, files[name]!]));
    return { maps, licence: "cc0", thumbUrl: asset.previewImage?.["256-PNG"] };
  },
};
