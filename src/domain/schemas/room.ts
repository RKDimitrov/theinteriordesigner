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

/*
 * Styles and finishes are optional so rooms saved before they existed stay
 * valid; read them through src/domain/room/fit-out.ts, which fills defaults.
 */
export const DoorStyle = z.enum(["hinged", "double", "sliding", "pocket", "glazed", "balcony", "barn", "bifold"]);
export type DoorStyle = z.infer<typeof DoorStyle>;
export const WindowStyle = z.enum(["casement", "tilt_turn", "sliding", "fixed", "floor_to_ceiling"]);
export type WindowStyle = z.infer<typeof WindowStyle>;
export const RadiatorStyle = z.enum(["panel", "column", "towel", "vertical", "convector"]);
export type RadiatorStyle = z.infer<typeof RadiatorStyle>;

/** How a leaf or a window looks, independent of how it opens. */
export const DoorDesign = z.enum(["flush", "shaker", "four_panel", "three_lite", "full_lite", "planks"]);
export type DoorDesign = z.infer<typeof DoorDesign>;
export const WindowDesign = z.enum(["plain", "grid", "transom"]);
export type WindowDesign = z.infer<typeof WindowDesign>;

export const DoorFinish = z.enum(["white_lacquer", "light_oak", "walnut", "black", "glass"]);
export type DoorFinish = z.infer<typeof DoorFinish>;
export const FrameFinish = z.enum(["white", "oak", "anthracite", "black"]);
export type FrameFinish = z.infer<typeof FrameFinish>;
export const RadiatorFinish = z.enum(["white", "anthracite", "black", "chrome"]);
export type RadiatorFinish = z.infer<typeof RadiatorFinish>;

export const Door = z.object({
  ...OnWall,
  kind: z.literal("door"),
  height: PositiveCm.default(200),
  /** Which end of the opening (along the wall direction) carries the hinge, or where a sliding leaf parks. */
  hinge: z.enum(["start", "end"]),
  /** "in" swings into this room; "out" swings away from it; "none" is a pass-through without a leaf. */
  swing: z.enum(["in", "out", "sliding", "none"]),
  style: DoorStyle.optional(),
  /** Overrides the apartment's default leaf design. */
  design: DoorDesign.optional(),
  /** Overrides the apartment's default door finish. */
  finish: DoorFinish.optional(),
});

/** Curtains or blinds on a window, open or closed. */
export const WindowTreatment = z.object({
  kind: z.enum(["curtains", "roller", "venetian"]),
  closed: z.boolean().default(false),
});
export type WindowTreatment = z.infer<typeof WindowTreatment>;

export const Window = z.object({
  ...OnWall,
  kind: z.literal("window"),
  height: PositiveCm,
  sillHeight: Cm,
  openable: z.boolean().default(true),
  style: WindowStyle.optional(),
  design: WindowDesign.optional(),
  treatment: WindowTreatment.optional(),
  /** Frame finish; overrides the apartment default. */
  finish: FrameFinish.optional(),
});

export const Radiator = z.object({
  ...OnWall,
  kind: z.literal("radiator"),
  height: PositiveCm,
  depth: PositiveCm.default(10),
  style: RadiatorStyle.optional(),
  finish: RadiatorFinish.optional(),
});

export const Socket = z.object({
  ...OnWall,
  kind: z.literal("socket"),
  height: Cm.default(30),
  socketType: z.enum(["power", "tv", "network"]).default("power"),
});

/** A light switch; `gangs` is how many rockers it has. */
export const Switch = z.object({
  ...OnWall,
  kind: z.literal("switch"),
  height: Cm.default(105),
  gangs: z.number().int().min(1).max(3).default(1),
});

export const Opening = z.discriminatedUnion("kind", [Door, Window, Radiator, Socket, Switch]);
export type Opening = z.infer<typeof Opening>;
export type Door = z.infer<typeof Door>;
export type Window = z.infer<typeof Window>;
export type Radiator = z.infer<typeof Radiator>;
export type Socket = z.infer<typeof Socket>;
export type Switch = z.infer<typeof Switch>;
export type OpeningKind = Opening["kind"];

/**
 * Fixed elements the design must work around. The first five are structure;
 * the rest are kitchen and bathroom fixtures and ceiling lights, placed in
 * the planner (see src/domain/room/fixtures.ts).
 */
export const FixedKind = z.enum(["chimney", "built_in", "column", "kitchen_run", "other", "fridge", "wc", "basin", "shower", "bathtub", "pendant", "chandelier"]);
export type FixedKind = z.infer<typeof FixedKind>;

/** What a kitchen run holds besides base units. */
export const KitchenOptions = z.object({
  sink: z.boolean().default(true),
  hob: z.boolean().default(true),
  oven: z.boolean().default(true),
  wallUnits: z.boolean().default(true),
});
export type KitchenOptions = z.infer<typeof KitchenOptions>;

export const FixedElement = z.object({
  id: Id,
  label: z.string().trim().min(1).max(60),
  kind: FixedKind,
  /** Axis-aligned footprint in room coordinates. */
  rect: z.object({ x: z.number(), y: z.number(), w: PositiveCm, d: PositiveCm }),
  height: PositiveCm,
  /** Plan angle the fixture's front faces (clockwise from plan up), for fixtures placed against a wall. */
  facing: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  kitchen: KitchenOptions.optional(),
  /** Asset id of the model chosen for this fixture; a default is used when unset. */
  model: z.string().max(80).optional(),
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
