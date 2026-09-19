import type { CachedTrends, Climate, ContextWarning, DesignContext, Location, RenterRules, RoomDaylight } from "../schemas/context";
import type { StyleKey } from "../schemas/profile";

export interface ContextParts {
  apartmentId: string;
  now: Date;
  location: Location | null;
  climate: Climate | null;
  rooms: RoomDaylight[];
  renter: RenterRules;
  topStyles: { style: StyleKey; score: number }[] | null;
  trends: CachedTrends | null;
}

/** Combine the parts into a DesignContext and list what is missing. */
export function assembleContext(p: ContextParts): DesignContext {
  const warnings: ContextWarning[] = [];
  if (!p.location) warnings.push("noLocation");
  if (!p.climate) warnings.push("noClimate");
  if (p.rooms.length === 0) warnings.push("noRooms");
  if (!p.topStyles || p.topStyles.length === 0) warnings.push("noProfile");
  if (!p.trends) warnings.push("noTrends");
  return {
    apartmentId: p.apartmentId,
    generatedAt: p.now.toISOString(),
    location: p.location,
    climate: p.climate,
    rooms: p.rooms,
    renter: p.renter,
    topStyles: p.topStyles ?? [],
    trends: p.trends,
    warnings,
  };
}
