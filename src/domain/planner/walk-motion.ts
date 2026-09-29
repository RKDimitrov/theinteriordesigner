/*
 * Smooth motion for the walkthrough: speed and gaze ease towards where the
 * keys and the mouse point, instead of jumping. Pure, so it is tested.
 */

/** Frame-rate independent easing of `current` towards `target`: `rate` is how many "e-foldings" per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** The signed turn in degrees, between −180 and 180, that takes heading `from` to `to` the short way. */
export function shortestTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Ease-in-out on 0–1, for gliding to a spot. */
export const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Eye height standing and sitting, in cm. */
export const EYE_STANDING = 165;
export const EYE_SITTING = 115;
