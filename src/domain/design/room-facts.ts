import { openingSpan } from "../geometry/openings";
import { bbox } from "../geometry/polygon";
import { normDeg } from "../geometry/units";
import type { Vec } from "../geometry/vec";
import { planAngle, wallOrientations, wallsOf } from "../geometry/walls";
import { keepClearZones } from "../geometry/zones";
import type { RoomShape } from "../schemas/room";

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
  return {
    roomId: room.id,
    name: room.name,
    type: room.type,
    widthCm: r1(b.w),
    lengthCm: r1(b.d),
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
      backAgainstRotation: Math.round(normDeg(planAngle(w.inward) - 180)),
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
