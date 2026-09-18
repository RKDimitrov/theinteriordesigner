export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
/** z-component of the 3D cross product. */
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number => length(sub(a, b));

export function normalize(a: Vec): Vec {
  const l = length(a);
  if (l === 0) throw new Error("Cannot normalize zero vector");
  return { x: a.x / l, y: a.y / l };
}

/**
 * Rotate clockwise *on screen* (y-down coordinates) by `deg` degrees.
 * In y-down space the standard rotation matrix turns clockwise visually.
 */
export function rotate(a: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Rotate 90° clockwise on screen (y-down). */
export const perpCw = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export const EPS = 1e-6;
export const nearlyEqual = (a: number, b: number, eps = EPS): boolean => Math.abs(a - b) <= eps;
