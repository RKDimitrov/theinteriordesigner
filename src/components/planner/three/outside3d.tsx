"use client";

import { useTexture } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";
import { assetPaths } from "@/domain/assets/catalogue";
import { backplateFor, defaultOutlook, dominantOutlook, groundBelowCm, heightBand, OPPOSITE_DISTANCE_CM, type Outlook, STOREY_CM, type Surroundings, type WallOutlooks } from "@/domain/context/outside";
import type { Material } from "@/domain/materials/library";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import type { Room } from "@/domain/schemas/room";
import { type Vec } from "@/domain/geometry/vec";
import { wallsOf } from "@/domain/geometry/walls";
import { cmUV } from "./geometry";
import { RealSurface } from "./surface-materials";

/*
 * The world outside the apartment: a photographed panorama projected onto
 * the ground at the right depth below the flat, the building the flat is in
 * (its storeys below), and the facades across the street or courtyard. The
 * near context is built in code from simple blocks and window grids so it
 * stays cheap; the panorama carries the detail.
 */

/** How high above the ground the panoramas were photographed. */
const CAPTURE_CM = 170;
/** The panorama sphere; the camera's far plane (40 000) stays outside it. */
const SKY_RADIUS_CM = 30000;

export interface OutsideRoom {
  room: Room;
  origin: Vec;
  outlooks: WallOutlooks;
}

export function Outside({ rooms, surroundings, floorLevel, hour }: { rooms: readonly OutsideRoom[]; surroundings: Surroundings; floorLevel: number; hour: number }) {
  const below = groundBelowCm(floorLevel);
  const bounds = useMemo(() => apartmentBounds(rooms), [rooms]);
  const sides = useMemo(() => windowSides(rooms, surroundings), [rooms, surroundings]);
  const outlook = dominantOutlook(
    sides.map((s) => ({ [s.outlook]: s.windows })),
    defaultOutlook(surroundings.kind),
  );
  const panorama = backplateFor(surroundings, heightBand(floorLevel), outlook);
  // Until phase E adds night skies, dim the photograph after dusk.
  const light = hour >= 21 || hour <= 5 ? 0.18 : hour >= 20 || hour <= 6 ? 0.45 : 1;
  const opposite = storeysOpposite(surroundings);
  const m = BUILDING_MARGIN_CM;

  return (
    <group>
      <Panorama id={panorama} groundY={-below} center={bounds.center} light={light} />
      <ShadowCatcher y={-below} center={bounds.center} />
      {below > 0 && <Block x0={bounds.x0 - m} x1={bounds.x1 + m} z0={bounds.z0 - m} z1={bounds.z1 + m} y0={-below} y1={-1} facade={facadeOf(surroundings)} windows />}
      {sides.map((s) => {
        const d = OPPOSITE_DISTANCE_CM[s.outlook];
        if (d === null) return null;
        // A courtyard is closed in by the same building, as high as the flat's own floor plus the roof storey.
        const height = (s.outlook === "courtyard" ? Math.max(floorLevel + 1, 3) : opposite) * STOREY_CM;
        return <Opposite key={s.dir} dir={s.dir} bounds={bounds} distance={d + m} y0={-below} height={height} facade={facadeOf(surroundings)} />;
      })}
    </group>
  );
}

/* ---------------- panorama ---------------- */

function Panorama({ id, groundY, center, light }: { id: string; groundY: number; center: THREE.Vector3; light: number }) {
  // Set up once, when the texture loads (textures are cached per URL).
  const map = useTexture(assetPaths.backplate(id), (t) => {
    const tex = t as THREE.Texture;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  });
  const sky = useMemo(() => {
    const s = new GroundedSkybox(map, CAPTURE_CM, SKY_RADIUS_CM);
    const mat = s.material as THREE.MeshBasicMaterial;
    // The photo is already exposed and tonemapped.
    mat.toneMapped = false;
    mat.depthWrite = false;
    s.renderOrder = -1;
    // Clicks go through the sky to "nothing", which clears the selection.
    s.raycast = () => {};
    return s;
  }, [map]);
  useEffect(() => () => sky.geometry.dispose(), [sky]);
  useEffect(() => {
    (sky.material as THREE.MeshBasicMaterial).color.setScalar(light);
  }, [sky, light]);
  return <primitive object={sky} position={[center.x, groundY + CAPTURE_CM, center.z]} />;
}

/** Receives the building's and furniture's shadows on the photographed ground. */
function ShadowCatcher({ y, center }: { y: number; center: THREE.Vector3 }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[center.x, y + 0.5, center.z]} receiveShadow raycast={() => {}}>
      <circleGeometry args={[6000, 48]} />
      <shadowMaterial opacity={0.25} />
    </mesh>
  );
}

/* ---------------- building blocks ---------------- */

interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  center: THREE.Vector3;
}

/** The apartment's footprint in scene coordinates, walls included. */
export function apartmentBounds(rooms: readonly OutsideRoom[]): Bounds {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const r of rooms)
    for (const p of r.room.polygon) {
      x0 = Math.min(x0, r.origin.x + p.x);
      x1 = Math.max(x1, r.origin.x + p.x);
      z0 = Math.min(z0, r.origin.y + p.y);
      z1 = Math.max(z1, r.origin.y + p.y);
    }
  if (!Number.isFinite(x0)) [x0, x1, z0, z1] = [0, 0, 0, 0];
  const w = PLANNER_WALL_CM;
  return { x0: x0 - w, x1: x1 + w, z0: z0 - w, z1: z1 + w, center: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2) };
}

type Dir = "n" | "e" | "s" | "w";

/** Sides of the apartment that have windows, with the outlook most of them share. */
function windowSides(rooms: readonly OutsideRoom[], surroundings: Surroundings): { dir: Dir; outlook: Outlook; windows: number }[] {
  const count = new Map<Dir, Map<Outlook, number>>();
  for (const r of rooms) {
    const walls = wallsOf(r.room.polygon);
    for (const o of r.room.openings) {
      if (o.kind !== "window" && !(o.kind === "door" && o.style === "balcony")) continue;
      const wall = walls[o.wallIndex];
      if (!wall) continue;
      // Outward is the opposite of inward; plan y maps to scene z.
      const ox = -wall.inward.x;
      const oz = -wall.inward.y;
      const dir: Dir = Math.abs(ox) >= Math.abs(oz) ? (ox > 0 ? "e" : "w") : oz > 0 ? "s" : "n";
      const outlook = r.outlooks[String(o.wallIndex)] ?? defaultOutlook(surroundings.kind);
      const m = count.get(dir) ?? new Map<Outlook, number>();
      m.set(outlook, (m.get(outlook) ?? 0) + 1);
      count.set(dir, m);
    }
  }
  return [...count].map(([dir, m]) => {
    const [outlook, windows] = [...m].sort((a, b) => b[1] - a[1])[0]!;
    return { dir, outlook, windows };
  });
}

/** Storeys of the buildings across the street: typical for the area, so high floors see over them. */
const storeysOpposite = (s: Surroundings): number => (s.kind === "city_centre" ? 7 : s.kind === "urban" ? 5 : 3);

/** A flat is part of a wider building: its block runs this far past the flat on every side. */
const BUILDING_MARGIN_CM = 600;

/** Render colour of the facades around: stone-grey in town, white in the suburbs. */
function facadeOf(s: Surroundings): Material {
  const tint = s.kind === "city_centre" ? "#d6cec2" : s.kind === "urban" ? "#e2d6c3" : s.kind === "suburban" ? "#eee8de" : "#e6dccb";
  return { id: "facade", surfaces: ["wall"], group: "plaster", texture: "painted_plaster_wall", tint };
}

/** A building across the street or courtyard, facing the apartment, running well past it on both sides. */
function Opposite({ dir, bounds, distance, y0, height, facade }: { dir: Dir; bounds: Bounds; distance: number; y0: number; height: number; facade: Material }) {
  const depth = 1200;
  const extra = 2500;
  const b = bounds;
  const box =
    dir === "e"
      ? { x0: b.x1 + distance, x1: b.x1 + distance + depth, z0: b.z0 - extra, z1: b.z1 + extra }
      : dir === "w"
        ? { x0: b.x0 - distance - depth, x1: b.x0 - distance, z0: b.z0 - extra, z1: b.z1 + extra }
        : dir === "s"
          ? { x0: b.x0 - extra, x1: b.x1 + extra, z0: b.z1 + distance, z1: b.z1 + distance + depth }
          : { x0: b.x0 - extra, x1: b.x1 + extra, z0: b.z0 - distance - depth, z1: b.z0 - distance };
  return <Block {...box} y0={y0} y1={y0 + height} facade={facade} windows />;
}

/** A rendered block with rows of windows on every side, one row per storey. */
function Block({ x0, x1, z0, z1, y0, y1, facade, windows }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; facade: Material; windows: boolean }) {
  const geo = useMemo(() => cmUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), [x0, x1, y0, y1, z0, z1]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow raycast={() => {}}>
        <RealSurface m={facade} />
      </mesh>
      {windows && <WindowGrid x0={x0} x1={x1} z0={z0} z1={z1} y0={y0} y1={y1} />}
    </group>
  );
}

const PANE = { w: 120, h: 150, sill: 90, pitch: 300 };

/** Dark window panes in pale frames on all four faces, instanced. */
function WindowGrid({ x0, x1, z0, z1, y0, y1 }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }) {
  const glass = useRef<THREE.InstancedMesh>(null);
  const frame = useRef<THREE.InstancedMesh>(null);
  const slots = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number }[] = [];
    const storeys = Math.floor((y1 - y0) / STOREY_CM);
    const faces: { a: number; b: number; fixed: number; axis: "x" | "z"; ry: number }[] = [
      { a: x0, b: x1, fixed: z1 + 1, axis: "x", ry: 0 },
      { a: x0, b: x1, fixed: z0 - 1, axis: "x", ry: Math.PI },
      { a: z0, b: z1, fixed: x1 + 1, axis: "z", ry: Math.PI / 2 },
      { a: z0, b: z1, fixed: x0 - 1, axis: "z", ry: -Math.PI / 2 },
    ];
    for (const f of faces) {
      const n = Math.max(1, Math.floor((f.b - f.a - 100) / PANE.pitch));
      const step = (f.b - f.a) / n;
      for (let s = 0; s < storeys; s++)
        for (let i = 0; i < n; i++) {
          const along = f.a + step * (i + 0.5);
          const y = y0 + s * STOREY_CM + PANE.sill + PANE.h / 2;
          out.push(f.axis === "x" ? { x: along, y, z: f.fixed, ry: f.ry } : { x: f.fixed, y, z: along, ry: f.ry });
        }
    }
    return out;
  }, [x0, x1, z0, z1, y0, y1]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    slots.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, one);
      glass.current?.setMatrixAt(i, m);
      frame.current?.setMatrixAt(i, m);
    });
    if (glass.current) glass.current.instanceMatrix.needsUpdate = true;
    if (frame.current) frame.current.instanceMatrix.needsUpdate = true;
  }, [slots]);
  return (
    <>
      <instancedMesh key={`f${slots.length}`} ref={frame} args={[undefined, undefined, slots.length]} raycast={() => {}}>
        <planeGeometry args={[PANE.w + 12, PANE.h + 12]} />
        <meshStandardMaterial color="#f1ede6" roughness={0.6} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh key={`g${slots.length}`} ref={glass} args={[undefined, undefined, slots.length]} position-y={0} raycast={() => {}}>
        <planeGeometry args={[PANE.w, PANE.h]} />
        <meshStandardMaterial color="#2d343a" metalness={0.4} roughness={0.15} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} />
      </instancedMesh>
    </>
  );
}
