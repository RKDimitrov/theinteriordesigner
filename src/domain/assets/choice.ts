/*
 * Which real model shows a furniture piece by default. Pure, so the rule is
 * tested: the model whose proportions need the least stretching to the
 * piece's exact size, nudged towards the styles the user's profile scores
 * highest. The same inputs always give the same model, so a set of dining
 * chairs matches.
 */

export interface ModelOption {
  id: string;
  /** Native [w, h, d] in cm, already turned to face the piece's front. */
  size: readonly [number, number, number];
  /** Style keys, e.g. "japandi". */
  styles: readonly string[];
}

/** How much a style match may outweigh stretching (in log-scale units). */
export const STYLE_WEIGHT = 0.3;

/**
 * Spread of the three log scale factors needed to fill w × d × h. A uniformly
 * scaled copy has none, so overall size does not count, only proportions.
 */
export function distortion(size: readonly [number, number, number], w: number, d: number, h: number): number {
  const [nw, nh, nd] = size;
  const logs = [Math.log(w / nw), Math.log(h / nh), Math.log(d / nd)];
  return Math.max(...logs) - Math.min(...logs);
}

/** The profile's best score among the model's styles (0 to 1); 0 without a profile. */
export function styleFit(styles: readonly string[], scores: Readonly<Partial<Record<string, number>>> | null): number {
  if (!scores) return 0;
  return Math.max(0, ...styles.map((s) => scores[s] ?? 0));
}

export function chooseModel<T extends ModelOption>(options: readonly [T, ...T[]] | readonly T[], w: number, d: number, h: number, scores: Readonly<Partial<Record<string, number>>> | null): T {
  let best = options[0]!;
  let bestCost = Infinity;
  for (const o of options) {
    const cost = distortion(o.size, w, d, h) - STYLE_WEIGHT * styleFit(o.styles, scores);
    if (cost < bestCost - 1e-9) [best, bestCost] = [o, cost];
  }
  return best;
}
