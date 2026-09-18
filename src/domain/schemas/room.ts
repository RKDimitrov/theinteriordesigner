import { z } from "zod";
import { Cm, Id, Polygon, PositiveCm } from "./common";

export const RoomType = z.enum([
  "living",
  "bedroom",
  "kitchen",
  "bath",
  "office",
  "hallway",
  "dining",
  "kids",
  "storage",
  "other",
]);
export type RoomType = z.infer<typeof RoomType>;

export const Cardinal = z.enum(["N", "E", "S", "W"]);
export type Cardinal = z.infer<typeof Cardinal>;

/** Every opening sits on one wall: edge `wallIndex` of the room polygon, `offset` cm from its start vertex. */
const OnWall = {
  id: Id,
  wallIndex: z.number().int().nonnegative(),
  offset: Cm,
  width: PositiveCm,
};

export const Door = z.object({
  ...OnWall,
  kind: z.literal("door"),
  height: PositiveCm.default(200),
  /** Which end of the opening (along the wall direction) carries the hinge. */
  hinge: z.enum(["start", "end"]),
  /** "in" swings into this room; "out" swings away from it. */
  swing: z.enum(["in", "out", "sliding"]),
});

export const Window = z.object({
  ...OnWall,
  kind: z.literal("window"),
  height: PositiveCm,
  sillHeight: Cm,
  openable: z.boolean().default(true),
});

export const Radiator = z.object({
  ...OnWall,
  kind: z.literal("radiator"),
  height: PositiveCm,
  depth: PositiveCm.default(10),
});

export const Socket = z.object({
  ...OnWall,
  kind: z.literal("socket"),
  height: Cm.default(30),
  socketType: z.enum(["power", "tv", "network"]).default("power"),
});

export const Opening = z.discriminatedUnion("kind", [Door, Window, Radiator, Socket]);
export type Opening = z.infer<typeof Opening>;
export type Door = z.infer<typeof Door>;
export type Window = z.infer<typeof Window>;
export type Radiator = z.infer<typeof Radiator>;
export type Socket = z.infer<typeof Socket>;
export type OpeningKind = Opening["kind"];

export const FixedElement = z.object({
  id: Id,
  label: z.string().trim().min(1).max(60),
  kind: z.enum(["chimney", "built_in", "column", "kitchen_run", "other"]),
  /** Axis-aligned footprint in room coordinates. */
  rect: z.object({ x: z.number(), y: z.number(), w: PositiveCm, d: PositiveCm }),
  height: PositiveCm,
});
export type FixedElement = z.infer<typeof FixedElement>;

export const RoomShape = z.object({
  name: z.string().trim().min(1, "Room name is required").max(60),
  type: RoomType,
  /** Clockwise (y-down) polygon in cm. */
  polygon: Polygon,
  ceilingHeight: z.number().int().min(180).max(600),
  openings: z.array(Opening).max(50).default([]),
  fixedElements: z.array(FixedElement).max(30).default([]),
  /** Optional manual override of derived wall orientations, keyed by wall index. */
  wallOrientationOverrides: z.record(z.string(), Cardinal).default({}),
});
export type RoomShape = z.infer<typeof RoomShape>;

export const Room = RoomShape.extend({ id: Id, apartmentId: Id, sortOrder: z.number().int() });
export type Room = z.infer<typeof Room>;
