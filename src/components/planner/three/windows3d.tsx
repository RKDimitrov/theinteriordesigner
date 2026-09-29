"use client";

import { useMemo } from "react";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { finishOf, type FitOut, windowDesign, windowStyle } from "@/domain/room/fit-out";
import { type Rect, type Sash, windowParts } from "@/domain/room/opening-parts";
import type { Window } from "@/domain/schemas/room";
import { FRAME_LOOK, type Look } from "./fit-out-look";
import { FinishMat, GlassMat, Ink } from "./finish-materials";
import { GLAZING_BEAD, SASH, WINDOW_BOARD, WINDOW_FRAME } from "./profiles";
import { rectPath } from "./sweep";
import { Board, Swept } from "./swept";
import { Treatment3D } from "./treatments3d";

/*
 * Windows from real profiles: a rebated frame and sloped sashes swept round
 * their outlines, double glazing held by beads, glazing bars and a top light
 * by design, a bullnosed inside board and an aluminium outside sill. In the
 * window's frame: x from its start along the wall, y up from the sill, and
 * +z towards the room after `scale-z={side}`.
 */

const W = PLANNER_WALL_CM;
/** The frame's 7 cm depth sits in the middle of the wall. */
const FRAME_Z = -W / 2 - 3.5;
/** Sash depth offset inside the frame, and the double-glazed unit's thickness. */
const SASH_Z = 0.6;
const IGU = 2.4;

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, y0: r.y0 + d, x1: r.x1 - d, y1: r.y1 - d });

export function Window3D({ win, ceiling, fitOut, realistic, side }: { win: Window; ceiling: number; fitOut: FitOut; realistic: boolean; side: number }) {
  const style = windowStyle(win);
  const look = FRAME_LOOK[finishOf(win, fitOut)];
  const y0 = win.sillHeight;
  const h = Math.min(win.height, ceiling - y0);
  const shape = useMemo(() => ({ ...win, height: h }), [win, h]);
  const parts = useMemo(() => windowParts(shape, windowDesign(win, fitOut)), [shape, win, fitOut]);
  const m = <FinishMat look={look} realistic={realistic} />;
  const framePath = useMemo(() => rectPath(0, 0, win.width, h), [win.width, h]);

  return (
    <group position={[win.offset, y0, 0]} scale-z={side}>
      <group position-z={FRAME_Z}>
        <Swept profile={WINDOW_FRAME} path={framePath} closed>
          {m}
          <Ink realistic={realistic} />
        </Swept>
        {parts.transom && (
          <Board r={parts.transom} t={5.2} z={3.6} round={0.3}>
            {m}
          </Board>
        )}
        {parts.lites.map((r, i) => (
          <Glazing key={`l${i}`} r={r} z={3.6} look={look} realistic={realistic} />
        ))}
        {parts.sashes.map((s, i) => (
          <SashPart key={i} s={s} sliding={style === "sliding"} handleMaxY={Math.max(150 - y0, 20)} look={look} realistic={realistic} />
        ))}
        {parts.bars.map((r, i) => (
          <Board key={`b${i}`} r={r} t={IGU + 2.4} z={3.8} round={0.3}>
            {m}
          </Board>
        ))}
      </group>
      {y0 > 0 && <Sills w={win.width} realistic={realistic} />}
      <Treatment3D win={win} h={h} ceiling={ceiling} realistic={realistic} />
    </group>
  );
}

/** Glass set in a frame or sash at depth `z`, with beads on the room side. */
function Glazing({ r, z, look, realistic }: { r: Rect; z: number; look: Look; realistic: boolean }) {
  const path = useMemo(() => rectPath(r.x0, r.y0, r.x1, r.y1), [r]);
  return (
    <>
      <Board r={inset(r, -1)} t={IGU} z={z} round={0}>
        <GlassMat realistic={realistic} />
      </Board>
      <group position-z={z + IGU / 2}>
        <Swept profile={GLAZING_BEAD} path={path} closed>
          <FinishMat look={look} realistic={realistic} />
        </Swept>
      </group>
    </>
  );
}

const SASH_FACE = 5.5;

/** `handleMaxY`: keeps handles on tall sashes within reach (at most 1.5 m off the floor). */
function SashPart({ s, sliding, handleMaxY, look, realistic }: { s: Sash; sliding: boolean; handleMaxY: number; look: Look; realistic: boolean }) {
  const path = useMemo(() => rectPath(s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1), [s.rect]);
  // Sliding sashes are slimmer and run on two tracks, the inner one nearer the room.
  const depth = sliding ? 0.5 : 1;
  const z = sliding ? (s.track === 0 ? 3.7 : 0.4) : SASH_Z;
  const glassZ = z + (6.5 * depth) / 2;
  const hx = s.handle === "right" ? s.rect.x1 - SASH_FACE / 2 : s.rect.x0 + SASH_FACE / 2;
  return (
    <>
      <group position-z={z} scale-z={depth}>
        <Swept profile={SASH} path={path} closed>
          <FinishMat look={look} realistic={realistic} />
          <Ink realistic={realistic} />
        </Swept>
      </group>
      <Glazing r={inset(s.rect, SASH_FACE)} z={glassZ} look={look} realistic={realistic} />
      <WindowHandle x={hx} y={Math.min((s.rect.y0 + s.rect.y1) / 2, handleMaxY)} z={z + 6.5 * depth} sliding={sliding} realistic={realistic} />
    </>
  );
}

/**
 * Window handle, built in code: no usable CC0/CC-BY model was found. A rose
 * with a lever hanging down (closed), or a slim pull on sliding sashes.
 */
function WindowHandle({ x, y, z, sliding, realistic }: { x: number; y: number; z: number; sliding: boolean; realistic: boolean }) {
  const metal = <meshStandardMaterial color={realistic ? "#e9e9e6" : "#bbb"} metalness={realistic ? 0.2 : 0} roughness={0.35} />;
  if (sliding)
    return (
      <Board r={{ x0: x - 0.8, y0: y - 8, x1: x + 0.8, y1: y + 8 }} t={2} z={z + 1} round={0.6}>
        {metal}
      </Board>
    );
  return (
    <>
      <Board r={{ x0: x - 1.5, y0: y - 3.5, x1: x + 1.5, y1: y + 3.5 }} t={1.2} z={z + 0.6} round={0.5}>
        {metal}
      </Board>
      <Board r={{ x0: x - 0.9, y0: y - 11, x1: x + 0.9, y1: y + 0.5 }} t={1.6} z={z + 2.2} round={0.7}>
        {metal}
      </Board>
    </>
  );
}

/** Bullnosed board inside and an aluminium drip sill outside. */
function Sills({ w, realistic }: { w: number; realistic: boolean }) {
  const inside = -W / 2 + 3.5;
  const depth = 4 - inside;
  const profile = useMemo(() => WINDOW_BOARD(depth), [depth]);
  const path = useMemo(
    () =>
      [
        [-4, 0],
        [w + 4, 0],
      ] as const,
    [w],
  );
  return (
    <>
      {/* Swept along x; (x, u, v) → (x, v, u): u runs into the room, v up. */}
      <group position={[0, -2.5, inside]} scale-y={-1}>
        <group rotation-x={Math.PI / 2}>
          <Swept profile={profile} path={path}>
            <meshStandardMaterial color="#ece8e0" roughness={realistic ? 0.35 : 0.6} />
            <Ink realistic={realistic} />
          </Swept>
        </group>
      </group>
      <Board r={{ x0: -3, y0: -1.2, x1: w + 3, y1: 0 }} t={W / 2 - 3.5 + 4} z={-W - 4 + (W / 2 - 3.5 + 4) / 2} round={0.2}>
        <meshStandardMaterial color="#8b8e91" metalness={0.6} roughness={0.45} />
      </Board>
    </>
  );
}
