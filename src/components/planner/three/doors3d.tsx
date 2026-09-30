"use client";

import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { doorDesign, doorStyle, finishOf, type FitOut, slides } from "@/domain/room/fit-out";
import { leafParts, type Rect } from "@/domain/room/opening-parts";
import type { Door, DoorDesign } from "@/domain/schemas/room";
import { DOOR_LOOK, FRAME_LOOK, type Look } from "./fit-out-look";
import { FinishMat, GlassMat, Ink } from "./finish-materials";
import { HandlePair, type HardwareKind } from "./hardware";
import { architrave, GLAZING_BEAD, PANEL_MOULD, RAISED_FIELD } from "./profiles";
import { rectPath } from "./sweep";
import { Board, Swept } from "./swept";

/*
 * Doors built like a joiner would: a lining through the wall with a stop
 * bead, mitred architraves on both faces, and a leaf of stiles, rails and
 * panels from leafParts(). Handles are real models (hardware.tsx). Drawn in
 * the wall's frame: x along the wall, y up, room on the +z side times `side`.
 */

const W = PLANNER_WALL_CM;
/** Lining board thickness, the gap round the leaf, leaf thickness. */
const LINING = 2.5;
const GAP = 0.3;
const LEAF_T = 4;
const FLOOR_GAP = 1;
const HANDLE_Y = 105;
/** Distance from the leaf's edge to the handle spindle. */
const BACKSET = 6.5;
const DOOR_OPEN_S = 0.8;

export interface DoorProps {
  door: Door;
  ceiling: number;
  fitOut: FitOut;
  realistic: boolean;
  side: number;
  open?: boolean;
  onToggle?: () => void;
}

export function Door3D({ door, ceiling, fitOut, realistic, side, open = false, onToggle }: DoorProps) {
  const style = doorStyle(door);
  const finish = finishOf(door, fitOut);
  const look = DOOR_LOOK[finish];
  const trim = FRAME_LOOK[fitOut.trim.finish];
  const design = doorDesign(door, fitOut);
  const h = Math.min(door.height, ceiling);
  const x0 = door.offset;
  const x1 = door.offset + door.width;
  const leafH = h - LINING - GAP - FLOOR_GAP;
  const clear = door.width - 2 * LINING;
  const handle = fitOut.doors.handle;
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onToggle?.();
  };
  const leaf = (w: number, extra?: React.ReactNode) => (
    <group position-y={FLOOR_GAP}>
      <LeafBody design={design} w={w} h={leafH} look={look} glass={finish === "glass"} balcony={style === "balcony"} barn={style === "barn"} realistic={realistic} />
      {extra}
    </group>
  );
  const handles = (x: number, point: 1 | -1, kind: HardwareKind = handle) => <HandlePair kind={kind} x={x} y={HANDLE_Y - FLOOR_GAP} t={LEAF_T} point={point} realistic={realistic} />;

  let leaves: React.ReactNode = null;
  const swings = door.swing !== "none" && !slides(door);
  if (door.swing === "none") {
    leaves = null;
  } else if (slides(door)) {
    const park = door.hinge === "start" ? -1 : 1;
    // Pocket: inside the wall. Sliding: in front of the architrave. Barn: further out, hung from a rail.
    const z = style === "pocket" ? (-W / 2) * side : (style === "barn" ? 7 : 4.5) * side;
    const lw = style === "pocket" ? clear - 2 * GAP : door.width + 4;
    const grab = -park * (lw / 2 - 8);
    leaves = (
      <>
        <SlidingLeaf x={(x0 + x1) / 2} z={z} shift={park * (style === "pocket" ? clear : door.width)} open={open}>
          {leaf(lw, style === "pocket" ? <FlushPulls x={grab} realistic={realistic} /> : handles(grab, 1, "pull"))}
        </SlidingLeaf>
        {style === "barn" && <BarnRail x0={park < 0 ? x0 - door.width : x0} x1={park < 0 ? x1 : x1 + door.width} y={h + 6} z={z} realistic={realistic} />}
      </>
    );
  } else {
    const inward = door.swing !== "out";
    // Hinged flush with the room face when opening in, with the far face when opening out.
    const z = (inward ? -LEAF_T / 2 : -(W - LEAF_T / 2)) * side;
    const swingSign = (inward ? 1 : -1) * side;
    const pivot0 = x0 + LINING + GAP;
    const pivot1 = x1 - LINING - GAP;
    if (style === "double") {
      const lw = (pivot1 - pivot0 - GAP) / 2;
      leaves = (
        <>
          <SwingLeaf x={pivot0} z={z} hingeAtStart swingSign={swingSign} open={open}>
            <group position-x={lw / 2}>
              {leaf(lw, handles(lw / 2 - BACKSET, -1))}
              <Hinges x={-lw / 2} h={leafH} realistic={realistic} />
            </group>
          </SwingLeaf>
          <SwingLeaf x={pivot1} z={z} hingeAtStart={false} swingSign={swingSign} open={open}>
            <group position-x={-lw / 2}>
              {leaf(lw, handles(-(lw / 2 - BACKSET), 1))}
              <Hinges x={lw / 2} h={leafH} realistic={realistic} />
            </group>
          </SwingLeaf>
        </>
      );
    } else if (style === "bifold") {
      const atStart = door.hinge === "start";
      const half = (pivot1 - pivot0 - GAP) / 2;
      const panel = (knob: boolean) => leaf(half, knob && handles((atStart ? 1 : -1) * (half / 2 - 5), atStart ? -1 : 1, "knob"));
      leaves = <BifoldLeaf x={atStart ? pivot0 : pivot1} z={z} hingeAtStart={atStart} swingSign={swingSign} half={half} open={open} first={panel(false)} second={panel(true)} />;
    } else {
      const atStart = door.hinge === "start";
      const dir = atStart ? 1 : -1;
      const lw = pivot1 - pivot0;
      leaves = (
        <SwingLeaf x={atStart ? pivot0 : pivot1} z={z} hingeAtStart={atStart} swingSign={swingSign} open={open}>
          <group position-x={(dir * lw) / 2}>
            {leaf(lw, handles(dir * (lw / 2 - BACKSET), dir > 0 ? -1 : 1))}
            <Hinges x={(-dir * lw) / 2} h={leafH} realistic={realistic} />
          </group>
        </SwingLeaf>
      );
    }
  }
  return (
    <group onClick={click}>
      <Lining x0={x0} x1={x1} h={h} side={side} look={trim} realistic={realistic} stop={swings ? (door.swing !== "out" ? 1 : -1) : 0} />
      <Architraves x0={x0} x1={x1} h={h} side={side} profile={fitOut.trim.profile} look={trim} realistic={realistic} />
      {style === "balcony" && <Balcony x0={x0} x1={x1} side={side} realistic={realistic} />}
      {leaves}
    </group>
  );
}

/* ---------------- frame ---------------- */

/** Lining boards through the wall, with a stop bead behind a swinging leaf (`stop` = +1 opening in, −1 out). */
function Lining({ x0, x1, h, side, look, realistic, stop }: { x0: number; x1: number; h: number; side: number; look: Look; realistic: boolean; stop: number }) {
  const m = <FinishMat look={look} realistic={realistic} />;
  const boards: Rect[] = [
    { x0, y0: 0, x1: x0 + LINING, y1: h },
    { x0: x1 - LINING, y0: 0, x1, y1: h },
    { x0: x0 + LINING, y0: h - LINING, x1: x1 - LINING, y1: h },
  ];
  // The stop sits just behind the closed leaf.
  const zs = stop > 0 ? -(LEAF_T + 1.75) : -(W - LEAF_T - 1.75);
  const stops: Rect[] = stop
    ? [
        { x0: x0 + LINING, y0: 0, x1: x0 + LINING + 1.2, y1: h - LINING },
        { x0: x1 - LINING - 1.2, y0: 0, x1: x1 - LINING, y1: h - LINING },
        { x0: x0 + LINING + 1.2, y0: h - LINING - 1.2, x1: x1 - LINING - 1.2, y1: h - LINING },
      ]
    : [];
  return (
    <group scale-z={side}>
      {boards.map((r, i) => (
        <Board key={i} r={r} t={W} z={-W / 2} round={0.15}>
          {m}
          <Ink realistic={realistic} />
        </Board>
      ))}
      {stops.map((r, i) => (
        <Board key={`s${i}`} r={r} t={3.5} z={zs} round={0.15}>
          {m}
        </Board>
      ))}
    </group>
  );
}

/** Mitred architraves round the opening on both wall faces. */
function Architraves({ x0, x1, h, side, profile, look, realistic }: { x0: number; x1: number; h: number; side: number; profile: FitOut["trim"]["profile"]; look: Look; realistic: boolean }) {
  const prof = useMemo(() => architrave(profile), [profile]);
  const path = useMemo(
    () =>
      [
        [x0, 0],
        [x0, h],
        [x1, h],
        [x1, 0],
      ] as const,
    [x0, x1, h],
  );
  return (
    <>
      {[0, 1].map((back) => (
        <group key={back} position-z={back ? -W * side : 0} scale-z={back ? -side : side}>
          <Swept profile={prof} path={path}>
            <FinishMat look={look} realistic={realistic} />
            <Ink realistic={realistic} />
          </Swept>
        </group>
      ))}
    </>
  );
}

/* ---------------- leaves ---------------- */

/** A leaf `w` × `h` centred on x = 0, standing on y = 0, LEAF_T thick and centred on z = 0. */
function LeafBody({ design, w, h, look, glass, balcony, barn, realistic }: { design: DoorDesign; w: number; h: number; look: Look; glass: boolean; balcony: boolean; barn: boolean; realistic: boolean }) {
  const parts = useMemo(() => leafParts(design, w, h, { balcony }), [design, w, h, balcony]);
  const m = <FinishMat look={look} realistic={realistic} />;
  if (glass) return <GlassLeaf w={w} h={h} realistic={realistic} />;
  if (design === "planks") return <PlankLeaf w={w} h={h} joints={parts.joints} barn={barn} look={look} realistic={realistic} />;
  return (
    <>
      {parts.solid.map((r, i) => (
        <Board key={i} r={r} t={LEAF_T}>
          {m}
          <Ink realistic={realistic} />
        </Board>
      ))}
      {parts.panels.map((p, i) => (
        <Panel key={`p${i}`} r={p.rect} kind={p.kind} look={look} realistic={realistic} />
      ))}
    </>
  );
}

const PANEL_T = 1.6;

/** A panel set in the leaf's frame: recessed flat, raised and moulded, or glazed with beads. */
function Panel({ r, kind, look, realistic }: { r: Rect; kind: "flat" | "raised" | "glass"; look: Look; realistic: boolean }) {
  const m = <FinishMat look={look} realistic={realistic} />;
  const path = useMemo(() => rectPath(r.x0, r.y0, r.x1, r.y1), [r]);
  const faces = [1, -1] as const;
  if (kind === "glass")
    return (
      <>
        <Board r={r} t={0.8} round={0}>
          <GlassMat realistic={realistic} />
        </Board>
        {faces.map((f) => (
          <group key={f} position-z={f * 0.4} scale-z={f}>
            <Swept profile={GLAZING_BEAD} path={path} closed>
              {m}
            </Swept>
          </group>
        ))}
      </>
    );
  if (kind === "flat")
    return (
      <Board r={r} t={PANEL_T} round={0}>
        {m}
        <Ink realistic={realistic} />
      </Board>
    );
  // Raised: a moulding round the edge, a bevelled border and a raised middle.
  const inner = { x0: r.x0 + 2.2, y0: r.y0 + 2.2, x1: r.x1 - 2.2, y1: r.y1 - 2.2 };
  const middle = { x0: inner.x0 + 4.5, y0: inner.y0 + 4.5, x1: inner.x1 - 4.5, y1: inner.y1 - 4.5 };
  return (
    <>
      <Board r={r} t={PANEL_T} round={0}>
        {m}
      </Board>
      <Board r={middle} t={PANEL_T + 1.8} round={0.2}>
        {m}
        <Ink realistic={realistic} />
      </Board>
      {faces.map((f) => (
        <group key={f} position-z={(f * PANEL_T) / 2} scale-z={f}>
          <Swept profile={PANEL_MOULD} path={path} closed>
            {m}
          </Swept>
          <Swept profile={RAISED_FIELD(0.9)} path={rectPath(inner.x0, inner.y0, inner.x1, inner.y1)} closed>
            {m}
          </Swept>
        </group>
      ))}
    </>
  );
}

/** Tongue-and-groove boards; barn doors get ledges and a brace on the room face. */
function PlankLeaf({ w, h, joints, barn, look, realistic }: { w: number; h: number; joints: number[]; barn: boolean; look: Look; realistic: boolean }) {
  const m = <FinishMat look={look} realistic={realistic} />;
  const edges = [-w / 2, ...joints, w / 2];
  const t = barn ? 3 : LEAF_T;
  const ledge = 14;
  const lo = 18;
  const hi = h - 18 - ledge;
  return (
    <>
      {/* A dark core behind the grooves, so light does not leak through the joints. */}
      <Board r={{ x0: -w / 2 + 0.5, y0: 0.5, x1: w / 2 - 0.5, y1: h - 0.5 }} t={t - 1} round={0}>
        <meshStandardMaterial color="#1a1512" roughness={1} />
      </Board>
      {edges.slice(1).map((x, i) => (
        <Board key={i} r={{ x0: edges[i]! + 0.15, y0: 0, x1: x - 0.15, y1: h }} t={t} round={0.4}>
          {m}
          <Ink realistic={realistic} />
        </Board>
      ))}
      {barn && (
        <group position-z={t / 2 + 1.25}>
          {[lo, hi].map((y) => (
            <Board key={y} r={{ x0: -w / 2 + 2, y0: y, x1: w / 2 - 2, y1: y + ledge }} t={2.5} round={0.3}>
              {m}
            </Board>
          ))}
          <group position={[0, (lo + ledge + hi) / 2, 0]} rotation-z={Math.atan2(hi - lo - ledge, w - 8)}>
            <Board r={{ x0: -Math.hypot(w - 8, hi - lo - ledge) / 2, y0: -ledge / 2, x1: Math.hypot(w - 8, hi - lo - ledge) / 2, y1: ledge / 2 }} t={2.5} round={0.3}>
              {m}
            </Board>
          </group>
        </group>
      )}
    </>
  );
}

/** A frameless toughened-glass leaf with black aluminium top and bottom rails. */
function GlassLeaf({ w, h, realistic }: { w: number; h: number; realistic: boolean }) {
  const alu = <meshStandardMaterial color="#232324" metalness={0.7} roughness={0.35} />;
  return (
    <>
      <Board r={{ x0: -w / 2, y0: 0, x1: w / 2, y1: h }} t={1} round={0.2}>
        <GlassMat realistic={realistic} />
      </Board>
      {[
        [0, 7],
        [h - 7, h],
      ].map(([y0, y1]) => (
        <Board key={y0} r={{ x0: -w / 2, y0: y0!, x1: w / 2, y1: y1! }} t={2.2} round={0.3}>
          {alu}
        </Board>
      ))}
    </>
  );
}

/* ---------------- small parts built in code ---------------- */

const BALCONY_DEPTH = 140;
const RAIL_H = 105;

/**
 * A concrete balcony slab outside a balcony door, with a glass balustrade and
 * a steel handrail on its three open sides. Built in code: a simple slab.
 */
function Balcony({ x0, x1, side, realistic }: { x0: number; x1: number; side: number; realistic: boolean }) {
  const w = x1 - x0 + 120;
  const cx = (x0 + x1) / 2;
  // In the wall's frame scaled so +z is the room: the balcony runs from the outer face (−W) outwards.
  const zOut = -W - BALCONY_DEPTH;
  const zMid = -W - BALCONY_DEPTH / 2;
  const glass = <GlassMat realistic={realistic} />;
  const steel = <meshStandardMaterial color="#3a3b3d" metalness={0.8} roughness={0.35} />;
  return (
    <group scale-z={side}>
      <Board r={{ x0: cx - w / 2, y0: -18, x1: cx + w / 2, y1: 0 }} t={BALCONY_DEPTH} z={zMid} round={0.5}>
        <meshStandardMaterial color="#c9c4bb" roughness={0.9} />
      </Board>
      {/* Front and side glass panels, with a handrail on top. */}
      <Board r={{ x0: cx - w / 2, y0: 4, x1: cx + w / 2, y1: RAIL_H - 4 }} t={1.2} z={zOut + 3} round={0}>
        {glass}
      </Board>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Board r={{ x0: cx + s * (w / 2) - 0.6, y0: 4, x1: cx + s * (w / 2) + 0.6, y1: RAIL_H - 4 }} t={BALCONY_DEPTH - 6} z={zMid - 1} round={0}>
            {glass}
          </Board>
          <Board r={{ x0: cx + s * (w / 2) - 2, y0: RAIL_H - 4, x1: cx + s * (w / 2) + 2, y1: RAIL_H }} t={BALCONY_DEPTH} z={zMid} round={0.8}>
            {steel}
          </Board>
        </group>
      ))}
      <Board r={{ x0: cx - w / 2, y0: RAIL_H - 4, x1: cx + w / 2, y1: RAIL_H }} t={4} z={zOut + 2} round={0.8}>
        {steel}
      </Board>
    </group>
  );
}

/** Three barrel hinges on the hinge edge (too small to be worth a model). */
function Hinges({ x, h, realistic }: { x: number; h: number; realistic: boolean }) {
  const ys = h > 180 ? [22, h / 2 + 10, h - 25] : [22, h - 25];
  return (
    <>
      {ys.map((y) => (
        <mesh key={y} position={[x, y + FLOOR_GAP, LEAF_T / 2 - 0.4]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 10, 12]} />
          <meshStandardMaterial color={realistic ? "#8f9296" : "#6d6f72"} metalness={1} roughness={0.35} />
        </mesh>
      ))}
    </>
  );
}

/** Recessed finger pulls on a pocket door, which must slide flush into the wall. */
function FlushPulls({ x, realistic }: { x: number; realistic: boolean }) {
  return (
    <>
      {[1, -1].map((f) => (
        <mesh key={f} position={[x, HANDLE_Y - FLOOR_GAP, f * (LEAF_T / 2 - 0.2)]}>
          <boxGeometry args={[3, 14, 0.5]} />
          <meshStandardMaterial color={realistic ? "#7c7f83" : "#555"} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

/** A flat steel rail with two roller hangers over a barn door. */
function BarnRail({ x0, x1, y, z, realistic }: { x0: number; x1: number; y: number; z: number; realistic: boolean }) {
  const steel = <meshStandardMaterial color="#1f1e1d" metalness={realistic ? 0.8 : 0.3} roughness={0.4} />;
  return (
    <mesh position={[(x0 + x1) / 2, y, z]} castShadow>
      <boxGeometry args={[x1 - x0 + 10, 4, 0.8]} />
      {steel}
    </mesh>
  );
}

/* ---------------- motion ---------------- */

/** Eased 0 → 1 progress towards `open`, updated every frame. */
function useOpenProgress(open: boolean) {
  const t = useRef(open ? 1 : 0);
  const invalidate = useThree((s) => s.invalidate);
  // The view draws on demand: ask for frames while the leaf is on its way.
  useEffect(() => invalidate(), [open, invalidate]);
  useFrame((_, dt) => {
    if (t.current === (open ? 1 : 0)) return;
    // The first frame after a rest reports the whole rest as its time step.
    const step = Math.min(dt, 0.05) / DOOR_OPEN_S;
    t.current = open ? Math.min(1, t.current + step) : Math.max(0, t.current - step);
    invalidate();
  });
  return t;
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Pivot at (x, 0, z); children are the closed leaf. Swings 90° towards `swingSign` × z. */
function SwingLeaf({ x, z, hingeAtStart, swingSign, open, children }: { x: number; z: number; hingeAtStart: boolean; swingSign: number; open: boolean; children: React.ReactNode }) {
  const pivot = useRef<THREE.Group>(null);
  const t = useOpenProgress(open);
  // Rotating +x by −90° about y points it along +z; a leaf reaching −x turns the other way.
  const full = (hingeAtStart ? -1 : 1) * swingSign * (Math.PI / 2);
  useFrame(() => {
    if (pivot.current) pivot.current.rotation.y = full * ease(t.current);
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={pivot}>{children}</group>
    </group>
  );
}

/** Leaf centred at x that runs `shift` cm along the wall when open. */
function SlidingLeaf({ x, z, shift, open, children }: { x: number; z: number; shift: number; open: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const t = useOpenProgress(open);
  useFrame(() => {
    if (g.current) g.current.position.x = shift * ease(t.current);
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={g}>{children}</group>
    </group>
  );
}

/** Two panels: the first turns on the hinge, the second folds back against it. Each panel is centred on its own x = 0. */
function BifoldLeaf({ x, z, hingeAtStart, swingSign, half, open, first, second }: { x: number; z: number; hingeAtStart: boolean; swingSign: number; half: number; open: boolean; first: React.ReactNode; second: React.ReactNode }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const t = useOpenProgress(open);
  const dir = hingeAtStart ? 1 : -1;
  const full = -dir * swingSign * (Math.PI / 2);
  useFrame(() => {
    const k = full * ease(t.current);
    if (a.current) a.current.rotation.y = k;
    if (b.current) b.current.rotation.y = -2 * k;
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={a}>
        <group position-x={(dir * half) / 2}>{first}</group>
        <group position-x={dir * half}>
          <group ref={b}>
            <group position-x={(dir * half) / 2}>{second}</group>
          </group>
        </group>
      </group>
    </group>
  );
}
