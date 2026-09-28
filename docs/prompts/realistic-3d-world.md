# RaumPlan: prompt for the realistic 3D apartment (materials, real models, lighting, surroundings)

Paste everything below the line into a new Claude Code session opened in this repo.

---

# Role

You are a senior graphics and full-stack engineer continuing work on **RaumPlan**. It's a web app where a user describes their apartment, gets an AI-generated interior design that is checked for dimensional validity, and then refines it in a 2D/3D planner.

**The vision:** when everything is set, the user steps into their apartment and looks around. It should look realistic and beautiful, like an architectural visualisation. That means:

- real furniture and fixtures,
- real materials on every surface,
- believable daylight and lamp light,
- and a believable world outside the windows that fits where the apartment actually is.

It also has to run in a normal browser on a normal laptop.

**Core principle (unchanged):** the language model decides taste and intent; deterministic TypeScript owns geometry. Every design passes the validator before it is shown. Nothing visual may change the dimensions a piece occupies: **every object renders at exactly the width, depth and height set in the planner.**

# Read first

1. `AGENTS.md`. This is **Next.js 16** and not the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before using any Next API.
2. `README.md`: setup, conventions, project layout, scripts (including `node scripts/fetch-assets.mjs`).
3. `docs/superpowers/specs/2026-09-27-opening-styles-design.md`: the door/window/radiator types and finishes that already exist.
4. The 3D code: `src/components/planner/stage-3d.tsx` and everything in `src/components/planner/three/`.

Stack: Next.js 16 (App Router), TypeScript strict, React 19, three 0.186 with @react-three/fiber 9, drei 10 and @react-three/postprocessing 3 (N8AO). Also Tailwind v4, next-intl (every string in `src/messages/en.json`, `de.json` and `bg.json`), Supabase auth, Prisma 7 (Postgres), Zod 4 at every boundary, Vitest and Playwright.

# What exists today

- **Rendering:** a Realistic/Drawing toggle (Scene tab). There's an interior HDRI from `@pmndrs/assets`, Neutral tone mapping, N8AO ambient occlusion (switched off automatically on slow machines by `PerformanceMonitor`), soft PCF shadows, and a suncalc sun driven by the apartment's latitude, north angle and a time-of-day slider.
- **Floors:** 4 photographed PBR floors from Poly Haven, tinted to their swatch colours.
- **Walls:** flat paint only; 4 colours, `WALL_COLOR` in `three/materials.ts`. Floor and wall finishes are stored **only in the browser (localStorage)**, per room.
- **Furniture:** `three/assets.ts` maps each of the 26 catalogue categories to either:
  - **real glTF models** from `public/models`, meshopt-compressed with WebP textures and fetched by `scripts/fetch-assets.mjs`. Each model is stretched to the exact size. When a category lists several models, `pickVariant` chooses the one needing the least distortion. Model sizes are measured into `three/model-sizes.json`.
  - **pieces built in code** from PBR textures (`three/pieces.tsx`): sofa, bed, wardrobe, shelves, tables and so on.
- **Doors, windows, radiators:** styles and finishes exist in the data model, with apartment defaults in `Apartment.fitOut` and per-opening overrides. Clearances, the validator and the AI designer's room facts all understand the styles. **The 3D look of these is built in code from boxes (`three/openings3d.tsx`), and the user rejected that.** See below.
- **Apartment data you can use:** `floorLevel` (−2 to 100), `city`, `country`, `lat`/`lng`, `northAngleDeg`, and each wall's compass facing (`wallOrientations`).
- **Asset hygiene:** a failed model or texture falls back to a plain box (`AssetBoundary`). `/models` and `/textures` get a one-day cache header in `next.config.ts`.

# The user's direction (decided, do not re-litigate)

1. **Real 3D objects, not replicas built in code.** Doors, windows, radiators and every other visible object should be real 3D models, like the furniture. Build geometry in code only when no usable model exists, or for things a model can't represent (walls cut to the room's shape, floors). When you do fall back, say so.
2. **Lots of choice.** The user wants many options for everything so they can make a good apartment: several models per furniture category, per door/window/radiator type, and per fixture, plus a large material library for walls, floors and ceilings.
3. **Realistic lighting**, indoors and out, that changes with the time of day.
4. **A realistic outside.** What you see through the windows, and around the apartment in the 3D overview, must depend on:
   - **height in the building** (`floorLevel`): a ground-floor flat sees a garden, pavement or street at eye level; a first to third floor sees tree canopies and the street below; a high floor sees rooftops, a skyline and mostly sky.
   - **surroundings:** city centre, urban residential, suburban, rural/countryside, and optionally waterfront or mountains.
   - **which way each window faces**, and ideally whether a wall faces the street, a courtyard or a garden.

# Workstreams

Treat these as separate, shippable phases. Propose an order; my suggestion is A first, then B, C, F, E, D, G. Each phase ends with tests green and verification in the running app.

## A. Asset pipeline for many sources

- Generalise `scripts/fetch-assets.mjs` into a manifest-driven pipeline. Each asset gets an entry with id, source, source URL, author, licence, category or kind, style tags, and native size (measured). Produce browser-ready files (meshopt + WebP, textures ≤ 1–2K) and a generated TypeScript/JSON catalogue.
- Sources to use, all with licences that allow shipping the file inside a web app:
  - **Poly Haven** (API, CC0): models, textures, HDRIs.
  - **ambientCG** (API, CC0): textures.
  - **Kenney** and **Quaternius** (CC0): stylised fallbacks.
  - **Poly Pizza** (CC0/CC-BY).
  - **Khronos glTF Sample Assets** (mostly CC-BY).
  - **Sketchfab**: download API v3, needs the user's API token, so ask for it and never commit it. Filter to CC0 and CC-BY only.
  - **cgbookcase** and **3dtextures.me** (CC0).
- **Licence rules:** never use NC (non-commercial) or ND licences, "royalty-free, no redistribution" store licences (TurboSquid, CGTrader free, BlenderKit), or retailer models (IKEA and so on). A web app ships the raw file, which counts as redistribution. Every CC-BY asset must be credited: add a generated **credits page** in the app, linked from Settings or the footer.
- **Budgets:** about 1.5 MB per model, a typical room scene under about 30 MB. Use instancing for repeated items and lazy loading per visible room. Consider KTX2 textures (self-host the Basis transcoder in `/public`, no CDN) if texture memory becomes the bottleneck.
- Keep `pickVariant` and the exact-size rule. Extend the orientation test (`three/assets.test.ts`) to every model.

## B. Doors, windows, radiators and fixtures as real models

- Replace the code-built openings in `three/openings3d.tsx` with real models for every style already in the data model:
  - **Doors:** hinged, double, sliding, pocket, glazed, balcony, barn, bifold.
  - **Windows:** casement, tilt-turn, sliding, fixed, floor-to-ceiling.
  - **Radiators:** panel, column, towel rail, vertical, floor convector.
  - Offer **several models per style**, and finishes as material variants of each model.
- **Exact size without distortion:** a frame stretched to a new size gets fat or thin profiles. Solve it properly. Either split models into parts (frame corners, rails, leaf, glass, handle) and rebuild them at size, or use 9-slice scaling (only the middle segments stretch). Glass and leaf panels may stretch; profiles and handles must not.
- **Doors must still open:** keep the existing swing, slide, pocket and fold animations. That needs models with a separate leaf node and a known hinge axis. Normalise that in the pipeline, for example with a naming convention like `leaf`, `frame` and `handle` nodes.
- **More fixtures,** each with several models:
  - light switches and sockets (sockets already exist in the data model),
  - skirting boards and door architraves,
  - window sills (inside and outside),
  - curtains, blinds and shutters (with open/closed state),
  - ceiling lights and pendants,
  - kitchen runs and appliances, and bathroom fixtures (the room types `kitchen` and `bath` already exist): basin, WC, shower, bath, tiles.
- 2D plan symbols and the validator already know the opening styles. New fixture kinds need both, plus room facts for the AI designer.

## C. Surface material library

- Many real PBR materials, each with a thumbnail:
  - **Walls:** paint in a real colour palette, plus limewash, plaster, concrete, exposed brick, wallpapers, wood panelling, and tiles (kitchen and bath).
  - **Floors:** many woods and parquet patterns (herringbone, chevron), tiles, natural stone, terrazzo, polished concrete, carpet, vinyl.
  - **Ceilings:** a few, including exposed beams as an option.
- Finishes should be settable **per wall** (accent walls), not only per room. Walls are `boxGeometry` today with 0–1 UVs, so give wall pieces real-world UVs in cm (see `cmUV` in `three/geometry.ts`).
- **Move finishes from localStorage into the database** (the UI even says "kept on this device for now"). That needs a Zod schema, a Prisma migration and server actions. Migrate any existing localStorage values on first load.
- The pickers need thumbnails, groups and search. Swatches should come from the same data as the 3D materials so they can't drift apart (the pattern in `three/fit-out-look.ts`).

## D. Furniture breadth and choice

- Several real models per catalogue category, tagged by style so they match the user's style profile (`src/domain/profile`: scandinavian, japandi, mid-century, industrial, boho, mediterranean, minimal, modern classic).
- The AI designer and the planner pick a matching model. The user can swap it in the inspector (a `modelId` on the furniture item, validated with Zod, with backward-compatible defaults).
- Colour and material variants where the model allows it; for example, tint a named fabric material to the piece's `colorHex`.
- Decor props that make rooms feel lived in: books, vases, cushions, throws, table lamps, kitchenware, towels, plants in several sizes. Decide with the user whether props are placed automatically and whether the validator should ignore them.
- Replace the pieces built in code (sofa, bed, wardrobe, …) with real models where good ones exist, per the user's direction.

## E. Lighting

- **Daylight:** keep the suncalc sun. Add a sky and outdoor HDRI that matches the time of day, so light through the windows, colour temperature and exposure change together (dawn, noon, golden hour, night).
- **Artificial light:** lamp models with emissive shades and matching point/spot lights, colour temperature per lamp, a light switch per room, and a sensible cap on real-time light count.
- **Exposure:** looking from a dim room at a bright window must look right. Add auto-exposure or eye adaptation (postprocessing), and subtle bloom for lamps and windows.
- **Two quality levels:**
  - **Real-time:** for orbiting and the walkthrough, with adaptive quality on slow machines.
  - **Photo mode:** for still images, with progressive accumulation (e.g. drei `AccumulativeShadows`, or a path tracer such as `three-gpu-pathtracer`) and a download button. Ask before adding a heavy dependency.

## F. Outside world and the building shell

- **New apartment data:**
  - `surroundings`: `city_centre` | `urban` | `suburban` | `rural`, and optionally `waterfront` or `mountains`. It needs a UI in the apartment form, a Zod schema, a Prisma migration, and a "Fill sample data" preset.
  - Optionally a per-wall **outlook** (`street` | `courtyard` | `garden` | `open`).
  - `floorLevel` already exists; use it for the viewing height (roughly 3 m per storey).
- **Suggested approach** (propose alternatives if you find better):
  1. **Distant view:** outdoor HDRI backplates chosen by surroundings × height band × time of day: ground level, low (1–3), mid (4–8), high (9+). Poly Haven has many (streets, courtyards, parks, rooftops, countryside). Place the ground at the right depth for the floor level, using ground-projected environment maps. Backplates visible through windows need 2–4K; lighting can stay at 1K.
  2. **Near context with parallax:**
     - the building's own facade (plaster, brick, render),
     - exterior window reveals and sills,
     - a balcony slab and railing for balcony doors,
     - simplified storeys above and below so the flat doesn't float in the 3D overview,
     - neighbouring facades across the street or courtyard,
     - trees (instanced or impostors),
     - pavement or garden at ground level.
  3. **Optional stretch:** use the real surroundings from OpenStreetMap building footprints (Overpass API) around `lat`/`lng`, extruded to plausible heights. Check the ODbL attribution and caching obligations and the rate limits. Ask before doing this.
- **The 3D overview** should show the apartment as part of a building (a cut-away), not a floating box.
- **Performance:** the outside must stay cheap. Mostly backplates, few near models, instancing, and nothing outside the view distance.

## G. Walkthrough polish

Keep collisions and door interaction. Add:

- correct eye height,
- smooth camera,
- a way to look out of each window (e.g. click a window to move there),
- saved viewpoints that also store time of day and the lights' state,
- screenshots taken from photo mode.

# Standing rules

- **The dev server:** usually I have `npm run dev` running on :3000. Ask before starting long-running processes. You may run `npm test`, `npm run typecheck`, `npm run lint`, and Playwright against my running dev server.
- **Visual checks:** use Playwright with my installed Chrome (`E2E_BROWSER_CHANNEL=chrome`). Screenshot the planner in 3D, as the previous session did, with temporary specs that create and delete their own test apartment. Always look at the screenshots before claiming something works.
- **Code standards:** strict TypeScript, no `any`, Zod at boundaries, pure logic in `src/domain/**` with unit tests, and TDD for logic.
- **Tests:** keep every existing unit and E2E test green, and keep the existing `data-testid` values working.
- **Translations:** every new string goes in en, de and bg.
- **Dependencies:** no new heavy ones without asking. Asset downloads go through the fetch pipeline, never by hand.
- **Database changes:** ask before applying any migration to the Supabase database, and apply migrations with `npx prisma migrate deploy`.
- **Work in progress:** the previous session's work may be uncommitted. Run `git status` first and never discard it.

# How to start

1. Load the brainstorming skill. This is architectural work, so decompose it into the phases above, confirm the order and scope with me, and ask clarifying questions one at a time.
2. For the first phase, write a spec in `docs/superpowers/specs/` and an implementation plan, then build it.
3. At the end of each phase, show me before/after screenshots and list what's still a code-built fallback and why.
