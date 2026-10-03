"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { wallsOf } from "@/domain/geometry/walls";
import { floorBounds, floorOrigins } from "@/domain/planner/floor-layout";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { sharedWallInfo, type WallShare } from "@/domain/planner/walls3d";
import type { Room } from "@/domain/schemas/room";
import { wallGeometry } from "@/components/planner/three/wall-geometry";

const INK = "#2b2622";

/**
 * The apartment as a small model that turns slowly on its own and can be
 * dragged round: floors and walls in the plan's drawing style, no ceilings,
 * no furniture. Light enough for the apartment page.
 */
export default function FloorModel3D({ rooms }: { rooms: readonly Room[] }) {
  const origins = useMemo(() => floorOrigins(rooms), [rooms]);
  const b = floorBounds(rooms, origins);
  const shares = useMemo(
    () => sharedWallInfo(rooms.map((r) => ({ id: r.id, polygon: r.polygon, origin: origins.get(r.id) ?? { x: 0, y: 0 }, openings: r.openings })), PLANNER_WALL_CM),
    [rooms, origins],
  );
  if (!b) return null;
  const cx = b.x + b.w / 2;
  const cz = b.y + b.d / 2;
  const r = Math.max(b.w, b.d);
  return (
    <Canvas camera={{ fov: 32, near: 10, far: 20000, position: [cx + r * 0.9, r * 1.05, cz + r * 1.1] }} dpr={[1, 1.5]} data-testid="floor-model-3d" gl={{ antialias: true }}>
      <color attach="background" args={["#f4ede0"]} />
      <hemisphereLight args={["#fffaf0", "#d9c9ad", 1.4]} />
      <directionalLight position={[cx - r, r * 2, cz + r * 0.6]} intensity={1.6} />
      <mesh rotation-x={-Math.PI / 2} position={[cx, -2, cz]}>
        <circleGeometry args={[r * 1.2, 48]} />
        <meshStandardMaterial color="#e8dcc6" roughness={1} />
      </mesh>
      {rooms.map((room) => (
        <ModelRoom key={room.id} room={room} origin={origins.get(room.id) ?? { x: 0, y: 0 }} shares={shares[room.id]} />
      ))}
      <OrbitControls makeDefault target={[cx, 60, cz]} autoRotate autoRotateSpeed={0.6} enablePan={false} enableDamping maxPolarAngle={Math.PI / 2.2} minDistance={r * 0.5} maxDistance={r * 3} />
    </Canvas>
  );
}

function ModelRoom({ room, origin, shares }: { room: Room; origin: { x: number; y: number }; shares?: WallShare[] }) {
  const floor = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, p.y))));
    g.rotateX(Math.PI / 2);
    return g;
  }, [room.polygon]);
  useEffect(() => () => floor.dispose(), [floor]);
  const walls = useMemo(() => wallsOf(room.polygon), [room.polygon]);
  return (
    <group position={[origin.x, 0, origin.y]}>
      <mesh geometry={floor}>
        <meshStandardMaterial color="#d8b98f" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {walls.map((w) => (
        <ModelWall key={w.index} room={room} wallIndex={w.index} share={shares?.[w.index]} />
      ))}
    </group>
  );
}

function ModelWall({ room, wallIndex, share }: { room: Room; wallIndex: number; share?: WallShare }) {
  const wall = wallsOf(room.polygon)[wallIndex]!;
  const geo = useMemo(() => wallGeometry(room, wall, share), [room, wall, share]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={[wall.a.x, 0, wall.a.y]} rotation-y={-Math.atan2(wall.dir.y, wall.dir.x)}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#fbf6ec" roughness={0.85} />
        <Edges color={INK} threshold={15} />
      </mesh>
    </group>
  );
}
