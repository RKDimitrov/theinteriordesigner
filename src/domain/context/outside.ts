import { z } from "zod";

/*
 * What lies outside the apartment: the kind of area, water or mountains
 * nearby, and what each wall looks onto. The 3D view picks a panorama for
 * the distance and builds the near context (the building below the flat,
 * facades across the street or courtyard) from these.
 */

export const SurroundingsKind = z.enum(["city_centre", "urban", "suburban", "rural"]);
export type SurroundingsKind = z.infer<typeof SurroundingsKind>;

export const Surroundings = z.object({
  kind: SurroundingsKind.default("urban"),
  waterfront: z.boolean().default(false),
  mountains: z.boolean().default(false),
});
export type Surroundings = z.infer<typeof Surroundings>;

export const Outlook = z.enum(["street", "courtyard", "garden", "open"]);
export type Outlook = z.infer<typeof Outlook>;

/** What each wall looks onto, keyed by wall index; unset walls take the area's default. */
export const WallOutlooks = z.record(z.string().regex(/^\d{1,2}$/), Outlook);
export type WallOutlooks = z.infer<typeof WallOutlooks>;

/** Storey height used to place the ground below a flat. */
export const STOREY_CM = 300;

export type HeightBand = "ground" | "low" | "mid" | "high";

/** Ground floor (and basements), 1st–3rd, 4th–8th, 9th and up. */
export function heightBand(floorLevel: number): HeightBand {
  if (floorLevel <= 0) return "ground";
  if (floorLevel <= 3) return "low";
  if (floorLevel <= 8) return "mid";
  return "high";
}

/** How far below the flat's floor the ground is. Basement flats are treated as ground level. */
export const groundBelowCm = (floorLevel: number): number => Math.max(0, floorLevel) * STOREY_CM;

export const defaultOutlook = (kind: SurroundingsKind): Outlook => (kind === "suburban" ? "garden" : kind === "rural" ? "open" : "street");

/** Distance to the facade opposite, or null where nothing stands across (gardens, open land). */
export const OPPOSITE_DISTANCE_CM: Readonly<Record<Outlook, number | null>> = { street: 1800, courtyard: 1400, garden: null, open: null };

/**
 * Panoramas (asset ids, see assets/manifest/hdris.json) by area and height.
 * From the middle floors up the view is over the rooftops, so "mid" uses the
 * high panorama.
 */
const PANORAMA: Readonly<Record<SurroundingsKind | "waterfront" | "mountains", Readonly<Record<"ground" | "low" | "high", string>>>> = {
  city_centre: { ground: "potsdamer_platz", low: "hamburg_canal", high: "hotel_rooftop_balcony" },
  urban: { ground: "urban_street_01", low: "urban_street_03", high: "homecoming_center_rooftop" },
  suburban: { ground: "suburban_garden", low: "stuttgart_suburbs", high: "stuttgart_hillside" },
  rural: { ground: "farm_field", low: "belfast_open_field", high: "rolling_hills" },
  waterfront: { ground: "binnenalster", low: "binnenalster", high: "binnenalster" },
  mountains: { ground: "alps_field", low: "alps_field", high: "fouriesburg_mountain_lookout" },
};

/** The panorama seen from a flat: water and mountains win over the area; courtyards and gardens show from the lower floors. */
export function backplateFor(s: Surroundings, band: HeightBand, outlook?: Outlook): string {
  const b = band === "mid" ? "high" : band;
  if (b !== "high" && outlook === "courtyard") return "urban_courtyard";
  if (b !== "high" && outlook === "garden" && s.kind !== "rural") return "residential_garden";
  if (s.waterfront) return PANORAMA.waterfront[b];
  if (s.mountains) return PANORAMA.mountains[b];
  return PANORAMA[s.kind][b];
}

/**
 * The outlook most windows in view share. `counts` has one entry per room:
 * how many windows look onto each outlook.
 */
export function dominantOutlook(counts: readonly Partial<Record<Outlook, number>>[], fallback: Outlook): Outlook {
  const total = new Map<Outlook, number>();
  for (const c of counts) for (const [o, n] of Object.entries(c) as [Outlook, number][]) total.set(o, (total.get(o) ?? 0) + n);
  let best = fallback;
  let bestN = 0;
  for (const [o, n] of total) if (n > bestN) [best, bestN] = [o, n];
  return best;
}
