# RaumPlan: prompt for phase 6 — deterministic layout solver, cheaper generation

Paste everything below the line into a new Claude Code session opened in this repo.

---

# Role

You are a senior full-stack engineer continuing work on **RaumPlan**, a web app where a user describes their apartment and gets an AI-generated interior design that is checked for dimensional validity.

**Core principle:** the language model decides taste and intent, deterministic TypeScript owns geometry. This phase takes that principle one step further: the model stops choosing coordinates entirely.

# Current state

Phases 0–5 are finished and verified: apartment and room editor, style profile, context builder, design generation with Claude, validator and repair loop. Read before writing code:

1. `README.md` — setup, conventions, layout, what each phase built.
2. `/home/zayko/.claude/plans/role-you-are-shimmering-sparrow.md` — the approved master plan (geometry conventions, Design schema).
3. `AGENTS.md` — this is **Next.js 16**: `middleware` is `src/proxy.ts`, `params`/`searchParams` are Promises, `PageProps<"/route">` comes from `next typegen`.

Key existing code you will reuse, not rewrite:

- `src/domain/geometry/` — `obb.ts` (`itemFootprint`, `convexOverlap`, `stripBeside`, `polygonInside`), `zones.ts` (`keepClearZones`), `grid.ts` (rasterise, clearance, reachable), `walls.ts` (`wallsOf`, `wallFacingBearing`).
- `src/domain/validator/` — `validateDesign`, `summarizeIssues`, all numbers in `clearances.ts`.
- `src/domain/design/room-facts.ts` and `brief.ts` — what the model is told.
- `src/server/design/repair-loop.ts` and `generate.ts` — the model loop, streaming, logging.
- `src/lib/dev/sample-design.ts` — a valid hand-made design used by tests and the dev button.

# The problem this phase solves

A real run on a 300 × 160 cm hallway produced an invalid design: the model placed a bench, shoe cabinet, armchair, side table, planter and a sideboard into 4.8 m², which cannot satisfy 80 cm walkways. It burned three repair rounds and still failed. Two causes:

1. The model is weak at spatial arithmetic, so coordinates come back wrong and every wrong coordinate costs a full extra generation.
2. Repairs resend and regenerate the entire design, so failures are the most expensive path.

Target after this phase: **one model call per room in the normal case, roughly €0.04–0.07, and a design that passes the validator on the first attempt most of the time.**

# Standing rules

- **Never start long-running processes** (`npm run dev`, Playwright `webServer`). Hand me the commands. You may run `npm test`, `npm run typecheck`, `npm run lint`, `npx prisma validate`, `npx next build` with placeholder env vars.
- Any phase that adds user inputs also adds a dev-only "Fill sample data" button (`src/components/dev/fill-sample-button.tsx`).
- Strict TypeScript, no `any`, Zod at every boundary. Pure logic lives in `src/domain/**` and is unit-tested with Vitest.
- Prompts are versioned files in `src/prompts/` (`*.vN.md` + registry in `src/prompts/index.ts`). Never edit a shipped prompt in place; add a new version.
- Keep all 156 existing tests green and keep the `data-testid` values used by `tests/e2e/*` working.
- No real API calls in tests. Mock the Anthropic client with recorded-shape responses, as `repair-loop.test.ts` already does.

---

# What to build

## 1. Furniture catalogue (`src/domain/design/catalogue.ts`, pure, tested)

A table of realistic dimensions per `FurnitureCategory` with size classes:

```ts
sofa:        { small: [180, 90], medium: [220, 95], large: [260, 100] }   // w, d in cm
bed:         { small: [90, 200], medium: [140, 200], large: [180, 200] }
wardrobe:    { small: [100, 60], medium: [150, 60], large: [200, 60] }
// … every category the designer may use, with a default height per category
```

- `catalogueSize(category, sizeClass)` → `{ w, d, h }`; heights come from ergonomic defaults (desk 74, dining table 75, sofa seat back 85, and so on).
- `minFreeSpan(category, sizeClass)` → how much wall or floor run the piece needs including its clearance.
- Also holds **placement metadata** per category: `wants: "wall" | "corner" | "free" | "front_of:sofa" | "beside:bed" | "under:dining_table"`, `priority` (anchor pieces high, plants and side tables low, used when the solver must drop something), and whether the piece needs front access.
- A `maxItems(areaM2, roomType)` helper: under 6 m² → 2–4 pieces, 6–12 m² → 4–8, above that scale up; hallways and baths get their own low caps.

## 2. Model output becomes intent, not coordinates (`src/domain/schemas/design.ts`)

Add a new Zod schema `DesignPlanInput` (the model's output) beside the existing `DesignContent` (still the stored format):

```ts
item: {
  id, category, sizeClass: "small" | "medium" | "large",
  name, material, colorHex, paletteRole,
  placement: "floor" | "floor_covering" | "wall" | "ceiling",
  intent: {                       // where it should go, not where it is
    anchor: "wall" | "corner" | "free" | "beside" | "front_of" | "under",
    wallIndex?: number,           // optional preference
    relativeTo?: string,          // id of another item, for beside/front_of/under
    zoneId?: string,
  },
  priority: 1 | 2 | 3,            // 1 = must have, 3 = drop first if it does not fit
  price: { min, max, currency },
  trendRisk, investmentTier, renterFriendly, requiresDrilling, existing,
  rationale                        // max 160 characters
}
```

Plus `zones`, `palette`, `surfaces`, `lighting`, `textiles`, `longevity` as today, with shorter rationale limits. Dimensions, `x`, `y`, `rotation`, `elevation` and `productQuery` are **not** in the model schema: the server fills them from the catalogue, the solver and a deterministic query builder.

Keep `DesignContent` as the stored and validated format so the validator, the design page, the sample design and every existing test keep working. Write a `toDesignContent(planned, placements)` mapper.

## 3. Placement solver (`src/domain/design/solver/`, pure, heavily tested)

Input: the room (polygon, openings, fixed elements), the keep-clear zones, the catalogue-resolved items with intents and priorities, and the must-keep pieces. Output: `x`, `y`, `rotation` per item, plus a list of items it had to drop.

Suggested approach, in this order:

1. **Slots.** Compute free wall runs (wall length minus door/window/radiator spans and their keep-clear bands) with their usable depth, and the free floor rectangle. Expose this as `wallSlots(room)` — also useful in the prompt facts.
2. **Anchors first.** Place `priority 1` wall pieces into the best-fitting slot: prefer the wall the model asked for, then the longest wall that faces the room, avoid the wall with the door path, use the wall's `backAgainstRotation` (already computed in `room-facts.ts`).
3. **Relations.** Place `front_of` / `beside` / `under` items relative to their anchor at ergonomic distances from `clearances.ts` (sofa → coffee table 45 cm, bed → nightstand flush at the head, dining table → chairs on the free sides).
4. **Local search.** Score a layout with a cost function: validator errors × 1000 + warnings × 10 + soft costs (distance from intent, unbalanced spread, blocked views to windows). Improve with a few hundred iterations of nudge/rotate/swap-slot moves (deterministic seed, hard iteration cap so it stays fast). Reuse `convexOverlap` for penetration depth so moves are informed, not random.
5. **Drop pass.** If errors remain, drop the lowest-priority item and re-run; record what was dropped and why so the UI can show "the room was too small for X".

Requirements: pure functions, deterministic given the same input, typical room solved in well under a second, and a unit test that asserts the solver produces a design with zero validator errors for a set of fixture rooms (including the 300 × 160 hallway, a 420 × 380 living room, a 350 × 320 bedroom with a double bed, and a kitchen with a fixed kitchen run).

## 4. Deterministic repair before any model call (`src/domain/design/autofix.ts`)

Given a `DesignContent` and its issues, try to fix them without the model:

- snap items within 15 cm of a wall onto the wall,
- push overlapping pairs apart along the minimum-penetration axis (`convexOverlap` returns it),
- slide items out of door swings, door paths, window and radiator zones,
- re-run the validator after each pass, at most a few passes,
- last resort: drop the lowest-priority offending item.

Return the fixed design plus a log of what changed. This runs both after the solver and after any model repair.

## 5. Cheaper model loop (`src/server/design/`)

- **One call in the happy path.** Prompt → `DesignPlanInput` → catalogue → solver → autofix → validator. If there are no errors, stop. No repair call at all.
- **Patch repairs only.** If errors remain, send a compact repair request that returns a **patch**, not a whole design: `{ move: [{id, wallIndex|relativeTo}], resize: [{id, sizeClass}], remove: [id], add: [item] }`. Apply it, re-solve, re-validate. Maximum **one** patch round by default (`DESIGN_MAX_REPAIRS`, default 1).
- Keep `effort` and model selection from `.env` (`DESIGN_MODEL` default `claude-sonnet-5`, `DESIGN_ESCALATE_MODEL`, `DESIGN_EFFORT` default `low`), keep the escalation rule for the final repair, keep prompt caching on the rules block and on the conversation.
- Keep streaming progress, but the stages become: context → designing → placing → checking → fixing → done. Update `src/lib/design-events.ts` and the progress labels.
- Log every call to `LlmCall` as today, and store solver statistics on the design (`durationMs`, items dropped, autofix passes) so I can see what happened without reading logs.

## 6. Prompt `design-generate.v2.md`

New version (keep v1 on disk, register v2 in `src/prompts/index.ts`), rewritten around the new job:

- The model chooses pieces, size classes, materials, colours, prices, lighting, textiles, surfaces and the reasoning. **It never writes coordinates.**
- Facts now include: room area in m², the item cap for that area, the free wall slots with lengths and depths, the free floor rectangle, keep-clear rectangles, and the catalogue's available size classes per category.
- Explicit instruction: circulation first; under-furnishing is better than breaking clearances; in rooms under 6 m² pick 2–4 pieces; hallways get at most a slim bench, hooks and a mirror; mark anything optional as priority 3 so the solver may drop it.
- Rationales max 160 characters, no repetition of the facts.
- Add `design-repair.v2.md` for the patch format.

## 7. UI touches (small, no redesign — that comes later)

- Show dropped items on the design page: "Two pieces did not fit and were left out: side table, planter."
- When a small room still fails, show the hint that the room may be too small for the requested furniture.
- Keep the dev-only "Insert sample design" button working; add a second dev button "Re-solve layout" that runs catalogue + solver + autofix on the current design's item list, so I can test the solver with zero API cost.

---

# Verification

- Vitest: catalogue, slots, solver (fixture rooms → zero errors), autofix (each repair kind), the mapper, patch application, and the loop with mocked model responses (happy path with no repair, one patch round, patch fails → best kept).
- Add a **cost regression test**: assert the generated tool schema and prompt stay under a token budget (use `messages.count_tokens` behind a flag, or a character-count proxy so it runs offline).
- Playwright: the dev "Insert sample design" and "Re-solve layout" flows.
- Report the measured before/after: output tokens per room, calls per room, estimated €, and the share of fixture rooms that pass with zero errors.

I run: `npm run db:deploy` if there is a migration, `npm run dev`, `npm run test:e2e`, and one real generation per room type to compare quality against the old pipeline.

# Start

Start by restating the plan in at most 8 bullets, including the exact solver algorithm and the new `DesignPlanInput` schema, and wait for my OK before writing code. Then build in this order, stopping after each step: **(a)** catalogue + slots + schema + mapper; **(b)** solver + autofix with fixture tests; **(c)** new prompts and the one-call server loop; **(d)** UI touches and the cost report.
