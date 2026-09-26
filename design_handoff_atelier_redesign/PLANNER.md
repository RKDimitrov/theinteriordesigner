# Handoff: RaumPlan Planner (2D plan + 3D view)

## Overview
A full-screen planner for drawing and furnishing a room or a whole apartment. It **replaces** the old inline room editor (`plan-editor/*`, the `#editor` screen). It uses the Atelier visual language: paper, ink, clay, Instrument Serif, IBM Plex Mono and Work Sans. The AI designer lives inside the planner as a side tab, and its suggestions appear as ghost pieces on the plan.

Repo: `RKDimitrov/theinteriordesigner` (branch `main`). Tokens, fonts and primitives are in `README.md`. Build those first.

## About the design files
`RaumPlan Editor.html`, `atelier/editor.css` and `atelier/editor.js` are **design references in HTML**. They are not production code. Recreate them in the existing Next.js 16, Tailwind v4 and shadcn/Base UI app, following its patterns: server actions, Zod schemas, next-intl strings and the existing validator. Do not ship the HTML or its vanilla JS. The mock's data (pieces, rooms, suggestions) is hard-coded sample data. Wire it to the real models.

## Fidelity
**High fidelity** for the layout, colours, type, borders and panel structure. The **3D view is a CSS-3D sketch** that only shows intent (dollhouse cutaway, camera panel, finishes). Build it for real with three.js / `@react-three/fiber` and keep the same panel UI.

## Standing rules
- Keep existing `data-testid`s where the concept survives (`plan-canvas`, `room-area`, `room-issues`, `opening-*`, `plan-item-*`). Add new ones: `planner-scope-*`, `planner-tool-*`, `planner-layer-*`, `planner-mode-2d`, `planner-mode-3d`, `catalogue-piece-*`, `designer-suggestion-*`.
- The validator stays authoritative. Its warnings and errors show in Designer → Checks.
- All copy goes into `src/messages/en.json` (plus de and bg). Nothing is hard-coded.
- Store geometry in **cm** in the data model. `in` is only a display unit.
- Run `npm run typecheck`, `npm run lint` and `npm test` after each step.

## Suggested order (stop for review after each)
1. **Route and shell**: `/apartments/[id]/planner?room=all|<roomId>`. Build the full-viewport grid, the top bar and the scope switch. Delete the old editor route and redirect it to the planner.
2. **2D canvas**: rulers, grid, pan and zoom, fit-to-scope, rendering walls, openings and dimensions from the existing room and opening models (reuse the geometry in `plan-view/shapes.tsx`).
3. **Furniture on the plan**: symbol renderer, select, drag with snap, the floating toolbar, and the inspector Selection block. Persist through a server action.
4. **Catalogue drawer**: from the Library data, with click-to-place.
5. **Layers panel**.
6. **Drawing tools**: wall, room, door, window, pass-through, radiator, socket, measure, dimension, label, note. Doors, windows, radiators and sockets map to the existing opening model.
7. **Designer tab**: suggestions (ghost layer, accept or skip), "Ask for a change", redesign, and checks. Hook these to the existing generate and repair pipeline.
8. **3D view** (three.js): camera panel, finishes, scene, and click-to-select.

---

## Links into the planner (from `RaumPlan Atelier.html`)
- Apartment overview: **Open planner →** (primary) → `?room=all`. The "Step 01 · Rooms" stepper cell goes to the same place.
- Room card: **Edit plan** → `?room=<roomId>`.
- New room: **Save & open planner →** → `?room=all`. The new room should be placed next to the existing rooms; the user drags it into position.
- Design result: **Edit in planner** → `?room=<roomId>`.
- Planner back arrow (top-left) → apartment overview.

## Layout
Full viewport, no page scroll. `body`: grid with `rows: auto minmax(0,1fr)` and `columns: minmax(0,1fr)`. There is no dotted body texture here; the stage is plain `#FBF6EC`.

Workspace columns in 2D, with the drawer open: `232px 300px minmax(0,1fr) 300px`. With the drawer closed: `232px minmax(0,1fr) 300px`. In 3D: `268px minmax(0,1fr) 300px`.
- ≤1280px: `220 / 260 / 1fr / 270`.
- ≤1100px: `200 / 240 / 1fr / 250`. Hide the logo, project name, units, snap, zoom % and title block.
- Below 1200px the drawer starts closed.

Column separators are `1.5px solid ink`.

### Top bar
Padding `8px 14px`, gap 12px, `border-bottom 1.5px ink`, background `#F4ECDC`. From left to right:
1. Back icon button (34×34, transparent border that turns ink on hover).
2. Logo "RaumPlan" (Instrument Serif italic 26px).
3. Project block, with a 1px `#B8A58A` left rule and 14px padding. "NovApartament" in serif 24px. Below it, mono 11px `#6F6152`: "saved 21:40 · F0", led by a 6px olive dot.
4. **Scope switch**, a tool group: "Whole apartment" (with a layers icon) | "Hol" | "Living room". Build one button per room from the DB.
5. Spacer.
6. **Mode**: "2D plan" | "3D" (cube icon).
7. Undo | Redo.
8. (2D only) Zoom: − | `100%` | + | Fit.
9. (2D only) Units: cm | in.
10. (2D only) "Snap 5" toggle (magnet icon).
11. Spacer.
12. **Designer ✦** (`.btn.p.sm`, clay). It switches to 2D and opens the Designer tab.
13. **Export** (`.btn.sm`).

**Tool group (`.tg`)** is used everywhere: `1.5px ink` border, `#FBF6EC` background. Children are 31px tall with 10px padding and a 1px ink right divider. Labels are mono 500 11.5px, uppercase, `.06em` letter-spacing. The active child is ink-filled with sheet-coloured text. Hover is `#EFE4D0`.

### Left rail (2D): tools
- **Top**: a tool group with Select `V` | Pan `H`, each button flex:1. Below it, a `1px dashed #B8A58A` rule.
- **Sections**: mono 10.5px uppercase headings with `.14em` letter-spacing in `#6F6152`. The number is in clay, and a dotted rule fills the rest of the line. The sections are:
  - "01 Draw the room": Wall (hint "straight"), Room (hint "rectangle")
  - "02 Openings & fixtures": Door D, Window N, Pass-through P, Radiator J, Socket K
  - "03 Furnish": a clay **Catalogue →** button (full width, toggles the drawer) and a row of category label chips (Living, Bedroom, Kitchen, Bath, Plants)
  - "04 Measure & note": Measure M, Dimension I, Room label L, Margin note T
- **Tool row**:
  - Layout: 7px 14px padding, 16px line icon, 14px Work Sans name.
  - Hint text: 11px mute, pushed right.
  - Shortcut: a `kbd` chip in mono 10px, with a 1px `#B8A58A` border on sheet.
  - States: hover `#EFE4D0`; active gets a sheet background and an `inset 3px 0 0 clay` bar.
- **Footer**: a full-width **View in 3D** button above a 1.5px ink top rule.
- The status bar hint changes with the tool (full list in `HINT` in editor.js). The cursor is crosshair for drawing tools and grab for Pan.

### Catalogue drawer (2D)
- **Header**: "Catalogue" in serif 32px. Below it, mono 11px "212 pieces · drawn to scale". A close X on the right.
- **Controls**: a search input (`.inp` with a search icon), then single-select category chips: Living, Bedroom, Dining, Office, Storage, Lighting, Textiles, Plants, Mine.
- **Grid**: 2 columns, gap 12, padding 16. Each card:
  - Box: 1px `#CBB9A0` border, `#FFFAF1` background, 10px padding.
  - Content: the plan symbol at 70px tall, the name in serif 18px, and the size in mono 10.5px "210 × 90 cm".
  - Tag at top-left: "in plan", or "mine" in olive.
  - Hover: ink border with a `3px 3px 0 ink` shadow. Armed: clay border with a clay shadow.
- **Placing**: click a card to arm it; the footer then reads "Click the plan to place: <name>". Clicking the plan places the piece at the cursor, snapped to the grid, and selects it. Clicking the armed card again disarms it. Drag-and-drop is a nice extra.

### Stage (2D)
- **Rulers**: 24px bands in `#F4ECDC` with a 1px ink inner edge and a "cm" corner.
  - Major ticks every 50cm (every 100cm below 70% zoom), each a 1px ink line with a mono 9.5px label.
  - Minor ticks every 10cm, drawn as a `#B8A58A` 6px background gradient.
  - The rulers follow pan and zoom, and 0 is the interior top-left of the apartment.
- **Paper**: two-level grid, 50cm major lines at `rgba(80,110,140,.17)` and 10cm minor lines at `.07`. Aligned to the origin; can be turned off from Layers.
- **Scale**: 1 cm = 1.2 px at 100% zoom. Zoom ranges from 35% to 300%. The wheel zooms around the cursor; the ± buttons zoom around the centre.
- **Panning and selecting**: dragging empty paper pans. A click without movement deselects, or places the armed catalogue piece.
- **Fit**: fits the scope's bounding box plus 85cm padding. Runs on load, on scope change and on the Fit button.
- **Scope dimming**: when a single room is in scope, other rooms' floors drop to 40% opacity and their furniture to 30%, and that furniture can't be clicked.
- **Compass**: top-right, 58px. Circle on sheet with a dashed inner ring. Needle clay north, sheet south, turned to match the apartment's "north offset" (12° in the mock).
- **Title block**: bottom-right, 270px wide, reusing `.titleblock`. Fields: Project / Sheet (scope name) / Scale 1 : 50 / Area (scope total).
- **Status bar**: 28px tall, mono 11px mute. Shows the cursor in cm ("x 212 · y 88 cm"), "Snap 5 cm", "Walls 12 cm" and, right-aligned, the tool hint.
- **Floating selection toolbar**: sits centred 50px above the selected piece. Style: `1.5px ink` border with a `3px 3px 0 ink` shadow. Items: the size readout ("80 × 80", mute), Rotate 45°, Duplicate, **✦ Swap** (clay-dark text) and Remove (red).

### Plan drawing
All strokes use `vector-effect: non-scaling-stroke` so they stay the same thickness at any zoom.
- **Walls**: solid ink fill, 12cm thick, drawn outside the interior line. Openings are cut out with sheet-coloured rects.
- **Window**: three parallel 1.2px lines across the wall thickness, with end caps.
- **Door**: a 2.5px ink leaf at 90°, with a dashed 1.2px swing arc.
- **Radiator**: a sheet rect with 0.8px vertical fins.
- **Socket**: an r5 circle on sheet with two pins.
- **Floor**: `#F3E7D0` with a plank line every 20cm in `#DCC9A8` at 0.7px.
- **Dimensions**: mono 10px ink lines with slash ticks, and labels on a sheet knockout. Overall sizes sit 52cm outside the wall; an opening chain row sits at 30cm. Labels read like "140 window" and "80 door".
- **Room label**: a sheet box with a 1.2px ink border, the name in serif 14, and the area in mono 8.
- **Furniture symbols**, drawn in local coordinates with the back edge at the top (see `sym()` in editor.js):
  - The fill is the piece colour, with a 35%-lighter tint for seats and cushions. The outline is 1.2px ink.
  - Sofa and armchair: back band 18cm, arms 12–14cm, seat divider lines (3 seats if wider than 180cm, otherwise 2).
  - Rug: dashed outline, inner border and fringe ticks.
  - Lamp: circle with a crosshair.
  - Plant: pot circle with 7 leaf ellipses.
  - Bed: pillows plus a folded duvet.
  - Dining: table with 4 chairs.
  - Desk: desk with a chair circle.
  - Wardrobe: rect with a centre line and dashed diagonals.
  - Shelf: rect with dividers every quarter.
  - Tables: round when square in size.
- **Selection**: a clay 1.3px dashed box offset 5cm, four 7cm sheet handles with clay outlines, and a rotate handle (a line up to a clay dot 22cm above).
- **Designer ghosts** (layer "Designer suggestions"): clay dashed outlines with a 10% clay fill and a mono 8px clay-dark label such as "✦ side table". Clicking a ghost opens the Designer tab.

### Right inspector (2D)
- **Tabs**: "Plan" (layers icon) | "Designer ✦". Labels are mono 11px uppercase. The active tab has a sheet background and an `inset 0 -3px 0 clay` underline.
- **Plan tab: Selection block**
  - Heading: "Selected", with the tier on the right.
  - Summary: a 42px swatch, the name in serif 23px, and "€ 290 · 80 × 80 × 78" in mono.
  - Inputs: a 3-column grid of Width, Depth and Height, then a second row of From W, From N and Turn (°). They update the plan live.
  - Actions: **✦ Swap piece** (primary sm) and Remove (ghost destructive).
  - Empty state: a cube icon, "Click something to edit it" in serif 23px, and three hint rows.
- **Plan tab: Layers**
  - Heading: "Layers" with an "N / 10" count.
  - Rows: 16px icon, name, eye toggle on the right. Hidden rows turn mute with the name struck through.
  - The layers are Walls (BASE), Doors & windows, Furniture, **Designer suggestions** (in clay-dark), Room labels, Dimensions, Electrical & heating, Floor finish, Grid, and Reference photo (off by default; clicking it asks for an upload to trace over).
- **Designer tab**
  1. The concept as a margin note, italic serif 21px.
  2. **On the plan**: suggestion rows, each with the name (serif 21), the reason (12.5px mute), and Accept (primary sm) / Skip (ghost sm). Accept turns the ghost into a real piece and selects it. Skip removes it.
  3. **Ask for a change**: a textarea (1.5px ink border, clay offset shadow on focus) and quick chips (Fill empty space, Wider walkways, Renter-friendly). Then a "Keep pieces I placed" toggle (`.sw-t`, on by default) and **✦ Redesign this room** (primary, full width), with the cost hint "About a minute · ~€ 0.15". This runs the existing generate pipeline, keeping locked pieces, and reuses the progress UI from the Design page.
  4. **Checks**: the validator's issues, each a `.issue` row with a clay "Warn" or red "Error" label.

### 3D mode
- **Left: Camera panel**
  - Title "Camera" in serif 30px with a camera icon.
  - A side-view diagram on blueprint grid: ground line, a dashed ceiling box, the camera at its eye height, and a clay sight line.
  - Stepper rows: a mono label, a `−` value `+` tool group, and preset chips. The rows are:
    - Eye height, in steps of 10cm, with chips 120 / 165 / 250 / 400
    - Rotation, in steps of 15°, with chips 0 / 90 / 180 / 270
    - Tilt, in steps of 5°, with chips Plan / Angled / Level
    - Lens, with chips Wide 24 mm / Normal 35 mm / Tele 85 mm
    - Distance, with chips Near / Room / Far
  - **Views**: a 2×2 grid of presets, each with the name in serif 19 and a mono sub-line. The presets are Eye level, Architect (the default), Bird's eye and Plan view. The active preset gets a clay offset shadow.
  - **Saved views**: a list with a thumbnail, name and mono meta, plus "Save this view" (ghost).
  - Hint at the bottom: "Drag the room to orbit and scroll to move closer. This panel follows the view."
- **Stage**:
  - Background: a vertical gradient from `--sky` (tinted by time of day) to `#E3D5BD`.
  - Dollhouse: walls facing the camera fold away; in three.js, hide a wall when its normal faces the camera.
  - Walls are 250cm, lime wash `#E9E1D2` with ink edges. Windows have walnut frames with a mullion. Doors are `#B58A60`.
  - Furniture is simple extruded boxes in the piece colours, with ink edge lines. Later, real models from the catalogue.
  - Drag to orbit, wheel to zoom. Clicking a piece selects it and opens the Selection tab; clicking empty space deselects.
  - Top centre: Screenshot (saves to the moodboard) and Walkthrough (eye-level first-person, WASD). Compass at top-right; status bar at the bottom.
  - Scope applies here too: all rooms together, or only the chosen room.
- **Right tabs**: Selection | **Finishes** (default) | Scene.
  - Finishes, floor: Oiled oak, Pale ash, Terracotta and Micro-cement.
  - Finishes, walls: Lime wash, Warm white, Clay and Sage.
  - Finishes, textiles: the palette strip from the Designer.
  - Swatches are 4 squares per row; the active one has a clay offset shadow and an ink outline. Picking one updates the room straight away and should persist on the room.
  - Scene: a time-of-day slider (07–21), plus toggles for ceiling lights, piece labels and folding away near walls.

## Keyboard
- V, H, W, R, D, N, P, J, K, M, I, L, T choose tools.
- `3` toggles 2D/3D.
- Delete or Backspace removes the selected piece; Esc deselects.
- Ignore all keys while an input is focused.

## State
- `scope: 'all' | roomId`, synced to `?room=` in the URL.
- `mode: '2d' | '3d'`.
- `tool` and `armedCatalogueItem`.
- `zoom`, `pan{x,y}`, `snap`, `units`.
- `selectedId`.
- `hiddenLayers: Set`.
- `camera {eyeHeight, rotation, tilt, lens, distance}` and `savedViews[]`.
- `finishes {floor, walls}` per room.
- `suggestions[]` from the latest design version.
- Undo/redo history of plan edits.
- **Data needed**: apartment rooms with position and size in apartment coordinates. This is **new**: rooms currently have no x/y, so add `originX`/`originY` in cm and confirm the migration first. Also openings, placed items with x, y, rotation and a `locked` flag, catalogue items, and validator results.

## Files
- `RaumPlan Editor.html`: the planner reference (open `?room=all`, `?room=hol` or `?room=living`).
- `atelier/editor.css`: planner styles (it builds on `atelier/atelier.css`).
- `atelier/editor.js`: sample data, the symbol renderer `sym()`, rulers, pan and zoom, selection and drag, layers, catalogue placing, the Designer tab and the CSS-3D sketch.
- `RaumPlan Atelier.html`: the other screens, now linking into the planner.

---

## Layout setting (Simple / Balanced / Detailed)
**Settings → Planner → Layout** stores the user's choice on their profile. The mock uses `localStorage['rp-planner-view2']` with the values `calm`, `quiet` and `full`. The planner reads it on load and sets a body class: `calm` or `quiet` (Detailed has no class). See `editor.css` sections "simple view" and "balanced view".
- **Balanced (default):** all content, with quiet chrome.
  - Lines: 1px `#DDD0BA` hairlines, no offset shadows.
  - Text: buttons, tabs and chips in sans 13px, normal case.
  - Active items: a `#ECE0CB` fill. Dark ink only for 2D/3D, Select/Pan, Export and View in 3D.
  - Canvas: a lighter grid, no title block, and the status bar as a floating chip at the bottom-left.
  - Selection block: hidden when nothing is selected.
- **Simple:** hides `.adv` items.
  - Top bar: the zoom group moves to a floating +/−/fit control on the canvas.
  - Tools: the extra tools go behind "More tools". Shortcut letters and hint text are hidden.
  - Inspector: the selection shows only W, D and Turn. Layers shows 5, with "+ All layers" for the rest.
  - 3D: camera steppers go behind "Fine-tune camera", and the Scene tab is hidden.
- **Detailed:** everything, with the original heavier Atelier chrome.
- **Settings → Planner → "3D opens with":** Current room / All rooms. Not wired in the mock; implement it.

## 3D rooms in view
- The Camera panel starts with a **Rooms in view** checklist: one row per room with a checkbox, the name, m², and an "only" action on hover.
- 3D starts from the 2D scope: all rooms, or the chosen room. The top-bar scope switch shows "Whole apartment" when every room is ticked, and the single room when only one is.

## Walkthrough
- **Starting:** from 3D → Walkthrough. The side panels hide and the stage fills the window.
- **Mouse:** the pointer is captured with the **Pointer Lock API** (`requestPointerLock` on the canvas). Mouse movement turns the view: yaw 0.15°/px, pitch 0.12°/px, clamped to ±35°. **Esc** releases the pointer; listen for `pointerlockchange` and exit the walkthrough when the lock ends. If the lock fails or is released, drag-to-look and the on-screen pad still work, and clicking the view takes control again.
- **Movement:** W/S forward and back, A/D sideways, arrow keys to turn at 80°/s. Walking speed is 150 cm/s and eye height is the camera's eye height (165 cm).
- **Collision:** the player stays inside room interiors, 22 cm from the walls. Doorways only let you through while their door is **open**. In the real build, also collide with furniture bounding boxes.
- **Doors:** a leaf hinged in 3D that swings 90° over 0.8s, opened by clicking it, pressing E within 1.9 m or using the "Open / close door" button. Door state is shared between orbit and walk.
- **Walls:** split into segments around openings, so doors are real gaps and windows are glass.
- **On-screen UI:**
  - a location chip showing the current room
  - "Exit walkthrough"
  - a crosshair in the centre
  - a hint that changes depending on whether the pointer is captured
  - an arrow pad and the door button, both hidden while the pointer is captured

## Real 3D (models, textures, lighting)
This is doable in a web app. Recommended stack:
- **Renderer:** three.js via `@react-three/fiber` and `@react-three/drei`, loaded only on the planner route (`next/dynamic`, `ssr:false`).
- **Furniture models:**
  - **Format:** glTF/GLB, compressed with Meshopt or Draco, one model per catalogue item. Store the model URL, real dimensions and pivot point on the catalogue record, and scale to the stored cm.
  - **Sources:** CC0 libraries (Poly Haven, Kenney), licensed marketplace models, or retailer 3D feeds where the licence allows. The plan symbol stays the 2D representation.
  - **Missing models:** fall back to the current extruded box.
- **Textures:** PBR materials (albedo, normal, roughness, AO) as KTX2/Basis. The floor and wall finishes from the Finishes tab map to materials, e.g. Poly Haven CC0 wood, plaster and tile sets. Use tiling at real-world scale (UVs in metres).
- **Lighting:**
  - HDRI environment for ambient light and reflections.
  - One directional "sun" whose angle comes from the time-of-day slider, the apartment's north offset and its latitude. Shadows via cascaded or contact shadows.
  - Window light through `RectAreaLight`, and lamp pieces as point lights with a warm 2700 K colour.
  - Tone mapping: ACES or AgX.
- **Quality tiers:**
  - "Interactive" by default: baked AO, 1 shadow-casting light.
  - "Render" (Screenshot button): progressive path tracing with `three-gpu-pathtracer` for a photoreal still that is saved to the moodboard.
- **Performance:**
  - Lazy-load models per visible room.
  - Instancing for repeated items; LODs for heavy models.
  - Cap device pixel ratio at 1.5; turn shadows off on low-end GPUs.
  - Target 60 fps in orbit and 30+ in walkthrough on a mid-range laptop.
- **Mobile:** orbit plus the on-screen pad; no pointer lock.
