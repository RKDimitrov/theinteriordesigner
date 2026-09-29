import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetPaths, Catalogue, MODEL_BUDGET_BYTES } from "@/domain/assets/catalogue";
import { isAttribution } from "@/domain/assets/licence";
import { CATALOGUE } from "@/domain/design/catalogue";
import type { FurnitureCategory } from "@/domain/schemas/design";
import CATALOGUE_JSON from "./asset-catalogue.json";
import { HDRI_IDS, MODEL_IDS, TEXTURE_IDS } from "./asset-ids";
import { MATERIALS } from "@/domain/materials/library";
import { ASSET_CATALOGUE, MODEL_SIZE, nativeFootprint, PIECE_ASSETS, pickVariant, TEXTURE_CM, type TextureId } from "./assets";

describe("pickVariant", () => {
  const tall = { id: "potted_plant_01" as const };
  const bushy = { id: "potted_plant_02" as const };

  it("chooses the model whose proportions need the least stretching", () => {
    expect(pickVariant([bushy, tall], 45, 45, 120)).toBe(tall);
    expect(pickVariant([tall, bushy], 70, 70, 85)).toBe(bushy);
  });

  it("ignores overall size: a uniformly smaller copy is not distorted", () => {
    const [w, h, d] = MODEL_SIZE["potted_plant_02"];
    expect(pickVariant([tall, bushy], w / 2, d / 2, h / 2)).toBe(bushy);
  });
});

describe("nativeFootprint", () => {
  it("swaps width and depth for a quarter turn", () => {
    const [w, h, d] = MODEL_SIZE["modern_coffee_table_01"];
    expect(nativeFootprint({ id: "modern_coffee_table_01", turn: 90 })).toEqual([d, h, w]);
    expect(nativeFootprint({ id: "modern_coffee_table_01" })).toEqual([w, h, d]);
  });
});

describe("PIECE_ASSETS", () => {
  const modelled = Object.entries(PIECE_ASSETS).filter(([, a]) => a.kind === "models") as [
    FurnitureCategory,
    Extract<(typeof PIECE_ASSETS)[FurnitureCategory], { kind: "models" }>,
  ][];

  it.each(modelled)("%s models face the way the catalogue piece does", (category, asset) => {
    const [cw, cd] = CATALOGUE[category].sizes.medium;
    // Only clearly oblong pieces have a long side to get wrong.
    if (Math.max(cw, cd) / Math.min(cw, cd) < 1.2) return;
    for (const v of asset.variants) {
      const [w, , d] = nativeFootprint(v);
      expect(w > d, `${v.id} long side`).toBe(cw > cd);
    }
  });

  it("has a measured size for every model it uses", () => {
    for (const [, a] of modelled) for (const v of a.variants) expect(MODEL_SIZE[v.id]).toHaveLength(3);
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
    const files = e.kind === "model" ? [assetPaths.model(id)] : e.kind === "texture" ? assetPaths.texture(id) : [assetPaths.hdri(id)];
    for (const f of files) expect(onDisk(f), f).toBe(true);
    expect(e.thumb && onDisk(e.thumb), "thumbnail").toBeTruthy();
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
