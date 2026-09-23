import { describe, expect, it } from "vitest";
import { catalogueTable } from "@/domain/design/catalogue";
import { planFacts } from "@/domain/design/room-facts";
import { renderTemplate } from "@/domain/prompts/render";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { PROMPTS } from "@/prompts";
import { buildPrompt, loadPrompt } from "../llm/prompts";

describe("design prompts v2", () => {
  it("render the catalogue into the system prompt and the facts into the user message", async () => {
    const facts = planFacts({ ...SAMPLE_ROOMS[0]!, id: "r1" }, 0);
    const p = await buildPrompt(PROMPTS.designGenerateV2, { roomFacts: JSON.stringify(facts), brief: "{}" });
    const system = renderTemplate(p.system, { catalogue: catalogueTable() });
    expect(system).toContain("- sofa (floor, wall, priority 1): small 180×90 · medium 220×95 · large 260×100, h 85");
    expect(system).toContain("submit_design_plan");
    expect(system).not.toMatch(/\{\{/);
    expect(p.user).toContain('"itemCap":9');
    expect(p.user).toContain('"wallSlots"');
    expect(p.user).not.toContain('"polygon"');
  });

  it("render the patch request", async () => {
    const t = (await loadPrompt(PROMPTS.designRepairV2)).user;
    const text = renderTemplate(t, { issues: "[]", dropped: "none", layout: "[]", errorCount: "2", attempt: "1", maxAttempts: "1" });
    expect(text).toContain("submit_patch");
    expect(text).toContain("breaks 2 rule(s)");
  });

  it("keep v1 on disk", async () => {
    expect((await loadPrompt(PROMPTS.designGenerate)).system).toContain("submit_design");
  });
});
