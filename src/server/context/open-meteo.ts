import { z } from "zod";
import type { DailyClimate } from "@/domain/context/climate";
import type { Location } from "@/domain/schemas/context";

/** Open-Meteo clients (free, no key). `fetchFn` is injectable for tests. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 20_000;

export class OpenMeteoError extends Error {}

async function getJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new OpenMeteoError(`Open-Meteo returned HTTP ${res.status}`);
  return res.json();
}

const GeocodeResponse = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

/** City-level coordinates, or null when the city is not found. */
export async function geocodeCity(city: string, country: string, fetchFn: FetchFn = fetch): Promise<Location | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city.trim());
  url.searchParams.set("countryCode", country.toUpperCase());
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const parsed = GeocodeResponse.safeParse(await getJson(fetchFn, url.toString()));
  if (!parsed.success) throw new OpenMeteoError("Unexpected geocoding response");
  const r = parsed.data.results?.[0];
  if (!r) return null;
  return {
    lat: r.latitude,
    lng: r.longitude,
    label: [r.name, r.admin1, country.toUpperCase()].filter(Boolean).join(", "),
    timezone: r.timezone ?? null,
  };
}

const Num = z.number().nullable();
const ArchiveResponse = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_mean: z.array(Num),
    relative_humidity_2m_mean: z.array(Num),
    daylight_duration: z.array(Num),
    sunshine_duration: z.array(Num),
  }),
});

/** The last `years` full calendar years before `now`. */
export function climatePeriod(now: Date, years = 10): { from: string; to: string } {
  const last = now.getUTCFullYear() - 1;
  return { from: `${last - years + 1}-01-01`, to: `${last}-12-31` };
}

/** Daily ERA5 reanalysis data for the climate summary. */
export async function fetchDailyClimate(
  lat: number,
  lng: number,
  period: { from: string; to: string },
  fetchFn: FetchFn = fetch,
): Promise<DailyClimate> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("start_date", period.from);
  url.searchParams.set("end_date", period.to);
  url.searchParams.set("daily", "temperature_2m_mean,relative_humidity_2m_mean,daylight_duration,sunshine_duration");
  url.searchParams.set("timezone", "auto");
  const parsed = ArchiveResponse.safeParse(await getJson(fetchFn, url.toString()));
  if (!parsed.success) throw new OpenMeteoError("Unexpected climate response");
  const d = parsed.data.daily;
  if (d.time.length === 0) throw new OpenMeteoError("No climate data for this location");
  return {
    time: d.time,
    temperatureMeanC: d.temperature_2m_mean,
    humidityMeanPct: d.relative_humidity_2m_mean,
    daylightSeconds: d.daylight_duration,
    sunshineSeconds: d.sunshine_duration,
  };
}
