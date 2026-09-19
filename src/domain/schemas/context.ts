import { z } from "zod";
import { Cardinal } from "./room";
import { StyleKey } from "./profile";

export const Level3 = z.enum(["low", "medium", "high"]);
export type Level3 = z.infer<typeof Level3>;

export const Location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string(),
  timezone: z.string().nullable(),
});
export type Location = z.infer<typeof Location>;

export const ClimateSummary = z.object({
  /** Mean annual heating degree days (Eurostat definition). */
  heatingDegreeDays: z.number().nonnegative(),
  meanHumidityPct: z.number().min(0).max(100),
  winterDaylightHours: z.number().min(0).max(24),
  winterSunshineHours: z.number().min(0).max(24),
  meanTempC: z.number(),
  years: z.number().int().positive(),
});
export type ClimateSummary = z.infer<typeof ClimateSummary>;

export const ClimateClasses = z.object({
  heating: Level3,
  humidity: z.enum(["dry", "moderate", "humid"]),
  winterLight: Level3,
  hints: z.array(z.string()),
});
export type ClimateClasses = z.infer<typeof ClimateClasses>;

export const Climate = z.object({
  summary: ClimateSummary,
  classes: ClimateClasses,
  period: z.object({ from: z.string(), to: z.string() }),
  fetchedAt: z.iso.datetime(),
});
export type Climate = z.infer<typeof Climate>;

export const RoomDaylight = z.object({
  roomId: z.string(),
  name: z.string(),
  level: Level3,
  score: z.number().nonnegative(),
  windowFloorRatio: z.number().nonnegative(),
  windowAreaM2: z.number().nonnegative(),
  dominantOrientation: Cardinal.nullable(),
  lightTemperature: z.enum(["cool", "neutral", "warm"]),
  hint: z.string(),
});
export type RoomDaylight = z.infer<typeof RoomDaylight>;

export const RenterRules = z.object({
  applies: z.boolean(),
  country: z.string(),
  drilling: z.enum(["free", "limited", "avoid"]),
  rules: z.array(z.object({ id: z.string(), text: z.string() })),
});
export type RenterRules = z.infer<typeof RenterRules>;

export const TrendCategory = z.enum(["color", "material", "furniture", "decor", "layout"]);
export const TrendLongevity = z.enum(["lasting", "mid", "fad"]);

export const Trend = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  category: TrendCategory,
  longevity: TrendLongevity,
});
export type Trend = z.infer<typeof Trend>;

export const Source = z.object({ title: z.string(), url: z.url() });

export const TrendsResult = z.object({
  trends: z.array(Trend).min(1).max(12),
  regionalCues: z.array(z.string().min(1).max(300)).max(8),
  sources: z.array(Source).max(20),
});
export type TrendsResult = z.infer<typeof TrendsResult>;

export const CachedTrends = TrendsResult.extend({
  country: z.string(),
  style: StyleKey,
  model: z.string(),
  fetchedAt: z.iso.datetime(),
});
export type CachedTrends = z.infer<typeof CachedTrends>;

export const DesignContext = z.object({
  apartmentId: z.string(),
  generatedAt: z.iso.datetime(),
  location: Location.nullable(),
  climate: Climate.nullable(),
  rooms: z.array(RoomDaylight),
  renter: RenterRules,
  topStyles: z.array(z.object({ style: StyleKey, score: z.number() })),
  trends: CachedTrends.nullable(),
  warnings: z.array(z.enum(["noLocation", "noClimate", "noProfile", "noTrends", "noRooms"])),
});
export type DesignContext = z.infer<typeof DesignContext>;
export type ContextWarning = DesignContext["warnings"][number];
