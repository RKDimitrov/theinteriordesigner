import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Wall } from "@/domain/geometry/walls";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { wallPieces, type WallShare } from "@/domain/planner/walls3d";
import { type RoofRoom, wallTop } from "@/domain/room/roof";
import type { Opening } from "@/domain/schemas/room";
import { cmUV } from "./geometry";
import { sideSign } from "./openings3d";

/*
 * One wall as a mesh, shared by the planner's 3D view and the apartment
 * page's preview: solid pieces around its doors and windows, the top
 * following a roof slope, and half the thickness where another room's wall
 * runs along it (so the two do not overlap and flicker). In the wall's own
 * frame: x along the wall, y up, z out of the room.
 */

const W = PLANNER_WALL_CM;

/** Height of a wall's top at `t` cm along it, from its profile. */
function topAt(top: readonly { t: number; h: number }[], t: number): number {
  for (let i = 1; i < top.length; i++) {
    const a = top[i - 1]!;
    const b = top[i]!;
    if (t <= b.t) return a.h + ((b.h - a.h) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
  }
  return top[top.length - 1]!.h;
}

/** A wall piece whose top may run into the roof: its outline cut by the top profile, given the wall's thickness. */
function slopedPiece(p: { from: number; to: number; y0: number; y1: number }, top: readonly { t: number; h: number }[], side: number, thickness: number): THREE.BufferGeometry[] {
  const ts = [p.from, ...top.map((q) => q.t).filter((t) => t > p.from && t < p.to), p.to];
  const heights = ts.map((t) => Math.min(p.y1, topAt(top, t)));
  if (heights.every((h) => h <= p.y0 + 0.5)) return [];
  const shape = new THREE.Shape();
  shape.moveTo(p.from, p.y0);
  shape.lineTo(p.to, p.y0);
  for (let i = ts.length - 1; i >= 0; i--) shape.lineTo(ts[i]!, Math.max(p.y0, heights[i]!));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // Extruded along +z from 0 to the thickness; walls sit on the side away from the room.
  if (side > 0) g.translate(0, 0, -thickness);
  return [g.toNonIndexed()];
}

export function wallGeometry(room: RoofRoom & { openings: readonly Opening[] }, wall: Wall, share?: WallShare): THREE.BufferGeometry {
  const thickness = share?.shared ? W / 2 : W;
  const pieces = wallPieces(wall.length, room.ceilingHeight, [...room.openings.filter((o) => o.wallIndex === wall.index), ...(share?.cuts ?? [])]);
  const side = sideSign(wall);
  const top = wallTop(room, wall);
  const flat = top.every((p) => p.h >= room.ceilingHeight);
  const parts = pieces.flatMap((p) =>
    flat ? [new THREE.BoxGeometry(p.to - p.from, p.y1 - p.y0, thickness).translate((p.from + p.to) / 2, (p.y0 + p.y1) / 2, (-thickness / 2) * side)] : slopedPiece(p, top, side, thickness),
  );
  const merged = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
  parts.forEach((g) => g.dispose());
  return cmUV(merged);
}
