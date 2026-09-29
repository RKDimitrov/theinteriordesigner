"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Material } from "@/domain/materials/library";
import { ASSET_CATALOGUE, type TextureId } from "./assets";
import { tintFor, usePbr } from "./textures";

/*
 * Wall, floor and ceiling materials from the library in
 * src/domain/materials/library.ts. Geometry must carry UVs in cm (cmUV), so
 * each texture tiles at its real-world size.
 */

const hex = (rgb: readonly number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** The material's overall colour: its tint, or the photo's mean. Used in drawing mode and for swatches. */
export function materialColor(m: Material): string {
  if (m.tint) return m.tint;
  const e = ASSET_CATALOGUE[m.texture];
  return e?.kind === "texture" ? hex(e.mean) : "#cccccc";
}

/** Thumbnail background for a picker swatch: the texture's preview, tinted like the 3D material. */
export function materialSwatch(m: Material): string {
  const thumb = ASSET_CATALOGUE[m.texture]?.thumb;
  if (m.group === "paint") return m.tint!;
  if (!thumb) return materialColor(m);
  return m.tint ? `linear-gradient(${m.tint}cc, ${m.tint}cc), url(${thumb}) center / cover` : `url(${thumb}) center / cover`;
}

/** Photographed PBR material, tinted to the material's colour. Suspends while loading. */
export function RealSurface({ m, side = THREE.FrontSide }: { m: Material; side?: THREE.Side }) {
  const id = m.texture as TextureId;
  const t = usePbr(id);
  const color = useMemo(() => (m.tint ? tintFor(m.tint, id) : new THREE.Color("#ffffff")), [m.tint, id]);
  // Paint hides most of the plaster's relief.
  const normalScale = useMemo(() => new THREE.Vector2(m.group === "paint" ? 0.25 : 1, m.group === "paint" ? 0.25 : 1), [m.group]);
  return <meshStandardMaterial {...t} color={color} normalScale={normalScale} side={side} {...(m.roughness !== undefined ? { roughness: m.roughness } : {})} />;
}

/** Flat colour for drawing mode and while textures load. */
export function FlatSurface({ m, side = THREE.FrontSide }: { m: Material; side?: THREE.Side }) {
  return <meshStandardMaterial color={materialColor(m)} roughness={0.9} side={side} />;
}
