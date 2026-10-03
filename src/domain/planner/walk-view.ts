import { z } from "zod";
import { EYE_STANDING } from "./walk-motion";

/*
 * How the walkthrough camera sees: its vertical field of view and the
 * standing eye height. A narrower view than the old 62° keeps rooms and
 * doors at the size they feel in person. Remembered per browser.
 */

export const WALK_FOV = { min: 40, max: 70, initial: 50 } as const;
export const WALK_EYE = { min: 140, max: 185, initial: EYE_STANDING } as const;

export const WalkView = z.object({
  fov: z.number().int().min(WALK_FOV.min).max(WALK_FOV.max),
  eye: z.number().int().min(WALK_EYE.min).max(WALK_EYE.max),
});
export type WalkView = z.infer<typeof WalkView>;

export const WALK_VIEW_STORAGE_KEY = "raumplan.walk-view";
export const DEFAULT_WALK_VIEW: WalkView = { fov: WALK_FOV.initial, eye: WALK_EYE.initial };

export function parseWalkView(raw: string | null): WalkView {
  if (!raw) return DEFAULT_WALK_VIEW;
  try {
    const parsed = WalkView.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_WALK_VIEW;
  } catch {
    return DEFAULT_WALK_VIEW;
  }
}

/** Width of the view across a screen of `aspect` (width / height), in degrees, for the settings label. */
export const horizontalFov = (verticalDeg: number, aspect: number): number => Math.round((2 * Math.atan(Math.tan((verticalDeg * Math.PI) / 360) * aspect) * 180) / Math.PI);
