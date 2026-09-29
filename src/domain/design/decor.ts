import type { FurnitureCategory, PieceDecor } from "../schemas/design";
import { hashSeed, mulberry32 } from "./solver/random";

/*
 * Decor props that dress a room in 3D: vases, books and bowls on tables and
 * sideboards, pillows on sofas. Pure and seeded, so a piece always shows the
 * same props until the user re-rolls it; only the seed and the props the
 * user removed are stored, on the host piece. Props are not furniture: the
 * validator and the solver never see them.
 */

export const DECOR_KINDS = ["vase", "books", "bowl", "plant", "frame", "clock", "figurine", "tea_set", "basket", "lamp", "candle", "pillows"] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

/** The box a prop is drawn in, [w, d, h] in cm; the model is scaled uniformly to fit inside it. */
export const DECOR_BOX: Readonly<Record<Exclude<DecorKind, "pillows">, readonly [number, number, number]>> = {
  vase: [18, 18, 32],
  books: [34, 12, 16],
  bowl: [30, 30, 9],
  plant: [18, 19, 27],
  frame: [18, 9, 23],
  clock: [20, 14, 15],
  figurine: [16, 12, 20],
  tea_set: [52, 28, 10],
  basket: [34, 26, 20],
  lamp: [30, 22, 45],
  candle: [9, 9, 22],
};

interface Surface {
  kinds: readonly DecorKind[];
  /** Most props on one piece. */
  max: number;
  /** Against the wall side of the top (sideboards, shelves), rather than anywhere on it. */
  back?: boolean;
  /** One prop in the middle (dining tables). */
  centre?: boolean;
  /** Props at the two ends, leaving the middle free to work at (desks). */
  ends?: boolean;
}

/** Which pieces get props, and which kinds suit them. */
export const DECOR_HOSTS: Readonly<Partial<Record<FurnitureCategory, Surface>>> = {
  coffee_table: { kinds: ["books", "bowl", "vase", "plant", "tea_set", "candle", "figurine"], max: 3 },
  side_table: { kinds: ["plant", "vase", "books", "candle", "clock"], max: 2 },
  nightstand: { kinds: ["clock", "books", "vase", "candle", "plant"], max: 2 },
  tv_unit: { kinds: ["vase", "books", "plant", "frame", "figurine", "basket"], max: 3, back: true },
  sideboard: { kinds: ["vase", "bowl", "frame", "candle", "books", "figurine"], max: 3, back: true },
  dresser: { kinds: ["frame", "vase", "basket", "clock", "plant"], max: 3, back: true },
  desk: { kinds: ["lamp", "books", "plant", "clock"], max: 2, back: true, ends: true },
  dining_table: { kinds: ["bowl", "vase", "candle"], max: 1, centre: true },
  wall_shelf: { kinds: ["plant", "books", "frame", "vase", "figurine"], max: 3, back: true },
  bookshelf: { kinds: ["vase", "basket", "plant"], max: 2, back: true },
  storage: { kinds: ["basket", "plant", "vase", "frame"], max: 2, back: true },
  shoe_cabinet: { kinds: ["basket", "plant", "vase"], max: 2, back: true },
  sofa: { kinds: ["pillows"], max: 1 },
};

export interface DecorProp {
  /** Stable within its piece, for removing it: the kind. */
  slot: string;
  kind: DecorKind;
  /** Which model of the kind (the renderer takes it modulo its list). */
  variant: number;
  /** Centre in the piece's frame: x to the right, y to the front (cm). */
  x: number;
  y: number;
  /** Height of the prop's base above the floor. */
  elevation: number;
  /** Degrees about the vertical, clockwise seen from above. */
  rotation: number;
  /** The box to fit the model in, [w, d, h] in cm. */
  box: readonly [number, number, number];
}

interface Host {
  id: string;
  category: FurnitureCategory;
  w: number;
  d: number;
  h: number;
  decor?: PieceDecor;
}

export const ROUND: ReadonlySet<DecorKind> = new Set(["vase", "bowl", "plant", "candle"]);

/** Space kept free along the edges of a top. */
const MARGIN = 4;
const GAP = 5;

/** The props on one piece, after the ones the user removed. */
export function dressPiece(p: Host): DecorProp[] {
  const surface = DECOR_HOSTS[p.category];
  if (!surface || p.decor?.off) return [];
  const rand = mulberry32(hashSeed(`${p.id}:${p.decor?.seed ?? 0}`));
  const hidden = new Set(p.decor?.hidden ?? []);
  const props = p.category === "sofa" ? pillows(p, rand) : onTop(p, surface, rand);
  return props.filter((x) => !hidden.has(x.slot));
}

function pillows(p: Host, rand: () => number): DecorProp[] {
  // Along the back of the seat, a bit under half the sofa's height.
  return [{ slot: "pillows", kind: "pillows", variant: Math.floor(rand() * 1e6), x: 0, y: -p.d * 0.12, elevation: p.h * 0.42, rotation: 0, box: [p.w * 0.5, p.d * 0.35, p.h * 0.42] }];
}

function onTop(p: Host, s: Surface, rand: () => number): DecorProp[] {
  const w = p.w - 2 * MARGIN;
  const d = p.d - 2 * MARGIN;
  if (w < 8 || d < 6) return [];

  // Shuffle the kinds, then keep those that still fit side by side.
  const kinds = [...s.kinds];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const chosen: { kind: Exclude<DecorKind, "pillows">; box: [number, number, number]; rotation: number; ext: [number, number] }[] = [];
  let used = 0;
  for (const k of kinds) {
    if (chosen.length >= s.max || k === "pillows") continue;
    // Round things may turn freely; the rest face the room, give or take.
    const rotation = ROUND.has(k) ? rand() * 360 : (rand() - 0.5) * 24;
    const [bw, bd, bh] = DECOR_BOX[k];
    // What the prop covers once turned (a round one covers the same whichever way it turns).
    const [ew, ed] = ROUND.has(k) ? [bw, bd] : turned(bw, bd, rotation);
    // Shrink a prop a little to fit a narrow top, never below 70 %.
    const f = Math.min(1, d / ed, w / ew);
    if (f < 0.7) continue;
    const ext: [number, number] = [ew * f, ed * f];
    if (used + ext[0] + (chosen.length ? GAP : 0) > w) continue;
    used += ext[0] + (chosen.length ? GAP : 0);
    chosen.push({ kind: k, box: [bw * f, bd * f, bh * f], rotation, ext });
  }
  if (chosen.length === 0) return [];

  const xs = s.centre ? [0] : s.ends && chosen.length === 2 ? [-w / 2 + chosen[0]!.ext[0] / 2, w / 2 - chosen[1]!.ext[0] / 2] : spread(chosen.map((c) => c.ext[0]), w, rand);
  return chosen.map((c, i) => {
    const room = d - c.ext[1];
    const y = s.centre ? 0 : s.back ? -d / 2 + c.ext[1] / 2 + rand() * Math.min(4, room) : (rand() - 0.5) * room;
    return { slot: c.kind, kind: c.kind, variant: Math.floor(rand() * 1e6), x: xs[i]!, y, elevation: p.h, rotation: c.rotation, box: c.box };
  });
}

/** Width and depth a w × d box covers once turned by `deg`. */
function turned(w: number, d: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const sn = Math.abs(Math.sin(a));
  return [w * c + d * sn, w * sn + d * c];
}

/** Centres for props of the given widths, left to right, with the free space shared out at random. */
function spread(widths: readonly number[], w: number, rand: () => number): number[] {
  const free = w - widths.reduce((a, b) => a + b, 0) - GAP * (widths.length - 1);
  const cuts = widths.map(() => rand());
  cuts.push(rand());
  const total = cuts.reduce((a, b) => a + b, 0) || 1;
  let x = -w / 2;
  return widths.map((bw, i) => {
    x += (free * cuts[i]!) / total + (i ? GAP : 0);
    const centre = x + bw / 2;
    x += bw;
    return centre;
  });
}
