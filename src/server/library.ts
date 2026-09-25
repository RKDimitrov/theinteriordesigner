import "server-only";
import type { z } from "zod";
import type { FurnitureCategory, Surface, Textile } from "@/domain/schemas/design";
import { listApartments } from "./repo/apartments";
import { getDesign } from "./repo/designs";
import { getProfile } from "./repo/profiles";
import { listRooms } from "./repo/rooms";

export type PieceGroup = "seating" | "tables" | "storage" | "lighting" | "textiles" | "other";

export interface LibraryPiece {
  key: string;
  name: string;
  kind: { type: "furniture"; category: FurnitureCategory } | { type: "light" } | { type: "textile"; textile: z.infer<typeof Textile>["type"] };
  group: PieceGroup;
  dims: { w: number; d: number; h?: number } | null;
  tier: "anchor" | "mid" | "swappable" | null;
  price: { min: number; max: number } | null;
  colorHex: string | null;
  renterFriendly: boolean;
  mine: boolean;
  /** Where it appears: the design page of a room, or the style profile for owned pieces. */
  href: string;
  where: string;
}

export type LibraryMaterial = {
  key: string;
  name: string;
  hex: string;
  detail: string;
  href: string;
  where: string;
} & ({ kind: "surface"; tag: z.infer<typeof Surface>["surface"] } | { kind: "palette"; tag: "base" | "secondary" | "accent" });

export interface LibraryData {
  pieces: LibraryPiece[];
  materials: LibraryMaterial[];
  /** Style profile to add an owned piece to (first apartment), or null without apartments. */
  addOwnHref: string | null;
}

const GROUPS: Partial<Record<FurnitureCategory, PieceGroup>> = {
  sofa: "seating",
  armchair: "seating",
  office_chair: "seating",
  dining_chair: "seating",
  bench: "seating",
  coffee_table: "tables",
  side_table: "tables",
  dining_table: "tables",
  desk: "tables",
  nightstand: "tables",
  wardrobe: "storage",
  dresser: "storage",
  bookshelf: "storage",
  sideboard: "storage",
  storage: "storage",
  tv_unit: "storage",
  shoe_cabinet: "storage",
  wall_shelf: "storage",
  coat_rack: "storage",
  floor_lamp: "lighting",
  rug: "textiles",
};

/**
 * Everything the latest design of each room uses, plus the pieces the user
 * keeps. Built from stored designs and style profiles only.
 */
export async function libraryData(userId: string): Promise<LibraryData> {
  const apartments = await listApartments(userId);
  const pieces: LibraryPiece[] = [];
  const materials: LibraryMaterial[] = [];

  await Promise.all(
    apartments.map(async (apt) => {
      const [rooms, profile] = await Promise.all([listRooms(userId, apt.id), getProfile(userId, apt.id)]);
      for (const m of profile?.mustKeep ?? []) {
        pieces.push({
          key: `keep-${apt.id}-${m.id}`,
          name: m.name,
          kind: { type: "furniture", category: m.category },
          group: GROUPS[m.category] ?? "other",
          dims: { w: m.w, d: m.d, h: m.h },
          tier: null,
          price: null,
          colorHex: m.colorHex,
          renterFriendly: true,
          mine: true,
          href: `/apartments/${apt.id}/profile#must-keep`,
          where: apt.name,
        });
      }
      const designs = await Promise.all(rooms.map((r) => getDesign(userId, r.id)));
      rooms.forEach((room, i) => {
        const design = designs[i];
        if (!design) return;
        const href = `/apartments/${apt.id}/design/${room.id}`;
        const where = `${room.name} · v${design.version}`;
        const c = design.content;
        for (const f of c.furniture) {
          if (f.existing) continue; // listed once, as an owned piece
          pieces.push({
            key: `${room.id}-${f.id}`,
            name: f.name,
            kind: { type: "furniture", category: f.category },
            group: GROUPS[f.category] ?? "other",
            dims: { w: f.w, d: f.d, h: f.h },
            tier: f.investmentTier,
            price: { min: f.price.min, max: f.price.max },
            colorHex: f.colorHex,
            renterFriendly: f.renterFriendly && !f.requiresDrilling,
            mine: false,
            href,
            where,
          });
        }
        for (const l of c.lighting) {
          if (l.itemId) continue; // floor and table lamps are already furniture
          pieces.push({
            key: `${room.id}-${l.id}`,
            name: l.fixture,
            kind: { type: "light" },
            group: "lighting",
            dims: null,
            tier: null,
            price: { min: l.price.min, max: l.price.max },
            colorHex: null,
            renterFriendly: !l.requiresDrilling,
            mine: false,
            href,
            where,
          });
        }
        for (const x of c.textiles) {
          pieces.push({
            key: `${room.id}-${x.id}`,
            name: `${x.material}${x.size ? `, ${x.size}` : ""}`,
            kind: { type: "textile", textile: x.type },
            group: "textiles",
            dims: null,
            tier: null,
            price: { min: x.price.min, max: x.price.max },
            colorHex: x.colorHex,
            renterFriendly: true,
            mine: false,
            href,
            where,
          });
        }
        c.surfaces.forEach((s, j) => {
          materials.push({
            key: `${room.id}-surface-${j}`,
            kind: "surface",
            tag: s.surface,
            name: s.material,
            hex: s.colorHex,
            detail: s.paint && s.paint.system !== "none" ? `${s.finish} · ${s.paint.system} ${s.paint.code ?? ""}`.trim() : s.finish,
            href,
            where,
          });
        });
        (["base", "secondary", "accent"] as const).forEach((role) => {
          const p = c.palette[role];
          materials.push({
            key: `${room.id}-palette-${role}`,
            kind: "palette",
            tag: role,
            name: p.name,
            hex: p.hex,
            detail: p.paint.system !== "none" ? `${p.paint.system} ${p.paint.code ?? ""}`.trim() : p.usage.join(", "),
            href,
            where,
          });
        });
      });
    })
  );

  const first = apartments[0];
  return { pieces, materials, addOwnHref: first ? `/apartments/${first.id}/profile#must-keep` : null };
}
