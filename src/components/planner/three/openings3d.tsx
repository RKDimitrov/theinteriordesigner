"use client";

import { Suspense } from "react";
import { openingSpan } from "@/domain/geometry/openings";
import type { Wall } from "@/domain/geometry/walls";
import type { FitOut } from "@/domain/room/fit-out";
import type { Opening } from "@/domain/schemas/room";
import { Door3D } from "./doors3d";
import { SWITCH_MODEL } from "./fixture-assets";
import { Fitted } from "./fixtures3d";
import { Radiator3D } from "./radiators3d";
import { Window3D } from "./windows3d";

/*
 * Doors, windows and radiators by style, design and finish (see
 * doors3d.tsx, windows3d.tsx and radiators3d.tsx). Each is drawn in its
 * wall's frame: x runs along the wall from its start, y is up, and the room
 * is on the +z side scaled by `side` (the wall body is on the other side).
 */

/**
 * After rotating the wall group so local +x runs along the wall, the room's
 * inside is +z or −z depending on winding; walls sit on the outside.
 */
export function sideSign(wall: Wall): number {
  // Local +z after rotation by −atan2(dir.y, dir.x) is the plan direction perpCw(dir) = (−dir.y, dir.x).
  const pz = { x: -wall.dir.y, y: wall.dir.x };
  return pz.x * wall.inward.x + pz.y * wall.inward.y > 0 ? 1 : -1;
}

interface OpeningProps {
  walls: readonly Wall[];
  o: Opening;
  ceiling: number;
  fitOut: FitOut;
  realistic: boolean;
  /** Doors only. */
  open?: boolean;
  onToggle?: () => void;
}

/** One door, window or radiator in its wall's frame. */
export function Opening3D(p: OpeningProps) {
  const span = openingSpan(p.walls, p.o);
  if (!span || p.o.kind === "socket") return null;
  const { wall } = span;
  const body = <OpeningBody {...p} side={sideSign(wall)} />;
  return (
    <group position={[wall.a.x, 0, wall.a.y]} rotation-y={-Math.atan2(wall.dir.y, wall.dir.x)}>
      {/* Wood finishes load a texture; show the flat colour meanwhile. */}
      {p.realistic ? <Suspense fallback={<OpeningBody {...p} side={sideSign(wall)} realistic={false} />}>{body}</Suspense> : body}
    </group>
  );
}

function OpeningBody(p: OpeningProps & { side: number }) {
  const { o } = p;
  if (o.kind === "door") return <Door3D {...p} door={o} />;
  if (o.kind === "window") return <Window3D {...p} win={o} />;
  if (o.kind === "radiator") return <Radiator3D {...p} rad={o} />;
  if (o.kind === "switch") {
    // One real switch plate per rocker, side by side on the room face; drawing mode shows a flat plate.
    const plate = 8.5;
    const w = plate * o.gangs;
    return (
      <group
        position={[o.offset + o.width / 2, o.height - 6, 0]}
        scale-z={p.side}
        onClick={(e) => {
          e.stopPropagation();
          p.onToggle?.();
        }}
      >
        {p.realistic ? (
          <Suspense fallback={null}>
            {Array.from({ length: o.gangs }, (_, i) => (
              <group key={i} position-x={(i - (o.gangs - 1) / 2) * plate}>
                <Fitted v={SWITCH_MODEL} w={plate - 0.3} h={12} d={1.2} />
              </group>
            ))}
          </Suspense>
        ) : (
          <mesh position={[0, 6, 0.4]}>
            <boxGeometry args={[w, 12, 0.8]} />
            <meshStandardMaterial color="#f2efe8" />
          </mesh>
        )}
      </group>
    );
  }
  return null;
}
