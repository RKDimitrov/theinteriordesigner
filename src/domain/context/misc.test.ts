import { describe, expect, it } from "vitest";
import { estimateCostEur } from "../llm/cost";
import { renderTemplate } from "../prompts/render";
import { assembleContext } from "./assemble";
import { renterRules } from "./renter-rules";

describe("renterRules", () => {
  it("gives owners no restrictions", () => {
    expect(renterRules("DE", "own")).toMatchObject({ applies: false, drilling: "free", rules: [] });
  });
  it("uses the German ruleset for DE renters", () => {
    const r = renterRules("de", "rent");
    expect(r.applies).toBe(true);
    expect(r.country).toBe("DE");
    expect(r.rules.map((x) => x.id)).toContain("no-tile-drilling");
  });
  it("falls back to default rules elsewhere", () => {
    expect(renterRules("BG", "rent").rules.map((x) => x.id)).toContain("minimal-drilling");
  });
});

describe("estimateCostEur", () => {
  it("prices tokens, cache and web searches", () => {
    const eur = estimateCostEur("claude-sonnet-5", {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 1_000_000,
      webSearchRequests: 5,
    });
    // USD: 2 + 1 + 0.2 + 0.05 = 3.25 → EUR 2.99
    expect(eur).toBeCloseTo(2.99, 2);
  });
  it("returns 0 for unknown models", () => {
    expect(estimateCostEur("unknown", { inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, webSearchRequests: 0 })).toBe(0);
  });
});

describe("renderTemplate", () => {
  it("fills placeholders", () => {
    expect(renderTemplate("Hi {{ name }} from {{city}}", { name: "A", city: "B" })).toBe("Hi A from B");
  });
  it("throws on missing or unused variables", () => {
    expect(() => renderTemplate("{{a}}", {})).toThrow(/missing/);
    expect(() => renderTemplate("x", { a: "1" })).toThrow(/not used/);
  });
});

describe("assembleContext", () => {
  it("lists warnings for missing parts", () => {
    const c = assembleContext({
      apartmentId: "a",
      now: new Date("2026-09-20T10:00:00Z"),
      location: null,
      climate: null,
      rooms: [],
      renter: renterRules("DE", "rent"),
      topStyles: null,
      trends: null,
    });
    expect(c.warnings).toEqual(["noLocation", "noClimate", "noRooms", "noProfile", "noTrends"]);
    expect(c.generatedAt).toBe("2026-09-20T10:00:00.000Z");
  });
});
