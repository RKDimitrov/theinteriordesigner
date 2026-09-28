import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { TEXTURE_CM, TEXTURE_MEAN, type TextureId } from "./assets";

const urls = (id: TextureId) => [`/textures/${id}/diff.webp`, `/textures/${id}/nor.webp`, `/textures/${id}/arm.webp`];

export interface Pbr {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** The packed AO/roughness/metal map; three.js reads roughness from green. */
  roughnessMap: THREE.Texture;
}

/**
 * A PBR set tiled at real-world size for geometry whose UVs are in cm
 * (room floors, and parts built with cmUV). Suspends while loading.
 */
export function usePbr(id: TextureId): Pbr {
  const [map, normalMap, roughnessMap] = useTexture(urls(id), (loaded) => tile(id, loaded as THREE.Texture[])) as THREE.Texture[];
  return useMemo(() => ({ map: map!, normalMap: normalMap!, roughnessMap: roughnessMap! }), [map, normalMap, roughnessMap]);
}

/** Textures are cached per URL, so this runs once per set. */
function tile(id: TextureId, textures: THREE.Texture[]) {
  textures.forEach((t, i) => {
    if (t.userData["tiled"]) return;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.setScalar(1 / TEXTURE_CM[id]);
    t.anisotropy = 8;
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace;
    t.userData["tiled"] = true;
    t.needsUpdate = true;
  });
}

usePbr.preload = (id: TextureId) => useTexture.preload(urls(id));

/**
 * Material colour that shifts a texture's average to `hex` while keeping its
 * grain or weave: light oak becomes walnut for a dark brown piece.
 */
export function tintFor(hex: string, id: TextureId): THREE.Color {
  const target = new THREE.Color(hex);
  const mean = TEXTURE_MEAN[id];
  const avg = new THREE.Color().setRGB(mean[0] / 255, mean[1] / 255, mean[2] / 255, THREE.SRGBColorSpace);
  return new THREE.Color(target.r / avg.r, target.g / avg.g, target.b / avg.b);
}
