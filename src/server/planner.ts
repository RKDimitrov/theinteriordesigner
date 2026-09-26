import "server-only";
import { renterRules } from "@/domain/context/renter-rules";
import { PLANNER_SOURCE } from "@/domain/planner/items";
import type { Apartment } from "@/domain/schemas/apartment";
import type { RenterRules } from "@/domain/schemas/context";
import type { DesignContent, DroppedItem, FurnitureItem } from "@/domain/schemas/design";
import type { MustKeepItem } from "@/domain/schemas/profile";
import type { Room } from "@/domain/schemas/room";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { apartmentRevisedAt, getApartment } from "./repo/apartments";
import { type DesignStatus, recentDesigns } from "./repo/designs";
import { getProfile } from "./repo/profiles";
import { listRooms } from "./repo/rooms";

/** The room's current design as the planner edits it. */
export interface PlannerDesign {
  version: number;
  status: DesignStatus;
  issues: ValidationIssue[];
  furniture: FurnitureItem[];
  concept: DesignContent["concept"];
  palette: { hex: string; name: string; share: number }[];
  /** True when this version was saved from the planner. */
  fromPlanner: boolean;
  /** The rest of the stored design (zones, lighting, …) so the client validates exactly what the server will. */
  content: DesignContent;
}

/** A piece the designer proposed that is not on the plan (the user removed it, or it did not fit). */
export interface PlannerSuggestion {
  id: string;
  name: string;
  category: FurnitureItem["category"];
  reason: "removed" | DroppedItem["reason"];
  /** Where the designer had put it; null when it never fitted. */
  item: FurnitureItem | null;
}

export interface PlannerRoom {
  room: Room;
  /** Newest version made by the designer (not the planner); a redesign changes it. */
  generatedVersion: number | null;
  design: PlannerDesign | null;
  suggestions: PlannerSuggestion[];
  budgetEur: number | null;
  mustKeep: MustKeepItem[];
}

export interface PlannerData {
  apartment: Pick<Apartment, "id" | "name" | "northAngleDeg" | "country" | "tenure" | "lat">;
  projectCode: string;
  rooms: PlannerRoom[];
  mustKeep: MustKeepItem[];
  renter: RenterRules;
  /** ISO time of the last saved change. */
  savedAt: string | null;
  hasProfile: boolean;
}

/** Short drawing number, e.g. "NOV-3F2A" (same as the overview's title block). */
export function projectCode(a: Pick<Apartment, "id" | "name">): string {
  const letters = a.name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "APT";
  return `${letters}-${a.id.slice(0, 4).toUpperCase()}`;
}

export async function plannerData(userId: string, apartmentId: string): Promise<PlannerData | null> {
  const apartment = await getApartment(userId, apartmentId);
  if (!apartment) return null;
  const [rooms, profile, revisedAt] = await Promise.all([
    listRooms(userId, apartmentId),
    getProfile(userId, apartmentId),
    apartmentRevisedAt(userId, apartmentId),
  ]);
  const versions = await Promise.all(rooms.map((r) => recentDesigns(userId, r.id)));
  const mustKeep = profile?.mustKeep ?? [];

  return {
    apartment: {
      id: apartment.id,
      name: apartment.name,
      northAngleDeg: apartment.northAngleDeg,
      country: apartment.country,
      tenure: apartment.tenure,
      lat: apartment.lat,
    },
    projectCode: projectCode(apartment),
    rooms: rooms.map((room, i) => {
      const history = versions[i] ?? [];
      const latest = history[0];
      const design: PlannerDesign | null = latest
        ? {
            version: latest.version,
            status: latest.validation.status,
            issues: latest.validation.issues,
            furniture: latest.content.furniture,
            concept: latest.content.concept,
            palette: (["base", "secondary", "accent"] as const).map((k) => ({
              hex: latest.content.palette[k].hex,
              name: latest.content.palette[k].name,
              share: latest.content.palette[k].share,
            })),
            fromPlanner: latest.source.promptId === PLANNER_SOURCE.promptId,
            content: latest.content,
          }
        : null;
      return {
        room,
        generatedVersion: history.find((d) => d.source.promptId !== PLANNER_SOURCE.promptId)?.version ?? null,
        design,
        suggestions: suggestionsFor(history),
        budgetEur: profile?.budgetPerRoom[room.id] ?? null,
        mustKeep: mustKeep.filter((m) => m.roomId === room.id),
      };
    }),
    mustKeep,
    renter: renterRules(apartment.country, apartment.tenure),
    savedAt: revisedAt?.toISOString() ?? null,
    hasProfile: profile !== null,
  };
}

/**
 * Pieces of the newest generated design that are not on the current plan, plus
 * the pieces the solver had to leave out. Only generated versions propose pieces.
 */
function suggestionsFor(history: readonly Awaited<ReturnType<typeof recentDesigns>>[number][]): PlannerSuggestion[] {
  const current = history[0];
  const generated = history.find((d) => d.source.promptId !== PLANNER_SOURCE.promptId);
  if (!current || !generated) return [];
  const onPlan = new Set(current.content.furniture.map((f) => f.id));
  const removed: PlannerSuggestion[] = generated.content.furniture
    .filter((f) => !onPlan.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, category: f.category, reason: "removed", item: f }));
  const dropped: PlannerSuggestion[] = (generated.validation.solver?.dropped ?? [])
    .filter((d) => !onPlan.has(d.id))
    .map((d) => ({ id: d.id, name: d.name, category: d.category, reason: d.reason, item: null }));
  return [...removed, ...dropped];
}
