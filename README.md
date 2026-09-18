# RaumPlan

RaumPlan is a web app where you describe your apartment and get an AI-generated interior design that has been checked for dimensional validity. You can then view the design in 2D or 3D and keep refining it.

**Core principle:** the language model decides taste and intent, and deterministic TypeScript owns geometry. Every design passes a validator before anyone sees it.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Scaffold: Next.js 16, Supabase, Prisma 7, Zod 4, next-intl, Vitest, Playwright | done |
| 1 | Apartment input wizard: rooms by dimensions or click-to-draw, openings, compass | done, awaiting your E2E run |
| 2 | Style profile | – |
| 3 | Context builder (climate, daylight, renter rules, trends) | – |
| 4 | Design generation (Claude) | – |
| 5 | Validator and repair loop | – |

## Stack

- **Next.js 16** (App Router, Turbopack) with TypeScript in strict mode (`noUncheckedIndexedAccess`), Tailwind v4 and shadcn/ui (Base UI flavour).
  - In Next 16, `middleware.ts` is called `src/proxy.ts`, and `params` and `searchParams` are Promises.
- **Supabase** for Postgres and Auth (magic link or email + password), using `@supabase/ssr`.
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter.
  - The client is generated into `src/generated/prisma`, which is gitignored and rebuilt on `npm install`.
  - `prisma.config.ts` holds the migration datasource.
- **Zod 4** at every boundary: form input, server actions, and JSON columns read back from the database.
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
  domain/               pure TypeScript, no framework imports, unit-tested
    schemas/            Zod: apartment, room/openings, design, validation-issue
    geometry/           vectors, polygons, walls/orientation, openings/door swing
    room/               room checks (RoomInput), factory, opening helpers
  server/               server-only: Prisma client, Supabase, auth, repos, actions
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

## Verifying phase 1

1. Run `npm test`. There are 42 unit tests (geometry, room checks, opening helpers), and all pass.
2. Run `npm run typecheck && npm run lint`. Both are clean.
3. `npm run build` passes (checked with placeholder env vars).
4. With `npm run dev` running, run `npm run test:e2e`. It runs 3 scenarios on desktop and mobile:
   - create an apartment, add a room by dimensions with a door and a window, reload, and check the data persisted
   - check that overlapping openings block saving
   - draw a room by dragging on the canvas (desktop only)
