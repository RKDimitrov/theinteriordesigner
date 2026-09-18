import { rectPolygon } from "../geometry/polygon";
import { snap } from "../geometry/units";
import type { RoomShape, RoomType } from "../schemas/room";

export interface RectRoomParams {
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  ceilingHeight?: number;
}

/**
 * Rectangular room with walls indexed clockwise from the top-left corner:
 * 0 = top, 1 = right, 2 = bottom, 3 = left.
 */
export function rectRoom(p: RectRoomParams): RoomShape {
  return {
    name: p.name,
    type: p.type,
    polygon: rectPolygon(snap(p.widthCm), snap(p.lengthCm)),
    ceilingHeight: p.ceilingHeight ?? 250,
    openings: [],
    fixedElements: [],
    wallOrientationOverrides: {},
  };
}

/** Resize a rectangular room anchored at its top-left corner. Openings keep their offsets. */
export function resizeRect(room: RoomShape, widthCm: number, lengthCm: number): RoomShape {
  const origin = room.polygon[0] ?? { x: 0, y: 0 };
  return { ...room, polygon: rectPolygon(snap(widthCm), snap(lengthCm), origin.x, origin.y) };
}
