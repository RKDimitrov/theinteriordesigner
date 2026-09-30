/*
 * How every furniture model is photographed for the catalogue: one camera
 * angle and one framing rule, so the pictures look like a set. Pure, so the
 * framing is tested; scripts/assets/render.ts applies it in the browser.
 */

export interface View {
  /** Degrees round the piece from its front (+z) towards its right (+x). */
  azimuthDeg: number;
  /** Degrees above the horizontal. */
  elevationDeg: number;
  /** Vertical field of view. */
  fovDeg: number;
  /** Picture width over height. */
  aspect: number;
}

/** A front three-quarter view with a long lens, which keeps proportions honest. */
export const RENDER_VIEW: View = { azimuthDeg: 35, elevationDeg: 22, fovDeg: 28, aspect: 1 };

type V3 = readonly [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Unit vector from the piece towards the camera. */
export function viewDirection(v: View): [number, number, number] {
  const az = (v.azimuthDeg * Math.PI) / 180;
  const el = (v.elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/**
 * Distance from the centre of a `size` box ([w, h, d]) at which the camera,
 * looking at that centre, sees every corner, leaving `margin` (a fraction of
 * half the picture) free round the tightest side.
 */
export function fitDistance(size: V3, v: View, margin: number): number {
  const dir = viewDirection(v);
  // Right is horizontal; up completes the camera's frame.
  const rl = Math.hypot(dir[0], dir[2]);
  const right: V3 = [dir[2] / rl, 0, -dir[0] / rl];
  const up: V3 = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  const t = Math.tan((v.fovDeg * Math.PI) / 360) * (1 - margin);
  let distance = 0;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const c: V3 = [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2];
        const towards = dot(c, dir);
        distance = Math.max(distance, towards + Math.abs(dot(c, up)) / t, towards + Math.abs(dot(c, right)) / (t * v.aspect));
      }
  return distance;
}
