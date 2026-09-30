import { containsPoint } from "../geometry/polygon";
import { add, scale, type Vec } from "../geometry/vec";
import { wallsOf } from "../geometry/walls";

/*
 * Where the plan's dimension lines may go. They are drawn outside each wall,
 * which is only "outside" on the apartment's outer walls: on a wall two rooms
 * share, that spot is inside the room next door, on top of its furniture.
 * Pure, so the rules are tested.
 */

/** Sample points along a wall, as fractions of its length. */
const PROBES = [0.1, 0.3, 0.5, 0.7, 0.9];

/**
 * For every room, one flag per wall: true when a dimension line drawn
 * `reaches` cm outside that wall (measured from the room's face) would land
 * inside another room.
 */
export function sharedWalls(rooms: readonly { id: string; polygon: readonly Vec[] }[], origins: Readonly<Record<string, Vec>>, reaches: readonly number[]): Record<string, boolean[]> {
  const at = (id: string) => origins[id] ?? { x: 0, y: 0 };
  const out: Record<string, boolean[]> = {};
  for (const r of rooms) {
    const o = at(r.id);
    const others = rooms.filter((x) => x.id !== r.id);
    out[r.id] = wallsOf(r.polygon).map((w) =>
      PROBES.some((t) =>
        reaches.some((reach) => {
          const p = add(add(add(w.a, scale(w.dir, w.length * t)), scale(w.inward, -reach)), o);
          return others.some((x) => containsPoint(x.polygon, { x: p.x - at(x.id).x, y: p.y - at(x.id).y }));
        }),
      ),
    );
  }
  return out;
}

export interface ChainSegment {
  from: number;
  to: number;
  /** Index into the `openings` given, or null for the wall between them. */
  opening: number | null;
}

/** A wall of `length` cm cut into the stretches between and across its openings, in order along the wall. */
export function openingChain(length: number, openings: readonly { offset: number; width: number }[]): ChainSegment[] {
  if (openings.length === 0) return [];
  const sorted = openings.map((o, index) => ({ o, index })).sort((a, b) => a.o.offset - b.o.offset);
  const chain: ChainSegment[] = [];
  let cursor = 0;
  for (const { o, index } of sorted) {
    if (o.offset > cursor + 1) chain.push({ from: cursor, to: o.offset, opening: null });
    chain.push({ from: o.offset, to: o.offset + o.width, opening: index });
    cursor = o.offset + o.width;
  }
  if (length - cursor > 1) chain.push({ from: cursor, to: length, opening: null });
  return chain;
}

/** Width of `text` in the plan's mono face at `fontSize`. */
export const labelWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.62;

/** The first of `wordings` that fits into `space` with `pad` to spare, or null when none does. */
export function fitLabel(wordings: readonly string[], space: number, fontSize: number, pad: number): string | null {
  return wordings.find((w) => labelWidth(w, fontSize) + pad <= space) ?? null;
}
