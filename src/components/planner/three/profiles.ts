import type { TrimProfile } from "@/domain/room/fit-out";
import type { P2 } from "./sweep";

/*
 * Cross-sections of real joinery and trim, in cm, as closed polygons for
 * sweep(). In each, u runs away from the edge the moulding is swept along
 * and v is its height off the surface it sits on.
 */

/** A cyma (S-shaped) curve from a to b, excluding a. */
function cyma(a: P2, b: P2, steps = 6): P2[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(Math.PI * t))] as const;
  });
}

/** A quarter circle from a to b, bulging away from `centre`, excluding a. */
function quarter(centre: P2, r: number, fromDeg: number, toDeg: number, steps = 5): P2[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = ((fromDeg + ((toDeg - fromDeg) * (i + 1)) / steps) * Math.PI) / 180;
    return [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)] as const;
  });
}

/**
 * Architrave round a door, 7 cm wide. u = 0 is the opening's edge, v the
 * projection off the wall.
 */
export function architrave(profile: TrimProfile): P2[] {
  switch (profile) {
    case "square":
      return [[0, 0], [7, 0], [7, 1.4], ...quarter([6.7, 1.4], 0.3, 0, 90, 3), [0.3, 1.7], ...quarter([0.3, 1.4], 0.3, 90, 180, 3)];
    case "bevel":
      // Thick at the opening, sloping to the wall.
      return [[0, 0], [7, 0], [7, 0.9], [6.8, 1.1], [0.8, 2.1], ...quarter([0.4, 1.8], 0.4, 60, 180, 3)];
    case "ogee":
      return [[0, 0], [7, 0], [7, 0.8], ...cyma([7, 0.8], [3.2, 2.0], 7), [1.4, 2.0], ...quarter([0.8, 2.0], 0.6, 0, 180, 6).map(([u, v]) => [u, Math.min(v, 2.6)] as const), [0, 1.6]];
  }
}

/**
 * Skirting board `h` cm high. u = 0 is the wall face, v the height off the
 * floor.
 */
export function skirting(profile: TrimProfile, h: number): P2[] {
  switch (profile) {
    case "square":
      return [[0, 0], [1.5, 0], [1.5, h - 0.3], ...quarter([1.2, h - 0.3], 0.3, 0, 90, 3), [0, h]];
    case "bevel":
      return [[0, 0], [1.8, 0], [1.8, h - 2.2], [0.8, h], [0, h]];
    case "ogee":
      return [[0, 0], [1.9, 0], [1.9, h - 3.4], ...cyma([1.9, h - 3.4], [0.9, h - 0.6], 7), ...quarter([0.6, h - 0.6], 0.3, 0, 90, 3), [0, h]];
  }
}

/** Glazing bead holding glass in a leaf or sash: u from the pane's edge, v off the glass. */
export const GLAZING_BEAD: P2[] = [[0, 0], [1.6, 0], ...quarter([0, 0], 1.6, 0, 90, 5).slice(0, -1), [0, 1.6]];

/** Small moulding framing a door panel: u from the panel's edge, v off the leaf face. */
export const PANEL_MOULD: P2[] = [[0, 0], [2.2, 0], ...cyma([2.2, 0], [0.6, 1.1], 6), [0, 1.1]];

/**
 * The bevelled border of a raised panel: u inwards from the panel's edge,
 * v up from the recessed field. The flat middle is a separate slab.
 */
export const RAISED_FIELD = (depth: number): P2[] => [[0, 0], [4.5, 0], [4.5, depth], [4.2, depth], [0.5, 0.25], [0, 0.25]];

/**
 * uPVC-style window frame, 6.5 cm face and 7 cm deep: u inwards from the
 * frame's outer edge, v from the outside face to the room face, with a rebate
 * for the sash.
 */
export const WINDOW_FRAME: P2[] = [[0, 0], [5.2, 0], [5.2, 0.8], [6.5, 1.4], [6.5, 1.8], [4.6, 1.8], [4.6, 5.6], [6.5, 5.6], [6.5, 6.6], [6.1, 7], [0.4, 7], [0, 6.6]];

/** Sash with a sloped ("softline") inner edge, 5.5 cm face, 6.5 cm deep. */
export const SASH: P2[] = [[0, 0], [5.5, 0], [5.5, 4.4], [4.3, 6.5], [0.4, 6.5], [0, 6.1]];

/** Inside window board: u from the wall face into the room, v up. Bullnose front edge. */
export const WINDOW_BOARD = (depth: number): P2[] => [[0, 0], [depth - 1, 0], ...quarter([depth - 1, 1.25], 1.25, -90, 90, 6), [0, 2.5]];
