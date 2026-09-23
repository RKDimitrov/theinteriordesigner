import { describe, expect, it } from "vitest";
import { distance } from "../../geometry/vec";
import { DesignContent } from "../../schemas/design";
import { summarizeIssues } from "../../validator";
import { runPipeline } from "../pipeline";
import { resolvePlan } from "../plan";
import { BEDROOM, BEDROOM_PLAN, FIXTURES, HALLWAY, HALLWAY_PLAN, KITCHEN, KITCHEN_PLAN, LIVING, LIVING_KEEP, LIVING_PLAN } from "./fixtures";
import { solveLayout } from "./index";

const run = (f: (typeof FIXTURES)[number]) => runPipeline({ plan: f.plan, room: f.room, mustKeep: f.mustKeep, budgetEur: null, renter: null });

describe("solver on fixture rooms", () => {
  for (const f of FIXTURES) {
    it(`lays out the ${f.name} with zero validator errors`, () => {
      const r = run(f);
      expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(DesignContent.safeParse(r.content).success).toBe(true);
      expect(r.stats.durationMs).toBeLessThan(1000);
    });
  }

  it("is deterministic", () => {
    const f = FIXTURES[2]!;
    expect(run(f).content).toEqual(run(f).content);
  });

  it("cuts the overloaded hallway to its item cap and keeps the must-have bench", () => {
    const r = runPipeline({ plan: HALLWAY_PLAN, room: HALLWAY, mustKeep: [], budgetEur: null, renter: null });
    const ids = r.content.furniture.map((f) => f.id);
    expect(ids).toContain("bench");
    expect(ids.length).toBeLessThanOrEqual(3);
    expect(r.stats.dropped.filter((d) => d.reason === "over_item_cap").map((d) => d.id)).toEqual(expect.arrayContaining(["armchair", "planter"]));
  });

  it("drops the lowest-priority pieces when the hallway is overloaded without a cap", () => {
    const planned = resolvePlan(HALLWAY_PLAN, { mustKeep: [], ceilingHeight: 260 });
    const r = solveLayout({ room: HALLWAY, items: planned.items });
    expect(summarizeIssues(r.issues).errors).toBe(0);
    expect(r.poses.has("bench")).toBe(true);
    expect(r.dropped.length).toBeGreaterThan(0);
    const kept = planned.items.filter((i) => r.poses.has(i.id));
    for (const d of r.dropped) {
      const item = planned.items.find((i) => i.id === d.id)!;
      if (d.reason === "no_space") expect(item.priority).toBeGreaterThanOrEqual(Math.min(...kept.map((k) => k.priority)));
    }
  });

  it("puts the coffee table 45 cm in front of the sofa and keeps the existing sideboard's size", () => {
    const r = runPipeline({ plan: LIVING_PLAN, room: LIVING, mustKeep: LIVING_KEEP, budgetEur: null, renter: null });
    const sofa = r.content.furniture.find((f) => f.id === "sofa")!;
    const table = r.content.furniture.find((f) => f.id === "coffee-table")!;
    expect(distance(sofa, table)).toBeCloseTo(sofa.d / 2 + 45 + table.d / 2, 0);
    expect(r.content.furniture.find((f) => f.existing)).toMatchObject({ w: 160, d: 45, h: 85 });
    expect(r.issues.map((i) => i.code)).not.toContain("MUST_KEEP_MISSING");
  });

  it("puts both nightstands at the head of the double bed", () => {
    const r = runPipeline({ plan: BEDROOM_PLAN, room: BEDROOM, mustKeep: [], budgetEur: null, renter: null });
    const bed = r.content.furniture.find((f) => f.id === "bed")!;
    for (const id of ["nightstand-l", "nightstand-r"]) {
      const n = r.content.furniture.find((f) => f.id === id)!;
      expect(n.rotation).toBe(bed.rotation);
      expect(distance(n, bed)).toBeLessThan(bed.w / 2 + n.w + 40 + bed.d / 2);
    }
  });

  it("seats dining chairs around the table in the kitchen", () => {
    const r = runPipeline({ plan: KITCHEN_PLAN, room: KITCHEN, mustKeep: [], budgetEur: null, renter: null });
    const table = r.content.furniture.find((f) => f.id === "table")!;
    const chairs = r.content.furniture.filter((f) => f.category === "dining_chair");
    expect(chairs).toHaveLength(3);
    for (const c of chairs) expect(distance(c, table)).toBeLessThan(Math.max(table.w, table.d) / 2 + 40);
  });
});
