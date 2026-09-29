"use client";

import { Edges, useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { assetPaths } from "@/domain/assets/catalogue";
import { fixtureFront, type FixtureKind, isFixtureKind, kitchenSlots } from "@/domain/room/fixtures";
import type { FixedElement } from "@/domain/schemas/room";
import { AssetBoundary } from "./asset-boundary";
import type { ModelVariant } from "./assets";
import { fixtureModel, KITCHEN_UNITS } from "./fixture-assets";
import { INK } from "./finish-materials";
import { fitToBox } from "./geometry";

/*
 * Fixed elements in 3D, in the room's plan frame. Kitchen and bathroom
 * fixtures are real models stretched to the size set in the planner; a
 * kitchen run is tiled from real units, one per standard module, so each unit
 * stretches only a little. Lights hang from the ceiling at their own
 * proportions. Structure (chimneys, columns …) stays a plain block.
 */

/** Base units stand under a continuous 3 cm worktop with a 2 cm overhang; wall units hang from 150 cm. */
const WORKTOP = 3;
const WALL_UNIT_Y = 150;
const WALL_UNIT_H = 70;
const WALL_UNIT_D = 35;

export function Fixed3D({ f, ceiling, realistic }: { f: FixedElement; ceiling: number; realistic: boolean }) {
  const block = <Block f={f} ceiling={ceiling} realistic={realistic} />;
  if (!realistic || !isFixtureKind(f.kind)) return block;
  return (
    <AssetBoundary fallback={block}>
      <Suspense fallback={block}>
        <Fixture f={f} ceiling={ceiling} />
      </Suspense>
    </AssetBoundary>
  );
}

/** The plain block drawn for structure, in drawing mode, and while models load. */
function Block({ f, ceiling, realistic }: { f: FixedElement; ceiling: number; realistic: boolean }) {
  const ceilingMounted = f.kind === "pendant" || f.kind === "chandelier";
  const h = Math.min(f.height, ceiling);
  const y = ceilingMounted ? ceiling - h / 2 : h / 2;
  return (
    <mesh position={[f.rect.x + f.rect.w / 2, y, f.rect.y + f.rect.d / 2]} castShadow receiveShadow>
      <boxGeometry args={[f.rect.w, h, f.rect.d]} />
      <meshStandardMaterial color={ceilingMounted ? "#f3efe6" : "#e8dcc6"} roughness={0.9} />
      {!realistic && <Edges color={INK} threshold={15} />}
    </mesh>
  );
}

function Fixture({ f, ceiling }: { f: FixedElement; ceiling: number }) {
  const cx = f.rect.x + f.rect.w / 2;
  const cz = f.rect.y + f.rect.d / 2;
  if (f.kind === "pendant" || f.kind === "chandelier") {
    return (
      <group position={[cx, ceiling, cz]}>
        <Hanging v={fixtureModel(f.kind, f.model)} w={f.rect.w} drop={f.height} />
      </group>
    );
  }
  // Local frame: width along x, depth along z, the front facing +z.
  const front = fixtureFront(f) ?? { x: 0, y: 1 };
  const side = f.facing === 90 || f.facing === 270;
  const w = side ? f.rect.d : f.rect.w;
  const d = side ? f.rect.w : f.rect.d;
  const h = Math.min(f.height, ceiling);
  return (
    <group position={[cx, 0, cz]} rotation-y={Math.atan2(front.x, front.y)}>
      {f.kind === "kitchen_run" ? (
        <KitchenRun f={f} w={w} d={d} h={h} ceiling={ceiling} />
      ) : (
        // Fixed3D only renders this for fixture kinds.
        <Fitted v={fixtureModel(f.kind as Exclude<FixtureKind, "kitchen_run">, f.model)} w={w} h={h} d={d} />
      )}
    </group>
  );
}

function KitchenRun({ f, w, d, h, ceiling }: { f: FixedElement; w: number; d: number; h: number; ceiling: number }) {
  const k = f.kitchen ?? { sink: true, hob: true, oven: true, wallUnits: true };
  const slots = useMemo(() => kitchenSlots(w, { sink: k.sink, cooker: k.hob || k.oven }), [w, k.sink, k.hob, k.oven]);
  const wallTop = Math.min(WALL_UNIT_Y + WALL_UNIT_H, ceiling - 2);
  const wallH = wallTop - WALL_UNIT_Y;
  // Each unit model's own top overhangs its carcass; widening the units a little closes the gaps
  // between carcasses, and one worktop over the whole run hides the overlapping tops, as in a real kitchen.
  const overlap = 1.06;
  return (
    <>
      <mesh position={[0, h - WORKTOP / 2, 1]} castShadow receiveShadow>
        <boxGeometry args={[w, WORKTOP, d + 2]} />
        <meshStandardMaterial color="#dcd6cc" roughness={0.35} />
      </mesh>
      {slots.map((s, i) => {
        const x = (s.from + s.to) / 2 - w / 2;
        const sw = s.to - s.from;
        const first = i === 0;
        const last = i === slots.length - 1;
        // The run's ends stay flush with its footprint.
        const uw = sw * (first || last ? 1 + (overlap - 1) / 2 : overlap);
        const ux = x + (first ? (uw - sw) / 2 : last ? -(uw - sw) / 2 : 0);
        return (
          <group key={i}>
            <group position-x={ux}>
              <Fitted v={KITCHEN_UNITS[s.unit]} w={uw} h={h - WORKTOP + 0.5} d={d - 2} />
            </group>
            {k.wallUnits && wallH > 30 && (
              <group position={[s.unit === "cooker" ? x : ux, WALL_UNIT_Y, -d / 2 + WALL_UNIT_D / 2]}>
                {s.unit === "cooker" ? <Fitted v={KITCHEN_UNITS.hood} w={sw} h={wallH} d={45} /> : <Fitted v={KITCHEN_UNITS.wall} w={uw} h={wallH} d={WALL_UNIT_D} />}
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}

/** A model stretched to exactly w × h × d, standing on y = 0, centred on x/z, its front towards +z. */
export function Fitted({ v, w, h, d }: { v: ModelVariant; w: number; h: number; d: number }) {
  const { scene } = useGLTF(assetPaths.model(v.id), false, true);
  const object = useMemo(() => {
    // SkeletonUtils rebinds skinned meshes (some curtains are rigged); a plain clone would draw nothing.
    const copy = cloneSkinned(scene);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return fitToBox(copy, w, h, d, v.turn ?? 0);
  }, [scene, w, h, d, v.turn]);
  return <primitive object={object} />;
}

/** A light hanging from y = 0 (the ceiling), scaled evenly to width `w`; its drop is capped at `drop`. */
function Hanging({ v, w, drop }: { v: ModelVariant; w: number; drop: number }) {
  const { scene } = useGLTF(assetPaths.model(v.id), false, true);
  const object = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min(w / Math.max(size.x, size.z, 1e-6), drop / Math.max(size.y, 1e-6));
    const root = new THREE.Group();
    copy.position.set(-(box.min.x + box.max.x) / 2, -box.max.y, -(box.min.z + box.max.z) / 2);
    root.add(copy);
    root.scale.setScalar(k);
    return root;
  }, [scene, w, drop]);
  return <primitive object={object} />;
}
