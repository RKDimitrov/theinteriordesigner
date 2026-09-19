import type { ClimateClasses, ClimateSummary } from "../schemas/context";

export interface DailyClimate {
  /** ISO dates, YYYY-MM-DD. */
  time: readonly string[];
  temperatureMeanC: readonly (number | null)[];
  humidityMeanPct: readonly (number | null)[];
  /** Seconds per day. */
  daylightSeconds: readonly (number | null)[];
  sunshineSeconds: readonly (number | null)[];
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Eurostat heating degree days: a day with mean temperature ≤ 15 °C adds 18 − Tm. */
export const HDD_THRESHOLD_C = 15;
export const HDD_BASE_C = 18;

/**
 * Long-term summary of daily data. Winter is Dec–Feb in the northern hemisphere
 * and Jun–Aug in the southern one.
 */
export function summarizeClimate(d: DailyClimate, lat: number): ClimateSummary {
  const winterMonths = lat < 0 ? [6, 7, 8] : [12, 1, 2];
  const years = new Set<string>();
  let hdd = 0;
  const temps: number[] = [];
  const hums: number[] = [];
  const winterDaylight: number[] = [];
  const winterSun: number[] = [];

  d.time.forEach((date, i) => {
    years.add(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const t = d.temperatureMeanC[i];
    if (t !== null && t !== undefined) {
      temps.push(t);
      if (t <= HDD_THRESHOLD_C) hdd += HDD_BASE_C - t;
    }
    const h = d.humidityMeanPct[i];
    if (h !== null && h !== undefined) hums.push(h);
    if (winterMonths.includes(month)) {
      const dl = d.daylightSeconds[i];
      const sun = d.sunshineSeconds[i];
      if (dl !== null && dl !== undefined) winterDaylight.push(dl / 3600);
      if (sun !== null && sun !== undefined) winterSun.push(sun / 3600);
    }
  });

  const nYears = Math.max(1, years.size);
  return {
    heatingDegreeDays: Math.round(hdd / nYears),
    meanHumidityPct: round(mean(hums), 1),
    winterDaylightHours: round(mean(winterDaylight), 1),
    winterSunshineHours: round(mean(winterSun), 1),
    meanTempC: round(mean(temps), 1),
    years: nYears,
  };
}

export function classifyClimate(s: ClimateSummary): ClimateClasses {
  const heating = s.heatingDegreeDays < 1500 ? "low" : s.heatingDegreeDays <= 3000 ? "medium" : "high";
  const humidity = s.meanHumidityPct < 60 ? "dry" : s.meanHumidityPct <= 75 ? "moderate" : "humid";
  const winterLight = s.winterSunshineHours < 1.5 ? "low" : s.winterSunshineHours <= 3 ? "medium" : "high";

  const hints: string[] = [];
  if (heating === "high") hints.push("Long heating season: favour warm base tones, layered textiles, wool rugs and thick curtains.");
  if (heating === "medium") hints.push("Moderate heating season: add rugs and throws for winter, keep summer textiles light.");
  if (heating === "low") hints.push("Mild winters: prefer breathable natural fabrics, light rugs and cool, airy materials.");
  if (humidity === "humid") hints.push("Humid climate: choose washable, mould-resistant fabrics and avoid unsealed wood in wet areas.");
  if (humidity === "dry") hints.push("Dry air: solid wood can shrink; plants and natural fibres help comfort.");
  if (winterLight === "low") hints.push("Dark winters: use warm white light (2700 K), light reflective walls and layered lamps.");
  if (winterLight === "high") hints.push("Sunny winters: plan for glare control and UV-stable fabrics near windows.");
  return { heating, humidity, winterLight, hints };
}
