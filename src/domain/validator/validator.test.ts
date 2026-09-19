import { describe, expect, it } from "vitest";
import { SAMPLE_DESIGN, SAMPLE_DESIGN_BROKEN } from "@/lib/dev/sample-design";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { renterRules } from "../context/renter-rules";
import { rectRoom } from "../room/factory";
import type { DesignContent, FurnitureItem } from "../schemas/design";
import { DesignContent as DesignContentSchema } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import type { RoomShape } from "../schemas/room";
import type { IssueCode } from "../schemas/validation-issue";
import { designCost, summarizeIssues, validateDesign, type ValidateInput } from ".";

const living = SAMPLE_ROOMS[0]!;
const sideboard: MustKeepItem = { id: "keep-1", name: "Grandma's sideboard", category: "sideboard", w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: "r" };

const input = (design: DesignContent, over: Partial<ValidateInput> = {}): ValidateInput => ({
  room: living,
  design,
  mustKeep: [sideboard],
  budgetEur: 4500,
  renter: renterRules("DE", "rent"),
  ...over,
});

const withItem = (id: string, patch: Partial<FurnitureItem>): DesignContent => ({
  ...SAMPLE_DESIGN,
  furniture: SAMPLE_DESIGN.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
});

const addItem = (item: Partial<FurnitureItem> & Pick<FurnitureItem, "id" | "category" | "x" | "y" | "w" | "d">): DesignContent => ({
  ...SAMPLE_DESIGN,
  furniture: [...SAMPLE_DESIGN.furniture, { ...SAMPLE_DESIGN.furniture[0]!, name: item.id, h: 80, rotation: 0, placement: "floor", existing: false, ...item }],
});

const codes = (d: DesignContent, over: Partial<ValidateInput> = {}): IssueCode[] => validateDesign(input(d, over)).map((i) => i.code);
const errors = (d: DesignContent, over: Partial<ValidateInput> = {}) =>
  validateDesign(input(d, over)).filter((i) => i.severity === "error").map((i) => i.code);

describe("sample design", () => {
  it("matches the schema", () => {
    expect(DesignContentSchema.safeParse(SAMPLE_DESIGN).success).toBe(true);
  });

  it("is fully valid in the sample living room", () => {
    const issues = validateDesign(input(SAMPLE_DESIGN));
    expect(issues).toEqual([]);
    expect(summarizeIssues(issues).status).toBe("valid");
  });

  it("the broken sample fails with overlap and door swing errors", () => {
    const c = errors(SAMPLE_DESIGN_BROKEN);
    expect(c).toContain("OVERLAP");
    expect(c).toContain("DOOR_SWING_BLOCKED");
    expect(summarizeIssues(validateDesign(input(SAMPLE_DESIGN_BROKEN))).status).toBe("invalid");
  });

  it("costs what it says", () => {
    const cost = designCost(SAMPLE_DESIGN);
    expect(cost.min).toBeGreaterThan(2000);
    expect(cost.max).toBeLessThanOrEqual(4500);
  });
});

describe("rules", () => {
  it("references: duplicate ids and unknown zone / item / trend ids", () => {
    const d: DesignContent = {
      ...withItem("rug", { zoneId: "nope" }),
      lighting: [...SAMPLE_DESIGN.lighting, { ...SAMPLE_DESIGN.lighting[1]!, id: "x2", itemId: "ghost" }],
      longevity: { ...SAMPLE_DESIGN.longevity, trendItems: ["missing"] },
    };
    expect(codes(d).filter((c) => c === "DANGLING_REFERENCE")).toHaveLength(3);
    expect(codes(withItem("rug", { id: "sofa" }))).toContain("DANGLING_REFERENCE");
  });

  it("bounds: item poking through a wall", () => {
    const issues = validateDesign(input(withItem("plant", { x: 415 })));
    const b = issues.find((i) => i.code === "OUT_OF_BOUNDS")!;
    expect(b.itemIds).toEqual(["plant"]);
    expect(b.hint).toMatch(/inside/);
  });

  it("overlap: reports depth and a move hint; chairs under tables are fine", () => {
    const o = validateDesign(input(withItem("coffee-table", { x: 120 }))).find((i) => i.code === "OVERLAP")!;
    expect(o.itemIds).toEqual(["sofa", "coffee-table"]);
    expect(o.measured).toBeGreaterThan(0);
    expect(o.hint).toMatch(/move 3-seat sofa at least \d+ cm toward/);

    const table = addItem({ id: "table", category: "dining_table", x: 300, y: 190, w: 80, d: 80 });
    const withChair: DesignContent = { ...table, furniture: [...table.furniture, { ...table.furniture.at(-1)!, id: "chair", category: "dining_chair", x: 300, y: 150, w: 45, d: 45 }] };
    expect(codes(withChair)).not.toContain("OVERLAP");
  });

  it("doors: swing and path", () => {
    expect(errors(withItem("plant", { x: 360, y: 330 }))).toContain("DOOR_SWING_BLOCKED");
    expect(errors(withItem("tv-unit", { y: 250 }))).toContain("DOOR_SWING_BLOCKED");
  });

  it("windows: tall items in front of a window, low ones are fine", () => {
    expect(errors(withItem("plant", { x: 300, y: 40 }))).toContain("WINDOW_BLOCKED");
    expect(errors(withItem("plant", { x: 300, y: 40, h: 60 }))).not.toContain("WINDOW_BLOCKED");
  });

  it("radiators: coverage over 30 % is an error, less a warning", () => {
    const big = validateDesign(input(withItem("plant", { x: 120, y: 30, w: 60, d: 40, h: 60 }))).find((i) => i.code === "RADIATOR_BLOCKED")!;
    expect(big.severity).toBe("error");
    const small = validateDesign(input(withItem("plant", { x: 70, y: 25, w: 30, d: 30, h: 60 }))).find((i) => i.code === "RADIATOR_BLOCKED")!;
    expect(small.severity).toBe("warning");
  });

  it("fixed elements: nothing on the chimney", () => {
    const office = SAMPLE_ROOMS[2]!;
    const d = { ...SAMPLE_DESIGN, furniture: [{ ...SAMPLE_DESIGN.furniture[5]!, x: 270, y: 130 }] };
    expect(codes(d, { room: office, mustKeep: [] })).toContain("FIXED_ELEMENT_COLLISION");
  });

  it("wall items: must sit on a wall and not cross a door", () => {
    expect(errors(withItem("art", { x: 50 }))).toContain("WALL_ITEM_NOT_ON_WALL");
    expect(errors(withItem("art", { rotation: 90 }))).toContain("WALL_ITEM_NOT_ON_WALL");
    expect(errors(withItem("art", { x: 345, y: 378.5, rotation: 180, elevation: 100 }))).toContain("WALL_ITEM_NOT_ON_WALL");
  });

  it("walkway: blocking the route to the TV unit", () => {
    const d = addItem({ id: "shelf", category: "bookshelf", x: 330, y: 190, w: 40, d: 200, h: 180 });
    const w = validateDesign(input(d)).filter((i) => i.code === "WALKWAY_TOO_NARROW");
    expect(w.map((i) => i.itemIds[0])).toContain("tv-unit");
  });

  it("walkway: two doors must connect", () => {
    const room: RoomShape = {
      ...rectRoom({ name: "Hall", type: "hallway", widthCm: 300, lengthCm: 300 }),
      openings: [
        { id: "d1", kind: "door", wallIndex: 3, offset: 100, width: 90, height: 200, hinge: "start", swing: "sliding" },
        { id: "d2", kind: "door", wallIndex: 1, offset: 100, width: 90, height: 200, hinge: "start", swing: "sliding" },
      ],
    };
    const wall = { ...SAMPLE_DESIGN.furniture[5]!, id: "wall", category: "storage" as const, x: 150, y: 150, w: 40, d: 300, h: 200, rotation: 0 };
    const d: DesignContent = { ...SAMPLE_DESIGN, furniture: [wall], lighting: [], longevity: { ...SAMPLE_DESIGN.longevity, trendItems: [] } };
    expect(validateDesign({ room, design: d, mustKeep: [], budgetEur: null, renter: null }).map((i) => i.message).join()).toMatch(/connects door d1 and door d2/);
  });

  it("budget: min over is an error, max over by >10 % a warning", () => {
    expect(validateDesign(input(SAMPLE_DESIGN, { budgetEur: 1000 })).find((i) => i.code === "OVER_BUDGET")?.severity).toBe("error");
    expect(validateDesign(input(SAMPLE_DESIGN, { budgetEur: 3500 })).find((i) => i.code === "OVER_BUDGET")?.severity).toBe("warning");
    expect(codes(SAMPLE_DESIGN, { budgetEur: null })).not.toContain("OVER_BUDGET");
  });

  it("longevity: trendy anchors and floors are errors", () => {
    expect(errors(withItem("sofa", { trendRisk: 0.6 }))).toContain("ANCHOR_TREND_RISK");
    const d = { ...SAMPLE_DESIGN, surfaces: [{ ...SAMPLE_DESIGN.surfaces[0]!, trendRisk: 0.8 }] };
    expect(errors(d)).toContain("ANCHOR_TREND_RISK");
  });

  it("renter: irreversible surfaces, drilling in tiled rooms, owners unrestricted", () => {
    const d = { ...SAMPLE_DESIGN, surfaces: [{ ...SAMPLE_DESIGN.surfaces[1]!, renterFriendly: false }] };
    expect(errors(d)).toContain("RENTER_VIOLATION");
    const kitchen = { ...living, type: "kitchen" as const };
    expect(errors(SAMPLE_DESIGN, { room: kitchen })).toContain("RENTER_VIOLATION");
    expect(codes(d, { renter: renterRules("DE", "own") })).not.toContain("RENTER_VIOLATION");
  });

  it("must-keep: missing or resized existing piece", () => {
    expect(errors(withItem("sideboard", { existing: false }))).toContain("MUST_KEEP_MISSING");
    expect(errors(withItem("sideboard", { w: 150 }))).toContain("MUST_KEEP_MISSING");
    expect(errors(withItem("sideboard", { w: 45, d: 160, rotation: 270, x: 30, y: 250 }))).not.toContain("MUST_KEEP_MISSING");
  });

  it("palette: shares far from 60/30/10 warn", () => {
    const d = { ...SAMPLE_DESIGN, palette: { ...SAMPLE_DESIGN.palette, base: { ...SAMPLE_DESIGN.palette.base, share: 0.3 } } };
    expect(validateDesign(input(d)).find((i) => i.code === "PALETTE_SHARES")?.severity).toBe("warning");
  });
});

describe("bed and dining", () => {
  const bedroom: RoomShape = {
    ...rectRoom({ name: "Bed", type: "bedroom", widthCm: 400, lengthCm: 400 }),
    openings: [{ id: "d", kind: "door", wallIndex: 2, offset: 20, width: 80, height: 200, hinge: "start", swing: "sliding" }],
  };
  const bed = { ...SAMPLE_DESIGN.furniture[0]!, id: "bed", name: "Bed", category: "bed" as const, w: 160, d: 200, h: 45, rotation: 0 };
  const base: DesignContent = { ...SAMPLE_DESIGN, furniture: [], lighting: [], longevity: { ...SAMPLE_DESIGN.longevity, trendItems: [] } };
  const run = (furniture: FurnitureItem[], room = bedroom) =>
    validateDesign({ room, design: { ...base, furniture }, mustKeep: [], budgetEur: null, renter: null }).filter((i) => i.code === "BED_ACCESS" || i.code === "DINING_CLEARANCE");

  it("centred double bed is fine", () => {
    expect(run([{ ...bed, x: 200, y: 100 }])).toEqual([]);
  });
  it("double bed against a side wall warns", () => {
    const r = run([{ ...bed, x: 80, y: 100 }]);
    expect(r.map((i) => i.severity)).toEqual(["warning"]);
  });
  it("both sides blocked is an error", () => {
    const r = run([{ ...bed, x: 200, y: 100, w: 380 }].map((b) => ({ ...b, w: 390 })));
    expect(r[0]?.severity).toBe("error");
  });
  it("dining chairs need 75 cm behind them", () => {
    const table = { ...bed, id: "table", name: "Table", category: "dining_table" as const, w: 120, d: 80, h: 75, x: 200, y: 100 };
    const chair = { ...bed, id: "c1", name: "Chair", category: "dining_chair" as const, w: 45, d: 45, h: 80, x: 200, y: 45 };
    expect(run([table, chair])).toHaveLength(1);
    expect(run([{ ...table, y: 200 }, { ...chair, y: 145 }])).toEqual([]);
  });
});
