import { describe, expect, it } from "vitest";
import type { Catalogue, CatalogueEntry } from "./catalogue.ts";
import { creditGroups } from "./credits.ts";

const row = (over: Partial<CatalogueEntry>): CatalogueEntry =>
  ({ kind: "hdri", title: "t", author: "a", source: "polyhaven", sourceUrl: "https://polyhaven.com/a/t", licence: "cc0", tags: [], bytes: 1, ...over }) as CatalogueEntry;

describe("creditGroups", () => {
  const catalogue: Catalogue = {
    sofa: row({ title: "Velvet Sofa", author: "Wayfair", source: "khronos", licence: "cc-by-4.0", sourceUrl: "https://github.com/x/sofa" }),
    door: row({ title: "Door", author: "Ann", source: "sketchfab", licence: "cc-by-4.0", sourceUrl: "https://sketchfab.com/3d-models/door" }),
    chair: row({ author: "Rico Cilliers" }),
    plant: row({ author: "Rico Cilliers, James Ray Cock" }),
    brick: row({ source: "url", author: "B", sourceUrl: "https://example.org/brick" }),
  };
  const { attribution, publicDomain } = creditGroups(catalogue);

  it("lists attribution assets by title", () => {
    expect(attribution.map((a) => a.title)).toEqual(["Door", "Velvet Sofa"]);
    expect(attribution[0]).toMatchObject({ author: "Ann", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", licenceLabel: "CC BY 4.0" });
  });

  it("groups public-domain assets by source, with each author once", () => {
    expect(publicDomain).toEqual([
      { name: "example.org", url: "https://example.org", count: 1, authors: ["B"] },
      { name: "Poly Haven", url: "https://polyhaven.com", count: 2, authors: ["James Ray Cock", "Rico Cilliers"] },
    ]);
  });
});
