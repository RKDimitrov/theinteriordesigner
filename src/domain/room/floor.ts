import { z } from "zod";
import { bbox, rectPolygon } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import { FixedKind, type Opening, RoofSlope, RoomShape, RoomType } from "../schemas/room";

/*
 * A whole floor written down once: rooms where they stand, with their doors,
 * windows, passages, fixed elements and roof slopes, in the coordinates of a
 * sketch. `floorRooms` turns it into the app's rooms and plan positions,
 * turning the drawing first when the sketch was drawn sideways. Pure, so the
 * conversion is tested; scripts/import-floor.ts writes the result.
 */

const Side = z.number().int().nonnegative();

const FloorOpening = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("door"), wall: Side, offset: z.number().min(0), width: z.number().positive(), height: z.number().positive().default(200), hinge: z.enum(["start", "end"]).default("start"), swing: z.enum(["in", "out", "sliding"]).default("in") }),
  /** A doorway or arch without a leaf. */
  z.object({ kind: z.literal("pass"), wall: Side, offset: z.number().min(0), width: z.number().positive(), height: z.number().positive().default(200) }),
  z.object({ kind: z.literal("window"), wall: Side, offset: z.number().min(0), width: z.number().positive(), height: z.number().positive(), sillHeight: z.number().min(0) }),
]);
export type FloorOpening = z.infer<typeof FloorOpening>;

const FloorFixed = z.object({ label: z.string().min(1).max(60), kind: FixedKind, x: z.number(), y: z.number(), w: z.number().positive(), d: z.number().positive(), height: z.number().positive() });

const FloorRoom = z
  .object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(60),
    type: RoomType,
    ceilingHeight: z.number().int(),
    /** Where the room's local origin sits in the sketch, cm. */
    x: z.number(),
    y: z.number(),
    /** A rectangle w × d, or a clockwise (y-down) outline in room coordinates. */
    w: z.number().positive().optional(),
    d: z.number().positive().optional(),
    polygon: z.array(z.object({ x: z.number(), y: z.number() })).min(3).optional(),
    openings: z.array(FloorOpening).default([]),
    fixed: z.array(FloorFixed).default([]),
    roofSlopes: z.array(RoofSlope).default([]),
  })
  .refine((r) => r.polygon || (r.w && r.d), { message: "give w and d, or a polygon" });
export type FloorRoom = z.infer<typeof FloorRoom>;

export const Floor = z.object({
  apartment: z.object({
    name: z.string().min(1).max(80),
    address: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    country: z.string().length(2),
    floorLevel: z.number().int(),
    tenure: z.enum(["rent", "own"]),
    northAngleDeg: z.number().min(0).max(359).default(0),
  }),
  /** Clockwise quarter turns that bring the sketch into the plan's orientation. */
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  rooms: z.array(FloorRoom).min(1),
});
export type Floor = z.infer<typeof Floor>;

export interface FloorResult {
  key: string;
  shape: RoomShape;
  /** The room's origin on the apartment plan, cm. */
  origin: Vec;
}

const outline = (r: FloorRoom): Vec[] => r.polygon ?? rectPolygon(r.w!, r.d!);

/** Turns sketch points `turns` quarter turns clockwise inside a frame `width` × `height`. */
function turn(p: Vec, turns: number, width: number, height: number): Vec {
  let q = p;
  let [w, h] = [width, height];
  for (let i = 0; i < turns; i++) {
    q = { x: h - q.y, y: q.x };
    [w, h] = [h, w];
  }
  return q;
}

/** The rooms of a floor, turned into the plan's orientation, each starting at its top-left corner. */
export function floorRooms(floor: Floor): FloorResult[] {
  const turns = floor.rotate / 90;
  const absolute = floor.rooms.map((r) => outline(r).map((p) => ({ x: r.x + p.x, y: r.y + p.y })));
  const all = absolute.flat();
  const width = Math.max(...all.map((p) => p.x));
  const height = Math.max(...all.map((p) => p.y));

  return floor.rooms.map((r, i) => {
    const turned = absolute[i]!.map((p) => turn(p, turns, width, height));
    // Start the outline at its top-left corner, as rooms drawn in the app do.
    const start = turned.reduce((best, p, k) => (p.y < turned[best]!.y - 1e-6 || (Math.abs(p.y - turned[best]!.y) < 1e-6 && p.x < turned[best]!.x) ? k : best), 0);
    const n = turned.length;
    const ordered = turned.map((_, k) => turned[(k + start) % n]!);
    const box = bbox(ordered);
    const origin = { x: round(box.x), y: round(box.y) };
    const polygon = ordered.map((p) => ({ x: round(p.x - box.x), y: round(p.y - box.y) }));
    const wallOf = (wall: number) => (wall - start + n) % n;

    const openings: Opening[] = r.openings.map((o, k): Opening => {
      const onWall = { id: `${o.kind}-${k + 1}`, wallIndex: wallOf(o.wall), offset: Math.round(o.offset), width: Math.round(o.width) };
      if (o.kind === "window") return { ...onWall, kind: "window", height: o.height, sillHeight: o.sillHeight, openable: true };
      if (o.kind === "pass") return { ...onWall, kind: "door", height: o.height, hinge: "start", swing: "none" };
      return { ...onWall, kind: "door", height: o.height, hinge: o.hinge, swing: o.swing };
    });
    const fixedElements = r.fixed.map((f, k) => {
      const corners = rectPolygon(f.w, f.d, r.x + f.x, r.y + f.y).map((p) => turn(p, turns, width, height));
      const b = bbox(corners);
      return { id: `fixed-${k + 1}`, label: f.label, kind: f.kind, rect: { x: round(b.x - box.x), y: round(b.y - box.y), w: Math.max(1, Math.round(b.w)), d: Math.max(1, Math.round(b.d)) }, height: Math.round(f.height) };
    });
    const roofSlopes = r.roofSlopes.map((s) => ({ ...s, wallIndex: wallOf(s.wallIndex) })).sort((a, b) => a.wallIndex - b.wallIndex);
    const shape: RoomShape = { name: r.name, type: r.type, polygon, ceilingHeight: r.ceilingHeight, openings, fixedElements, wallOrientationOverrides: {}, roofSlopes };
    return { key: r.key, shape, origin };
  });
}

const round = (v: number) => Math.round(v * 10) / 10;
