"use client";

import { Edges } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { openingSpan } from "@/domain/geometry/openings";
import type { Wall } from "@/domain/geometry/walls";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { doorStyle, finishOf, type FitOut, radiatorStyle, slides, windowStyle } from "@/domain/room/fit-out";
import type { Door, Opening, Radiator, RadiatorStyle, Window } from "@/domain/schemas/room";
import { DOOR_LOOK, FRAME_LOOK, type Look, RADIATOR_LOOK } from "./fit-out-look";
import { Cyl, Part, type V3, Wood } from "./pieces";

/*
 * Doors, windows and radiators by style and finish. Each is drawn in its
 * wall's frame: x runs along the wall from its start, y is up, and the room
 * is on the +z side scaled by `side` (the wall body is on the other side).
 */

const W = PLANNER_WALL_CM;
const INK = "#2b2622";
const DOOR_OPEN_S = 0.8;
const HANDLE_Y = 105;

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
  if (o.kind === "door") return o.swing === "none" ? null : <Door3D {...p} door={o} />;
  if (o.kind === "window") return <Window3D {...p} win={o} />;
  if (o.kind === "radiator") return <Radiator3D {...p} rad={o} />;
  return null;
}

/* ---------------- materials ---------------- */

/** Material for a finish. Drawing mode uses flat colours with ink edges, no textures. */
function LookMat({ look, realistic }: { look: Look; realistic: boolean }) {
  switch (look.kind) {
    case "wood":
      return realistic ? <Wood hex={look.color} /> : <meshStandardMaterial color={look.color} roughness={0.6} />;
    case "paint":
      return <meshStandardMaterial color={look.color} roughness={look.rough} />;
    case "metal":
      return <meshStandardMaterial color={look.color} metalness={1} roughness={look.rough} />;
    case "glass":
      // Glass doors: the frame parts are black aluminium.
      return <meshStandardMaterial color="#2a2a2b" metalness={0.6} roughness={0.4} />;
  }
}

const Glass = () => (
  // No depth write, so ambient occlusion sees through the glass.
  <meshPhysicalMaterial color="#cdd9d5" transparent opacity={0.28} roughness={0.05} metalness={0} depthWrite={false} />
);
const Steel = () => <meshStandardMaterial color="#b9bcbf" metalness={1} roughness={0.25} />;

/** A box part with the finish material, outlined in ink in drawing mode. */
function Box({ size, at, look, realistic }: { size: V3; at: V3; look: Look; realistic: boolean }) {
  return (
    <Part size={size} at={at}>
      <LookMat look={look} realistic={realistic} />
      {!realistic && <Edges color={INK} threshold={15} />}
    </Part>
  );
}

/** Eased 0 → 1 progress towards `open`, updated every frame; returns a ref read in useFrame. */
function useOpenProgress(open: boolean) {
  const t = useRef(open ? 1 : 0);
  useFrame((_, dt) => {
    const step = dt / DOOR_OPEN_S;
    t.current = open ? Math.min(1, t.current + step) : Math.max(0, t.current - step);
  });
  return t;
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/* ---------------- doors ---------------- */

function Door3D({ door, ceiling, fitOut, realistic, side, open = false, onToggle }: OpeningProps & { door: Door; side: number }) {
  const style = doorStyle(door);
  const finish = finishOf(door, fitOut);
  const look = DOOR_LOOK[finish];
  const h = Math.min(door.height, ceiling);
  const x0 = door.offset;
  const x1 = door.offset + door.width;
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onToggle?.();
  };
  // Glazed and balcony doors, and any door in the glass finish, are framed glass.
  const glazed = style === "glazed" || style === "balcony" || finish === "glass";
  const leaf = (w: number) => <Leaf w={w} h={h - 1} look={look} glazed={glazed} balcony={style === "balcony"} realistic={realistic} />;
  const casing = style !== "barn" && <Casing x0={x0} x1={x1} h={h} side={side} look={look} realistic={realistic} />;

  let leaves: React.ReactNode;
  if (slides(door)) {
    const park = door.hinge === "start" ? -1 : 1;
    // Pocket: inside the wall. Sliding: on the room face. Barn: proud of the wall on a rail.
    const z = style === "pocket" ? (-W / 2) * side : (style === "barn" ? 5 : 3) * side;
    leaves = (
      <>
        <SlidingLeaf x={x0} z={z} shift={park * door.width} open={open}>
          <group position-x={door.width / 2}>{leaf(door.width)}</group>
        </SlidingLeaf>
        {style === "barn" && (
          <Part size={[door.width * 2 + 10, 3, 2]} at={[(park < 0 ? x0 - door.width : x0) + door.width, h + 6, 5 * side]}>
            <meshStandardMaterial color="#1f1e1d" metalness={0.7} roughness={0.4} />
          </Part>
        )}
      </>
    );
  } else {
    const inward = door.swing !== "out";
    // Hinged at the room face when opening in, at the outer face when opening out.
    const z = (inward ? -2 : -(W - 2)) * side;
    const swingSign = (inward ? 1 : -1) * side;
    if (style === "double") {
      const half = door.width / 2;
      leaves = (
        <>
          <SwingLeaf x={x0} z={z} hingeAtStart swingSign={swingSign} open={open}>
            <group position-x={half / 2}>{leaf(half - 0.5)}</group>
          </SwingLeaf>
          <SwingLeaf x={x1} z={z} hingeAtStart={false} swingSign={swingSign} open={open}>
            <group position-x={-half / 2}>{leaf(half - 0.5)}</group>
          </SwingLeaf>
        </>
      );
    } else if (style === "bifold") {
      leaves = <BifoldLeaf x={door.hinge === "start" ? x0 : x1} z={z} hingeAtStart={door.hinge === "start"} swingSign={swingSign} w={door.width} h={h - 1} look={look} realistic={realistic} open={open} />;
    } else {
      const atStart = door.hinge === "start";
      leaves = (
        <SwingLeaf x={atStart ? x0 : x1} z={z} hingeAtStart={atStart} swingSign={swingSign} open={open}>
          <group position-x={(atStart ? 1 : -1) * (door.width / 2)}>
            {leaf(door.width - 1)}
            <Handles x={(atStart ? 1 : -1) * (door.width / 2 - 8)} />
          </group>
        </SwingLeaf>
      );
    }
  }
  return (
    <group onClick={click}>
      {casing}
      {leaves}
    </group>
  );
}

/** A door leaf centred on x = 0, standing on y = 0, 4 cm thick. Glazed leaves are a frame round glass. */
function Leaf({ w, h, look, glazed, balcony, realistic }: { w: number; h: number; look: Look; glazed: boolean; balcony: boolean; realistic: boolean }) {
  if (!glazed) return <Box size={[w, h, 4]} at={[0, h / 2, 0]} look={look} realistic={realistic} />;
  const stile = look.kind === "glass" ? 4 : 10;
  // Balcony doors have a solid kick panel below the glass.
  const bottom = balcony ? 30 : stile;
  return (
    <>
      <Box size={[stile, h, 4]} at={[-w / 2 + stile / 2, h / 2, 0]} look={look} realistic={realistic} />
      <Box size={[stile, h, 4]} at={[w / 2 - stile / 2, h / 2, 0]} look={look} realistic={realistic} />
      <Box size={[w - 2 * stile, stile, 4]} at={[0, h - stile / 2, 0]} look={look} realistic={realistic} />
      <Box size={[w - 2 * stile, bottom, 4]} at={[0, bottom / 2, 0]} look={look} realistic={realistic} />
      <mesh position={[0, bottom + (h - stile - bottom) / 2, 0]}>
        <boxGeometry args={[w - 2 * stile, h - stile - bottom, 1]} />
        <Glass />
      </mesh>
    </>
  );
}

function Handles({ x }: { x: number }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <Part key={s} size={[12, 1.8, 1.8]} at={[x + (x > 0 ? -5 : 5), HANDLE_Y, s * 4]}>
          <Steel />
        </Part>
      ))}
    </>
  );
}

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

/** Leaf that runs `shift` cm along the wall when open. Children are drawn from x = 0 along +x. */
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

/** Two half panels: the first turns on the hinge, the second folds back against it. */
function BifoldLeaf({ x, z, hingeAtStart, swingSign, w, h, look, realistic, open }: { x: number; z: number; hingeAtStart: boolean; swingSign: number; w: number; h: number; look: Look; realistic: boolean; open: boolean }) {
  const first = useRef<THREE.Group>(null);
  const second = useRef<THREE.Group>(null);
  const t = useOpenProgress(open);
  const dir = hingeAtStart ? 1 : -1;
  const half = w / 2;
  const full = -dir * swingSign * (Math.PI / 2);
  useFrame(() => {
    const a = full * ease(t.current);
    if (first.current) first.current.rotation.y = a;
    if (second.current) second.current.rotation.y = -2 * a;
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={first}>
        <Box size={[half - 0.5, h, 3]} at={[(dir * half) / 2, h / 2, 0]} look={look} realistic={realistic} />
        <group position-x={dir * half}>
          <group ref={second}>
            <Box size={[half - 0.5, h, 3]} at={[(dir * half) / 2, h / 2, 0]} look={look} realistic={realistic} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Door frame: jambs and head lining the opening, standing proud of both wall faces. */
function Casing({ x0, x1, h, side, look, realistic }: { x0: number; x1: number; h: number; side: number; look: Look; realistic: boolean }) {
  const t = 4;
  const depth = W + 2;
  const zc = (-W / 2) * side;
  return (
    <>
      <Box size={[t, h, depth]} at={[x0 + t / 2, h / 2, zc]} look={look} realistic={realistic} />
      <Box size={[t, h, depth]} at={[x1 - t / 2, h / 2, zc]} look={look} realistic={realistic} />
      <Box size={[x1 - x0, t, depth]} at={[(x0 + x1) / 2, h - t / 2, zc]} look={look} realistic={realistic} />
    </>
  );
}

/* ---------------- windows ---------------- */

function Window3D({ win, ceiling, fitOut, realistic, side }: OpeningProps & { win: Window; side: number }) {
  const style = windowStyle(win);
  const look = FRAME_LOOK[finishOf(win, fitOut)];
  const y0 = win.sillHeight;
  const h = Math.min(win.height, ceiling - y0);
  const w = win.width;
  const zc = (-W / 2) * side;
  const f = style === "fixed" ? 5 : 6;
  const cx = win.offset + w / 2;
  const frame = (
    <>
      <Box size={[w, f, 7]} at={[cx, y0 + h - f / 2, zc]} look={look} realistic={realistic} />
      <Box size={[w, f, 7]} at={[cx, y0 + f / 2, zc]} look={look} realistic={realistic} />
      <Box size={[f, h - 2 * f, 7]} at={[win.offset + f / 2, y0 + h / 2, zc]} look={look} realistic={realistic} />
      <Box size={[f, h - 2 * f, 7]} at={[win.offset + w - f / 2, y0 + h / 2, zc]} look={look} realistic={realistic} />
    </>
  );
  const innerW = w - 2 * f;
  const innerH = h - 2 * f;
  let sashes: React.ReactNode;
  if (style === "fixed") {
    sashes = (
      <mesh position={[cx, y0 + h / 2, zc]}>
        <boxGeometry args={[innerW, innerH, 1]} />
        <Glass />
      </mesh>
    );
  } else if (style === "sliding") {
    // Two sashes, each a little over half the width, on staggered tracks.
    const sw = innerW * 0.52;
    sashes = [-1, 1].map((s) => (
      <Sash key={s} w={sw} h={innerH} at={[cx + s * (innerW / 2 - sw / 2), y0 + f + innerH / 2, zc + s * 1.8]} look={look} realistic={realistic} handle={s < 0 ? "right" : "left"} />
    ));
  } else {
    // Casement, tilt & turn and full-height glazing: side-by-side sashes about 80 cm wide.
    const n = Math.max(1, Math.round(innerW / (style === "floor_to_ceiling" ? 90 : 75)));
    const sw = innerW / n;
    sashes = Array.from({ length: n }, (_, i) => (
      <Sash key={i} w={sw} h={innerH} at={[win.offset + f + sw * (i + 0.5), y0 + f + innerH / 2, zc]} look={look} realistic={realistic} handle={i % 2 === 0 ? "right" : "left"} />
    ));
  }
  return (
    <>
      {frame}
      {sashes}
      {y0 > 0 && (
        // Interior sill board.
        <Part size={[w + 8, 2.5, W / 2 + 4]} at={[cx, y0 - 1.25, (-W / 2 + (W / 2 + 4) / 2) * side]}>
          <meshStandardMaterial color="#ebe7df" roughness={0.45} />
        </Part>
      )}
    </>
  );
}

/** A glazed sash centred at `at`, with its handle on one side. */
function Sash({ w, h, at, look, realistic, handle }: { w: number; h: number; at: V3; look: Look; realistic: boolean; handle: "left" | "right" }) {
  const b = 5.5;
  const [x, y, z] = at;
  const hx = handle === "right" ? x + w / 2 - b / 2 : x - w / 2 + b / 2;
  return (
    <>
      <Box size={[w, b, 6]} at={[x, y + h / 2 - b / 2, z]} look={look} realistic={realistic} />
      <Box size={[w, b, 6]} at={[x, y - h / 2 + b / 2, z]} look={look} realistic={realistic} />
      <Box size={[b, h - 2 * b, 6]} at={[x - w / 2 + b / 2, y, z]} look={look} realistic={realistic} />
      <Box size={[b, h - 2 * b, 6]} at={[x + w / 2 - b / 2, y, z]} look={look} realistic={realistic} />
      <mesh position={[x, y, z]}>
        <boxGeometry args={[w - 2 * b, h - 2 * b, 0.8]} />
        <Glass />
      </mesh>
      <Part size={[1.6, 11, 2]} at={[hx, y, z + 4]}>
        <Steel />
      </Part>
    </>
  );
}

/* ---------------- radiators ---------------- */

/** Boxes merged into one mesh, for repeated parts like columns and grille bars. */
function useMergedBoxes(boxes: { size: V3; at: V3 }[], key: string) {
  const geo = useMemo(() => {
    const parts = boxes.map(({ size, at }) => new THREE.BoxGeometry(...size).translate(...at));
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes the boxes
  }, [key]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

function Radiator3D({ rad, fitOut, realistic, side }: OpeningProps & { rad: Radiator; side: number }) {
  const style = radiatorStyle(rad);
  const look = RADIATOR_LOOK[finishOf(rad, fitOut)];
  const { width: w, height: h, depth: d } = rad;
  const x0 = rad.offset;
  const convector = style === "convector";
  // Wall radiators hang 15 cm above the floor (towel rails 20 cm); a convector lies in the floor.
  const y0 = convector ? 0 : style === "towel" ? 20 : 15;
  const zc = (convector ? d / 2 + 2 : d / 2 + 3) * side;
  const boxes = useMemo(() => radiatorBoxes(style, w, h, d), [style, w, h, d]);
  const geo = useMergedBoxes(boxes, `${style}:${w}:${h}:${d}`);
  return (
    <group position={[x0, y0, zc]}>
      <mesh geometry={geo} castShadow={!convector} receiveShadow>
        <LookMat look={look} realistic={false} />
        {!realistic && !convector && <Edges color={INK} threshold={15} />}
      </mesh>
      {convector && (
        // The dark trench under the grille.
        <Part size={[w, 0.8, d]} at={[w / 2, 0.3, 0]}>
          <meshStandardMaterial color="#1a1918" roughness={0.9} />
        </Part>
      )}
      {style === "towel" &&
        [0, w].map((x) => (
          <Cyl key={x} top={1.6} bottom={1.6} h={h} at={[x, h / 2, 0]}>
            <LookMat look={look} realistic={false} />
          </Cyl>
        ))}
    </group>
  );
}

/** Parts of a radiator in its own frame: x from 0 to w along the wall, y up from its bottom, z centred. */
export function radiatorBoxes(style: RadiatorStyle, w: number, h: number, d: number): { size: V3; at: V3 }[] {
  switch (style) {
    case "column": {
      // Vertical columns every 5 cm, joined by top and bottom headers.
      const n = Math.max(2, Math.floor(w / 5));
      const pitch = w / n;
      const cols = Array.from({ length: n }, (_, i) => ({ size: [pitch * 0.7, h, d] as V3, at: [pitch * (i + 0.5), h / 2, 0] as V3 }));
      return [...cols, { size: [w, 4, d * 0.5], at: [w / 2, h - 3, 0] }, { size: [w, 4, d * 0.5], at: [w / 2, 3, 0] }];
    }
    case "towel": {
      // Horizontal bars every 9 cm between the two side rails.
      const n = Math.max(3, Math.floor(h / 9));
      return Array.from({ length: n }, (_, i) => ({ size: [w, 2, 2] as V3, at: [w / 2, (h / n) * (i + 0.5), 0] as V3 }));
    }
    case "convector": {
      // Grille bars across the trench, flush with the floor.
      const n = Math.max(4, Math.floor(w / 1.6));
      const pitch = w / n;
      return Array.from({ length: n }, (_, i) => ({ size: [pitch * 0.45, 1, d] as V3, at: [pitch * (i + 0.5), 0.5, 0] as V3 }));
    }
    case "vertical":
    case "panel":
    default: {
      // A flat panel with a convector grille on top; vertical designs get slim ribs.
      const ribs = style === "vertical" ? Math.max(3, Math.floor(w / 7)) : 0;
      const pitch = ribs ? w / ribs : 0;
      return [
        { size: [w, h, d * 0.55], at: [w / 2, h / 2, -d * 0.2] },
        { size: [w - 1, 1, d * 0.9], at: [w / 2, h - 0.5, 0] },
        ...Array.from({ length: ribs }, (_, i) => ({ size: [pitch * 0.35, h - 2, d * 0.25] as V3, at: [pitch * (i + 0.5), h / 2, d * 0.2] as V3 })),
      ];
    }
  }
}
