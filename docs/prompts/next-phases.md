# RaumPlan: prompt for phases 2–5

Paste everything below the line into a new Claude Code session opened in this repo.

---

# Role

You are a senior full-stack engineer continuing work on **RaumPlan**. RaumPlan is a web platform where a user describes their apartment. It returns an AI-generated interior design that has been checked for dimensional validity. The user can view the design in 2D and 3D and iterate on it.

**Core principle:** the LLM decides *taste and intent*, and deterministic code owns *geometry*. Never trust model output for spatial correctness. Every design passes a validator before it is shown.

# Current state (phases 0–1 are done and verified by the user)

Read these before you write any code:

1. `README.md` covers setup, conventions, the project layout, and what phase 1 built.
2. `/home/zayko/.claude/plans/role-you-are-shimmering-sparrow.md` is the approved plan. It contains the folder structure, the **Design JSON schema** (already implemented in `src/domain/schemas/design.ts`), and the phase breakdown. Follow it. If you want to deviate, ask first.
3. `AGENTS.md`: this is **Next.js 16**. Read the relevant guide in `node_modules/next/dist/docs/` before you use an API you are unsure of.
   - `middleware` is now `src/proxy.ts`.
   - `params` and `searchParams` are Promises.
   - `PageProps<"/route">` types come from `next typegen`.

Stack facts that are already decided and wired up:

- **Supabase:** Auth runs through `@supabase/ssr`, with helpers in `src/server/supabase/*` and `src/server/auth.ts`.
- **Database:** Postgres is reached through the Supabase **poolers**. `DATABASE_URL` uses the transaction pooler (6543); `DIRECT_URL` uses the session pooler (5432) and is used for migrations.
- **Prisma 7:** it uses `@prisma/adapter-pg`, and the client is generated into `src/generated/prisma`. The config lives in `prisma.config.ts`.
  - You can't run `migrate dev` without a DB shadow setup, so write each migration by hand: generate it with `prisma migrate diff`, then append `ENABLE ROW LEVEL SECURITY` for every new table.
- **Zod 4** at every boundary. Json columns are parsed with Zod on read in `src/server/repo/*`, and every repo function is scoped by `userId`.
- **Server actions** return `ActionResult<T>` (`src/lib/action-result.ts`).
- **UI:**
  - shadcn/ui is the **Base UI** flavour: there is no `asChild`, so use `buttonVariants` on links.
  - Use the form fields in `src/components/wizard/fields.tsx`.
- **next-intl:** every UI string goes in `src/messages/en.json`, and messages are type-checked.
- `ANTHROPIC_API_KEY` is already in `.env`. It is server-only, so never give it a `NEXT_PUBLIC_` prefix.

# Standing rules

- **Do not start long-running processes** (`npm run dev`, `next dev`, a Playwright webServer). The machine is slow. Give me the commands, and I will run them and report back.
  - You may run finite commands: `npm test`, `npm run typecheck`, `npm run lint`, `npx prisma validate`, `npx prisma migrate diff`, and `npx next build` with env vars set.
- **Every phase that adds new inputs** also adds a dev-only **"Fill sample data"** button, so I can test without typing. Pattern:
  - Put presets in `src/lib/dev/samples.ts`.
  - Validate each preset against the real Zod schema in `src/lib/dev/samples.test.ts`.
  - Render the button with `<FillSampleButton onFill={(n) => …} />` from `src/components/dev/fill-sample-button.tsx`. It is hidden in production, and each click passes a counter so presets cycle.
- Strict TypeScript. No `any`, and no unchecked casts outside `src/server/repo/json.ts`.
- **Pure logic** (daylight, climate classification, geometry, validator, prompt building) lives in `src/domain/**`, with no framework imports, and is unit-tested with Vitest.
- **LLM prompts** live in `src/prompts/` as versioned files (`*.v1.md`) plus a registry. Log token usage per call.
- Keep API keys server-side. Rate-limit the generation endpoints.
- The input UI must work on mobile.
- **Before you write any Claude API code, load the `claude-api` skill.** It confirms current model ids, the structured-output and tool-use params, the web-search tool version, and prompt caching.
  - Use `claude-opus-5` for design generation and repair.
  - Use `claude-sonnet-5` for cheaper calls (trend research, and later chat edits).

# Work to do: phases 2 → 5, one at a time

After **each** phase, stop and hand me a report. Do not start the next phase until I confirm. Each phase is done only when you have delivered:

- working code
- migrations
- `npm test`, `npm run typecheck` and `npm run lint` all green
- new or updated Playwright specs in `tests/e2e/`, which I run
- a README "Phase N" section
- a short manual test checklist for me

## Phase 2: style profile (`/apartments/[id]/profile`)

- Add a `UserProfile` model per apartment: Zod schema in `src/domain/schemas/profile.ts`, a Prisma migration, and a repo function plus server actions.
- **Household:** adults, kids (with ages), pets (type and count), and WFH days per week.
- **Budget per room**, in EUR (a slider plus a number input). Show the total.
- **Style quiz:** about 10 pairwise choices across Scandinavian, Japandi, Mid-century, Industrial, Modern classic, Boho, Minimal and Mediterranean.
  - Produce a normalised score vector.
  - Use placeholder illustrations in `public/quiz/` (simple generated SVG or CSS mood cards are fine). I will swap in licensed photos later.
- **Palette picker:** liked and disliked colours (swatches plus a custom hex).
- **Must-keep furniture:** name, category, w/d/h in cm, colour, and target room.
- Add a "Fill sample data" button: two or three presets (for example, a family with a dog, and a WFH couple).
- Add a "2. Style profile" step link on the overview page. It should show as done or not done.

## Phase 3: context builder (`/apartments/[id]/context`)

- **Geocoding:** use Open-Meteo geocoding (free, no key). Store lat/lng on `Apartment`.
- **Climate:** use Open-Meteo climate normals. Classify heating degree days, humidity, and winter daylight hours. This is pure and tested.
- **Daylight per room:** combine the window-to-floor area ratio, an orientation factor (`suncalc` sun exposure per façade azimuth, using `wallOrientations`/`wallFacingBearing`), and a floor-level factor.
  - The output is `daylight: low | medium | high` plus a light-temperature hint, since north light is cool.
  - This is pure and unit-tested.
- **Renter rules:** add `src/domain/context/renter-rules/de.ts` (reversible changes, drilling limits, neutral walls at move-out, and so on) plus a default ruleset, keyed by country and tenure.
- **Trends:** make a Sonnet call with web search. Return a structured `{ trends[], regionalCues[], sources[] }`, cached 90 days per (country, top style).
- **Cache:** add a `ContextCache` table (`key`, `kind`, `payload`, `fetchedAt`, `expiresAt`). Show the fetch date in the UI.
- **Logging:** add an `LlmCall` table (purpose, model, prompt id and version, input/output/cache tokens, estimated EUR cost, duration).
- Assemble a `DesignContext` Zod object and show it on the context page for review, with a "Refresh" button.
- Mock the Anthropic client and `fetch` in unit tests. Make no real API calls in tests.

## Phase 4: design generation

- Write the prompt in `src/prompts/design-generate.v1.md`. Rules to include:
  - the 60/30/10 colour rule
  - walkways ≥ 80–90 cm
  - 60 cm beside or in front of beds
  - 75–90 cm behind dining chairs
  - desk height 72–75 cm
  - 40–45 cm between sofa and coffee table
  - ambient, task and accent lighting layers
  - daylight-aware palettes (cool north light calls for warmer tones)
  - a timeless base with trends only in cheap, swappable items (anchors need trend risk ≤ 0.3)
  - durability for kids and pets
  - renter constraints and the budget
- Send the room as hard facts:
  - polygon coordinates
  - opening segments
  - precomputed keep-clear rectangles (door swings via `doorSwing()`, window and radiator zones)
  - must-keep furniture
- Make one `claude-opus-5` call per room, with a forced tool `submit_design`. Its input schema is `z.toJSONSchema(DesignContent)`. Parse the result with Zod. Apply prompt caching to the static rules block.
- Add a `Design` table with one row per version (content, validation, status, source, parentVersion).
- Add `POST /api/design/generate` with these properties:
  - auth required
  - Postgres rate limit (5 per hour and 10 per day per user)
  - SSE progress: generating → validating → repairing n/3 → done
- Add a design page, `/apartments/[id]/design/[roomId]`, with:
  - a Generate button with progress
  - the SVG plan, with furniture footprints drawn as rotated rectangles by reusing `src/components/plan-view/shapes.tsx`
  - palette swatches
  - an item list showing rationale, price range and a trend-risk badge
- Add a unit test that feeds a recorded fixture of a model response, so the test costs nothing.

## Phase 5: validator and repair loop

- The validator goes in `src/domain/validator/`: `validateDesign(room, design, profile, context) → ValidationIssue[]`, with one file per rule and all clearances in `clearances.ts`. Rules:
  - items stay inside the polygon
  - OBB SAT overlap (any rotation) between floor items
  - door swing areas stay clear
  - windows are not blocked above sill height
  - radiators are not covered
  - fixed-element collisions
  - wall items sit on a wall
  - walkway: rasterise at 5 cm, erode 40 cm, flood-fill from the doors, and every item's access side plus both bed sides must be reachable
  - bed access
  - dining clearance
  - budget
  - anchor trend risk
  - renter drilling
  - must-keep items are present
  - palette shares
  - no dangling references
- Put a `hint` on every issue with a concrete fix, such as "move sofa ≥ 12 cm toward +y".
- Write thorough Vitest fixtures: one good design, and one deliberately broken design per rule.
- **Repair loop:** when there are errors, call `src/prompts/design-repair.v1.md` with the current JSON and the issues. Run at most 3 loops and keep the version with the fewest errors.
  - If the design is still invalid, save it with status `invalid` and show the issues to the user. Never display an invalid design as valid.
- Test the repair loop with a mocked LLM client.
- On the design page, highlight the problem items in the SVG plan, next to the issue list.

# Later (do not start): phases 6–9

These come after phase 5:

- the 3D view with three.js through @react-three/fiber and drei, plus a whole-apartment colour-flow view
- an iteration chat that edits the design through JSON patches, with versions, diff and revert
- a shopping list and PDF export
- optional mood renders, labelled "inspiration, not to scale"

Keep the phase 2–5 code structured so these can plug in.

# Start

Start with **phase 2**. First restate the phase 2 scope in five bullets or fewer, plus any schema you want to add, and wait for my OK before you write code.
