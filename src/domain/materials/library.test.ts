import { describe, expect, it } from "vitest";
import CATALOGUE from "@/components/planner/three/asset-catalogue.json";
import { DEFAULT_FINISHES, fromLegacy, MATERIALS, materialsFor, resolveFinishes, RoomFinishes } from "./library";

describe("MATERIALS", () => {
  it("has unique ids and a texture for each in the asset catalogue", () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const catalogue = CATALOGUE as Record<string, { kind: string }>;
    for (const m of MATERIALS) expect(catalogue[m.texture]?.kind, m.id).toBe("texture");
  });

  it("offers a broad choice on every surface", () => {
    expect(materialsFor("wall").length).toBeGreaterThanOrEqual(20);
    expect(materialsFor("floor").length).toBeGreaterThanOrEqual(15);
    expect(materialsFor("ceiling").length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the ids the planner stored before", () => {
    for (const id of ["oak", "ash", "terracotta", "microcement"]) expect(materialsFor("floor").map((m) => m.id)).toContain(id);
    for (const id of ["limewash", "warmwhite", "clay", "sage"]) expect(materialsFor("wall").map((m) => m.id)).toContain(id);
  });
});

describe("resolveFinishes", () => {
  it("uses the defaults when nothing is set", () => {
    const r = resolveFinishes(RoomFinishes.parse({}));
    expect([r.floor.id, r.walls.id, r.ceiling.id]).toEqual([DEFAULT_FINISHES.floor, DEFAULT_FINISHES.walls, DEFAULT_FINISHES.ceiling]);
  });

  it("paints accent walls and falls back to the room's walls elsewhere", () => {
    const r = resolveFinishes({ walls: "sage", wallOverrides: { "2": "red_brick" } });
    expect(r.wall(2).id).toBe("red_brick");
    expect(r.wall(0).id).toBe("sage");
  });

  it("ignores unknown ids and materials on the wrong surface", () => {
    const r = resolveFinishes({ floor: "red_brick", walls: "nope", wallOverrides: {} });
    expect(r.floor.id).toBe(DEFAULT_FINISHES.floor);
    expect(r.walls.id).toBe(DEFAULT_FINISHES.walls);
  });

  it("refuses ids that are not safe", () => {
    expect(RoomFinishes.safeParse({ floor: "../x" }).success).toBe(false);
    expect(RoomFinishes.safeParse({ wallOverrides: { a: "oak" } }).success).toBe(false);
  });
});

describe("fromLegacy", () => {
  it("reads finishes stored in the browser before", () => {
    expect(fromLegacy({ floor: "terracotta", walls: "clay" })).toEqual({ floor: "terracotta", walls: "clay", wallOverrides: {} });
  });

  it("drops what it cannot use", () => {
    expect(fromLegacy({ floor: "lava" })).toBeNull();
    expect(fromLegacy("nonsense")).toBeNull();
  });
});
