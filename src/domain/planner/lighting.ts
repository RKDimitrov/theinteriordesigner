import { bbox } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import type { FixedElement, RoomShape } from "../schemas/room";

/*
 * Artificial light and the sky, for the 3D view. Pure, so the rules are
 * tested: when a room's lights are on, where its lamps are, which of them
 * get a real-time light (the rest glow only), their colour, and how bright
 * the view outside is for the sun's height.
 */

/** Lights come on by themselves after dark; a room switched by hand keeps its state. */
export const roomLit = (roomId: string, switched: Readonly<Record<string, boolean>>, hour: number): boolean => switched[roomId] ?? (hour >= 19 || hour < 7);

export interface Lamp {
  id: string;
  /** Room coordinates of the light, and its height above the floor. */
  x: number;
  y: number;
  elevation: number;
  kind: "ceiling" | "floor_lamp";
}

interface LampPiece {
  id: string;
  category: string;
  x: number;
  y: number;
  h: number;
}

/**
 * Where a room's light comes from: pendants and chandeliers (the bulbs sit
 * about four fifths of the way down), floor lamps (under the shade), or, in
 * a room without lamps, one ceiling light in the middle.
 */
export function lampSources(room: Pick<RoomShape, "ceilingHeight" | "polygon"> & { fixedElements: readonly FixedElement[] }, furniture: readonly LampPiece[]): Lamp[] {
  const out: Lamp[] = [];
  for (const f of room.fixedElements) {
    if (f.kind !== "pendant" && f.kind !== "chandelier") continue;
    out.push({ id: f.id, x: f.rect.x + f.rect.w / 2, y: f.rect.y + f.rect.d / 2, elevation: room.ceilingHeight - Math.min(f.height, room.ceilingHeight) * 0.8, kind: "ceiling" });
  }
  for (const f of furniture) if (f.category === "floor_lamp") out.push({ id: f.id, x: f.x, y: f.y, elevation: Math.max(80, f.h - 20), kind: "floor_lamp" });
  if (out.length === 0) {
    const b = bbox(room.polygon);
    out.push({ id: "ceiling", x: b.x + b.w / 2, y: b.y + b.d / 2, elevation: room.ceilingHeight - 20, kind: "ceiling" });
  }
  return out;
}

/** Real-time lights are costly: only the `max` nearest the camera get one. */
export function nearestLights<T extends { pos: { x: number; y: number; z: number } }>(lamps: readonly T[], camera: { x: number; y: number; z: number }, max: number): T[] {
  const d = (p: T["pos"]) => (p.x - camera.x) ** 2 + (p.y - camera.y) ** 2 + (p.z - camera.z) ** 2;
  return [...lamps].sort((a, b) => d(a.pos) - d(b.pos)).slice(0, max);
}

const clamp255 = (n: number) => Math.round(Math.min(255, Math.max(0, n)));

/** Colour of a light source at `kelvin` (Tanner Helland's fit), as #rrggbb. */
export function kelvinToHex(kelvin: number): string {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Brightness and colour of the view outside for a sun `altitude` degrees above the horizon. */
export function skyLight(altitude: number): { light: number; tint: string } {
  if (altitude >= 15) return { light: 1, tint: "#ffffff" };
  if (altitude >= 3) return { light: 0.85, tint: "#ffe2c4" };
  if (altitude >= -4) return { light: 0.5, tint: "#e8c9c9" };
  if (altitude >= -12) return { light: 0.22, tint: "#8e9ac4" };
  return { light: 0.1, tint: "#5b6690" };
}

/** A lamp's world position once its room is placed at `origin`. */
export const lampWorld = (l: Lamp, origin: Vec) => ({ x: origin.x + l.x, y: l.elevation, z: origin.y + l.y });
