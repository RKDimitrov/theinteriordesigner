# Furniture breadth and choice (phase D1)

Status: built and checked in the running app (every model cycled through a living room, a bedroom and a hall), 2026-09-29. No migration: the model choice is stored in the design JSON.

## Content

The manifest gained 74 furniture models, about 83 in all:

- **Poly Haven (CC0), 31 models:** sofas, armchairs, nightstands, cabinets, tables, chairs, shelves, a console, coffee tables, a bench and a mirror.
- **Sketchfab (CC-BY 4.0, one CC0), 38 models:** one or more per category, found by a search for CC0 and CC-BY models with 500 to 60 000 faces. The candidates were reviewed on contact sheets.
- **Khronos glTF samples by Wayfair, 3 models:**
  - Glam Velvet Sofa and Chair Damask Purplegold, both CC-BY 4.0.
  - Sheen Chair, CC0.

Every model was rendered from the front, the side and the top to check which way it faces:

- Six models needed a turn to face +z.
- Four were dropped:
  - sofa_03 duplicates the Khronos leather sofa.
  - The terminal sofa has stray geometry that breaks its bounds.
  - The Poly Haven dining table has a tablecloth over it.
  - The round table stands on a cabinet.
- One was over the 1.5 MB budget even with 512 px textures: the metal-frame bookcase.
- The two standing coat trees were dropped after the in-app check. The catalogue's coat rack is a wall-mounted hook rail (60 × 8 × 20 cm), so a coat tree stretched to that size lay flat.

Each model carries tags for its categories (`furniture.sofa`) and one or two styles (`style.japandi`), using the profile's style keys.

## Data

- **`FurnitureItem.modelId`:** an optional asset id, or `"built"` for the version built in code. When it is unset, the planner chooses. The field is backward compatible, so no migration is needed.
- **`PlannerData.styles`:** the profile's style scores, or null when there is no profile.

## Choosing a model (`src/domain/assets/choice.ts`, unit tested)

The default model has the lowest cost:

> cost = distortion − 0.3 × styleFit

- **distortion:** the spread of the three log scale factors needed to fill the piece's exact size. A uniformly scaled copy has none.
- **styleFit:** the profile's best score among the model's styles.

A style match therefore wins between models of similar proportions, but not against a badly stretched model. The rule is deterministic, so a set of dining chairs always matches.

If even the best model would need more than about a 2.7× stretch between two axes (a distortion above 1), the default falls back to the version built in code, where the category has one. The user can still pick that model by hand.

`pieceModel` in `three/assets.ts` applies the user's choice first:

- a chosen model is used if it belongs to the piece's category;
- `"built"` is used if the category has a version built in code;
- otherwise the default applies.

`PIECE_MODELS` is derived from the catalogue tags. `MODEL_TUNING` holds what the catalogue cannot know: turns, and which materials are upholstery.

## Colour

Upholstery materials are tinted to the piece's `colorHex`. They are named per model in `MODEL_TUNING`: pillows, duvets, the velvet sofa's fabric, and the office chair's cloth. The tint divides the target colour by the texture's mean colour, which is read once from an 8 × 8 copy of the texture. The result is capped, so a dark fabric can turn light without glowing. Most models use one texture atlas for everything, so they keep their own colours. For an exact colour, the user can pick the "Simple" version built in code.

## Planner

When a piece is selected, the inspector shows:

- a colour input (`sel-colour`);
- a model picker (`piece-models`) with thumbnails. It offers "Automatic" (which shows what it would choose), every model of the category, and "Simple" where a built version exists.
- a dev-only "Vary models" button. It moves every piece in the room on to its next model.

## Still built in code, and why

- **Rugs, coat racks and "other":** no models. A rug is a textured slab at the exact size, which models would not improve. None of the coat rack candidates reviewed was a wall-mounted hook rail.
- **Every other category** now has at least one real model. The built versions stay as the "Simple" choice.
