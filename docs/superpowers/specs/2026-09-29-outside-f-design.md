# The world outside and the building shell (phase F)

Status: built and checked in the running app (overview and walkthrough of a 9th-floor waterfront flat and a 3rd-floor courtyard flat), 2026-09-29. The migration `20260929100000_outside_world` is applied.

## Decisions (user)

- Store `surroundings` on the apartment, with a UI in the apartment form and a sample preset.
- Include a per-wall outlook (street, courtyard, garden, open).
- Real OpenStreetMap buildings are not in this phase. Revisit after lighting (E).

## Data

- `Apartment.surroundings`: `{ kind: city_centre | urban | suburban | rural, waterfront, mountains }`. The default is urban.
- `Room.wallOutlooks`: outlook per wall index. Walls without one take the area's default: street in town, garden in the suburbs, open land in the countryside.
- Migration `20260929100000_outside_world`:
  - `Apartment.surroundings JSONB NOT NULL DEFAULT '{}'`
  - `Room.wallOutlooks JSONB NOT NULL DEFAULT '{}'`

## Domain (`src/domain/context/outside.ts`, unit tested)

- **`heightBand`:** ground (floor 0 and basements), low (1–3), mid (4–8), high (9+).
- **`groundBelowCm`:** 3 m per storey.
- **`backplateFor`:** picks the panorama by area and height band.
  - Mid floors use the high panorama, because from there the view is over the rooftops.
  - Water and mountains win over the kind of area.
  - Courtyard and garden outlooks get their own panoramas below the high floors.
- **`dominantOutlook`:** the outlook most windows in view share.
- **`OPPOSITE_DISTANCE_CM`:** 18 m to the facade across a street, 14 m across a courtyard, nothing for gardens and open land.

## Assets

The pipeline gained backplates: an HDRI manifest entry with `backplate: true` produces a 2048×1024 JPG from Poly Haven's tonemapped panorama (`/hdris/<id>.jpg`). There are 17 panoramas, 6 MB in total:

| Area | Ground | Low | High |
| --- | --- | --- | --- |
| City centre | Potsdamer Platz | Hamburg canal | hotel rooftop balcony |
| Urban | urban street 01 | urban street 03 | Homecoming Center rooftop |
| Suburban | suburban garden | Stuttgart suburbs | Stuttgart hillside |
| Rural | farm field | Belfast open field | rolling hills |
| Waterfront | Binnenalster | Binnenalster | Binnenalster |
| Mountains | Alps field | Alps field | Fouriesburg mountain lookout |

Courtyard: urban courtyard. Garden: residential garden. All are CC0.

## 3D (`three/outside3d.tsx`, realistic mode only)

- **Distant view:** the panorama as a `GroundedSkybox`. Its ground lies at the flat's depth below the floor. It is not tonemapped, and it is dimmed after dusk until E adds night skies.
- **Shadows:** a shadow catcher on the ground receives the building's shadows.
- **The flat's own building:** its storeys below the flat, as a rendered block with instanced window grids on every face.
- **Across the street or courtyard:** for each side of the apartment that has windows, a building at the distance for its outlook. It is 7 storeys in the city centre, 5 in urban areas, and 3 elsewhere; courtyard blocks match the flat's own height.
- **Balcony doors:** a concrete slab 140 cm deep with a glass balustrade and a steel handrail.
- **Drawing mode:** keeps the old plain ground disc.

## Planner

- The apartment form has a surroundings select and "By the water" and "Mountains in view" checkboxes.
- New sample preset: "HafenCity loft" (Hamburg, 9th floor, city centre, waterfront). Sofia now has mountains.
- The Scene tab has an "Outside" block: surroundings and floor, and, with one room in view, an outlook picker per windowed wall, saved to the room.

## Still built in code, and why

The near context (storeys below, opposite blocks, window grids, balconies) is simple geometry built in code. That keeps the outside cheap, as the brief asks: the photographed panorama carries the detail. Real neighbouring buildings (OpenStreetMap) are deferred.
