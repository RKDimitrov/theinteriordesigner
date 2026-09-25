import "server-only";
import { topStyles } from "@/domain/profile/quiz";
import { Climate, type Trend } from "@/domain/schemas/context";
import type { Room } from "@/domain/schemas/room";
import { cacheKeys, getCached } from "./context/cache";
import { getCachedTrends } from "./context/trends";
import { getApartment } from "./repo/apartments";
import { getDesign } from "./repo/designs";
import { getProfile } from "./repo/profiles";
import { listRooms } from "./repo/rooms";

export type Pin =
  | { kind: "photo"; key: string; room: Room; href: string }
  | { kind: "slip"; key: string; text: string; source: string }
  | { kind: "fabric"; key: string; hex: string; label: string }
  | { kind: "palette"; key: string; colors: { hex: string; name: string; share: number }[]; caption: string }
  | { kind: "trend"; key: string; trend: Trend };

/**
 * Pins for one apartment's board, auto-collected from stored data: room plans,
 * each room's latest design (concept, palette, textiles), cached trends and
 * climate tips. Nothing is fetched.
 */
export async function moodboardPins(userId: string, apartmentId: string): Promise<Pin[] | null> {
  const apt = await getApartment(userId, apartmentId);
  if (!apt) return null;
  const [rooms, profile, climate] = await Promise.all([
    listRooms(userId, apartmentId),
    getProfile(userId, apartmentId),
    apt.lat !== null && apt.lng !== null ? getCached(cacheKeys.climate(apt.lat, apt.lng), Climate) : null,
  ]);
  const main = profile ? topStyles(profile.scores, 1)[0] : undefined;
  const [designs, trends] = await Promise.all([
    Promise.all(rooms.map((r) => getDesign(userId, r.id))),
    main ? getCachedTrends(apt.country, main.style) : null,
  ]);

  const pins: Pin[] = [];
  rooms.forEach((room, i) => {
    const d = designs[i];
    pins.push({ kind: "photo", key: `photo-${room.id}`, room, href: `/apartments/${apt.id}/design/${room.id}` });
    if (!d) return;
    const c = d.content;
    pins.push({ kind: "slip", key: `concept-${room.id}`, text: c.concept.summary, source: `${room.name} · ${c.concept.title}` });
    pins.push({
      kind: "palette",
      key: `palette-${room.id}`,
      colors: (["base", "secondary", "accent"] as const).map((r) => ({ hex: c.palette[r].hex, name: c.palette[r].name, share: c.palette[r].share })),
      caption: room.name,
    });
    for (const x of c.textiles.slice(0, 2)) pins.push({ kind: "fabric", key: `fabric-${room.id}-${x.id}`, hex: x.colorHex, label: x.material });
  });
  for (const tr of trends?.trends.slice(0, 4) ?? []) pins.push({ kind: "trend", key: `trend-${tr.name}`, trend: tr });
  for (const [i, h] of (climate?.value.classes.hints ?? []).slice(0, 2).entries()) pins.push({ kind: "slip", key: `climate-${i}`, text: h, source: apt.city });

  // Interleave kinds so the board does not read as one block per type.
  const order: Pin["kind"][] = ["photo", "slip", "fabric", "palette", "trend"];
  const buckets = order.map((k) => pins.filter((p) => p.kind === k));
  const mixed: Pin[] = [];
  while (buckets.some((b) => b.length > 0)) for (const b of buckets) if (b.length > 0) mixed.push(b.shift()!);
  return mixed;
}
