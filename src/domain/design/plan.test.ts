import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SAMPLE_PLAN } from "@/lib/dev/sample-plan";
import { DesignContent, DesignPlanInput, type PlanItem } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import { applyPatch, type Pose, productQuery, resolvePlan, toDesignContent } from "./plan";

const sideboard: MustKeepItem = { id: "keep-1", name: "Grandma's sideboard", category: "sideboard", w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: "r" };
const opts = { mustKeep: [sideboard], ceilingHeight: 280 };
const bounds = { room: { x: 0, y: 0, w: 420, d: 380 }, fallback: { x: 0, y: 40, w: 420, d: 250 } };
const item = (id: string) => SAMPLE_PLAN.items.find((i) => i.id === id)!;

describe("DesignPlanInput", () => {
  it("accepts the sample plan and converts to a JSON schema", () => {
    expect(DesignPlanInput.safeParse(SAMPLE_PLAN).success).toBe(true);
    const schema = z.toJSONSchema(DesignPlanInput, { io: "input" });
    expect(Object.keys(schema.properties ?? {})).toContain("items");
    expect(JSON.stringify(schema)).not.toContain('"x"');
  });

  it("rejects long rationales", () => {
    const long = { ...SAMPLE_PLAN, items: [{ ...item("sofa"), rationale: "x".repeat(161) }] };
    expect(DesignPlanInput.safeParse(long).success).toBe(false);
  });
});

describe("resolvePlan", () => {
  const planned = resolvePlan(SAMPLE_PLAN, opts);
  const get = (id: string) => planned.items.find((i) => i.id === id)!;

  it("takes dimensions from the catalogue and must-keep list", () => {
    expect(get("sofa")).toMatchObject({ w: 220, d: 95, h: 85, elevation: 0 });
    expect(get("sideboard")).toMatchObject({ w: 160, d: 45, h: 85, priority: 1 });
    expect(get("art")).toMatchObject({ w: 100, d: 3, h: 70, elevation: 115, placement: "wall" });
    expect(planned.items).toHaveLength(SAMPLE_PLAN.items.length);
  });

  it("adds must-keep pieces the model forgot", () => {
    const p = resolvePlan({ ...SAMPLE_PLAN, items: SAMPLE_PLAN.items.filter((i) => i.id !== "sideboard") }, opts);
    const kept = p.items.find((i) => i.existing)!;
    expect(kept).toMatchObject({ id: "keep-keep-1", category: "sideboard", w: 160, d: 45, h: 85, priority: 1, price: { min: 0, max: 0 } });
  });

  it("repairs broken relations", () => {
    const nightstand: PlanItem = { ...item("plant"), id: "ns", category: "nightstand", intent: { anchor: "beside" } };
    const table: PlanItem = { ...item("coffee-table"), intent: { anchor: "front_of", relativeTo: "ghost" } };
    const a: PlanItem = { ...item("plant"), id: "a", intent: { anchor: "beside", relativeTo: "b" } };
    const b: PlanItem = { ...item("plant"), id: "b", intent: { anchor: "beside", relativeTo: "a" } };
    const p = resolvePlan({ ...SAMPLE_PLAN, items: [item("sofa"), table, nightstand, a, b] }, { mustKeep: [], ceilingHeight: 250 });
    const byId = new Map(p.items.map((i) => [i.id, i]));
    expect(byId.get("coffee-table")!.intent).toMatchObject({ anchor: "front_of", relativeTo: "sofa" });
    expect(byId.get("ns")!.intent.anchor).toBe("free");
    const cyclic = [byId.get("a")!.intent, byId.get("b")!.intent];
    expect(cyclic.some((i) => i.anchor === "free")).toBe(true);
  });
});

describe("toDesignContent", () => {
  const planned = resolvePlan(SAMPLE_PLAN, opts);
  const poses = new Map<string, Pose>(planned.items.map((i, n) => [i.id, { x: 60 + n * 10, y: 200, rotation: 270 }]));

  it("builds a valid stored design with deterministic product queries", () => {
    const content = toDesignContent(planned, poses, bounds);
    expect(DesignContent.safeParse(content).success).toBe(true);
    const sofa = content.furniture.find((f) => f.id === "sofa")!;
    expect(sofa).toMatchObject({ x: 60, y: 200, rotation: 270, w: 220, sizeClass: "medium", priority: 1, intent: { anchor: "wall", wallIndex: 3 } });
    expect(sofa.productQuery).toBe("3-seat sofa, Wool blend, oak legs, 220 × 95 cm");
    expect(content.furniture.find((f) => f.id === "sideboard")!.productQuery).toBeUndefined();
    expect(productQuery({ name: "Desk", material: "Oak", w: 120, d: 70 })).toBe("Desk, Oak, 120 × 70 cm");
  });

  it("wraps zones around their items and falls back for empty zones", () => {
    const content = toDesignContent(planned, poses, bounds);
    const relax = content.zones.find((z) => z.id === "relax")!.rect;
    expect(relax.x).toBe(0);
    expect(relax.y).toBeGreaterThan(0);
    expect(content.zones.find((z) => z.id === "media")!.rect).toEqual({ x: 40, y: 100, w: 80, d: 200 });
  });

  it("removes dropped items and every reference to them", () => {
    const partial = new Map(poses);
    partial.delete("floor-lamp");
    partial.delete("art");
    partial.delete("tv-unit");
    const content = toDesignContent(planned, partial, bounds);
    expect(content.furniture.map((f) => f.id)).not.toContain("floor-lamp");
    expect(content.lighting.map((l) => l.id)).not.toContain("reading");
    expect(content.longevity.trendItems).toEqual(["cushions"]);
    expect(content.zones.find((z) => z.id === "media")!.rect).toEqual(bounds.fallback);
  });
});

describe("applyPatch", () => {
  it("moves, resizes, removes and adds", () => {
    const patched = applyPatch(SAMPLE_PLAN, {
      move: [
        { id: "tv-unit", wallIndex: 0 },
        { id: "coffee-table", relativeTo: "sideboard" },
        { id: "plant", anchor: "beside", relativeTo: "sofa" },
      ],
      resize: [{ id: "sofa", sizeClass: "small" }],
      remove: ["art", "ghost"],
      add: [{ ...item("plant"), id: "plant-2" }, { ...item("plant"), id: "sofa" }],
    });
    const get = (id: string) => patched.items.find((i) => i.id === id)!;
    expect(get("tv-unit").intent).toMatchObject({ anchor: "wall", wallIndex: 0, zoneId: "media" });
    expect(get("coffee-table").intent).toMatchObject({ anchor: "front_of", relativeTo: "sideboard" });
    expect(get("plant").intent).toEqual({ anchor: "beside", relativeTo: "sofa" });
    expect(get("sofa").sizeClass).toBe("small");
    expect(get("sofa").category).toBe("sofa");
    expect(patched.items.map((i) => i.id)).not.toContain("art");
    expect(patched.items.filter((i) => i.id === "plant-2")).toHaveLength(1);
    expect(patched.items).toHaveLength(SAMPLE_PLAN.items.length);
  });

  it("turns a relative piece into a wall piece when given only a wall", () => {
    const patched = applyPatch(SAMPLE_PLAN, { move: [{ id: "coffee-table", wallIndex: 2 }], resize: [], remove: [], add: [] });
    expect(patched.items.find((i) => i.id === "coffee-table")!.intent).toEqual({ anchor: "wall", wallIndex: 2, zoneId: "relax" });
  });
});
