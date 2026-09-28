"use client";

import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import type { DoorHandle } from "@/domain/room/fit-out";
import { assetPaths } from "@/domain/assets/catalogue";
import { AssetBoundary } from "./asset-boundary";
import type { ModelId } from "./assets";
import type { V3 } from "./pieces";

/*
 * Real hardware models (asset pipeline, Sketchfab CC-BY). Hardware is never
 * stretched: each model is scaled uniformly to its real size and placed by
 * the point where it meets the door or radiator.
 */

export type HardwareKind = DoorHandle | "pull" | "valve";

interface Fit {
  id: ModelId;
  /** Uniform scale from the model's units to cm. */
  scale: number;
  /** Degrees, applied so the model projects along +z and its arm points +x. */
  rotation?: V3;
  /** The mounting point in the model's own units: spindle on the face, bar centre, valve inlet. */
  anchor: V3;
  /**
   * "face": one model per face of the leaf, mounted on the surface.
   * "through": a matched pair already spanning a 4–5 cm leaf, centred on it.
   */
  mount: "face" | "through";
}

/**
 * Measured from each model's bounds and orthographic renders (see the phase
 * B1 spec). The levers and the valve are modelled in metres, the knob and
 * the pull in arbitrary units.
 */
export const HARDWARE: Readonly<Record<HardwareKind, Fit>> = {
  lever_modern: { id: "handle_lever_modern", scale: 100, anchor: [-0.0525, 0, -0.0235], mount: "face" },
  lever_classic: { id: "handle_lever_classic", scale: 100, anchor: [-0.0473, 0.1017, -0.0015], mount: "through" },
  knob: { id: "handle_knob", scale: 6.5 / 32.3, rotation: [90, 0, 0], anchor: [0, 0, 0], mount: "face" },
  pull: { id: "handle_pull", scale: 35 / 55, rotation: [0, -90, 0], anchor: [0, -20, 0], mount: "face" },
  valve: { id: "radiator_valve_trv", scale: 100, anchor: [-0.064, 0, 0], mount: "face" },
};

const DEG = Math.PI / 180;

function Model({ fit }: { fit: Fit }) {
  const { scene } = useGLTF(assetPaths.model(fit.id), false, true);
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return copy;
  }, [scene]);
  const [rx, ry, rz] = fit.rotation ?? [0, 0, 0];
  return (
    <group rotation={[rx * DEG, ry * DEG, rz * DEG]}>
      <primitive object={object} position={[-fit.anchor[0], -fit.anchor[1], -fit.anchor[2]]} />
    </group>
  );
}

/** Stand-in drawn in code while a model loads or if it fails: a rose and a lever. */
function Plain({ kind }: { kind: HardwareKind }) {
  const steel = <meshStandardMaterial color="#9a9da0" metalness={1} roughness={0.3} />;
  if (kind === "valve")
    return (
      <mesh position={[6, 8, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 9, 16]} />
        <meshStandardMaterial color="#f1efe9" roughness={0.4} />
      </mesh>
    );
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.5]}>
        <cylinderGeometry args={[2.6, 2.6, 1, 20]} />
        {steel}
      </mesh>
      <mesh position={[6, 0, 5]}>
        <boxGeometry args={[12, 1.6, 1.6]} />
        {steel}
      </mesh>
    </group>
  );
}

/**
 * One piece of hardware at `at`. `face` is +1 on the leaf's front face, −1 on
 * its back; `point` is the direction a lever's arm points along x.
 */
export function Hardware({ kind, at, face = 1, point = 1, realistic }: { kind: HardwareKind; at: V3; face?: 1 | -1; point?: 1 | -1; realistic: boolean }) {
  const fit = HARDWARE[kind];
  const plain = <Plain kind={kind} />;
  // Mirroring (negative scale) keeps levers pointing the same way on both faces; three.js flips the winding.
  const s = fit.scale;
  return (
    <group position={at} scale={[point, 1, fit.mount === "through" ? 1 : face]}>
      {realistic ? (
        <AssetBoundary fallback={plain}>
          <Suspense fallback={plain}>
            <group scale={s}>
              <Model fit={fit} />
            </group>
          </Suspense>
        </AssetBoundary>
      ) : (
        plain
      )}
    </group>
  );
}

/** Both faces of a leaf, `t` thick: one call for face-mounted pairs and through sets alike. */
export function HandlePair({ kind, x, y, t, point, realistic }: { kind: HardwareKind; x: number; y: number; t: number; point: 1 | -1; realistic: boolean }) {
  if (HARDWARE[kind].mount === "through") return <Hardware kind={kind} at={[x, y, 0]} point={point} realistic={realistic} />;
  return (
    <>
      <Hardware kind={kind} at={[x, y, t / 2]} face={1} point={point} realistic={realistic} />
      <Hardware kind={kind} at={[x, y, -t / 2]} face={-1} point={point} realistic={realistic} />
    </>
  );
}

export const preloadHardware = (kinds: readonly HardwareKind[]) => kinds.forEach((k) => useGLTF.preload(assetPaths.model(HARDWARE[k].id), false, true));
