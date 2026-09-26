# Handoff: RaumPlan "Atelier" redesign

## Overview
A full visual redesign of the RaumPlan app (Next.js 16 · Tailwind v4 · shadcn/ui on Base UI · next-intl). The new direction, **Atelier**, looks like an architect's working file: grainy paper, ink, pencil floor plans on a blueprint grid, taped-down sheets, rubber stamps for finished steps, monospace labels and large serif headings. It replaces the neutral black/white shadcn look.

Repo: `RKDimitrov/theinteriordesigner` (branch `main`).

## About the design files
`RaumPlan Atelier.html` + `atelier/atelier.css` + `atelier/atelier.js` are **design references built in HTML**, not production code. Recreate them in the existing app: same routes, server actions, Zod schemas, `data-testid`s, next-intl strings and domain logic. Only the presentation layer changes. Do not copy the vanilla JS router or the mock data.

Open the HTML file in a browser; navigate with the top menu or `#apartments`, `#overview`, `#newroom`, `#design`, `#library`, `#moodboard`, `#settings`.

## Fidelity
**High fidelity.** Colors, type, borders, shadows and spacing are final. Match them closely. Copy in the mock that is not in `src/messages/en.json` must be added there (never hard-code strings).

## Standing rules (from the repo)
- Keep every existing `data-testid` (`plan-canvas`, `room-area`, `room-issues`, `opening-*`, `step-1..4`, `budget-*`, `quiz-*`, `chip-*`, `design-status`, `design-issues`, `item-*`, `plan-item-*`, `generate-design`). Update tests where markup changes; do not drop assertions.
- Validator stays authoritative: invalid designs still show the red status and problem list.
- No new heavy dependencies. Fonts via `next/font/google`.
- `prefers-reduced-motion: reduce` disables all motion.
- Run `npm run typecheck`, `npm run lint`, `npm test` after each step.

## Suggested order (stop for review after each)
1. **Tokens, fonts, primitives**: `globals.css`, `layout.tsx` fonts, restyle `src/components/ui/*` (button, badge, card, input, select, tabs, slider, checkbox, dialog).
2. **Shell + lists**: `(app)/layout.tsx` header, apartments list, apartment overview (stepper + room cards + history).
3. **Room flow**: new room, plan rendering (`plan-view/shapes.tsx`, `room-plan.tsx`).
3b. **Planner** (replaces `plan-editor/*`): see `PLANNER.md`. It has its own order of work.
4. **Design page**: `design/design-view.tsx`, `design-plan.tsx`, `generate-button.tsx`.
5. **Profile, context, settings**: restyle existing profile/context pages with the same parts; add the Settings page.
6. **New screens** (Library, Moodboard): these need new data. Build the UI with the data the app already has (design items, palette, trends, must-keep furniture). Ask the product owner before adding new tables.

---

## Design tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| paper | `#F4ECDC` | page background |
| sheet | `#FBF6EC` | cards, inputs, panels |
| ink | `#2B2622` | text, borders, offset shadows |
| clay | `#C8794A` | primary accent, CTAs, selection |
| clay-dark | `#8E4F2F` | pressed/hover of clay |
| walnut | `#6B4A32` | secondary accent, storage items |
| olive | `#5D6B3C` | success / "done" stamps |
| red | `#9A3B2A` | destructive |
| amber (warn) | `#A6782A` | "valid with warnings" stamp |
| rule | `#B8A58A` | dashed/dotted dividers |
| mute | `#6F6152` | secondary text, labels (4.5:1 on paper) |
| line | `#E3D6C1` | hairlines inside cards |
| card-border | `#CBB9A0` | card outer border |
| grid | `rgba(80,110,140,.10)` | blueprint grid lines |
| dim | `#5A6E82` | plan dimension lines/text |
| window glass | `#DBE6EE` | window fill in plans |
| tape | `rgba(214,196,160,.75)` | tape strips |
| sticky/highlight | `#FFF8EC` / `#FFF3E0` | current step, hovered row |

**Mapping into `src/app/globals.css` `:root`** (replace the neutral oklch values):
```css
--background:#F4ECDC; --foreground:#2B2622;
--card:#FBF6EC; --card-foreground:#2B2622;
--popover:#FBF6EC; --popover-foreground:#2B2622;
--primary:#C8794A; --primary-foreground:#FFF8EE;
--secondary:#EFE4D0; --secondary-foreground:#2B2622;
--muted:#EFE4D0; --muted-foreground:#6F6152;
--accent:#FFF3E0; --accent-foreground:#2B2622;
--destructive:#9A3B2A;
--border:#CBB9A0; --input:#2B2622; --ring:#C8794A;
--chart-1:#EFE3CF; --chart-2:#B9A58A; --chart-3:#A57A52; --chart-4:#C8794A; --chart-5:#5D6B3C;
--radius:0rem;
```
Add custom tokens `--paper --sheet --ink --clay --walnut --olive --rule --line --grid` and expose them in `@theme inline` (`--color-olive: var(--olive)` etc.). Dark mode is out of scope for this pass; leave `.dark` but it is not designed.

**Paper grain** on `body`:
```css
background-image: radial-gradient(rgba(80,55,30,.07) .8px, transparent 1px);
background-size: 5px 5px;
```
**Blueprint grid** (plan areas): `linear-gradient(rgba(80,110,140,.10) 1px,transparent 1px), linear-gradient(90deg, same)` at `14px 14px` (20px on the editor canvas is fine too).

### Typography
Replace Geist in `src/app/[locale]/layout.tsx`:
- **Instrument Serif** 400 + italic → `--font-heading`. Headlines, card titles, big numbers.
- **Work Sans** 400/500/600 → `--font-sans`. Body and inputs.
- **IBM Plex Mono** 400/500/600 → `--font-mono`. Labels, buttons, numbers, meta, nav.

| Role | Font | Size / line-height | Notes |
|---|---|---|---|
| Page title (h1) | Instrument Serif | `clamp(48px,6vw,72px)` / .95 | letter-spacing −.02em; second word may be italic clay (`<em>`) |
| Section title (h2) | Instrument Serif | 40px / 1 | followed by a mono `small` label |
| Card title | Instrument Serif | 30px / 1 | |
| Step title | Instrument Serif | 28px / 1.1 | |
| Margin note | Instrument Serif italic | 24px / 1.25 | quotes from context/concept |
| Body | Work Sans | 15px / 1.55 | |
| Hint | Work Sans | 12.5px | color mute |
| Eyebrow / label | IBM Plex Mono 500 | 11px, uppercase, tracking .12em | color mute |
| Button | IBM Plex Mono 500 | 12px, uppercase, tracking .08em | |
| Nav | IBM Plex Mono 500 | 12px, uppercase, tracking .08em | |
| Numbers | IBM Plex Mono | `font-variant-numeric: tabular-nums` | |
| Logo | Instrument Serif italic | 32px | + mono 10px "ATELIER" superscript in clay |

### Radius, borders, shadows
- **Radius 0 everywhere** (square paper). Only exceptions: stamps, avatar and round plan items (circles).
- Borders: `1.5px solid ink` for interactive things (buttons, inputs, stepper, tabs, segmented controls). `1px solid #CBB9A0` for cards. Dividers: `1px dashed #B8A58A` (section), `1px dotted #B8A58A` (rows).
- **Offset shadow** (buttons, focused inputs, selected chips): `3px 3px 0 ink`; hover `4px 4px 0` + `translate(-1px,-1px)`; active `1px 1px 0` + `translate(2px,2px)`. Selected chip / active tool: `3px 3px 0 clay`. Focused input: `box-shadow: 3px 3px 0 clay`.
- **Card shadow**: `0 1px 0 #E6D9C4, 0 14px 24px -12px rgba(60,40,20,.28)`; hover `0 22px 30px -14px rgba(60,40,20,.34)` + `translateY(-3px)`.
- Double rule under the header: `border-bottom:1px solid ink` plus a second 1px line 5px lower.

### Spacing
Page padding `30px clamp(20px,4vw,48px) 72px`, max width 1280px. Main + sidebar grid `minmax(0,1fr) 340px`, gap 40px (design page 360px sidebar; editor 380px). Card grid `repeat(auto-fill,minmax(300px,1fr))` gap 28px. Form field stacks gap 6px; field groups gap 14px; form sections gap 34px.

---

## Shared components (build once, reuse)

- **Button** (`ui/button.tsx` variants). All variants have a mono uppercase label, a 1.5px ink border, no radius and the offset shadow.
  - `default`: clay background, `#FFF8EE` text.
  - `outline`/`secondary`: sheet background, ink text.
  - `ghost`: dashed border, no shadow, transparent.
  - `destructive`: red text + red border, sheet background.
  - Sizes: default `10px 16px`, sm `7px 12px` / 11px.
- **Label chip** (`ui/badge.tsx`): `2px 8px`, 1px ink border, mono 10.5px uppercase, tracking .06em. `default` = ink fill + paper text; `outline`; `clay`; `olive`.
- **Stamp** (new): 62px circle, 2px olive border, olive mono 10px text "DONE ✓", `rotate(-14deg)`, opacity .85. The in-progress version has a dashed clay border and `rotate(9deg)`. Warning: amber. Error: red. Large 96px variant for the design status.
- **Ticket stepper** (overview; replaces the 4 step badges; keep `step-1..4` testids): a 4-column strip with a 1.5px ink border on sheet, cells split by 1.5px dashed rule. Each cell has a mono eyebrow "STEP 01", a 28px serif title, a 13px summary and a stamp in the top-right. The current cell has a `#FFF8EC` background and a clay eyebrow "STEP 04 · NOW". Each cell links to its step. On mobile it becomes 2 columns.
- **Taped card** (room/apartment card): sheet background, 1px card border, card shadow. The tape strip is an 86×22px pseudo-element centred at top −10px, rotated −3deg. Odd cards are rotated −.4deg and even cards +.5deg; they straighten and lift on hover. Parts:
  - Header row: serif 30px title with the mono area on the right, then a hairline.
  - Plan area: blueprint grid.
  - Footer: label chips and a mono underlined link "Open →" pushed right.
- **Dashed "add" tile**: 1.5px dashed rule border, a large clay serif "+" and a mono uppercase caption. Used for new apartment, new room and pin.
- **Title block** (overview header, like an architect's drawing stamp): a 2×2 grid with a 1.5px ink outer border and 1px inner lines. Each cell has a 9.5px mono uppercase key and a 13px mono value (Project, North, Rooms, Revised).
- **Sidebar sections**: each starts with a 1.5px ink top rule. The heading is a mono 11px uppercase row with the title left and a small value or link right. The contents are one of:
  - "rows": label left, mono value right, with dotted dividers.
  - "margin note": italic serif quote.
  - "swatch card": 64px color blocks with mono captions.
- **Ledger** (history/activity): a 3-column grid (`92px 1fr auto`) with a mono date, the text and an optional label chip, and dotted dividers.
- **Input** (`ui/input.tsx`): 1.5px ink border, sheet background, `10px 12px` padding, and a mono unit suffix (`cm`) inside on the right. Number inputs use mono with tabular figures. Focus: `3px 3px 0 clay`. Error: red border + red hint text below.
- **Field label**: mono 10.5px uppercase, tracking .14em, mute.
- **Segmented control** (`ui/tabs` line variant or radio group): 1.5px ink border. Buttons are mono 11.5px uppercase, split by 1px ink lines; the active one is ink-filled.
- **Toggle** (`ui/checkbox` as switch): 46×24px square track with a 1.5px ink border and a 16px square ink knob. On: clay track with a sheet knob.
- **Tabs, large** (Library): serif 26px tabs with a 1.5px ink border (no bottom). Inactive tabs are `#EFE4D0` and sit 4px lower; the active tab is sheet and flush with the content.

---

## Screens

### 1. App shell (`(app)/layout.tsx`)
- **Header:**
  - Left: the logo "RaumPlan" with a clay "ATELIER" superscript.
  - Middle: nav with Apartments / Library / Moodboards / Settings. The active item has a 2px clay underline.
  - Right: the user name in mono uppercase and a 32px ink avatar circle with initials. Move sign-out into Settings, or keep it as a small link here.
  - Below: the double rule.
- **Page header** on every screen: a breadcrumb (mono 11px uppercase with underlined links, separated by "/"), the h1, then a meta row. The meta row is mono 13px, with items separated by 1px rule borders and 14px padding. Primary actions sit right-aligned. A 1px dashed rule and 28px margin separate the header from the content.

### 2. Apartments (`apartments/page.tsx`)
- Eyebrow "Index · your apartment files", h1 "Apartments", meta (apartments · rooms · designs), and a "+ New apartment" button.
- Left: a card grid of apartment taped cards, each with its name, total m², a mini plan (the largest room, dimensions off, 220px tall) and chips (step x of 4, city, tenure). The last tile is the dashed "Start a new apartment file".
- Right sidebar: a "Recent entries" ledger (design saved, trends researched, climate fetched, room added) and a margin note. The ledger needs a small query over existing `DesignVersion`, context and room `createdAt` timestamps.
- Empty state: only the dashed tile, plus the margin note "No apartments yet. Start by adding one."

### 3. Apartment overview (`apartments/[id]/page.tsx`)
- Breadcrumb, h1 (name; the second half may be italic clay), meta (address, m², floor, tenure), and the title block on the right with Edit (ghost) and Delete (ghost destructive).
- Ticket stepper with per-step summaries from existing data.
- Left column:
  - "Rooms · N sheets" with "+ Add room" on the right.
  - Room taped cards with the plan (the designed room shows furniture footprints) and chips: design status ("Designed · v2", or a clay "No design yet") and orientation plus light temperature.
  - Links: "Edit plan" → planner scoped to that room (`?room=<id>`), Open → / Generate → design page.
- Header buttons: Delete (ghost destructive), Edit details (ghost), **Open planner →** (primary, whole apartment). The "Step 01 · Rooms" stepper cell also opens the planner (whole apartment).
  - "History": a ledger of every design version per room, showing version, repairs, seconds, cost and a validity chip. This data is already stored on the generation record.
- Right sidebar:
  - A margin note: the first climate tip from context.
  - Climate · Sofia rows: HDD, mean temperature, humidity, winter daylight, winter sunshine, with "Re-check".
  - A swatch card from the liked colours in the style profile, with the top styles.

### 4. New room (`rooms/new/page.tsx`)
A single form with 4 numbered sections. Each h2 starts with a mono number ("01").
1. Name (input, max 420px) and room type chips (single select; the active chip is ink with a clay offset shadow). Types come from `RoomType`.
2. Size: width, length and ceiling in cm (3 columns), plus a hint.
3. Mood for this room: a 4-column grid of 8 style tiles, each with an 86px image slot and a serif name. The selected tile has an ink border, a clay offset shadow and an olive ✓ badge. This defaults to the apartment profile. **This is a new optional per-room field**; confirm before adding it to the schema, or hide the section.
4. Budget: a range slider (clay) with a live mono "€ 1,800" readout. This maps to the existing budget per room.

The right sidebar is sticky:
- "Live sketch · 1:50": the room drawn as a rectangle that updates on input.
- "Area": the area in 64px serif, plus a hint.

Actions: Cancel (ghost) and "Save & open planner →" (primary), which saves the room and opens the planner with the whole apartment in view.

### 5. Planner (replaces the old room editor)
The inline room editor screen was **removed**. All plan editing, for one room or the whole apartment, now happens in the full-screen planner. Its full spec is in **`PLANNER.md`**, with the reference in `RaumPlan Editor.html`.

### 6. Design result (`design/[roomId]/page.tsx`, `design-view.tsx`)
- Header: breadcrumb, h1 "Living room · design", meta (m², light, style), a version switcher (a segmented strip of `vN` buttons, latest marked) and "Generate new version ✦" (primary, `generate-design`).
- Progress panel, shown while generating:
  - Title "Drawing up a new version", with the cost note on the right.
  - An 8px striped clay bar showing progress.
  - A mono list of stages: done stages are olive with "✓", the current one is ink with "→" and the rest are mute. Map it to the existing `stage_*` events.
- Left column:
  - A large plan card with furniture footprints: filled rects at .85 opacity with a 1.2px ink stroke and a mono item number centred; rugs are dashed at .55; round items are circles.
  - Hovering shows a tooltip (ink box, sheet text, mono 11.5px, clay offset shadow) with the number, name, W × D cm and price. The item is highlighted with a 3px clay stroke, together with its row in the list, and hovering a row does the same in reverse (keep `plan-item-*` / `item-*`).
  - Below the plan is a legend strip.
  - Furniture list: a table and card hybrid with columns number / colour chip 18px / name + search hint / size / tier chip / price. Rows have dotted dividers and a `#FFF3E0` hover. A section title shows the piece count and total.
- Right sidebar (sticky):
  - **Status box** (`design-status`): a 1.5px ink box holding a large stamp and a serif title + summary.
    - valid: olive stamp "VALID ✓"
    - valid_with_warnings: amber stamp
    - invalid: red stamp "NOT VALID", with the existing banner copy
  - **Problems** (`design-issues`): rows of a label chip (clay "Warn" / red "Error") + text. Add the "room may be too small" hint for `WALKWAY_TOO_NARROW`/`OVERLAP` under 6 m².
  - **Concept**: the model's concept as a margin note.
  - **Palette**: a 72px bar split by share, with % captions.
  - **Budget**: rows for the estimate, model and time, and repairs.

### 7. Library (new)
- Tabs: Furniture / Materials.
- Filters: a row of label chips, multi-select (All, Seating, Tables, Storage, Lighting, Textiles, Mine, Renter-friendly).
- Furniture cards:
  - A 170px image slot.
  - Serif name, then mono dims and tier.
  - Mono price with "+ Add" / "Added ✓" (a toggle button).
  - "Mine" pieces show "owned" and an olive chip. These come from the style profile's must-keep items.
- Materials cards: a 150px colour block with a mono kind tag, then the name and hex. These come from the design's surfaces and palette.
- "+ Add my own piece" opens the existing must-keep form.

### 8. Moodboard (new)
A corkboard-like area:
- 1.5px ink border, `#D9C7A6` with a 7px dot texture, min height 900px.
- Absolutely positioned pins, each slightly rotated and straightening on hover:
  - photo pins (sheet frame, 10px padding, tape, mono caption)
  - typed slips (italic serif 22px + mono source)
  - fabric swatches (120px squares with a pinked top edge via clip-path)
  - palette pins
  - trend cards
- Content is auto-pinned from the design concept, palette, trends and context tips. Later: user uploads and drag to reposition (needs a new table, so confirm first).

### 9. Settings (new, absorbs parts of Profile)
Rows with a 1.5px ink top rule. Each row has a left column (220px) with a serif 30px title and a hint, and the controls on the right (max 620px).
- Profile: name, email.
- Household: adults, kids, WFH days, pet chips. Reuse the profile household data.
- Units & language: segmented controls (cm/in, EUR/BGN/USD, English/Deutsch/Български). Only English exists in next-intl today.
- Designer: toggles for auto-repair, trend research and renter-friendly pieces, plus "Spent this month" rows.
- Danger zone: a red title and a delete-account button.

The **style profile** and **context** pages are not mocked separately. Restyle them with the same parts:
- quiz pairs → large taped cards with a stamp on the chosen one
- budget sliders → the new-room slider
- colour picker → swatch card
- context cards → sidebar sections, rows and margin notes
- daylight per room → ledger rows with chips

---

## Plans (`plan-view/shapes.tsx`)
The pure SVG renderer in `atelier/atelier.js` (`plan()`) shows the intended style:
- floor fill `rgba(255,250,240,.55)`
- walls: 5px ink, round joins, plus a 1px 35%-opacity offset rect for a pencil feel
- windows: glass `#DBE6EE` with an ink centre line
- doors: a sheet gap, a 2.5px leaf and a clay 1.4px dashed `4 3` swing arc
- radiators: clay bars; sockets: clay dots
- dimensions: `#5A6E82` 0.8px lines with 45° ticks and mono 11px labels "300 · N"
- compass: a 14px ring with a clay needle

Keep the geometry code; only change the colours and stroke styles.

## Interactions & motion
- Page content rises: `opacity 0→1, translateY 10px→0`, 450ms `cubic-bezier(.2,.7,.2,1)`, staggered 50ms per section.
- Plan walls draw in: `stroke-dasharray/offset` over 1s ease-out after 150ms. Furniture pops in: scale .85→1 plus fade over 350ms, staggered 60ms, starting at 600ms.
- Cards lift and straighten on hover (250ms). Buttons press (120ms).
- Tooltip follows the cursor at +14px.
- All of this is disabled under `prefers-reduced-motion`.

## Responsive (< 900px)
Sidebars stack below the content. The stepper becomes 2 columns, style tiles 2 columns, and the furniture list hides the number, tier and size columns. On mobile the editor side panel should become a bottom sheet.

## Assets
No images. Every striped box (`.ph`) is a placeholder for a real photo (room renders, product photos, style tiles; `public/quiz/*.svg` can fill the style tiles). Fonts: Instrument Serif, Work Sans and IBM Plex Mono from Google Fonts via `next/font/google`. Use real glyphs (✓ ✦ →) or lucide icons if they're already installed.

## Files
- `RaumPlan Atelier.html`: all 8 screens (hash-routed).
- `atelier/atelier.css`: every style, with tokens as CSS variables at the top.
- `atelier/atelier.js`: the plan SVG renderer, sample furniture, and the interactions (router, plan/list linking, generate progress, editor selection).
- `Redesign Directions.html`: the original direction exploration (1b Atelier was chosen).
- `RaumPlan Editor.html` + `atelier/editor.css` + `atelier/editor.js`: the full-screen planner (2D and 3D). Spec: `PLANNER.md`.
