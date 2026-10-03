import { z } from "zod";

/*
 * How the walkthrough camera sees: its vertical field of view and the height
 * of the person walking. A wide view, like a person's own field of vision or
 * a property tour, keeps rooms feeling as large as they do in real life; a
 * narrow one crops them and makes doors look big. Remembered per browser.
 */

export const WALK_FOV = { min: 55, max: 95, initial: 75 } as const;
/** The walker's height (cm); the eyes are EYE_BELOW_TOP_CM lower. */
export const WALK_HEIGHT = { min: 150, max: 200, initial: 180 } as const;
export const EYE_BELOW_TOP_CM = 12;

export const WalkView = z.object({
  fov: z.number().int().min(WALK_FOV.min).max(WALK_FOV.max),
  height: z.number().int().min(WALK_HEIGHT.min).max(WALK_HEIGHT.max),
});
export type WalkView = z.infer<typeof WalkView>;

/** A new key, so the old narrow view saved by earlier versions is not carried over. */
export const WALK_VIEW_STORAGE_KEY = "raumplan.walk-view.v2";
export const DEFAULT_WALK_VIEW: WalkView = { fov: WALK_FOV.initial, height: WALK_HEIGHT.initial };

/** Standing eye height (cm) of the walker. */
export const walkEye = (view: WalkView): number => view.height - EYE_BELOW_TOP_CM;

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
