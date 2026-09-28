import { z } from "zod";
import {
  type Door,
  DoorFinish,
  DoorStyle,
  FrameFinish,
  type Radiator,
  RadiatorFinish,
  RadiatorStyle,
  type Window,
  WindowStyle,
} from "../schemas/room";

/**
 * The apartment's fit-out: the style new openings get when drawn, and the
 * finish every opening shows unless it overrides it. Stored on the apartment.
 */
export const DEFAULT_FIT_OUT = {
  doors: { style: "hinged", finish: "white_lacquer" },
  windows: { style: "tilt_turn", finish: "white" },
  radiators: { style: "panel", finish: "white" },
} as const;

export const FitOut = z.object({
  doors: z.object({ style: DoorStyle.default(DEFAULT_FIT_OUT.doors.style), finish: DoorFinish.default(DEFAULT_FIT_OUT.doors.finish) }).default(DEFAULT_FIT_OUT.doors),
  windows: z
    .object({ style: WindowStyle.default(DEFAULT_FIT_OUT.windows.style), finish: FrameFinish.default(DEFAULT_FIT_OUT.windows.finish) })
    .default(DEFAULT_FIT_OUT.windows),
  radiators: z
    .object({ style: RadiatorStyle.default(DEFAULT_FIT_OUT.radiators.style), finish: RadiatorFinish.default(DEFAULT_FIT_OUT.radiators.finish) })
    .default(DEFAULT_FIT_OUT.radiators),
});
export type FitOut = z.infer<typeof FitOut>;

/** Door style, reading doors saved before styles existed ("sliding" was a swing). */
export const doorStyle = (d: Door): DoorStyle => d.style ?? (d.swing === "sliding" ? "sliding" : "hinged");
export const windowStyle = (w: Window): WindowStyle => w.style ?? "casement";
export const radiatorStyle = (r: Radiator): RadiatorStyle => r.style ?? "panel";

/** Leaf runs along the wall instead of swinging: no swing area, but the wall beside it must stay free. */
export const slides = (d: Door): boolean => {
  const s = doorStyle(d);
  return s === "sliding" || s === "pocket" || s === "barn";
};

export function finishOf(o: Door, fitOut: FitOut): DoorFinish;
export function finishOf(o: Window, fitOut: FitOut): FrameFinish;
export function finishOf(o: Radiator, fitOut: FitOut): RadiatorFinish;
export function finishOf(o: Door | Window | Radiator, fitOut: FitOut): string {
  if (o.finish) return o.finish;
  return o.kind === "door" ? fitOut.doors.finish : o.kind === "window" ? fitOut.windows.finish : fitOut.radiators.finish;
}

/**
 * Size changes that come with picking a style, so the opening looks like one:
 * a towel rail is tall and narrow, a convector sits in the floor.
 */
export const STYLE_SHAPE = {
  door: {
    hinged: {},
    double: { width: 140 },
    sliding: { swing: "sliding" },
    pocket: { swing: "sliding" },
    glazed: {},
    balcony: { height: 215 },
    barn: { swing: "sliding" },
    bifold: {},
  },
  window: {
    casement: {},
    tilt_turn: {},
    sliding: {},
    fixed: { openable: false },
    floor_to_ceiling: { sillHeight: 0 },
  },
  radiator: {
    panel: { height: 60, depth: 10 },
    column: { height: 60, depth: 12 },
    towel: { width: 50, height: 120, depth: 8 },
    vertical: { width: 45, height: 180, depth: 10 },
    convector: { height: 12, depth: 25 },
  },
} as const satisfies {
  door: Record<DoorStyle, Partial<Door>>;
  window: Record<WindowStyle, Partial<Window>>;
  radiator: Record<RadiatorStyle, Partial<Radiator>>;
};

export function applyDoorStyle(d: Door, style: DoorStyle): Door {
  const next: Door = { ...d, ...STYLE_SHAPE.door[style], style };
  if (style === "double") next.width = Math.max(d.width, STYLE_SHAPE.door.double.width);
  // Leaving a sliding style: the leaf swings into the room again.
  if (!slides(next) && next.swing === "sliding") next.swing = "in";
  return next;
}

export function applyWindowStyle(w: Window, style: WindowStyle, ceilingHeight: number): Window {
  const next: Window = { ...w, openable: true, ...STYLE_SHAPE.window[style], style };
  if (style === "floor_to_ceiling") next.height = ceilingHeight;
  return next;
}

export const applyRadiatorStyle = (r: Radiator, style: RadiatorStyle): Radiator => ({ ...r, ...STYLE_SHAPE.radiator[style], style });
