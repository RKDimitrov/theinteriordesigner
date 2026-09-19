import { getPosition } from "suncalc";
import { area } from "../geometry/polygon";
import { m2 } from "../geometry/units";
import { bearingToCardinal, wallFacingBearing, wallsOf } from "../geometry/walls";
import type { RoomDaylight } from "../schemas/context";
import type { Cardinal, Room } from "../schemas/room";

const DIFFUSE = 0.3;
const DIRECT = 0.7;

/** Relative sun on a façade facing `bearing` (0 = N) at `lat`, 0..1 vs the equator-facing façade. */
export function facadeSunFactor(bearing: number, lat: number | null): number {
  if (lat === null) return cardinalFallback(bearing);
  const own = directSun(bearing, lat);
  const best = directSun(lat >= 0 ? 180 : 0, lat);
  if (best <= 0) return DIFFUSE;
  return DIFFUSE + DIRECT * Math.min(1, own / best);
}

/** Without a location assume the northern hemisphere: south 1, east/west 0.7, north 0.35. */
function cardinalFallback(bearing: number): number {
  const c = bearingToCardinal(bearing);
  if (c === "S") return 1;
  if (c === "N") return 0.35;
  return 0.7;
}

const directCache = new Map<string, number>();

/** Average direct-beam incidence on a vertical façade: 21st of each month, hourly. */
function directSun(bearing: number, lat: number): number {
  const key = `${Math.round(bearing)}:${lat.toFixed(1)}`;
  const cached = directCache.get(key);
  if (cached !== undefined) return cached;
  let sum = 0;
  let n = 0;
  for (let month = 0; month < 12; month++) {
    for (let hour = 0; hour < 24; hour++) {
      // Longitude 0 and UTC keep solar noon near 12:00, which is all the ratio needs.
      const pos = getPosition(new Date(Date.UTC(2025, month, 21, hour, 30)), lat, 0);
      n++;
      if (pos.altitude <= 0) continue;
      // suncalc 2.x: altitude and azimuth in degrees, azimuth clockwise from north.
      const rad = Math.PI / 180;
      const incidence = Math.cos(pos.altitude * rad) * Math.cos((pos.azimuth - bearing) * rad);
      if (incidence > 0) sum += incidence;
    }
  }
  const v = sum / n;
  directCache.set(key, v);
  return v;
}

export function floorFactor(floorLevel: number): number {
  return Math.min(1.05, Math.max(0.85, 0.85 + 0.05 * floorLevel));
}

export const DAYLIGHT_THRESHOLDS = { medium: 0.08, high: 0.15 } as const;

/**
 * Daylight estimate for one room: window-to-floor ratio × orientation factor
 * (area-weighted over windows) × floor factor.
 */
export function roomDaylight(room: Pick<Room, "id" | "name" | "polygon" | "openings">, northAngleDeg: number, lat: number | null, floorLevel: number): RoomDaylight {
  const walls = wallsOf(room.polygon);
  const floorCm2 = area(room.polygon);
  let windowCm2 = 0;
  let weighted = 0;
  const areaByDir = new Map<Cardinal, number>();

  for (const o of room.openings) {
    if (o.kind !== "window") continue;
    const wall = walls[o.wallIndex];
    if (!wall) continue;
    const a = o.width * o.height;
    const bearing = wallFacingBearing(wall, northAngleDeg);
    windowCm2 += a;
    weighted += a * facadeSunFactor(bearing, lat);
    const dir = bearingToCardinal(bearing);
    areaByDir.set(dir, (areaByDir.get(dir) ?? 0) + a);
  }

  const ratio = floorCm2 > 0 ? windowCm2 / floorCm2 : 0;
  if (windowCm2 === 0) {
    return {
      roomId: room.id,
      name: room.name,
      level: "low",
      score: 0,
      windowFloorRatio: 0,
      windowAreaM2: 0,
      dominantOrientation: null,
      lightTemperature: "neutral",
      hint: "No windows: rely on layered artificial light (ambient + task + accent) and light, warm surfaces.",
    };
  }

  const score = ratio * (weighted / windowCm2) * floorFactor(floorLevel);
  const level = score >= DAYLIGHT_THRESHOLDS.high ? "high" : score >= DAYLIGHT_THRESHOLDS.medium ? "medium" : "low";
  const dominant = [...areaByDir.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const southern = lat !== null && lat < 0;
  const poleward: Cardinal = southern ? "S" : "N";
  const equatorward: Cardinal = southern ? "N" : "S";
  const lightTemperature = dominant === poleward ? "cool" : dominant === equatorward || dominant === "W" ? "warm" : "neutral";

  return {
    roomId: room.id,
    name: room.name,
    level,
    score: Math.round(score * 1000) / 1000,
    windowFloorRatio: Math.round(ratio * 1000) / 1000,
    windowAreaM2: Math.round(m2(windowCm2) * 100) / 100,
    dominantOrientation: dominant,
    lightTemperature,
    hint: daylightHint(level, lightTemperature),
  };
}

function daylightHint(level: RoomDaylight["level"], temp: RoomDaylight["lightTemperature"]): string {
  const tone =
    temp === "cool"
      ? "Cool, even light: warm the palette (warm whites, ochre, terracotta, wood) and avoid grey-blues on large surfaces."
      : temp === "warm"
        ? "Warm, direct sun: cooler or muted tones stay calm; use sheers for glare and UV protection."
        : "Balanced light: most palettes work; test paint samples at morning and evening.";
  const amount =
    level === "low"
      ? " Little daylight: keep walls light and reflective, use mirrors and more lamps."
      : level === "high"
        ? " Plenty of daylight: deeper accent colours are possible."
        : "";
  return tone + amount;
}
