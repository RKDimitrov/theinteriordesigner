# Door, window and radiator styles: design and progress

## Decisions (agreed)

- Scope: every door, window and radiator type below, on today's flat ceilings. Roof windows / skylights need sloped ceilings and are a separate, later project.
- Finishes: a curated preset list per kind, each backed by a real material.
- Defaults: set once per apartment (the new `Apartment.fitOut` column); any single opening can override the finish.
- Model: approach A. Each existing opening kind gets an optional `style` and `finish`; no new opening kinds.

| Kind | Styles | Finishes |
|---|---|---|
| Door | hinged, double, sliding, pocket, glazed, balcony, barn, bifold | white_lacquer, light_oak, walnut, black, glass |
| Window | casement, tilt_turn, sliding, fixed, floor_to_ceiling | frame: white, oak, anthracite, black |
| Radiator | panel, column, towel, vertical, convector | white, anthracite, black, chrome |

Behaviour:

- Double doors have two half-width leaves; a bifold folds to half its width.
- Sliding and barn doors have no swing area. The wall run beside the opening, where the leaf parks, must stay free (new issue code `DOOR_SLIDE_BLOCKED`). Pocket doors park inside the wall.
- Full-height windows and balcony doors let pieces up to 50 cm stand in front of them.
- Floor convectors have no keep-clear zone.
- The AI designer receives `style` in its room facts. It already receives the computed keep-clear zones, so no prompt version bump is needed.

## Done (tests, typecheck and lint pass)

- `src/domain/schemas/room.ts`: the style and finish enums, optional on each opening.
- `src/domain/room/fit-out.ts`:
  - `FitOut` schema and `DEFAULT_FIT_OUT`.
  - `doorStyle`, `windowStyle`, `radiatorStyle`. An old `swing: "sliding"` reads as the sliding style.
  - `slides`, `finishOf`, `STYLE_SHAPE`, and `apply{Door,Window,Radiator}Style`.
- `src/domain/room/openings-edit.ts`: `withFitOutStyle`. New openings drawn in the planner take the apartment's default style.
- `src/domain/geometry/openings.ts`: `doorLeaves`, `doorSwings`, `slideRun`.
- `zones.ts`, the validator door rule, `autofix.ts` and `room-facts.ts` are style-aware.
- Database: the migration `20260927000000_apartment_fit_out` adds `Apartment.fitOut` and has been applied. It runs through the repo (`setApartmentFitOut`), the server action (`saveFitOutAction`) and the planner data, and is kept in `PlannerState.fitOut`.
- `src/components/planner/three/fit-out-look.ts`: finish colours and materials shared by the swatches and 3D.
- UI: `src/components/planner/fit-out-controls.tsx`.
  - Type and finish pickers in the inspector for the selected door, window or radiator. The finish can be left on "Apartment default".
  - "Doors & windows" apartment defaults in the 3D Finishes tab, saved with `saveFitOutAction`.
  - Translations in the `FitOut` namespace (en, de, bg).
- 2D: every leaf from `doorLeaves` (double, bifold zigzag, glazed hollow leaf); sliding, barn and pocket marks with their parking run; window lines per type; radiator variants.
- 3D: `src/components/planner/three/openings3d.tsx`.
  - Door leaves that swing, slide, park inside the wall (pocket) or fold (bifold), with casing and handles.
  - Window frames and sashes by type, plus an inside sill board.
  - Radiator geometry by type.
  - Finish materials from `fit-out-look.ts`.
- Checked in the running app: the pickers, the 2D double door, and the 3D full-height, sliding, column-radiator and walnut double-door combinations.

## Remaining (optional)

1. Check the door open/close animations for each style in the walkthrough. They're written but haven't been checked visually.
2. Add a permanent e2e test that picks a type and a finish.
3. Allow a floor convector in front of a door (`kindsConflict` currently rejects a radiator and a door sharing wall span).
4. Pocket doors: warn about wall items or sockets on the wall section the leaf slides into.
