export const GRID_CM = 5;

/** Snap a length to the editor grid (default 5 cm). */
export function snap(v: number, step = GRID_CM): number {
  const s = Math.round(v / step) * step;
  return Object.is(s, -0) ? 0 : s;
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Normalise any angle to [0, 360). */
export function normDeg(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export const cmToM = (cm: number): number => cm / 100;
export const m2 = (cm2: number): number => cm2 / 10_000;

export function formatCm(cm: number): string {
  return `${Math.round(cm)} cm`;
}
