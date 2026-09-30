import { z } from "zod";

/*
 * How much the 3D view draws. Three levels trade looks for speed; "auto"
 * follows the measured frame rate. Pure, so the levels and the stored
 * choice are tested.
 */

export const Quality = z.enum(["low", "medium", "high"]);
export type Quality = z.infer<typeof Quality>;

export const QualityChoice = z.enum(["auto", "low", "medium", "high"]);
export type QualityChoice = z.infer<typeof QualityChoice>;

export interface QualitySettings {
  /** Ambient occlusion, the costliest pass. */
  ao: boolean;
  /** Glow round lamps and bright windows. */
  bloom: boolean;
  /** Decor props on the furniture. */
  decor: boolean;
  /** Device pixel ratio range the canvas may use. */
  dpr: readonly [number, number];
  /** Real-time lamps; the rest only glow. */
  maxLights: number;
  /** Sun shadow map size in pixels. */
  shadowMap: number;
}

export const QUALITY: Readonly<Record<Quality, QualitySettings>> = {
  low: { ao: false, bloom: false, decor: false, dpr: [1, 1], maxLights: 3, shadowMap: 1024 },
  medium: { ao: true, bloom: true, decor: true, dpr: [1, 1.25], maxLights: 5, shadowMap: 2048 },
  high: { ao: true, bloom: true, decor: true, dpr: [1, 1.5], maxLights: 8, shadowMap: 2048 },
};

const ORDER: readonly Quality[] = ["low", "medium", "high"];
export const stepDown = (q: Quality): Quality => ORDER[Math.max(0, ORDER.indexOf(q) - 1)]!;
export const stepUp = (q: Quality): Quality => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(q) + 1)]!;

/** Below this the view feels sluggish; above the upper mark there is room for more. */
export const FPS_TOO_SLOW = 28;
export const FPS_ROOM_FOR_MORE = 57;

/** What a measured frame rate says about the current level. */
export const judgeFrameRate = (fps: number): "down" | "up" | "hold" => (fps < FPS_TOO_SLOW ? "down" : fps > FPS_ROOM_FOR_MORE ? "up" : "hold");

/** The level in force: the user's, or on Auto the one the frame rate settled on. */
export const effectiveQuality = (choice: QualityChoice, measured: Quality): Quality => (choice === "auto" ? measured : choice);

/** What the browser remembers between visits. */
export const StoredQuality = z.object({ choice: QualityChoice, measured: Quality });
export type StoredQuality = z.infer<typeof StoredQuality>;

export const QUALITY_STORAGE_KEY = "raumplan.quality";

/** The remembered choice, or Auto starting at High when nothing usable is stored. */
export function parseStoredQuality(raw: string | null): StoredQuality {
  const fresh: StoredQuality = { choice: "auto", measured: "high" };
  if (!raw) return fresh;
  try {
    const parsed = StoredQuality.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fresh;
  } catch {
    return fresh;
  }
}
