import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RadiatorStyle } from "@/domain/schemas/room";
import { radiatorGeometry } from "./radiator-geometry";

describe("radiatorGeometry", () => {
  it.each(RadiatorStyle.options)("%s fills exactly its width and stays within its height and depth", (style) => {
    const [w, h, d] = style === "convector" ? [120, 12, 25] : [100, 60, 10];
    const box = new THREE.Box3();
    for (const g of radiatorGeometry(style, w, h, d)) {
      g.computeBoundingBox();
      box.union(g.boundingBox!);
    }
    expect(box.min.x).toBeCloseTo(0, 1);
    expect(box.max.x).toBeCloseTo(w, 1);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThanOrEqual(h + 0.01);
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(d + 0.01);
  });
});
