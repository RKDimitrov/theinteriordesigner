# RaumPlan: prompt for the frontend redesign (phase 6) and the 3D walkthrough (later bonus)

Paste everything below the line into a new Claude Code session opened in this repo.

---

# Role

You are a senior full-stack engineer and UI designer continuing work on **RaumPlan**, a web app where a user describes their apartment and gets an AI-generated interior design that is checked for dimensional validity.

**Core principle (unchanged):** the language model decides taste and intent, deterministic TypeScript owns geometry. Every design passes the validator before it is shown. The redesign must not weaken that: an invalid design still shows its red banner and problem list.

# Current state

Phases 0–5 are finished and verified: apartment and room editor, style profile, context builder (climate, daylight, renter rules, trends), design generation with Claude, validator and repair loop. Read before writing code:

1. `README.md` — setup, conventions, project layout, what each phase built.
2. `/home/zayko/.claude/plans/role-you-are-shimmering-sparrow.md` — the approved master plan.
3. `AGENTS.md` — this is **Next.js 16**: `middleware` is `src/proxy.ts`, `params`/`searchParams` are Promises, `PageProps<"/route">` comes from `next typegen`. Read `node_modules/next/dist/docs/` before using an API you are unsure of.

Stack: Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind v4, shadcn/ui in its **Base UI** flavour (no `asChild`; use `buttonVariants` on links), next-intl (every string lives in `src/messages/en.json`), Supabase auth, Prisma 7, Zod 4 at every boundary.

# Standing rules

- **Never start long-running processes** (`npm run dev`, Playwright `webServer`). The machine is slow. Hand me the commands and I run them. You may run `npm test`, `npm run typecheck`, `npm run lint`, `npx prisma validate`, `npx next build` (with placeholder env vars).
- **Every phase that adds inputs adds a dev-only "Fill sample data" button** (`src/components/dev/fill-sample-button.tsx`, presets in `src/lib/dev/samples.ts`, each preset validated by a Vitest test).
- Strict TypeScript, no `any`, Zod at boundaries, pure logic in `src/domain/**` with unit tests.
- Keep every existing unit and E2E test green. Where you change markup that tests target, update the test rather than dropping the assertion. Existing `data-testid` values used by `tests/e2e/*.spec.ts` must keep working (`plan-canvas`, `room-area`, `room-issues`, `opening-*`, `step-1..4`, `budget-*`, `quiz-*`, `chip-*`, `design-status`, `design-issues`, `item-*`, `plan-item-*`, `generate-design`).
- No new heavy dependencies without asking. Framer Motion / `motion` is fine if you need it; prefer CSS transitions and the `tailwindcss-animate`/`tw-animate-css` already installed.

---

# Part 1 — Frontend redesign (do this first, it costs no API credit)

Make the whole app look like a modern, confident product: clean, minimal, with a warm editorial personality and tasteful motion. Everything can be tested for free with the dev-only **"Insert sample design"** button and the "Fill sample data" buttons, so you never need to call Claude while working on this.

## Visual direction (decided, do not re-litigate)

**Warm editorial.** Paper-toned surfaces, ink text, one warm accent and one muted green, serif headlines over a clean sans body.

Starting tokens (tune them, keep the character):

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#FAF7F2` | `#141312` |
| Surface / card | `#FFFFFF` | `#1D1B19` |
| Text | `#1A1A18` | `#F2EFEA` |
| Muted text | `#6B6660` | `#A8A29A` |
| Border | `#E6E0D7` | `#2E2B27` |
| Accent (primary) | `#C0683F` | `#D98159` |
| Secondary | `#7E8B72` | `#93A186` |
| Destructive | `#B3261E` | `#E5786F` |

- Headlines: a serif from `next/font/google` (Fraunces, Instrument Serif or similar). Body and UI: keep Geist Sans or swap to Inter. Numbers use tabular figures.
- Radius scale 8/12/16 px, soft shadows only on raised surfaces, hairline borders elsewhere. Generous whitespace, wide line length limits on prose.
- Everything is defined as CSS variables in `src/app/globals.css`, in both light and dark blocks, so shadcn components inherit it. Add a theme toggle (system / light / dark) with `next-themes`, which is already installed.
- Accessibility: text contrast at least 4.5:1, visible focus rings, hit targets ≥ 44 px on touch.

## Motion (decided)

Tasteful, 150–250 ms, standard easing:

- Page content fades and rises slightly on mount; cards and list items stagger by ~40 ms.
- The 2D plan draws itself: room outline strokes in, then furniture footprints fade/scale in, staggered.
- Numbers (area, budget total, cost estimate) count up.
- Buttons have press states; the Generate button shows a live progress line with a subtle pulsing indicator.
- Skeleton loaders instead of blank space (use `loading.tsx` per route where it helps).
- Every animation is wrapped so `prefers-reduced-motion: reduce` disables it. Add a `useReducedMotion` guard or a CSS media query — no exceptions.

## Screens to rework (all of them, mobile first)

1. **Landing** (`src/app/[locale]/page.tsx`): a real hero explaining the product (describe your flat → AI design → checked by geometry), one screenshot-style illustration (you can render the sample design's SVG plan), a three-step "how it works" strip, one clear call to action. No stock-photo placeholders.
2. **Login**: centred card, clear split between magic link and password, friendly errors.
3. **App shell** (`(app)/layout.tsx`): sticky slim header, product mark, breadcrumb of apartment → step, theme toggle, account menu with sign-out. On mobile a bottom-safe layout, no cramped rows.
4. **Apartments list**: cards with the apartment's mini plan or a generated monogram, room count, status chips, an empty state that invites the first apartment.
5. **Apartment overview**: turn the four step badges into a real progress stepper (done / current / locked) with per-step summaries (rooms count, profile completeness, context freshness, designs valid). Room cards get a nicer plan thumbnail and quick links to edit / design.
6. **Room editor**: the SVG canvas gets the new palette (paper canvas, ink walls, accent handles), a floating tool bar with icons plus labels, better hover/selection feedback, a collapsible side panel on mobile (sheet/drawer), and clearer inline validation.
7. **Style profile**: make the quiz feel good — big tappable cards, progress bar, animated transition between pairs, animated result bars. Budget sliders with live totals. Colour picker with proper swatch states.
8. **Context page**: a summary strip (location, climate class, daylight spread), cards for climate, daylight per room (small orientation dial per room), renter rules, trends with source links and a clear "researched on" date.
9. **Design page** (most important): a two-column layout on desktop — large plan on the left, sticky sidebar with status, problems and palette on the right. The plan gets a legend, a zoom control, hover tooltips showing name, size and price, and a toggle to show/hide keep-clear zones. Items in the list and the plan stay linked in both directions. The status banner becomes a clear header: valid (green-ish), warnings (amber), invalid (red) with the count of problems. Furniture list becomes a comfortable table/card hybrid with a per-item colour chip.

## Prompt fix to include in this pass (cheap, no API needed to write)

A real run produced an invalid design for a 300 × 160 cm hallway: the model placed a bench, shoe cabinet, armchair, side table, planter and sideboard in 4.8 m², which cannot satisfy 80 cm walkways. Update `src/prompts/design-generate.v1.md` (bump to `design-generate.v2.md` and register it in `src/prompts/index.ts`, keeping v1 on disk):

- State the room area explicitly in the facts and tell the model to scale the furniture count to it: tiny rooms (< 6 m²) get 2–4 pieces, hallways get circulation first and at most a slim bench, hooks and a mirror.
- Tell it that leaving a room under-furnished is acceptable and preferable to breaking clearances, and that it should drop items rather than shrink walkways.
- Add a short "before you submit" checklist: walk each door path, check both bed sides, confirm nothing sits in a keep-clear rectangle.

Also surface this in the UI: when the validator returns `WALKWAY_TOO_NARROW` or `OVERLAP` for a room under about 6 m², show a hint that the room may be too small for the requested furniture.

## Deliverables for part 1

- Working code, all existing tests updated and green, `npm run typecheck` and `npm run lint` clean, `npx next build` passing.
- A short design-system note in the README: tokens, fonts, motion rules, how to change the palette.
- New Playwright assertions where behaviour changed (theme toggle, stepper, plan legend).
- A manual checklist for me, including what to look at on a phone.

Work in this order and stop after each step for my check: **(a)** tokens, fonts, theme toggle and shared primitives; **(b)** app shell, landing, login, apartments list and overview; **(c)** room editor and profile; **(d)** context and design pages plus the prompt fix.

---

# Part 2 — 3D walkthrough (bonus, only when I say so)

Do not start this until I explicitly ask. It comes after the frontend pass and after I have topped up API credit.

Goal: walk around the designed apartment in first person and look around, from the same validated design data — no new model calls.

- **Stack:** `three` with `@react-three/fiber` and `@react-three/drei`. Desktop first; on mobile fall back to an orbit view.
- **Geometry from data only:** extrude walls from the room polygon and `ceilingHeight`, cut openings for doors and windows (sill height and height are stored), place furniture as parametric meshes per `FurnitureCategory` (box-based sofa, bed, table, wardrobe, and so on) coloured with `colorHex` and the palette. Rugs are flat planes. Put the mesh builders in `src/domain/three/` or `src/components/three/` as pure functions with unit tests on dimensions and positions.
- **Movement:** pointer-lock WASD plus mouse look on desktop, joystick on touch, eye height 165 cm, collision against the same footprints the validator uses (reuse `itemFootprint` and the room polygon) so you cannot walk through furniture. A "reset view" and a minimap using the existing 2D plan.
- **Lighting:** an ambient base plus the design's lighting layers (ceiling, floor lamps) using the stored `colorTempK`, and a directional light from the window direction derived from `northAngleDeg` and the daylight model.
- **Whole-apartment mode:** rooms laid out from the apartment plan, with a door-to-door walk between them, so the colour flow between rooms is visible.
- **Performance:** lazy-load the 3D bundle (`next/dynamic`, no SSR), instance repeated meshes, cap pixel ratio, show a "3D view" button rather than loading three.js on the design page by default. Target a usable frame rate on a modest laptop.
- **Labelled clearly:** this is a schematic view built from measured data, not a photoreal render.

Deliverables: the same as part 1, plus a note in the README on how the 3D view derives from the design JSON.

---

# Start

Start with **Part 1, step (a)**. First show me the token set and two small before/after examples (a button row and a card) as code, and wait for my OK before rolling it out across the app.
