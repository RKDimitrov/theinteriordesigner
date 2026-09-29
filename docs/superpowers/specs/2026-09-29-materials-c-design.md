# Surface material library (phase C)

Status: built and checked in the running app, 2026-09-29. The migration `20260929000000_room_finishes` is applied.

## Decisions (user)

- Finishes move from the browser's localStorage to the database: a new `Room.finishes` JSONB column.
- A broad first library of about 40 materials.

## Model

- `src/domain/materials/library.ts` defines `MATERIALS`, the list the 3D materials and the picker swatches both read, so the two can't drift apart. Each material has:
  - an id;
  - the surfaces it can go on (wall, floor, ceiling);
  - a group (paint, plaster, concrete, brick, wood, panelling, wallpaper, tile, stone, terrazzo, carpet, beams);
  - a texture id from the asset catalogue;
  - an optional tint and roughness.

  Paint is a colour over a fine plaster texture with a quarter-strength normal map.
- The ids the planner stored before stay valid. Floors: `oak`, `ash`, `terracotta`, `microcement`. Walls: `limewash`, `warmwhite`, `clay`, `sage`.
- `RoomFinishes` holds `floor`, `walls`, `ceiling` and `wallOverrides` (keyed by wall index, for accent walls). `resolveFinishes` falls back to the defaults for unknown or misplaced ids. `fromLegacy` reads the old browser format.
- The library has 42 materials:

  | Surface | Count | What |
  | --- | --- | --- |
  | Walls | 23 | 12 paints; limewash, clay and smooth plaster; fair-faced concrete; red and old brick; wood slats; textured wallpaper; subway, square and marble tiles |
  | Floors | 18 | oak, ash, herringbone, diagonal parquet, wide oak, dark planks, pale pine, vinyl plank; terracotta, large grey, chequer and marble tiles; marble, terrazzo, polished concrete, microcement; two carpets |
  | Ceilings | 13 | paints, plaster, concrete, wood slats, ceiling white, exposed beams |

  23 new CC0 textures come from Poly Haven and ambientCG.

## Storage

- Migration `20260929000000_room_finishes`: `ALTER TABLE "Room" ADD COLUMN "finishes" JSONB NOT NULL DEFAULT '{}'`.
- `setRoomFinishes` in the repository.
- `saveRoomFinishesAction({ apartmentId, rooms: [{ roomId, finishes }] })`. When several rooms are in view, each keeps its own accent walls.
- On the first planner load, finishes stored in the browser are moved to rooms that have none yet, then no longer written locally.

## Planner

- The Finishes tab has floor, walls and ceiling pickers, each with group chips, name search, and thumbnails. A thumbnail is the texture preview, tinted like the 3D material.
- With one room in view, "All walls / Wall 1 … n" chips pick an accent wall, and "Same as the other walls" clears it.
- Material and group names are in en, de and bg. A test checks every id has a name in each language.

## 3D

- **Walls:** each wall is one merged mesh with UVs in cm in the wall's own frame. Brick and tile patterns run on across the pieces above and below windows.
- **Floor:** the chosen material, tinted.
- **Ceiling:** drawn during the walkthrough. From above it would hide the room. "Exposed beams" adds oak beams every 70 cm across the shorter span.
- **Drawing mode:** a flat colour (the tint, or the texture's mean colour).

## Checked

- The E2E test `tests/e2e/finishes.spec.ts` picks a herringbone floor and a red-brick accent wall, reloads, and finds both saved.
- Screenshots of four material combinations and of the beamed ceiling in the walkthrough.

## Limits

- No chevron parquet exists in the free sources, so diagonal parquet stands in.
- The free wallpapers are plain relief, so there is one tintable textured wallpaper and no patterned one.
- `polished_concrete` (Poly Haven `concrete_floor_02`) is quite weathered. A cleaner concrete can be added later.
