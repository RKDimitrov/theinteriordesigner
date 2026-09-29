"use client";

import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { DECOR_KINDS, type DecorKind, type DecorProp, dressPiece } from "@/domain/design/decor";
import type { FurnitureItem } from "@/domain/schemas/design";
import { ASSET_CATALOGUE, type ModelId } from "./assets";
import { MODEL_IDS } from "./asset-ids";
import { AssetBoundary } from "./asset-boundary";

/** Turns that make a prop's front face +z (checked by rendering each model). */
const DECOR_TURN: Partial<Record<ModelId, number>> = {
  standing_picture_frame_01: 270,
  standing_picture_frame_02: 270,
  desk_lamp_arm_01: 180,
};

/** The prop models of each kind, from the manifest tags ("decor.vase"). */
export const DECOR_MODELS: Readonly<Record<DecorKind, readonly ModelId[]>> = (() => {
  const out = {} as Record<DecorKind, ModelId[]>;
  for (const k of DECOR_KINDS) out[k] = MODEL_IDS.filter((id) => ASSET_CATALOGUE[id]!.tags.includes(`decor.${k}`));
  return out;
})();

/**
 * The props on one piece, in its frame (floor at y = 0, front towards +z).
 * Each loads on its own, so a missing model drops only that prop.
 */
export function PieceDecor3D({ f, h }: { f: FurnitureItem; h: number }) {
  const props = useMemo(() => dressPiece({ ...f, h }), [f, h]);
  return (
    <>
      {props.map((p) => {
        const ids = DECOR_MODELS[p.kind];
        const id = ids[p.variant % Math.max(1, ids.length)];
        if (!id) return null;
        return (
          <AssetBoundary key={p.slot} fallback={null}>
            <Suspense fallback={null}>
              <Prop p={p} id={id} />
            </Suspense>
          </AssetBoundary>
        );
      })}
    </>
  );
}

function Prop({ p, id }: { p: DecorProp; id: ModelId }) {
  const { scene } = useGLTF(`/models/${id}.glb`, false, true);
  const object = useMemo(() => fitInside(scene.clone(true), p.box, DECOR_TURN[id] ?? 0), [scene, p.box, id]);
  return (
    <group position={[p.x, p.elevation, p.y]} rotation-y={(-p.rotation * Math.PI) / 180}>
      <primitive object={object} />
    </group>
  );
}

/** Scales a model uniformly to the largest size that fits in a [w, d, h] box, standing on y = 0 and centred. */
function fitInside(object: THREE.Object3D, [w, d, h]: readonly [number, number, number], turnDeg: number): THREE.Group {
  const root = new THREE.Group();
  object.rotation.y = (turnDeg * Math.PI) / 180;
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  root.add(object);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  object.position.set(-centre.x, -box.min.y, -centre.z);
  root.scale.setScalar(Math.min(w / (size.x || 1), d / (size.z || 1), h / (size.y || 1)));
  return root;
}
