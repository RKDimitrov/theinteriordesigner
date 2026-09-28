import type { Source } from "../../../src/domain/assets/licence.ts";
import { ambientcg } from "./ambientcg.ts";
import { polyhaven } from "./polyhaven.ts";
import { sketchfab } from "./sketchfab.ts";
import type { Adapter } from "./types.ts";
import { url } from "./url.ts";

export const ADAPTERS: Readonly<Record<Source, Adapter>> = {
  polyhaven,
  ambientcg,
  sketchfab,
  khronos: url,
  polypizza: url,
  kenney: url,
  quaternius: url,
  cgbookcase: url,
  "3dtextures": url,
  url,
};
