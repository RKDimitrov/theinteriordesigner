import { openingSpan } from "../geometry/openings";
import { area, bbox } from "../geometry/polygon";
import type { Vec } from "../geometry/vec";
import { backAgainstRotation, wallOrientations, wallsOf } from "../geometry/walls";
import { keepClearZones } from "../geometry/zones";
import type { RoomShape } from "../schemas/room";
import { maxItems } from "./catalogue";
import { freeFloorRect, wallSlots } from "./solver/slots";

interface OpeningFact {
  id: string;
  kind: string;
  wallIndex: number;
  from: Vec;
  to: Vec;
  widthCm: number;
  heightCm: number;
  swing?: string;
  hinge?: string;
  sillHeightCm?: number;
  depthCm?: number;
  socketType?: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Vec) => ({ x: r1(p.x), y: r1(p.y) });

/**
 * Hard geometric facts for the design prompt. Everything is precomputed so
 * the model never has to derive wall directions or clearances itself.
 */
export function roomFacts(room: RoomShape & { id: string }, northAngleDeg: number) {
  const walls = wallsOf(room.polygon);
  const dirs = wallOrientations(room.polygon, northAngleDeg, room.wallOrientationOverrides);
  const b = bbox(room.polygon);
  const areaM2 = Math.round(area(room.polygon) / 1000) / 10;
  const floor = freeFloorRect(room);
  return {
    roomId: room.id,
    name: room.name,
    type: room.type,
    widthCm: r1(b.w),
    lengthCm: r1(b.d),
    areaM2,
    /** Most pieces of furniture (rugs and wall pieces included) this room should get. */
    itemCap: maxItems(areaM2, room.type),
    ceilingHeightCm: room.ceilingHeight,
    polygon: room.polygon.map(pt),
    walls: walls.map((w) => ({
      index: w.index,
      from: pt(w.a),
      to: pt(w.b),
      lengthCm: r1(w.length),
      facing: dirs[w.index],
      inwardNormal: pt(w.inward),
      /** Rotation that puts an item's back against this wall with its front facing into the room. */
      backAgainstRotation: backAgainstRotation(w),
    })),
    openings: room.openings.flatMap((o): OpeningFact[] => {
      const span = openingSpan(walls, o);
      if (!span) return [];
      const base = { id: o.id, kind: o.kind, wallIndex: o.wallIndex, from: pt(span.start), to: pt(span.end), widthCm: o.width };
      switch (o.kind) {
        case "door":
          return [{ ...base, heightCm: o.height, swing: o.swing, hinge: o.hinge }];
        case "window":
          return [{ ...base, sillHeightCm: o.sillHeight, heightCm: o.height }];
        case "radiator":
          return [{ ...base, heightCm: o.height, depthCm: o.depth }];
        case "socket":
          return [{ ...base, heightCm: o.height, socketType: o.socketType }];
      }
    }),
    /** Free wall runs for pieces up to 60 cm deep and taller than window sills; usableDepth leaves an 80 cm walkway. */
    wallSlots: wallSlots(room).map(({ wallIndex, from, to, length, usableDepth }) => ({ wallIndex, from, to, length, usableDepth })),
    /** Largest open floor rectangle, clear of doors, radiators and fixed elements. */
    freeFloorRect: { x: r1(floor.x), y: r1(floor.y), w: r1(floor.w), d: r1(floor.d) },
    fixedElements: room.fixedElements.map((f) => ({ id: f.id, label: f.label, kind: f.kind, rect: f.rect, heightCm: f.height })),
    keepClear: keepClearZones(room).map((z) => ({
      kind: z.kind,
      refId: z.refId,
      // Axis-aligned bounds are enough for the model; the validator uses exact polygons.
      bounds: (() => {
        const bb = bbox(z.polygon);
        return { x: r1(bb.x), y: r1(bb.y), w: r1(bb.w), d: r1(bb.d) };
      })(),
      ...(z.minBlockingHeight !== undefined ? { blocksItemsTallerThanCm: z.minBlockingHeight } : {}),
    })),
  };
}

export type RoomFacts = ReturnType<typeof roomFacts>;

/**
 * Facts for design-generate v2, where the model picks pieces and intents but
 * never coordinates: walls by index and length, openings by wall, free wall
 * runs, the open floor and the item cap. Coordinates stay only where they
 * explain a constraint (keep-clear areas, fixed elements).
 */
export function planFacts(room: RoomShape & { id: string }, northAngleDeg: number) {
  const f = roomFacts(room, northAngleDeg);
  return {
    roomId: f.roomId,
    name: f.name,
    type: f.type,
    widthCm: f.widthCm,
    lengthCm: f.lengthCm,
    areaM2: f.areaM2,
    itemCap: f.itemCap,
    ceilingHeightCm: f.ceilingHeightCm,
    walls: f.walls.map((w) => ({ index: w.index, lengthCm: w.lengthCm, facing: w.facing })),
    openings: room.openings.map((o) => ({
      id: o.id,
      kind: o.kind,
      wallIndex: o.wallIndex,
      offsetCm: o.offset,
      widthCm: o.width,
      ...(o.kind === "window" ? { sillHeightCm: o.sillHeight } : {}),
      ...(o.kind === "door" ? { swing: o.swing } : {}),
      ...(o.kind === "socket" ? { socketType: o.socketType } : {}),
    })),
    fixedElements: f.fixedElements,
    wallSlots: f.wallSlots,
    freeFloorRect: f.freeFloorRect,
    keepClear: f.keepClear,
  };
}
