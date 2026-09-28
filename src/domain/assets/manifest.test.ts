import { describe, expect, it } from "vitest";
import hdris from "../../../assets/manifest/hdris.json";
import models from "../../../assets/manifest/models.json";
import textures from "../../../assets/manifest/textures.json";
import { Manifest, manifestIssues, type ManifestEntry } from "./manifest.ts";

const chair: ManifestEntry = {
  id: "modern_arm_chair_01",
  kind: "model",
  source: "polyhaven",
  ref: "modern_arm_chair_01",
  title: "Modern Arm Chair 01",
  author: "Vibrant Nordic",
  sourceUrl: "https://polyhaven.com/a/modern_arm_chair_01",
  licence: "cc0",
  tags: ["furniture.armchair"],
};

describe("Manifest", () => {
  it("accepts a well-formed entry", () => {
    expect(Manifest.safeParse([chair]).success).toBe(true);
  });

  it("refuses licences that forbid commercial use, changes or shipping the file", () => {
    for (const licence of ["cc-by-nc-4.0", "cc-by-nd-4.0", "cc-by-sa-4.0", "royalty-free"]) {
      expect(Manifest.safeParse([{ ...chair, licence }]).success, licence).toBe(false);
    }
  });

  it("refuses ids that are not safe file names", () => {
    for (const id of ["Chair", "a b", "../x", ""]) expect(Manifest.safeParse([{ ...chair, id }]).success, id).toBe(false);
  });

  it("needs a tile size for textures from sources that do not report one", () => {
    const tex = { ...chair, id: "plaster", kind: "texture", source: "url", ref: "https://example.com/p.zip" } as const;
    expect(Manifest.safeParse([tex]).success).toBe(false);
    expect(Manifest.safeParse([{ ...tex, tileCm: 200 }]).success).toBe(true);
  });
});

describe("manifestIssues", () => {
  it("reports duplicate ids", () => {
    expect(manifestIssues([chair, chair])).toEqual(["duplicate id modern_arm_chair_01"]);
  });

  it("needs an author for attribution licences", () => {
    expect(manifestIssues([{ ...chair, licence: "cc-by-4.0", author: "" }])).toEqual(["modern_arm_chair_01: CC-BY needs an author"]);
  });
});

describe("the committed manifest", () => {
  const all = [...models, ...textures, ...hdris];

  it("parses and has no issues", () => {
    const parsed = Manifest.parse(all);
    expect(manifestIssues(parsed)).toEqual([]);
  });

  it("keeps each kind in its own file", () => {
    expect(models.every((e) => e.kind === "model")).toBe(true);
    expect(textures.every((e) => e.kind === "texture")).toBe(true);
    expect(Manifest.parse(hdris).every((e) => e.kind === "hdri")).toBe(true);
  });
});
