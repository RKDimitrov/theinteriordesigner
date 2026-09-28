import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/domain/design/catalogue";
import type { FurnitureCategory } from "@/domain/schemas/design";
import { MODEL_SIZE, nativeFootprint, PIECE_ASSETS, pickVariant } from "./assets";

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
