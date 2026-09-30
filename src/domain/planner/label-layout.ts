/*
 * Where the labels of the designer's suggestion ghosts go on the plan, so
 * they stay readable: off the placed pieces, off the other ghosts and off
 * each other. Pure, so the rule is tested.
 */

/** An axis-aligned box: top-left corner, width and height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelRequest {
  id: string;
  /** Bounds of the thing the label names. */
  anchor: Box;
  /** Size of the label. */
  w: number;
  h: number;
}

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The centre of each label: in the middle of its anchor when that spot is
 * free, else above, below, right or left of it (`gap` away), whichever comes
 * first without covering an obstacle, another anchor or a label already
 * placed. When no spot is free the least covered one is taken.
 */
export function placeLabels(requests: readonly LabelRequest[], obstacles: readonly Box[], gap: number): Record<string, { x: number; y: number }> {
  const placed: Box[] = [];
  const out: Record<string, { x: number; y: number }> = {};
  for (const r of requests) {
    const a = r.anchor;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const spots = [
      { x: cx, y: cy },
      { x: cx, y: a.y - gap - r.h / 2 },
      { x: cx, y: a.y + a.h + gap + r.h / 2 },
      { x: a.x + a.w + gap + r.w / 2, y: cy },
      { x: a.x - gap - r.w / 2, y: cy },
    ];
    const taken = [...obstacles, ...requests.filter((o) => o.id !== r.id).map((o) => o.anchor), ...placed];
    const boxAt = (c: { x: number; y: number }): Box => ({ x: c.x - r.w / 2, y: c.y - r.h / 2, w: r.w, h: r.h });
    let best = spots[0]!;
    let bestCover = Infinity;
    for (const s of spots) {
      const box = boxAt(s);
      const cover = taken.reduce((n, t) => n + overlapArea(box, t), 0);
      if (cover < bestCover) [best, bestCover] = [s, cover];
      if (cover === 0) break;
    }
    out[r.id] = best;
    placed.push(boxAt(best));
  }
  return out;
}
