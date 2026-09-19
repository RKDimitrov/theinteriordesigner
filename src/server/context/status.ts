import "server-only";
import { topStyles } from "@/domain/profile/quiz";
import { Climate } from "@/domain/schemas/context";
import { getApartment } from "../repo/apartments";
import { getProfile } from "../repo/profiles";
import { cacheKeys, getCached } from "./cache";
import { getCachedTrends } from "./trends";

/** Step 3 is done when climate and trends are cached. Reads cache only, never fetches. */
export async function contextStatus(userId: string, apartmentId: string): Promise<boolean> {
  const [apt, profile] = await Promise.all([getApartment(userId, apartmentId), getProfile(userId, apartmentId)]);
  if (!apt || apt.lat === null || apt.lng === null) return false;
  const main = profile ? topStyles(profile.scores, 1)[0] : undefined;
  if (!main) return false;
  const [climate, trends] = await Promise.all([getCached(cacheKeys.climate(apt.lat, apt.lng), Climate), getCachedTrends(apt.country, main.style)]);
  return climate !== null && trends !== null;
}
