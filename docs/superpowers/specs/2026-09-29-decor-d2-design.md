# Decor props (phase D2)

Status: built and checked in the running app, 2026-09-29. No migration: the settings live on the host piece in the design JSON.

## Decisions (user)

- Rooms dress themselves; the user can remove single props or re-roll them.
- The validator ignores props. Large floor props such as big plants stay furniture ("plant"), so they are still checked.

## Content

The manifest gained 23 Poly Haven props (CC0), each with 512 px textures and tagged `decor.<kind>`:

- vases (7);
- a set of books;
- a bowl and a plate;
- a succulent;
- two standing photo frames;
- an alarm clock and a mantel clock;
- three figurines;
- a tea set;
- a basket;
- an arm desk lamp;
- a candlestick;
- throw pillows.

The photo frames need a turn of 270° and the desk lamp 180° to face the room (`DECOR_TURN` in `three/decor3d.tsx`).

## Data

`FurnitureItem.decor` is optional: `{ seed, hidden: string[], off? }`.

- **Unset:** the piece shows its default dressing (seed 0).
- **`seed`:** changing it re-rolls the props.
- **`hidden`:** the slots of props the user removed.
- **`off`:** no props on this piece at all.

## Dressing (`src/domain/design/decor.ts`, unit tested)

`dressPiece` is pure and seeded with the piece id and the seed, so a piece keeps its props until it is re-rolled.

`DECOR_HOSTS` lists, for each category, which kinds of props suit it and how many at most:

- coffee tables: books, bowls, vases and a tea set;
- desks: a lamp and books at the two ends, leaving the middle free to work at;
- dining tables: one centrepiece in the middle;
- sideboards, TV units, dressers and shelves: props against the wall side of the top;
- sofas: cushions along the back of the seat.

Props are chosen at random from the suitable kinds, then kept only while they fit side by side along the top. Each prop is drawn inside a nominal box (`DECOR_BOX`); a prop may shrink to fit a narrow top, but not below 70 %. Round props can turn freely; the others face the room within ±12°, and their turned footprint is what must fit.

The tests check every host at every catalogue size and 20 seeds:

- props stay on their top;
- props never overlap;
- props are only of the kinds that suit the piece.

## 3D

`PieceDecor3D` draws the props in the piece's frame, on top of the model or of the built version. Each model is scaled uniformly (never stretched) into its box. Each prop loads on its own, so a missing file drops only that prop. The Scene tab has a "Decor on furniture" switch.

## Planner

For a piece that takes props, the inspector shows:

- a chip per prop, which removes it or brings it back;
- "Re-roll";
- "No decor" (or "Add decor" once it is off);
- a dev-only "Re-roll room" button that re-rolls every piece in the room.
