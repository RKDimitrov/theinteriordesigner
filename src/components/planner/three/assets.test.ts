import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetPaths, Catalogue, MODEL_BUDGET_BYTES } from "@/domain/assets/catalogue";
import { isAttribution } from "@/domain/assets/licence";
import { MODEL_TUNING } from "@/domain/assets/model-tuning";
import { CATALOGUE } from "@/domain/design/catalogue";
import type { FurnitureCategory } from "@/domain/schemas/design";
import CATALOGUE_JSON from "./asset-catalogue.json";
import { HDRI_IDS, MODEL_IDS, TEXTURE_IDS } from "./asset-ids";
import { MATERIALS } from "@/domain/materials/library";
import { StyleKey } from "@/domain/schemas/profile";
import { ASSET_CATALOGUE, BUILT_CATEGORIES, BUILT_MODEL, MODEL_SIZE, modelPicture, nativeFootprint, PIECE_MODELS, type PieceModel, pieceModel, TEXTURE_CM, type TextureId } from "./assets";

describe("pieceModel", () => {
  it("keeps the model the user chose when it belongs to the category", () => {
    const m = pieceModel("sofa", "glam_velvet_sofa", 200, 90, 80, null);
    expect(m !== "built" && m.id).toBe("glam_velvet_sofa");
  });

  it("ignores a chosen model of another category and picks by proportions", () => {
    const plants = PIECE_MODELS.plant.map((m) => m.id);
    const tall = pieceModel("plant", "sofa_02", 45, 45, 120, null);
    const bushy = pieceModel("plant", undefined, 70, 70, 85, null);
    if (tall === "built" || bushy === "built") throw new Error("plants have models");
    expect(plants).toContain(tall.id);
    expect(plants).toContain(bushy.id);
    // The tall piece gets the slimmer model.
    const slimness = (m: PieceModel) => nativeFootprint(m)[1] / nativeFootprint(m)[0];
    expect(slimness(tall)).toBeGreaterThan(slimness(bushy));
  });

  it("leans towards the profile's style", () => {
    const m = pieceModel("dining_chair", undefined, 45, 50, 90, { mediterranean: 1 });
    expect(m !== "built" && m.styles).toContain("mediterranean");
  });

  it("builds in code on request, or when a category has no model", () => {
    expect(pieceModel("sofa", BUILT_MODEL, 200, 90, 80, null)).toBe(BUILT_MODEL);
    expect(pieceModel("rug", undefined, 200, 140, 1, null)).toBe(BUILT_MODEL);
    // A bookshelf model squashed into a low wide piece would look wrong.
    expect(pieceModel("bookshelf", undefined, 300, 30, 40, null)).toBe(BUILT_MODEL);
    // Armchairs have no code-built version, so "built" falls back to a model.
    expect(pieceModel("armchair", BUILT_MODEL, 80, 80, 80, null)).not.toBe(BUILT_MODEL);
  });
});

describe("nativeFootprint", () => {
  it("swaps width and depth for a quarter turn", () => {
    const [w, h, d] = MODEL_SIZE["modern_coffee_table_01"];
    expect(nativeFootprint({ id: "modern_coffee_table_01", turn: 90 })).toEqual([d, h, w]);
    expect(nativeFootprint({ id: "modern_coffee_table_01" })).toEqual([w, h, d]);
  });
});

describe("PIECE_MODELS", () => {
  const modelled = Object.entries(PIECE_MODELS) as [FurnitureCategory, readonly PieceModel[]][];

  it.each(modelled.filter(([, m]) => m.length > 0))("%s models face the way the catalogue piece does", (category, models) => {
    const [cw, cd] = CATALOGUE[category].sizes.medium;
    // Only clearly oblong pieces have a long side to get wrong.
    if (Math.max(cw, cd) / Math.min(cw, cd) < 1.2) return;
    for (const v of models) {
      const [w, , d] = nativeFootprint(v);
      // A round or square model has no long side either.
      if (Math.max(w, d) / Math.min(w, d) < 1.2) continue;
      expect(w > d, `${v.id} long side`).toBe(cw > cd);
    }
  });

  it("gives every category a model or a version built in code", () => {
    for (const [c, m] of modelled) expect(m.length > 0 || BUILT_CATEGORIES.has(c), c).toBe(true);
  });

  it("tags every piece model with at least one known style, except plants and art", () => {
    for (const [c, models] of modelled) {
      if (c === "plant" || c === "art") continue;
      for (const m of models) {
        expect(m.styles.length, m.id).toBeGreaterThan(0);
        for (const st of m.styles) expect(StyleKey.options, m.id).toContain(st);
      }
    }
  });
});

describe("asset catalogue", () => {
  const entries = Object.entries(ASSET_CATALOGUE);
  const onDisk = (p: string) => existsSync(join(process.cwd(), "public", p));

  it("matches its schema and the generated id lists", () => {
    expect(Catalogue.safeParse(CATALOGUE_JSON).success).toBe(true);
    const byKind = (k: string) => entries.filter(([, e]) => e.kind === k).map(([id]) => id);
    expect([...MODEL_IDS]).toEqual(byKind("model"));
    expect([...TEXTURE_IDS]).toEqual(byKind("texture"));
    expect([...HDRI_IDS]).toEqual(byKind("hdri"));
  });

  it.each(entries)("%s has its files and a thumbnail", (id, e) => {
    const files = e.kind === "model" ? [assetPaths.model(id)] : e.kind === "texture" ? assetPaths.texture(id) : [e.backplate ? assetPaths.backplate(id) : assetPaths.hdri(id)];
    for (const f of files) expect(onDisk(f), f).toBe(true);
    expect(e.thumb && onDisk(e.thumb), "thumbnail").toBeTruthy();
  });

  it("tunes only models that exist", () => {
    for (const id of Object.keys(MODEL_TUNING)) expect(MODEL_IDS as readonly string[], id).toContain(id);
  });

  it.each(Object.values(PIECE_MODELS).flat().map((m) => m.id))("%s has a rendered catalogue picture", (id) => {
    const picture = modelPicture(id);
    expect(picture).toBe(assetPaths.render(id));
    expect(onDisk(picture!), picture).toBe(true);
  });

  it.each(entries.filter(([, e]) => e.kind === "model"))("%s is within the model budget", (_, e) => {
    expect(e.bytes).toBeLessThanOrEqual(MODEL_BUDGET_BYTES);
  });

  it.each(entries.filter(([, e]) => isAttribution(e.licence)))("%s credits its author", (_, e) => {
    expect(e.author.trim()).not.toBe("");
  });

  it("has a tile size for every surface material's texture", () => {
    for (const m of MATERIALS) expect(TEXTURE_CM[m.texture as TextureId], m.id).toBeGreaterThan(0);
  });

  /** Models tagged for a furniture category must face the way that category's pieces do. */
  const tagged = entries.flatMap(([id, e]) =>
    e.kind === "model" ? e.tags.flatMap((t) => (t.startsWith("furniture.") ? [[id, t.slice(10) as FurnitureCategory] as const] : [])) : [],
  );
  it.each(tagged)("%s tagged %s is a catalogue category", (_, category) => {
    expect(CATALOGUE[category]).toBeDefined();
  });
});
