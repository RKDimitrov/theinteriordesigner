# Asset pipeline (phase A of the realistic 3D apartment)

Status: approved 2026-09-28. Later phases: B openings and fixtures, C surface materials, F outside world, E lighting, D furniture breadth, G walkthrough.

## Why

The realistic view needs hundreds of real models, textures and HDRIs from several free sources. Before this phase, `scripts/fetch-assets.mjs` knew only Poly Haven. It kept its ids in hard-coded lists, and the texture tile sizes and mean colours were typed by hand in `three/assets.ts`. Nothing recorded licences, and there was no credits page. Every later phase feeds content through this pipeline, so it comes first.

## Decisions

- The generated files are committed to git (`public/models`, `public/textures`, `public/hdris`, `public/thumbs`), as before.
- Phase A migrates the existing 9 models and 6 textures, and proves each source adapter with one real asset. Bulk content arrives in later phases.
- Allowed licences: CC0, CC-BY 3.0 and CC-BY 4.0. NC, ND and SA are refused. So are store licences that forbid redistribution (TurboSquid, CGTrader free, BlenderKit) and retailer models. A web app ships the raw file, which counts as redistribution.
- The Sketchfab token lives in `SKETCHFAB_TOKEN` (environment or `.env.local`). It is never committed or logged.

## Layout

| Path | Role |
| --- | --- |
| `assets/manifest/{models,textures,hdris}.json` | Hand-edited list of every asset: id, source, source ref, title, author, source URL, licence and tags. |
| `src/domain/assets/manifest.ts` | Zod schema for the manifest and cross-entry checks (unique ids, credit fields). |
| `src/domain/assets/licence.ts` | Maps each source's licence strings to our licence enum. Returns `null` for anything not allowed. |
| `src/domain/assets/catalogue.ts` | Zod schema for the generated catalogue. |
| `scripts/assets/**` | The pipeline in TypeScript. Node 22 runs it directly through type stripping, so it imports the domain modules with relative `.ts` paths. |
| `scripts/fetch-assets.mjs` | CLI entry point, unchanged command: `node scripts/fetch-assets.mjs [--only id] [--source name] [--force] [--check]`. |
| `src/components/planner/three/asset-catalogue.json` | Generated. Replaces `model-sizes.json`. |
| `src/app/[locale]/credits/page.tsx` | Public credits page, generated from the catalogue. |

## Sources

| Source | Adapter | Licence check |
| --- | --- | --- |
| Poly Haven | API (`/info`, `/files`): models, textures, HDRIs. Tile size comes from `dimensions` (mm). | Always CC0. |
| ambientCG | API v2: 1K-JPG zip. Separate AO, roughness and metal maps are packed into `arm`. | Always CC0. |
| Sketchfab | v3: `/models/{uid}` for the licence, then `/models/{uid}/download` with the token. | `license.slug` must be `cc0` or `by`. |
| Khronos glTF Sample Assets | `url` adapter, raw GitHub URL. | Per asset, taken from the manifest (the sample's README states it). |
| Poly Pizza, Kenney, Quaternius, cgbookcase, 3dtextures.me | `url` adapter: the manifest pins a file or zip URL and which files to pick from it. | Taken from the manifest; a human checks it when adding the entry. |

If the licence found at the source differs from the one in the manifest, the pipeline fails for that entry.

## Processing

- **Models:** `gltf-transform optimize` with meshopt geometry and WebP textures of at most 1024 px (the entry can set `textureSize` to 512 to fit the budget, or 2048 for hero pieces). Then the scene bounds are measured in cm. A model over 1.5 MB fails the budget.
- **Textures:** `diff`, `nor` and `arm` WebP maps at 1K. DirectX normal maps get their green channel flipped. The mean sRGB colour of `diff` is computed for tinting. The tile size in cm comes from the source or from the manifest.
- **HDRIs:** the 1K `.hdr` file, for lighting. Backplates for the outside world are phase F.
- **Thumbnails:** the source's preview image, written as a 256 px WebP to `public/thumbs/<id>.webp`.
- **Catalogue:** one entry per id, holding kind, title, author, licence, source, source URL, tags, file size and thumbnail. Models also get their native size; textures get tile size and mean colour. A run with `--only` merges into the existing catalogue, and ids no longer in the manifest are dropped.
- **`--check`:** works offline. It validates the manifest and reports missing outputs and orphan files.

## App changes

- `three/assets.ts` derives `ModelId`, `TextureId`, `MODEL_SIZE`, `TEXTURE_CM` and `TEXTURE_MEAN` from the catalogue. Their exported shapes stay the same, so the rendering code does not change.
- Credits page: CC-BY assets are listed with title, author, source link, licence link and a note on what was changed (CC-BY requires this). CC0 assets are grouped by source. Links to the page are in Settings and on the login page. The strings are in en, de and bg.

## Out of scope (later phases)

- KTX2 textures, only if texture memory becomes the bottleneck.
- Instancing and loading assets per visible room (B and D).
- Door and window rigging with `leaf`, `frame` and `handle` nodes, and 9-slice scaling (B). B adds it as an optional manifest field, which does not break existing entries.
- Model `turn` stays in `PIECE_ASSETS` until phase D picks variants from tags.
