import "server-only";
import { assembleContext } from "@/domain/context/assemble";
import { classifyClimate, summarizeClimate } from "@/domain/context/climate";
import { roomDaylight } from "@/domain/context/daylight";
import { renterRules } from "@/domain/context/renter-rules";
import { topStyles } from "@/domain/profile/quiz";
import { type Apartment } from "@/domain/schemas/apartment";
import { Climate, type DesignContext, Location } from "@/domain/schemas/context";
import { getApartment, setApartmentLocation } from "../repo/apartments";
import { getProfile } from "../repo/profiles";
import { listRooms } from "../repo/rooms";
import { cacheKeys, deleteCached, getCached, putCached } from "./cache";
import { climatePeriod, fetchDailyClimate, geocodeCity } from "./open-meteo";
import { getCachedTrends } from "./trends";

const GEO_TTL_DAYS = 365;
const CLIMATE_TTL_DAYS = 365;

async function resolveLocation(userId: string, apt: Apartment): Promise<Location | null> {
  const key = cacheKeys.geocode(apt.country, apt.city);
  const cached = await getCached(key, Location);
  if (apt.lat !== null && apt.lng !== null) {
    return { lat: apt.lat, lng: apt.lng, label: cached?.value.label ?? `${apt.city}, ${apt.country}`, timezone: cached?.value.timezone ?? null };
  }
  let loc = cached?.value ?? null;
  if (!loc) {
    try {
      loc = await geocodeCity(apt.city, apt.country);
    } catch (e) {
      console.warn("Geocoding failed", e);
      return null;
    }
    if (!loc) return null;
    await putCached(key, "geocode", loc, GEO_TTL_DAYS);
  }
  await setApartmentLocation(userId, apt.id, loc);
  return loc;
}

async function resolveClimate(loc: Location): Promise<Climate | null> {
  const key = cacheKeys.climate(loc.lat, loc.lng);
  const cached = await getCached(key, Climate);
  if (cached) return cached.value;
  try {
    const period = climatePeriod(new Date());
    const daily = await fetchDailyClimate(loc.lat, loc.lng, period);
    const summary = summarizeClimate(daily, loc.lat);
    const climate: Climate = { summary, classes: classifyClimate(summary), period, fetchedAt: new Date().toISOString() };
    await putCached(key, "climate", climate, CLIMATE_TTL_DAYS);
    return climate;
  } catch (e) {
    console.warn("Climate fetch failed", e);
    return null;
  }
}

/**
 * Everything design generation needs to know about the apartment's
 * surroundings. Geocoding and climate are fetched once and cached; trends are
 * only read from cache (research runs on explicit request).
 */
export async function buildDesignContext(userId: string, apartmentId: string): Promise<DesignContext | null> {
  const apt = await getApartment(userId, apartmentId);
  if (!apt) return null;
  const [rooms, profile, location] = await Promise.all([listRooms(userId, apartmentId), getProfile(userId, apartmentId), resolveLocation(userId, apt)]);
  const climate = location ? await resolveClimate(location) : null;
  const styles = profile ? topStyles(profile.scores, 3) : null;
  const main = styles?.[0];
  const trends = main ? await getCachedTrends(apt.country, main.style) : null;

  return assembleContext({
    apartmentId,
    now: new Date(),
    location,
    climate,
    rooms: rooms.map((r) => roomDaylight(r, apt.northAngleDeg, location?.lat ?? null, apt.floorLevel)),
    renter: renterRules(apt.country, apt.tenure),
    topStyles: styles,
    trends,
  });
}

/** Forget cached location and climate so the next build fetches them again. */
export async function resetLocation(userId: string, apartmentId: string): Promise<boolean> {
  const apt = await getApartment(userId, apartmentId);
  if (!apt) return false;
  const keys = [cacheKeys.geocode(apt.country, apt.city)];
  if (apt.lat !== null && apt.lng !== null) keys.push(cacheKeys.climate(apt.lat, apt.lng));
  await deleteCached(keys);
  await setApartmentLocation(userId, apartmentId, null);
  return true;
}
