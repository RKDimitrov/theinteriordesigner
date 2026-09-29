import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import { DECOR_HOSTS, dressPiece, ROUND, type DecorProp } from "./decor";
import type { FurnitureCategory } from "../schemas/design";

const piece = (category: FurnitureCategory, w: number, d: number, h: number, id = "p1") => ({ id, category, w, d, h });

/** Corners of a prop's box after its turn, in the piece frame. */
function corners(p: DecorProp): [number, number][] {
  // A round prop covers the same ground whichever way it turns.
  const a = ROUND.has(p.kind) ? 0 : (p.rotation * Math.PI) / 180;
  const [w, d] = p.box;
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => [p.x + x! * Math.cos(a) - y! * Math.sin(a), p.y + x! * Math.sin(a) + y! * Math.cos(a)]);
}

describe("dressPiece", () => {
  it("is the same for the same piece and seed, and changes on a re-roll", () => {
    const p = piece("sideboard", 180, 45, 80);
    expect(dressPiece(p)).toEqual(dressPiece(p));
    const rolls = new Set([0, 1, 2, 3, 4].map((seed) => JSON.stringify(dressPiece({ ...p, decor: { seed, hidden: [] } }))));
    expect(rolls.size).toBeGreaterThan(1);
  });

  it("keeps props on the top of their piece, apart from each other, for every host at every size", () => {
    for (const [category, s] of Object.entries(DECOR_HOSTS)) {
      if (category === "sofa" || !s) continue;
      for (const size of ["small", "medium", "large"] as const) {
        const [w, d, h] = CATALOGUE[category as FurnitureCategory].sizes[size];
        for (let seed = 0; seed < 20; seed++) {
          const props = dressPiece({ ...piece(category as FurnitureCategory, w, d, h), decor: { seed, hidden: [] } });
          expect(props.length).toBeLessThanOrEqual(s.max);
          for (const p of props) {
            expect(s.kinds, category).toContain(p.kind);
            expect(p.elevation).toBe(h);
            for (const [x, y] of corners(p)) {
              expect(Math.abs(x), `${category} ${size} ${p.kind} x`).toBeLessThanOrEqual(w / 2 + 0.01);
              expect(Math.abs(y), `${category} ${size} ${p.kind} y`).toBeLessThanOrEqual(d / 2 + 0.01);
            }
          }
          // Side by side along the width: the gaps between neighbours are never negative.
          const spans = props.map((p) => corners(p).map(([x]) => x)).map((xs) => [Math.min(...xs), Math.max(...xs)] as const).sort((a, b) => a[0] - b[0]);
          for (let i = 1; i < spans.length; i++) expect(spans[i]![0], `${category} ${size} overlap`).toBeGreaterThanOrEqual(spans[i - 1]![1] - 0.01);
        }
      }
    }
  });

  it("dresses the medium size of every host with at least one prop", () => {
    for (const category of Object.keys(DECOR_HOSTS) as FurnitureCategory[]) {
      const [w, d, h] = CATALOGUE[category].sizes.medium;
      expect(dressPiece(piece(category, w, d, h)).length, category).toBeGreaterThan(0);
    }
  });

  it("leaves out the props the user removed, and all of them when switched off", () => {
    const p = piece("coffee_table", 110, 60, 40);
    const all = dressPiece(p);
    const slot = all[0]!.slot;
    expect(dressPiece({ ...p, decor: { seed: 0, hidden: [slot] } }).map((x) => x.slot)).toEqual(all.map((x) => x.slot).filter((s) => s !== slot));
    expect(dressPiece({ ...p, decor: { seed: 0, hidden: [], off: true } })).toEqual([]);
  });

  it("puts pillows along the back of a sofa's seat and nothing on pieces that are not hosts", () => {
    const [pillows] = dressPiece(piece("sofa", 220, 95, 85));
    expect(pillows?.kind).toBe("pillows");
    expect(pillows!.y).toBeLessThan(0);
    expect(pillows!.elevation).toBeLessThan(85 / 2);
    expect(dressPiece(piece("armchair", 80, 85, 90))).toEqual([]);
  });

  it("puts a dining table's one prop in the middle and a desk's props at its ends", () => {
    const [centre] = dressPiece(piece("dining_table", 160, 90, 75));
    expect([centre!.x, centre!.y]).toEqual([0, 0]);
    for (let seed = 0; seed < 10; seed++) {
      const props = dressPiece({ ...piece("desk", 140, 70, 75), decor: { seed, hidden: [] } });
      if (props.length === 2) expect(Math.min(...props.map((p) => Math.abs(p.x)))).toBeGreaterThan(40);
    }
  });
});
