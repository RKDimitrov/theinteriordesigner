import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogueTable } from "@/domain/design/catalogue";
import { planFacts, roomFacts } from "@/domain/design/room-facts";
import { SAMPLE_DESIGN } from "@/lib/dev/sample-design";
import { SAMPLE_PLAN } from "@/lib/dev/sample-plan";
import { SAMPLE_ROOMS } from "@/lib/dev/samples";
import { PROMPTS } from "@/prompts";
import { SUBMIT_PATCH_TOOL, SUBMIT_PLAN_TOOL } from "./plan-loop";
import { SUBMIT_DESIGN_TOOL } from "./repair-loop";

/**
 * Offline cost guard: ~3.5 characters per token for JSON and English prose.
 * It protects the budget of one room generation, which is what the new loop
 * is for. No API call, so it runs in CI.
 */
const tokens = (s: string) => Math.round(s.length / 3.5);
const json = (v: unknown) => tokens(JSON.stringify(v));
const room = { ...SAMPLE_ROOMS[0]!, id: "r1" };
const systemOf = async (file: string, vars: Readonly<Record<string, string>> = {}) => {
  const raw = (await readFile(path.join(process.cwd(), "src", "prompts", file), "utf8")).split("---user---")[0]!;
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), raw);
};

describe("cost budget", () => {
  it("keeps one generation under its token budget", async () => {
    const system = tokens(await systemOf(PROMPTS.designGenerateV2.file, { catalogue: catalogueTable() }));
    const request = json(SUBMIT_PLAN_TOOL.input_schema) + json(SUBMIT_PATCH_TOOL.input_schema) + system + json(planFacts(room, 0));
    // Input of the first (and usually only) call, without the brief.
    expect(request).toBeLessThan(7000);
    // What the model writes for one room.
    expect(json(SAMPLE_PLAN)).toBeLessThan(2200);
  });

  it("asks for less than the v1 design schema and facts", async () => {
    expect(json(SUBMIT_PLAN_TOOL.input_schema)).toBeLessThan(json(SUBMIT_DESIGN_TOOL.input_schema));
    expect(json(planFacts(room, 0))).toBeLessThan(json(roomFacts(room, 0)));
    // A repair is a patch, not a whole design: an order of magnitude less output.
    expect(json(SUBMIT_PATCH_TOOL.input_schema)).toBeLessThan(1000);
    expect(json({ move: [{ id: "sofa", wallIndex: 1 }], resize: [], remove: ["plant"], add: [] })).toBeLessThan(json(SAMPLE_DESIGN) / 20);
  });

  it("never asks the model for geometry", () => {
    const schema = JSON.stringify(SUBMIT_PLAN_TOOL.input_schema);
    for (const key of ['"x"', '"y"', '"rotation"', '"elevation"', '"w"', '"d"', '"productQuery"']) expect(schema).not.toContain(key);
  });
});
