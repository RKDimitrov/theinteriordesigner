# RaumPlan

RaumPlan is a web app where you describe your apartment and get an AI-generated interior design that has been checked for dimensional validity. You can then view the design in 2D or 3D and keep refining it.

**Core principle:** the language model decides taste and intent, and deterministic TypeScript owns geometry. Every design passes a validator before anyone sees it.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Scaffold: Next.js 16, Supabase, Prisma 7, Zod 4, next-intl, Vitest, Playwright | done |
| 1 | Apartment input wizard: rooms by dimensions or click-to-draw, openings, compass | done |
| 2 | Style profile: household, budgets, style quiz, colours, must-keep furniture | done |
| 3 | Context builder: location, climate, daylight per room, renter rules, trends | done |
| 4 | Design generation with Claude Opus 5 | done, awaiting your E2E run |
| 5 | Validator and repair loop | done, awaiting your E2E run |

## Stack

- **Next.js 16** (App Router, Turbopack) with TypeScript in strict mode (`noUncheckedIndexedAccess`), Tailwind v4 and shadcn/ui (Base UI flavour).
  - In Next 16, `middleware.ts` is called `src/proxy.ts`, and `params` and `searchParams` are Promises.
- **Supabase** for Postgres and Auth (magic link or email + password), using `@supabase/ssr`.
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter.
  - The client is generated into `src/generated/prisma`, which is gitignored and rebuilt on `npm install`.
  - `prisma.config.ts` holds the migration datasource.
- **Zod 4** at every boundary: form input, server actions, and JSON columns read back from the database.
- **Claude**: `claude-sonnet-5` for trend research and design generation, escalating to `claude-opus-5` for a last repair. All model ids are env-configurable (see `.env.example`).
- **next-intl**: English only for now. All strings live in `src/messages/en.json`, and the URLs have no locale prefix.

## Setup

1. **Create a Supabase project.**
   - Under **Authentication → Providers**, turn on Email.
   - Under **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` as a redirect URL.
   - Under **Authentication → Users**, create a user with a password. Playwright signs in as this user.
2. **Configure the environment.** Run `cp .env.example .env` and fill in:
   - both database URLs (pooled 6543 and direct 5432)
   - the Supabase URL and publishable key
   - the E2E user
3. **Install and migrate:**

   ```bash
   npm install              # also runs prisma generate
   npm run db:deploy        # applies prisma/migrations to Supabase
   ```

4. **Run the app** (in your own terminal):

   ```bash
   npm run dev              # http://localhost:3000
   ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:e2e` | Playwright. Needs `npm run dev` already running (or `E2E_BASE_URL`). Runs desktop Chrome and a Pixel 7 profile. |
| `npm run db:migrate` | `prisma migrate dev`, used to create new migrations during development |
| `npm run db:deploy` | `prisma migrate deploy` |

## Project layout

```
prisma/                 schema + SQL migrations (RLS enabled, no policies)
src/
  app/[locale]/         pages (landing, login, (app)/apartments/...)
  app/auth/callback/    magic-link code exchange
  components/
    plan-editor/        SVG room editor: draw, resize, place/drag openings, compass
    plan-view/          read-only plan shapes, reused by the editor
    wizard/             form fields, apartment form
    profile/            style profile sections (household, budget, quiz, colours, must-keep)
    dev/                dev-only "Fill sample data" button
  domain/               pure TypeScript, no framework imports, unit-tested
    schemas/            Zod: apartment, room/openings, profile, design, validation-issue
    geometry/           vectors, polygons, walls/orientation, openings/door swing
    room/               room checks (RoomInput), factory, opening helpers
    profile/            quiz pairs + scoring, profile status, colour swatches
    context/            climate summary, daylight model, renter rules, context assembly
    design/             room facts and brief sent to the model
    validator/          one file per rule + clearances.ts (all the numbers)
    geometry/obb,zones,grid  footprints + SAT, keep-clear areas, walkway raster
    llm/, prompts/      cost estimate, prompt template rendering
  prompts/              versioned LLM prompt files (*.v1.md) + registry
  server/               server-only: Prisma client, Supabase, auth, repos, actions,
                        context (Open-Meteo, cache, trends), design (generate, repair loop),
                        llm (client, usage log), rate limit
  i18n/, messages/      next-intl routing and messages
tests/e2e/              Playwright
```

## Conventions

- **Units:** lengths are integer **centimetres**, angles are in degrees, and money is in whole EUR.
- **Coordinates:** room-local, with the origin at the top-left, **x to the right and y downwards** (the same as SVG). Polygons run clockwise on screen.
- **Walls:** wall `i` is the polygon edge from vertex `i` to vertex `i+1`.
  - Rectangular rooms have wall 0 at the top, 1 on the right, 2 at the bottom and 3 on the left.
  - Openings are stored as `{ wallIndex, offset, width }`, so they survive a room resize.
- **North:** `northAngleDeg` is the clockwise angle of north measured from the top of the plan.
  - Each wall's N/E/S/W label is derived from its outward normal.
  - A per-wall override is possible (`wallOrientationOverrides`).
- **Doors:**
  - `hinge` is `start` or `end`, measured along the wall direction.
  - `swing` is `in` (into this room), `out` or `sliding`.
  - `doorSwing()` returns the quarter-disc polygon that the validator will keep clear.
- **Data access:** every read and write goes through `src/server/repo/*`, which always filters by the Supabase user id.
  - Prisma connects as the table owner and bypasses RLS.
  - RLS is enabled with no policies, so Supabase's public Data API cannot read these tables.

## Phase 1: what was built

- **Apartment form:**
  - fields: name, address, city, country, floor, rent or own, total m² and year built
  - a draggable compass (or a typed angle) for north
- **Room editor** (`/apartments/:id/rooms/new` and `/rooms/:roomId`):
  - Enter the width and length, or drag on the canvas to draw the room. Drawing snaps to a 5 cm grid.
  - Resize handles on the right edge, the bottom edge and the corner.
  - Openings (door, window, radiator, socket): pick a tool and click a wall, or use the "Add …" buttons. Then fine-tune them in the panel, or drag them along their wall.
  - The editor draws the door swing arcs and labels each wall with its dimension and orientation.
  - Fixed elements (chimney, built-in and so on) are entered as rectangles.
  - Zoom with the buttons or the mouse wheel. Pan by dragging the background.
  - Pointer events are used throughout, so the editor works on touch screens.
- **Live validation:** the client runs the same `RoomInput` Zod schema as the server. It catches:
  - openings that fall off their wall or overlap (a door with a window, a radiator in a doorway)
  - windows that reach above the ceiling
  - fixed elements outside the room
  - self-intersecting outlines
  - rooms smaller than 1 m²
- **Overview:** a room list with a mini plan of each room. You can delete a room or the whole apartment.

**Not in phase 1:**

- editing non-rectangular rooms (the data model already stores polygons)
- dragging fixed elements on the canvas
- geocoding (phase 3)

## Phase 2: what was built

- **Style profile page** (`/apartments/:id/profile`), one profile per apartment, stored in the `UserProfile` table (migration `20260920000000_phase2_style_profile`, RLS enabled). Sections:
  - **Household:** adults, kids with ages, pets (type and count), work-from-home days per week.
  - **Budget per room:** a slider (0–20 000 €) plus a number input for each room, with the total and a list of rooms that still have no budget.
  - **Style quiz:** 10 fixed pairs covering 8 styles (Scandinavian, Japandi, Mid-century, Industrial, Modern classic, Boho, Minimal, Mediterranean). Pick, skip, go back or redo. When complete, the top 3 styles are shown as bars.
  - **Colours:** liked and disliked colours from 16 curated swatches or a custom colour. A colour can only be in one list; picking it in the other list moves it.
  - **Furniture you keep:** name, category, width/depth/height, colour and target room.
- **Scores are computed on the server.** The client sends only quiz answers; `scoreQuiz()` (`src/domain/profile/quiz.ts`) turns them into a normalised score vector (sum 1) on save.
- **Server clean-up:** budgets and must-keep assignments that point at rooms outside the apartment are dropped (`pruneToRooms`).
- **Overview:** the step badges are now links. "2. Style profile" shows **Done** once the quiz is complete (all 10 pairs answered, at least 5 real choices) and every room has a budget above 0.
- **Placeholder quiz art:** simple SVG vignettes in `public/quiz/<style>.svg`. Replace them with licensed photos of the same name.

## Phase 3: what was built

- **Context page** (`/apartments/:id/context`) showing the `DesignContext` that phase 4 will send to the design model:
  - **Location:** the city is geocoded with Open-Meteo (free, no key) and the coordinates are stored on the apartment. Street addresses are not geocoded, only the city. Changing the city or country clears the stored coordinates.
  - **Climate:** 10 years of daily ERA5 data (Open-Meteo archive) summarised into heating degree days, humidity, winter daylight and sunshine, then classified (heating low/medium/high, air dry/moderate/humid, winter light low/medium/high) with design hints.
  - **Daylight per room:** window-to-floor ratio × orientation factor (sun path from `suncalc`, 21st of each month, hourly) × floor-level factor → low/medium/high, main window direction, cool/neutral/warm light and a palette hint.
  - **Renter rules:** a German ruleset for rented flats in DE (reversible changes, no drilling into tiles, walls back to neutral at move-out, …) and a default ruleset elsewhere. Owners have none.
  - **Style:** top 3 styles from the profile.
  - **Trends:** only when you click **Research trends**. Claude Sonnet 5 searches the web (up to 5 searches), then returns trends with a longevity rating (lasting / 2–5 years / short-lived) and regional cues through a strict tool. Sources are taken from the search results, not from the model's text. Results are cached for 90 days per country + main style. Limited to 5 research runs per user per hour.
- **Caching:** geocoding and climate are cached for 365 days in `ContextCache`; **Re-check location** clears them.
- **LLM logging:** every Claude call writes an `LlmCall` row (tokens, cache tokens, web searches, estimated EUR cost, duration, error). Prompts live in `src/prompts/*.v1.md` and each log row records the prompt id and version.
- **Overview:** "3. Context" is **Done** once climate and trends are cached.
- Migration `20260921000000_phase3_context` adds `ContextCache`, `LlmCall` and `RateLimitHit` (RLS enabled).

Cost estimates use list prices (Sonnet 5 $2/$10, Opus 5 $5/$25 per million tokens, web search assumed $10 per 1000) and a fixed USD→EUR rate of 0.92. They are for tracking, not billing.

## Phases 4 and 5: what was built

**Generation** (`/apartments/:id/design/:roomId`)

- One Claude call per room with a forced `submit_design` tool whose schema is generated from the Zod `DesignContent` schema, streaming, prompt caching, and the server-side refusal fallback enabled.
- **Model and cost:** `DESIGN_MODEL` (default `claude-sonnet-5`) designs and repairs; if the design is still invalid going into the last repair, that attempt runs on `DESIGN_ESCALATE_MODEL` (default `claude-opus-5`). `DESIGN_EFFORT` (default `low`) sets thinking depth. A typical run costs about €0.15; set `DESIGN_MODEL="claude-opus-5"` for the best layouts at roughly 2.5× the cost.
- Caching keeps repairs cheap: the rules block, the tool schema and the conversation so far are all marked cacheable, so a repair turn re-reads them at about a tenth of the input price.
- The prompt gets hard facts, not prose: room polygon, every wall with the rotation that puts an item's back against it, opening segments, and precomputed keep-clear areas (door swings, the 80 cm path inside each door, window and radiator zones, fixed elements). The brief adds household, budget, top styles, liked and disliked colours, must-keep pieces, daylight, climate hints, renter rules and the researched trends split by longevity.
- `POST /api/design/generate` streams progress over SSE: context → designing → writing (character count) → checking → repairing *n* of 3 → done. It is rate limited to 5 designs per hour and 10 per day per user. The design is saved even if you close the tab.
- Prompts live in `src/prompts/design-generate.v1.md` and `design-repair.v1.md`; every call is logged in `LlmCall` with tokens, cost and the resulting `designId`.

**Validator** (`src/domain/validator`, pure TypeScript, no model involved)

- Geometry: oriented footprints with SAT overlap (any rotation), room containment, keep-clear zones, and a 5 cm occupancy grid with a distance transform plus flood fill for walkways.
- Rules: references and duplicate ids, room bounds, item overlap (chairs may tuck under tables), door swing and door path, windows (tall items in front, wall items across the opening), radiators (over 30 % coverage is an error), fixed elements, wall items (back on a wall, not across a door), 80 cm walkways from the door to everything that needs access, 60 cm beside beds and at the foot, 75 cm behind dining chairs, budget, trend risk on anchors and on floors and walls, renter rules, must-keep pieces, and the 60/30/10 palette split.
- Every problem carries a concrete hint such as "move sofa at least 12 cm toward −x (left)". All numbers live in `clearances.ts`.

**Repair loop**

- Generate → validate → send the problems back as an error `tool_result` → up to 3 repairs. The best attempt (fewest errors, then warnings) is kept. A design that is still invalid is saved and shown with a red banner; it is never presented as valid.

**Design page**

- Plan with furniture footprints in their real colours, front-edge marks, zones, openings and wall dimensions. Tap an item in the plan or the list to highlight it; items with errors are outlined red.
- Problem list with hints, palette with shares and paint references, furniture list (size, price range, tier, trend risk, renter flags, search phrase, reasoning), lighting by layer, surfaces, textiles, longevity note, cost against the room budget, and what the generation cost and took.
- Version history per room (`?v=`), room tabs, and a dev-only **"Insert sample design"** button that saves a hand-made design (first click valid, second click deliberately broken) through the real validator, so the whole page can be tested without spending API credit.

## Sample data for manual testing

In development builds, every form has a dashed **"Fill sample data"** button. Clicking it repeatedly cycles through the presets defined in `src/lib/dev/samples.ts`: 2 apartments, 4 rooms (living room, bedroom, office, kitchen) and 3 style profiles (family with a dog, WFH couple with cats, student on a small budget). Profile presets adapt to the apartment's actual rooms. A test in `samples.test.ts` checks every preset against the real Zod schemas. The button does not appear in production builds.

## Verifying phases 1–5

1. Run `npm test`. There are 154 unit tests (geometry, room checks, profile, quiz, climate, daylight, renter rules, cost, prompt rendering, Open-Meteo clients, trend research, footprints and SAT, the walkway grid, every validator rule, the sample design, room facts, the design brief and the repair loop with mocked Claude responses), and all pass. No test calls a real API.
2. Run `npm run typecheck && npm run lint`. Both are clean.
3. `npm run build` passes (checked with placeholder env vars).
4. With `npm run dev` running, run `npm run test:e2e`. It runs 8 scenarios on desktop and mobile:
   - create an apartment, add a room by dimensions with a door and a window, reload, and check the data persisted
   - check that overlapping openings block saving
   - draw a room by dragging on the canvas (desktop only)
   - fill a sample profile, save, reload, and check the overview shows "Done"
   - answer the quiz by tapping cards, then redo it
   - move a colour from liked to disliked
   - open the context page: Berlin location, climate, daylight row, German renter rules (uses the real Open-Meteo API; trend research is not clicked because it costs money)
   - insert the sample design, check it validates, highlight an item, then insert the broken one and check it is rejected
   - generate a real design with Claude (only with `E2E_RUN_LLM=1`, which spends API credit)

   Run `npm run db:deploy` first so the new tables exist.
