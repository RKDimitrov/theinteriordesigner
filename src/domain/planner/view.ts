import type { Vec } from "../geometry/vec";

/*
 * The 2D plan view: zoom, pan and a quarter-turn rotation. Turning only
 * changes how the plan is shown, never the rooms. Pure, so the mapping
 * between screen and plan is tested in every rotation.
 */

export type ViewRotation = 0 | 90 | 180 | 270;

/** The plan point turned clockwise on screen (y points down). */
export function rotatePoint(p: Vec, rot: ViewRotation): Vec {
  switch (rot) {
    case 0:
      return { x: p.x, y: p.y };
    case 90:
      return { x: -p.y, y: p.x };
    case 180:
      return { x: -p.x, y: -p.y };
    case 270:
      return { x: p.y, y: -p.x };
  }
}

export const inverseRotation = (rot: ViewRotation): ViewRotation => ((360 - rot) % 360) as ViewRotation;

/** A quarter turn more (dir 1) or back (dir −1). */
export const turnView = (rot: ViewRotation, dir: 1 | -1): ViewRotation => (((rot + dir * 90 + 360) % 360) as ViewRotation);

export interface PlanView {
  /** Pixels per cm. */
  k: number;
  pan: Vec;
  rot: ViewRotation;
}

export function worldToScreen(p: Vec, v: PlanView): Vec {
  const r = rotatePoint(p, v.rot);
  return { x: v.pan.x + r.x * v.k, y: v.pan.y + r.y * v.k };
}

export function screenToWorld(s: Vec, v: PlanView): Vec {
  return rotatePoint({ x: (s.x - v.pan.x) / v.k, y: (s.y - v.pan.y) / v.k }, inverseRotation(v.rot));
}

/**
 * Which plan coordinate runs along each screen axis, and in which direction:
 * the rulers label the screen's x and y with it.
 */
export function rulerAxes(rot: ViewRotation): { x: { axis: "x" | "y"; sign: 1 | -1 }; y: { axis: "x" | "y"; sign: 1 | -1 } } {
  switch (rot) {
    case 0:
      return { x: { axis: "x", sign: 1 }, y: { axis: "y", sign: 1 } };
    case 90:
      return { x: { axis: "y", sign: -1 }, y: { axis: "x", sign: 1 } };
    case 180:
      return { x: { axis: "x", sign: -1 }, y: { axis: "y", sign: -1 } };
    case 270:
      return { x: { axis: "y", sign: 1 }, y: { axis: "x", sign: -1 } };
  }
}

/**
 * The angle (degrees, in plan space) to draw a label that runs along
 * `angleDeg` so it reads left to right, upright, on the turned screen.
 */
export function uprightAngle(angleDeg: number, rot: ViewRotation): number {
  let screen = (((angleDeg + rot) % 360) + 360) % 360;
  if (screen > 90 && screen <= 270) screen -= 180;
  return screen - rot;
}
