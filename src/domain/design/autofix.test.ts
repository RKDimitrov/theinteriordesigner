import { describe, expect, it } from "vitest";
import { SAMPLE_DESIGN, SAMPLE_DESIGN_BROKEN } from "@/lib/dev/sample-design";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import type { DesignContent, FurnitureItem } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import { summarizeIssues, validateDesign } from "../validator";
import { autofix } from "./autofix";

const room = SAMPLE_ROOMS[0]!;
const mustKeep: MustKeepItem[] = [{ id: "keep-1", name: "Grandma's sideboard", category: "sideboard", w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: null }];
const validate = (design: DesignContent) => validateDesign({ room, design, mustKeep, budgetEur: null, renter: null });
const edit = (patch: Record<string, Partial<FurnitureItem>>, extra: FurnitureItem[] = []): DesignContent => ({
  ...SAMPLE_DESIGN,
  furniture: [...SAMPLE_DESIGN.furniture.map((f) => (patch[f.id] ? { ...f, ...patch[f.id] } : f)), ...extra],
});
const codes = (c: DesignContent) => validate(c).filter((i) => i.severity === "error").map((i) => i.code);

describe("autofix", () => {
  it("starts from a valid sample", () => {
    expect(codes(SAMPLE_DESIGN)).toEqual([]);
  });

  it("separates overlapping pieces and clears the door swing", () => {
    expect(codes(SAMPLE_DESIGN_BROKEN)).toEqual(expect.arrayContaining(["OVERLAP", "DOOR_SWING_BLOCKED"]));
    const r = autofix(SAMPLE_DESIGN_BROKEN, room, validate);
    expect(summarizeIssues(r.issues).errors).toBe(0);
    expect(r.log.some((l) => l.startsWith("separated from"))).toBe(true);
    expect(r.log.some((l) => l.startsWith("cleared door"))).toBe(true);
    expect(r.dropped).toEqual([]);
  });

  it("snaps a wall item back onto its wall", () => {
    const broken = edit({ art: { x: 11.5 } });
    expect(codes(broken)).toContain("WALL_ITEM_NOT_ON_WALL");
    const r = autofix(broken, room, validate);
    expect(codes(r.content)).toEqual([]);
    expect(r.content.furniture.find((f) => f.id === "art")!.x).toBeCloseTo(1.5);
  });

  it("pulls a piece back inside the room", () => {
    const broken = edit({ sofa: { x: 30 } });
    expect(codes(broken)).toContain("OUT_OF_BOUNDS");
    const r = autofix(broken, room, validate);
    expect(codes(r.content)).toEqual([]);
    expect(r.log.some((l) => l.startsWith("pulled inside"))).toBe(true);
  });

  it("slides a tall piece out of a window and radiator zone", () => {
    const broken = edit({ plant: { x: 120, y: 30 } });
    expect(codes(broken)).toEqual(expect.arrayContaining(["WINDOW_BLOCKED"]));
    const r = autofix(broken, room, validate);
    expect(codes(r.content)).toEqual([]);
  });

  it("drops the lowest-priority offender when moving cannot help, never an existing piece", () => {
    const hopeless: FurnitureItem = { ...SAMPLE_DESIGN.furniture[0]!, id: "giant", name: "Giant wardrobe", category: "wardrobe", w: 400, d: 360, x: 210, y: 190, rotation: 0, priority: 3 };
    const r = autofix(edit({}, [hopeless]), room, validate);
    expect(r.dropped.map((d) => d.id)).toEqual(["giant"]);
    expect(summarizeIssues(r.issues).errors).toBe(0);
    expect(r.content.furniture.some((f) => f.existing)).toBe(true);
    expect(r.log.at(-1)).toMatch(/removed Giant wardrobe/);
  });
});
