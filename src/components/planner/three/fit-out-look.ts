import type { DoorFinish, FrameFinish, RadiatorFinish } from "@/domain/schemas/room";

/**
 * How each door, window-frame and radiator finish is drawn: the 3D material
 * and the swatch in the planner share these, so the two never drift apart.
 */
export type Look =
  | { kind: "paint"; color: string; rough: number }
  | { kind: "wood"; color: string }
  | { kind: "metal"; color: string; rough: number }
  | { kind: "glass" };

export const DOOR_LOOK: Readonly<Record<DoorFinish, Look>> = {
  white_lacquer: { kind: "paint", color: "#f3f0ea", rough: 0.35 },
  light_oak: { kind: "wood", color: "#c9a57a" },
  walnut: { kind: "wood", color: "#5e4030" },
  black: { kind: "paint", color: "#252321", rough: 0.45 },
  glass: { kind: "glass" },
};

export const FRAME_LOOK: Readonly<Record<FrameFinish, Look>> = {
  white: { kind: "paint", color: "#f4f2ee", rough: 0.4 },
  oak: { kind: "wood", color: "#b88e60" },
  anthracite: { kind: "paint", color: "#3b3e42", rough: 0.5 },
  black: { kind: "paint", color: "#1f1e1d", rough: 0.5 },
};

export const RADIATOR_LOOK: Readonly<Record<RadiatorFinish, Look>> = {
  white: { kind: "paint", color: "#f3f1ec", rough: 0.4 },
  anthracite: { kind: "paint", color: "#3a3d40", rough: 0.45 },
  black: { kind: "paint", color: "#1e1d1c", rough: 0.45 },
  chrome: { kind: "metal", color: "#d8dadc", rough: 0.12 },
};

const WOOD_IMAGE = "url(/textures/oak_veneer_01/diff.webp) center / 90px";

/** CSS background for a finish swatch. */
export function swatchOf(look: Look): string {
  switch (look.kind) {
    case "paint":
      return look.color;
    case "wood":
      // Tint the oak photo towards the finish colour, as the 3D material does.
      return `linear-gradient(${look.color}b3, ${look.color}b3), ${WOOD_IMAGE}`;
    case "metal":
      return `linear-gradient(135deg, #f4f5f6, ${look.color} 45%, #9ea2a6 60%, #eef0f1)`;
    case "glass":
      return "linear-gradient(135deg, #e9f1f3, #b9ccd2 60%, #dfe9ec)";
  }
}
