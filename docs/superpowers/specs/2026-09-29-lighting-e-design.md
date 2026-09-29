# Lighting (phase E)

Status: built and checked in the running app, 2026-09-29. Shots at noon, 20:00 and 22:00, a walkthrough, and a photo-mode download.

## Decisions (user)

Photo mode uses progressive accumulation, with no new dependency. There is no path tracer.

## Daylight

- The suncalc sun is unchanged. `sunVector` now also returns the sun's altitude.
- `skyLight(altitude)` in `src/domain/planner/lighting.ts` sets the brightness and tint of the view outside:

  | Sun | Brightness | Tint |
  | --- | --- | --- |
  | Day | full | none |
  | Low sun | 0.85 | warm |
  | Dusk | 0.5 | pink |
  | After dusk | 0.22 | blue |
  | Night | 0.1 | dark blue |

- The panorama and the neighbouring facades both follow it.
- At night about a third of the neighbours' windows glow warm. Which windows are lit is fixed per window, so they don't flicker.
- The time-of-day slider now runs from 5:00 to 23:00.

## Artificial light

- **When lights are on:** `roomLit` switches each room's lights on by itself after 19:00 and before 7:00. A room switched by hand keeps its state: Scene tab → Lights, or a click on a light switch in the walkthrough. The switch state lives in the planner, not the database. Saving it with viewpoints belongs to phase G.
- **Where the light comes from:** `lampSources` uses pendants and chandeliers (bulbs about four fifths of the way down), floor lamps, or one ceiling light in the middle of a room that has no lamps.
- **Glow:** lit lamps glow. Their glass, globes, bulbs and emissive maps are switched on per lamp instance.
- **Colour temperature:** 2700, 3000 or 4000 K for all lamps. `kelvinToHex` uses Tanner Helland's fit.
- **Light cap:** `RoomLights` gives real-time point lights only to the 8 lamps nearest the camera (`MAX_LIGHTS`). It re-picks every 0.4 s, and only when the set changes, to avoid shader recompiles.

## Exposure and bloom

- Bloom is subtle (threshold 0.92), on lamps and bright windows.
- In the walkthrough, tone mapping switches to adaptive (`REINHARD2_ADAPTIVE`), so the eye adapts between a dim room and a bright window. The overview keeps Neutral.

## Photo mode

`three/photo.tsx` adds a "Photo" button next to "Screenshot".
- The Canvas switches to twice the pixel density.
- Ambient occlusion runs at full resolution and high quality.
- Eight frames are rendered with sub-pixel Halton jitter and averaged.
- The result downloads as a PNG, twice the screen size, in a few seconds.

## Tests

`src/domain/planner/lighting.test.ts` covers `roomLit`, `kelvinToHex`, `lampSources`, `nearestLights` and `skyLight`.
