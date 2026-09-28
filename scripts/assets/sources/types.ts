import type { Licence } from "../../../src/domain/assets/licence.ts";
import type { HdriEntry, MapName, ModelEntry, TextureEntry } from "../../../src/domain/assets/manifest.ts";

/** What a source hands over for one entry, before processing. */
interface Raw {
  /** The licence as the source reports it, in our terms; null when not allowed. */
  licence: Licence | null;
  /** The source's preview image, as a URL or as the image itself. */
  thumbUrl?: string;
  thumbData?: Uint8Array;
}

export interface RawModel extends Raw {
  /** A .glb or .gltf (with its files beside it) inside `tmp`. */
  file: string;
}

export interface RawTexture extends Raw {
  maps: Partial<Record<MapName, Uint8Array>>;
  tileCm?: number;
}

export interface RawHdri extends Raw {
  hdr: Uint8Array;
}

export interface Adapter {
  model?: (e: ModelEntry, tmp: string) => Promise<RawModel>;
  texture?: (e: TextureEntry) => Promise<RawTexture>;
  hdri?: (e: HdriEntry) => Promise<RawHdri>;
}
