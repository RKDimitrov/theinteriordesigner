# Kitchen, bathroom, lights, switches and window treatments (phase B2)

Status: built and checked in the running app (screenshots of the sample kitchen, bathroom and living room; E2E test for the fixture tool), 2026-09-29. Follows B1 (doors, windows, radiators, trim).

## Decisions (user)

- **Kitchen and bathroom fixtures are fixed elements that the user places.** The plumbing already exists in a real flat, so the AI designer designs around fixtures and never moves them. The validator keeps each fixture's activity space free.
- **Kitchens use real models**, stretched to size. To keep distortion low, a run is tiled from real units in standard module widths (80 cm sink unit, 60 cm cooker, base units near 60 cm). Each unit stretches only a little.
- **Window treatments are a setting on each window, and ceiling lights are fixed elements on the ceiling.** All of it lives in the existing JSON columns (`Room.openings`, `Room.fixedElements`), so there is **no migration**.

## Data model

- `FixedKind` gains `fridge`, `wc`, `basin`, `shower`, `bathtub`, `pendant` and `chandelier`, alongside the existing `chimney`, `built_in`, `column`, `kitchen_run` and `other`.
- `FixedElement` gains three optional fields:
  - `facing`: the plan angle of its front;
  - `kitchen`: sink, hob, oven and wall-unit toggles;
  - `model`: the chosen asset id.
- New opening kind `switch` (a light switch), with `height` (default 105) and `gangs` (1 to 3 rockers).
- `Window.treatment`: `{ kind: curtains | roller | venetian, closed }`, optional.

## Domain (`src/domain/room/fixtures.ts`, unit tested)

- **`FIXTURE_SPEC`:** default size, clearance in front and mount per kind. Clearances follow DIN 18022 and kitchen practice:

  | Fixture | Clearance in front |
  | --- | --- |
  | WC, basin | 70 cm |
  | Shower, bathtub | 75 cm |
  | Kitchen run, fridge | 100 cm |

- **`placeFixture`:** puts the fixture's back against the clicked wall, facing into the room. It keeps the fixture on the wall and shrinks it to fit short walls. It refuses slanted walls, because fixed elements are axis-aligned.
- **`placeCeilingFixture`:** places a light centred on the click.
- **`frontZone`:** the clearance polygon in front of a fixture.
- **`fixtureWall`:** the wall a fixture stands against.
- **`resizeFixture` and `fixtureSize`:** change width and depth while the back stays on the wall.
- **`kitchenSlots`:** the units along a run.
- **Zones:** ceiling lights never block the floor. Floor fixtures add a `fixture_front` keep-clear zone. The new validator rule `FIXTURE_CLEARANCE` (error, auto-fixable) and the solver's wall slots both respect it.
- **AI room facts:** fixtures carry `facingDeg`, and lights carry `mountedOn: "ceiling"`. Switches appear with the other openings.

## Planner

- **New tools:**
  - **Switch** (`S`): works like the socket tool.
  - **Fixture** (`F`): a picker in the inspector chooses what to place. Click a wall for a floor fixture, or click anywhere in the room for a light.
- **Plan symbols:**
  - kitchen run: module lines, sink bowl and hob rings;
  - WC: tank and bowl;
  - basin: bowl;
  - shower: tray with crossed diagonals;
  - bathtub: inner tub;
  - lights: a dashed circle with a cross;
  - switch: the electrical symbol.
- **Inspector for a fixed element:**
  - width, depth and height;
  - kitchen toggles (sink, cooker, wall units);
  - model picker, for kinds that have several models;
  - remove.
- **Other inspector changes:** switches get a rocker count. Windows get a treatment picker and an open/closed toggle.
- **Sample data:** the "Fill sample data" presets now include a kitchen (run, fridge, pendant, switch, roller blind) and a bathroom (WC, basin, bathtub, light, switch, venetian blind). The living room gets curtains, a two-gang switch and a pendant.

## 3D

- **Fixtures:** real models via `fitToBox`. A kitchen run is tiled from base, sink and cooker units, with wall units above and a chimney hood over the cooker. Lights hang from the ceiling, scaled evenly (never stretched).
- **Folding:** fixtures against a wall fold away with that wall in the cut-away view.
- **Curtains and venetian blinds:** real models stretched to the window. Open curtains stand beside the glass; open blinds are drawn up to a stack.
- **Switches:** a real plate per rocker.
- **Drawing mode:** plain blocks and panels.

## Assets added (pipeline, credited on `/credits`)

- **Pack extraction:** the pipeline gained a `node` option that keeps only the named nodes of a pack. Packs are downloaded once per run.
- **Kitchen:** from Mora's "Kitchen Modular" pack (CC-BY): base unit, sink unit, cooker, wall unit and fridge. Also a grey fridge (Glowbox 3D), a built-in oven (3DDomino), a chimney hood (allenbranch) and a faucet (Renend Studio).
- **Bathroom:** a WC (HippoStance), two vanities (blendffnike, Ren Viro Store), two bathtubs (3ddominator, Igrium) and a shower enclosure (binhnham).
- **Window treatments:** curtains (CommunicationNode, milaink) and a venetian blind (AK STUDIO).
- **Switch:** Avot.
- **Lights (Poly Haven, CC0):** modern pendant, industrial pendant, two chandeliers.
- **Rejected after render review:** a roller blind (tiny panels), an "induction hob" that was a whole countertop, a sink rotated 45°, a WC model that was a whole restroom, and a fridge with an unclear front.

## Still built in code, and why

- **Roller blinds:** no usable model.
- **Stand-in blocks:** fixtures in Drawing mode and while models load.
- **Structure:** chimneys, columns and built-ins stay plain blocks.

## Fixed during the checks

- Gaps showed between kitchen units because each unit's own top overhangs its carcass. The units now overlap slightly under one continuous worktop (a flat slab built in code), as in a real kitchen.
- One curtain model is rigged with a skeleton. Models are now cloned with `SkeletonUtils`, because a plain clone draws nothing.
- Clicking a placed fixture selected it, and the pointer-up then cleared the selection. Presses on fixed elements now register as a "press" gesture.

## Known limits

- Fixtures can only be placed against walls parallel to the plan axes.
- Fixtures can't be dragged. To move one, remove it and place it again, or change its size in the inspector.
- The built-in oven and faucet models are fetched but not used yet. The cooker unit includes its own oven and the sink unit its own tap.
