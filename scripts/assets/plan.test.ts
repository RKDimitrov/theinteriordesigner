import { describe, expect, it } from "vitest";
import type { Catalogue, CatalogueEntry } from "../../src/domain/assets/catalogue.ts";
import type { ManifestEntry } from "../../src/domain/assets/manifest.ts";
import { idsModule, mergeCatalogue, orphans, outputsOf } from "./plan.ts";

const entry = (id: string, kind: ManifestEntry["kind"]) =>
  ({ id, kind, source: "polyhaven", ref: id, title: id, author: "a", sourceUrl: "https://polyhaven.com", licence: "cc0", tags: [] }) as ManifestEntry;
const row = (title: string) => ({ kind: "hdri", title, author: "a", source: "polyhaven", sourceUrl: "https://polyhaven.com", licence: "cc0", tags: [], bytes: 1 }) as CatalogueEntry;

describe("outputsOf", () => {
  it("lists the files each kind produces", () => {
    expect(outputsOf(entry("chair", "model"))).toEqual(["/models/chair.glb"]);
    expect(outputsOf(entry("oak", "texture"))).toEqual(["/textures/oak/diff.webp", "/textures/oak/nor.webp", "/textures/oak/arm.webp"]);
    expect(outputsOf(entry("sky", "hdri"))).toEqual(["/hdris/sky.hdr"]);
  });
});

describe("orphans", () => {
  it("finds files no entry produces", () => {
    const files = ["/models/chair.glb", "/models/old.glb", "/thumbs/chair.webp", "/thumbs/old.webp"];
    expect(orphans(files, [entry("chair", "model")])).toEqual(["/models/old.glb", "/thumbs/old.webp"]);
  });
});

describe("mergeCatalogue", () => {
  it("prefers fresh rows, keeps old ones, drops ids gone from the manifest, and sorts", () => {
    const old: Catalogue = { b: row("old b"), gone: row("gone"), a: row("old a") };
    const fresh: Catalogue = { b: row("new b") };
    const merged = mergeCatalogue(old, fresh, [entry("b", "hdri"), entry("a", "hdri")]);
    expect(Object.keys(merged)).toEqual(["a", "b"]);
    expect(merged["b"]?.title).toBe("new b");
    expect(merged["a"]?.title).toBe("old a");
  });
});

describe("idsModule", () => {
  it("lists ids per kind as TypeScript tuples", () => {
    const src = idsModule({ sky: row("sky"), dusk: row("dusk") });
    expect(src).toContain('export const HDRI_IDS = ["sky","dusk"] as const;');
    expect(src).toContain("export const MODEL_IDS = [] as const;");
  });
});
