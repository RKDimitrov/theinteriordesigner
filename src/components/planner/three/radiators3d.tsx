"use client";

import { finishOf, type FitOut, radiatorStyle } from "@/domain/room/fit-out";
import type { Radiator } from "@/domain/schemas/room";
import { RADIATOR_LOOK } from "./fit-out-look";
import { FinishMat, Ink } from "./finish-materials";
import { Hardware } from "./hardware";
import { radiatorGeometry } from "./radiator-geometry";
import { useMerged } from "./swept";

/*
 * Radiators as their makers build them: pressed-steel panels with vertical
 * channels and a top grille, cast column sections, flat-oval vertical tubes,
 * tube towel rails, and a floor convector's grille. Repeated parts come from
 * radiatorParts() and are merged into one mesh. A real thermostatic valve
 * model sits at one end. Local frame: x along the wall from the radiator's
 * start, y up from its bottom, +z towards the room.
 */

export function Radiator3D({ rad, fitOut, realistic, side }: { rad: Radiator; fitOut: FitOut; realistic: boolean; side: number }) {
  const style = radiatorStyle(rad);
  const look = RADIATOR_LOOK[finishOf(rad, fitOut)];
  const { width: w, height: h, depth: d } = rad;
  const convector = style === "convector";
  // Wall radiators hang 15 cm above the floor (towel rails 20 cm); a convector lies in the floor.
  const y0 = convector ? 0 : style === "towel" ? 20 : 15;
  const zc = (convector ? d / 2 + 2 : d / 2 + 3) * side;
  const geo = useMerged(() => radiatorGeometry(style, w, h, d), `${style}:${w}:${h}:${d}`);
  const valve = style === "panel" || style === "column" || style === "vertical";
  return (
    <group position={[rad.offset, y0, zc]} scale-z={side}>
      <mesh geometry={geo} castShadow={!convector} receiveShadow>
        <FinishMat look={look} realistic={realistic} />
        {!convector && <Ink realistic={realistic} />}
      </mesh>
      {convector && (
        // The dark trench and heating element under the grille.
        <mesh position={[w / 2, 0.15, 0]}>
          <boxGeometry args={[w - 1.6, 0.3, d - 1.6]} />
          <meshStandardMaterial color="#141312" roughness={0.9} />
        </mesh>
      )}
      {/* The valve's inlet meets the radiator's end; its body and pipe run beside and below it. */}
      {valve && <Hardware kind="valve" at={[w, 6, 0]} realistic={realistic} />}
    </group>
  );
}
