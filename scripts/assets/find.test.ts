import { describe, expect, it } from "vitest";
import { candidateEntry, isCandidate, slugId, type SketchfabHit } from "./find.ts";

const hit = (over: Partial<SketchfabHit> = {}): SketchfabHit => ({
  uid: "0123456789abcdef0123456789abcdef",
  name: "Oak Wardrobe (Free!)",
  user: { displayName: "Ana Maker", username: "ana" },
  license: { label: "CC Attribution" },
  faceCount: 12000,
  likeCount: 40,
  viewerUrl: "https://sketchfab.com/3d-models/oak-wardrobe-0123456789abcdef0123456789abcdef",
  archives: { glb: { size: 9_000_000 } },
  thumbnails: { images: [{ width: 256, url: "https://media.sketchfab.com/t.jpg" }] },
  ...over,
});

describe("slugId", () => {
  it("makes a manifest id from the category, the title and the author", () => {
    expect(slugId("wardrobe", "Oak Wardrobe (Free!)", "Ana Maker")).toBe("wardrobe_oak_free_ana_maker");
  });

  it("stays within the id pattern whatever the title", () => {
    expect(slugId("sofa", "Ｓｏｆａ —— 沙发 №1", "")).toMatch(/^[a-z0-9][a-z0-9_-]{0,79}$/);
    expect(slugId("sofa", "x".repeat(200), "y".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("isCandidate", () => {
  it("takes a single piece under an allowed licence and a sensible weight", () => {
    expect(isCandidate(hit(), new Set())).toBe(true);
    expect(isCandidate(hit({ license: { label: "CC0 Public Domain" } }), new Set())).toBe(true);
  });

  it("refuses licences that may not be shipped", () => {
    for (const label of ["CC Attribution-NonCommercial", "CC Attribution-ShareAlike", "CC Attribution-NoDerivs", "Standard"]) {
      expect(isCandidate(hit({ license: { label } }), new Set()), label).toBe(false);
    }
    expect(isCandidate(hit({ license: null }), new Set())).toBe(false);
  });

  it("skips what is already in the manifest, and models too heavy or too crude for the budget", () => {
    expect(isCandidate(hit(), new Set([hit().uid]))).toBe(false);
    expect(isCandidate(hit({ faceCount: 900_000 }), new Set())).toBe(false);
    expect(isCandidate(hit({ faceCount: 40 }), new Set())).toBe(false);
    expect(isCandidate(hit({ archives: { glb: { size: 300_000_000 } } }), new Set())).toBe(false);
  });

  it("skips rooms, packs and stylised pieces by their title", () => {
    for (const name of ["Living room scene", "Furniture Pack", "Low Poly Sofa", "Stylized wardrobe", "Cartoon chair"]) {
      expect(isCandidate(hit({ name }), new Set()), name).toBe(false);
    }
  });
});

describe("candidateEntry", () => {
  it("writes the manifest entry with the licence the source reports", () => {
    expect(candidateEntry("wardrobe", hit())).toEqual({
      id: "wardrobe_oak_free_ana_maker",
      kind: "model",
      source: "sketchfab",
      ref: "0123456789abcdef0123456789abcdef",
      title: "Oak Wardrobe (Free!)",
      author: "Ana Maker",
      sourceUrl: "https://sketchfab.com/3d-models/oak-wardrobe-0123456789abcdef0123456789abcdef",
      licence: "cc-by-4.0",
      tags: ["furniture.wardrobe"],
    });
  });
});
