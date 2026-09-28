import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { radiatorParts } from "@/domain/room/opening-parts";
import type { RadiatorStyle } from "@/domain/schemas/room";

/*
 * Radiator bodies as their makers build them, in the radiator's local frame:
 * x along the wall from its start, y up from its bottom, z centred with +z
 * towards the room. Repeated parts come from radiatorParts().
 */

const box = (w: number, h: number, d: number, x: number, y: number, z: number, r = 0) =>
  (r > 0.05 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)) : new THREE.BoxGeometry(w, h, d)).translate(x, y, z);

function tube(r: number, length: number, axis: "x" | "y", x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, length, 14, 1);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  return g.translate(x, y, z);
}

/** Every part of one radiator, in its local frame (see the file comment). */
export function radiatorGeometry(style: RadiatorStyle, w: number, h: number, d: number): THREE.BufferGeometry[] {
  const p = radiatorParts(style, w, h);
  switch (style) {
    case "panel": {
      // Type 22: front and back channelled panels, side covers and a slotted top grille.
      // The back sheet is the front turned round (a rotation, not a mirror, so faces keep their winding).
      const front = channelledSheet(w, h - 1, p.pitch).translate(0, 0, d / 2 - 0.6);
      const back = channelledSheet(w, h - 1, p.pitch).rotateY(Math.PI).translate(w, 0, -d / 2 + 0.6);
      const slots = Math.max(4, Math.round(w / 1.2));
      return [
        front,
        back,
        box(0.3, h - 1, d - 0.4, 0.15, (h - 1) / 2, 0),
        box(0.3, h - 1, d - 0.4, w - 0.15, (h - 1) / 2, 0),
        ...Array.from({ length: slots }, (_, i) => box(w / slots - 0.5, 0.3, d - 1.4, (w / slots) * (i + 0.5), h - 0.15, 0)),
      ];
    }
    case "column": {
      // Sections of 2–4 round columns joined top and bottom, butting like cast sections on their nipples.
      const cols = Math.max(2, Math.round(d / 4.5));
      const r = Math.min(1.35, p.pitch * 0.32);
      const zs = Array.from({ length: cols }, (_, j) => (cols === 1 ? 0 : -d / 2 + r + ((d - 2 * r) * j) / (cols - 1)));
      return Array.from({ length: p.count }, (_, i) => {
        const x = p.pitch * (i + 0.5);
        return [
          ...zs.map((z) => new THREE.CapsuleGeometry(r, h - 2 * r, 3, 10).translate(x, h / 2, z)),
          box(p.pitch, 5, d - 0.5, x, 3, 0, 2),
          box(p.pitch, 5, d - 0.5, x, h - 3, 0, 2),
        ];
      }).flat();
    }
    case "vertical": {
      // Flat-oval tubes between round manifolds.
      return [
        ...Array.from({ length: p.count }, (_, i) => box(p.pitch - 1.2, h - 6, 3, p.pitch * (i + 0.5), h / 2, 1, 1.4)),
        tube(1.8, w, "x", w / 2, 2.5, -1),
        tube(1.8, w, "x", w / 2, h - 2.5, -1),
      ];
    }
    case "towel": {
      // Two round rails and the bars between them.
      return [
        tube(1.6, h, "y", 1.6, h / 2, 0),
        tube(1.6, h, "y", w - 1.6, h / 2, 0),
        ...p.bars.map((y) => tube(1.1, w - 3.2, "x", w / 2, y, 0)),
      ];
    }
    case "convector": {
      // Grille bars across the trench, inside an angle frame, flush with the floor.
      return [
        ...Array.from({ length: p.count }, (_, i) => box(p.pitch * 0.45, 0.9, d - 1.6, p.pitch * (i + 0.5), 0.45, 0)),
        box(w, 0.4, 0.8, w / 2, 0.2, d / 2 - 0.4),
        box(w, 0.4, 0.8, w / 2, 0.2, -d / 2 + 0.4),
        box(0.8, 0.4, d, 0.4, 0.2, 0),
        box(0.8, 0.4, d, w - 0.4, 0.2, 0),
      ];
    }
  }
}

/**
 * One pressed-steel sheet `w` × `h`, 0.15 cm thick, with a rounded vertical
 * channel every `pitch` cm, facing +z.
 */
function channelledSheet(w: number, h: number, pitch: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const n = Math.round(w / pitch);
  const front: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    // Flat for 60 % of the pitch, then a 0.5 cm deep rounded groove.
    const x = i * pitch;
    front.push([x, 0], [x + pitch * 0.6, 0]);
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      front.push([x + pitch * (0.6 + 0.4 * t), -0.5 * Math.sin(Math.PI * t)]);
    }
  }
  front.push([w, 0]);
  // Shape y is −depth, so after rotating the extrusion upright the front faces +z.
  shape.moveTo(front[0]![0], -front[0]![1]);
  for (const [x, z] of front.slice(1)) shape.lineTo(x, -z);
  for (const [x, z] of [...front].reverse()) shape.lineTo(x, -(z - 0.15));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}
