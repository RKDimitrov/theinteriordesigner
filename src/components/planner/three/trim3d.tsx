"use client";

import { useMemo } from "react";
import type { Wall } from "@/domain/geometry/walls";
import type { FitOut } from "@/domain/room/fit-out";
import type { SkirtingPiece } from "@/domain/room/opening-parts";
import { FRAME_LOOK } from "./fit-out-look";
import { FinishMat, Ink } from "./finish-materials";
import { skirting } from "./profiles";
import type { P2 } from "./sweep";
import { Swept } from "./swept";

/**
 * One wall's skirting board, in the room's plan frame. The piece is swept in
 * a plane where plan (x, y) becomes (x, −y), then stood up so the profile's
 * height is +y and its thickness runs into the room; its ends are mitred to
 * the neighbouring walls' boards (see skirtingPieces).
 */
export function SkirtingBoard({ piece, wall, trim, realistic }: { piece: SkirtingPiece; wall: Wall; trim: FitOut["trim"]; realistic: boolean }) {
  const profile = useMemo(() => skirting(trim.profile, trim.skirtingHeight), [trim.profile, trim.skirtingHeight]);
  const run = useMemo(() => {
    const flip = (p: { x: number; y: number }): P2 => [p.x, -p.y];
    // The profile lies to the left of the run; turn the run round if that is not into the room.
    const d = { x: piece.b.x - piece.a.x, y: piece.b.y - piece.a.y };
    const intoRoom = d.y * wall.inward.x - d.x * wall.inward.y > 0;
    const pts = { a: flip(piece.a), b: flip(piece.b), before: piece.before && flip(piece.before), after: piece.after && flip(piece.after) };
    return intoRoom ? { path: [pts.a, pts.b], before: pts.before, after: pts.after } : { path: [pts.b, pts.a], before: pts.after, after: pts.before };
  }, [piece, wall]);
  return (
    <group rotation-x={-Math.PI / 2}>
      <Swept profile={profile} path={run.path} before={run.before} after={run.after}>
        <FinishMat look={FRAME_LOOK[trim.finish]} realistic={realistic} />
        <Ink realistic={realistic} />
      </Swept>
    </group>
  );
}
