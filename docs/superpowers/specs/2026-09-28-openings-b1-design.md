# Realistic doors, windows, radiators and trim (phase B1)

Status: built and checked in the running app, 2026-09-28. Follows phase A (asset pipeline). Phase B2, which comes after this, adds new fixture kinds: switches, curtains and blinds, ceiling lights, kitchen runs and bathroom fixtures.

## Why parametric, and what "real" means here

The user rejected the box-built openings. The first plan was to replace them with downloaded models. A survey of the allowed sources (Poly Haven, ambientCG, Sketchfab CC0/CC-BY, Kenney, Quaternius, Poly Pizza, Khronos) found three problems:

- Few usable models exist for modern apartment doors, windows and radiators. Most are old, rusty or low-poly game assets.
- Their quality and scale don't match each other.
- Nearly every door fuses the leaf and the frame into one mesh (for example the Sketchfab "Door with frame"), so the leaf cannot swing. None exist for pocket, bifold or floor-convector styles.

Stretching a model to size also fattens its profiles. Architectural tools (Revit, ArchiCAD) make doors and windows parametric objects for exactly that reason. The user chose this: **parametric construction from real profiles and real materials, plus real glTF hardware.**

- **Profiles:** real cross-sections (architrave, lining and stop, leaf edge, panel mouldings, glazing beads, window frame and sash, sill, skirting) are swept along the opening's outline with mitred corners. Every piece has exactly the planner's size, and nothing is distorted.
- **Materials:** photographed PBR wood tinted to the finish, lacquer with clearcoat, powder-coat paint, glass.
- **Hardware:** real models from the pipeline, scaled uniformly to real-world size and never stretched.
  - Door levers (modern stainless, classic brass lever set), a knob and a pull handle: Sketchfab, CC-BY.
  - Thermostatic radiator valve: Sketchfab, CC-BY.
- **Still built in code, and why:** window handles (no usable model found), hinges and barn-door rails and rollers (tiny or simple), and radiator bodies. Radiator bodies are standard pressed-steel and tube shapes, so they are built from real profiles and tubes, with repeated parts instanced.

## Choice for the user

Choice comes from three layers:

- **Style** is the existing mechanics.
- **Design** is new. Doors: `flush`, `shaker`, `four_panel`, `three_lite`, `full_lite`, `planks`. Windows: `plain`, `grid`, `transom`.
- **Finish** is the existing enum.

The apartment also gets a **trim** setting: profile family (`square`, `bevel` or `ogee`, shared by architraves and skirting), trim finish, skirting height, and skirting on or off. It also gets a default door handle: `lever_modern`, `lever_classic` or `knob`.

| Layer | Where it is stored | Default |
| --- | --- | --- |
| Door `design` | `Door.design` (optional), `FitOut.doors.design` | `flush`. Glazed and balcony styles default to `full_lite`, barn to `planks`. |
| Window `design` | `Window.design` (optional), `FitOut.windows.design` | `plain` |
| Handle | `FitOut.doors.handle` | `lever_modern` |
| Trim | `FitOut.trim` `{ profile, finish, skirting, skirtingHeight }` | `square`, `white`, on, 8 cm |

`Room.openings` and `Apartment.fitOut` are JSON columns parsed with Zod defaults, so old data still reads and **no migration is needed**. The design never changes an opening's footprint, so the validator, the 2D symbols and the AI room facts are unchanged.

## Code layout

- `src/domain/room/fit-out.ts`: new enums, defaults, `doorDesign()` and `windowDesign()`.
- `src/domain/room/opening-parts.ts`: pure layouts with unit tests.
  - `leafParts`: stiles, rails, panels and glass by design.
  - `windowParts`: frame, sashes, glazing bars and transom by style and design.
  - `radiatorParts`: sections and pitch.
  - `skirtingRuns`: runs along each wall, broken at doors and at floor-level glazing.
- `src/components/planner/three/sweep.ts`: sweeps a closed 2D profile along a 2D path, open or closed, with mitred joints, capped ends, and UVs in cm. Unit tested: exact bounds, mitres and caps.
- `three/profiles.ts`: the cross-section library.
- `three/hardware.tsx`: handle and valve models, sized uniformly, with a fallback built in code if a model fails to load.
- `three/doors3d.tsx`, `three/windows3d.tsx`, `three/radiators3d.tsx` and `three/trim3d.tsx` (skirting).
  - `openings3d.tsx` keeps `Opening3D`, `sideSign` and the swing, slide and fold animations, and routes each opening to one of these files.
- UI:
  - Design picker in the inspector.
  - Design, handle and trim defaults in the Finishes tab.
  - Strings in en, de and bg.
  - A dev "Fill sample data" button that cycles through fit-out presets.

## Performance

- Swept geometries are memoised per size and profile.
- Radiator sections and grille bars are merged or instanced.
- Hardware glTFs are shared through `useGLTF` caching.
- Glass is transparent PBR, not transmission, to avoid an extra render pass.
- Drawing mode reuses the same geometry with flat colours and ink edges.

## Verification

- Unit tests: profiles and sweep, layouts, fit-out parsing of old JSON.
- `npm test`, `npm run typecheck`, `npm run lint`.
- Playwright screenshots against the user's dev server, with a temporary spec that creates and deletes its own apartment:
  - every door style (open and closed), every window style and every radiator style;
  - a trim close-up;
  - Realistic and Drawing modes.

## Done

- Everything in "Code layout" above is built, with tests for the sweep, every profile, the leaf, window, radiator and skirting layouts, radiator bounds, fit-out parsing and the sample fit-outs.
- Hardware models in the manifest (Sketchfab CC-BY, credited on `/credits`): `handle_lever_modern`, `handle_lever_classic`, `handle_knob`, `handle_pull`, `radiator_valve_trv`. The levers and the valve are modelled in metres (scale 100); the knob and pull use their own units. Placement data is in `three/hardware.tsx`.
- Radiators now render inside their wall's fold-away group, so they hide with the wall in the cut-away view.
- Checked with screenshots in the running app (Realistic and Drawing modes):
  - the three sample fit-outs (Modern, Classic, Scandinavian);
  - every door style and design, with handles, hinges, architraves, barn rail and pocket finger pull;
  - every window style, with glazing bars and a top light;
  - every radiator style, with the valve;
  - skirting in all three profiles, broken at doors and floor-level glazing.

## Still built in code, and why

- Window handles: no usable CC0/CC-BY model was found.
- Hinges, barn rail, pocket-door finger pulls: small, simple parts.
- Door and window frames, leaves, sashes, radiators and trim: parametric by decision (see "Why parametric").

## Not done in B1

- Door open/close animations were not re-checked in the walkthrough. The code (`SwingLeaf`, `SlidingLeaf`, `BifoldLeaf`) is unchanged apart from taking the new leaves.
- A radiator under a window keeps its place when the window becomes floor-to-ceiling. The validator does not flag this overlap yet.
