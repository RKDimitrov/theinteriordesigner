"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import type { Window } from "@/domain/schemas/room";
import { AssetBoundary } from "./asset-boundary";
import { TREATMENT_MODELS } from "./fixture-assets";
import { Fitted } from "./fixtures3d";

/*
 * Curtains and blinds, in the window's frame (x from its start along the
 * wall, y up from the sill, +z towards the room). Curtains and venetian
 * blinds are real models stretched to the window; roller blinds are built in
 * code, since no usable model was found.
 */

const W = PLANNER_WALL_CM;
/** The window frame's room face (see windows3d.tsx): blinds hang just in front of it. */
const FRAME_FACE_Z = -W / 2 + 3.5;

export function Treatment3D({ win, h, ceiling, realistic }: { win: Window; h: number; ceiling: number; realistic: boolean }) {
  const t = win.treatment;
  if (!t) return null;
  const closed = t.closed;
  if (t.kind === "curtains") {
    // From a rod just under the ceiling to the floor; open, the drapes stand beside the glass.
    const width = win.width + (closed ? 20 : 80);
    const top = ceiling - 8;
    return (
      <Modelled realistic={realistic} fallback={<Panel x={win.width / 2} y={-win.sillHeight} w={width} h={top} z={12} color="#d9cfc0" />}>
        <group position={[win.width / 2, -win.sillHeight, 12]}>
          <Fitted v={TREATMENT_MODELS.curtains![0]} w={width} h={top} d={10} />
        </group>
      </Modelled>
    );
  }
  // Blinds hang inside the reveal; open, they are drawn up to a short stack at the top.
  const drop = closed ? h - 2 : Math.max(10, h * 0.16);
  const y = h - drop;
  if (t.kind === "venetian") {
    return (
      <Modelled realistic={realistic} fallback={<Panel x={win.width / 2} y={y} w={win.width - 4} h={drop} z={FRAME_FACE_Z + 3} color="#ece8e0" />}>
        <group position={[win.width / 2, y, FRAME_FACE_Z + 3]}>
          <Fitted v={TREATMENT_MODELS.venetian![0]} w={win.width - 4} h={drop} d={4} />
        </group>
      </Modelled>
    );
  }
  return <Roller w={win.width - 4} x={win.width / 2} top={h} drop={drop} z={FRAME_FACE_Z + 3} />;
}

function Modelled({ realistic, fallback, children }: { realistic: boolean; fallback: React.ReactNode; children: React.ReactNode }) {
  if (!realistic) return fallback;
  return (
    <AssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </AssetBoundary>
  );
}

/** Flat stand-in for drawing mode and while a model loads. */
function Panel({ x, y, w, h, z, color }: { x: number; y: number; w: number; h: number; z: number; color: string }) {
  return (
    <mesh position={[x, y + h / 2, z]}>
      <boxGeometry args={[w, h, 1]} />
      <meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.85} />
    </mesh>
  );
}

/** Roller blind, built in code: a fabric sheet under a 4 cm tube with a weighted bottom rail. */
function Roller({ w, x, top, drop, z }: { w: number; x: number; top: number; drop: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, top - 2, 0]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[2, 2, w + 2, 16]} />
        <meshStandardMaterial color="#e9e5dc" roughness={0.6} />
      </mesh>
      <mesh position={[0, top - 4 - drop / 2, 0.5]} castShadow>
        <boxGeometry args={[w, drop, 0.2]} />
        <meshStandardMaterial color="#e6dfd2" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, top - 4 - drop, 0.5]}>
        <boxGeometry args={[w, 1.5, 1]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.5} />
      </mesh>
    </group>
  );
}
