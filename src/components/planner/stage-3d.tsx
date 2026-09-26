"use client";

import { Edges, Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Camera as CameraIcon, DoorOpen, Footprints, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPosition } from "suncalc";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { doorLeaf, openingSpan } from "@/domain/geometry/openings";
import { bbox } from "@/domain/geometry/polygon";
import { clamp } from "@/domain/geometry/units";
import type { Vec } from "@/domain/geometry/vec";
import { type Wall, wallsOf } from "@/domain/geometry/walls";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { canStand, roomAt, startSpot, type WalkRoom, wallPieces } from "@/domain/planner/walls3d";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Door, Opening, Room } from "@/domain/schemas/room";
import { usePlanner } from "./planner-context";
import { type Camera, DEFAULT_FINISH, type Finish, type PlanRoom } from "./state";
import { floorTexture, WALL_COLOR } from "./three/materials";

const INK = "#2b2622";
const CLAY = "#c8794a";
const WALNUT = "#6b4a32";
const DOOR = "#b58a60";
const W = PLANNER_WALL_CM;
const WALK_SPEED = 150; // cm/s
const TURN_SPEED = 80; // °/s
const YAW_PER_PX = 0.15;
const PITCH_PER_PX = 0.12;
const PITCH_MAX = 35;
const DOOR_REACH = 190;
const WALK_FOV = 62;

/** Vertical field of view for a lens on a full-frame sensor. */
const fovOf = (lens: Camera["lens"]) => (2 * Math.atan(12 / lens) * 180) / Math.PI;
const doorKey = (roomId: string, id: string) => `${roomId}:${id}`;

interface Placed {
  r: PlanRoom;
  origin: Vec;
  finish: Finish;
}

export default function Stage3D() {
  const t = useTranslations("Planner");
  const { s, dispatch, data, toast } = usePlanner();
  const gl = useRef<THREE.WebGLRenderer | null>(null);
  const [locked, setLocked] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const walkApiRef = useRef<{ toggleNearestDoor: () => void; move: (key: string, down: boolean) => void } | null>(null);

  const placed: Placed[] = useMemo(
    () =>
      s.plan.rooms
        .filter((r) => s.visible3d.includes(r.room.id))
        .map((r) => ({ r, origin: s.plan.origins[r.room.id] ?? { x: 0, y: 0 }, finish: s.finishes[r.room.id] ?? DEFAULT_FINISH })),
    [s.plan.rooms, s.plan.origins, s.visible3d, s.finishes],
  );

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of placed) {
      const b = bbox(p.r.room.polygon);
      minX = Math.min(minX, p.origin.x + b.x);
      minY = Math.min(minY, p.origin.y + b.y);
      maxX = Math.max(maxX, p.origin.x + b.x + b.w);
      maxY = Math.max(maxY, p.origin.y + b.y + b.d);
    }
    if (!Number.isFinite(minX)) return { cx: 0, cz: 0, radius: 400 };
    return { cx: (minX + maxX) / 2, cz: (minY + maxY) / 2, radius: Math.max(250, Math.hypot(maxX - minX, maxY - minY) / 2) };
  }, [placed]);

  const sun = useMemo(() => sunVector(s.scene.hour, data.apartment.lat ?? 50, data.apartment.northAngleDeg), [s.scene.hour, data.apartment.lat, data.apartment.northAngleDeg]);

  const screenshot = () => {
    const canvas = gl.current?.domElement;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${data.projectCode}-3d.png`;
    a.click();
    toast(t("screenshotSaved"));
  };

  const startWalk = () => dispatch({ type: "set", patch: { walking: true } });
  const stopWalk = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    dispatch({ type: "set", patch: { walking: false } });
  };

  useEffect(() => {
    const onLock = () => {
      const isLocked = document.pointerLockElement === gl.current?.domElement;
      setLocked(isLocked);
    };
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, []);

  const empty = placed.length === 0;
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  return (
    <div className="pl-stage">
      <div className="pl-scene3" style={{ "--sky": sun.sky } as React.CSSProperties} data-testid="planner-scene-3d">
        {!empty && (
          <Canvas
            shadows="percentage"
            dpr={[1, 1.5]}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ fov: fovOf(s.camera.lens), near: 5, far: 40000, position: [bounds.cx + 800, 700, bounds.cz + 800] }}
            onCreated={(state) => {
              gl.current = state.gl;
              state.gl.toneMapping = THREE.ACESFilmicToneMapping;
            }}
            onPointerMissed={() => !s.walking && dispatch({ type: "select", selection: null })}
          >
            <SceneContents placed={placed} sun={sun} />
            {s.walking ? (
              <WalkControls placed={placed} onLocation={setLocation} apiRef={walkApiRef} coarse={!!coarse} onExit={stopWalk} />
            ) : (
              <OrbitRig cx={bounds.cx} cz={bounds.cz} radius={bounds.radius} />
            )}
          </Canvas>
        )}
        {empty && <p className="pl-hint" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{t("noRoomsInView")}</p>}

        {!s.walking ? (
          <>
            <div className="pl-cam-bar">
              <Button size="sm" variant="outline" onClick={screenshot} disabled={empty}>
                <CameraIcon /> {t("screenshot")}
              </Button>
              <Button size="sm" variant="outline" onClick={startWalk} disabled={empty} data-testid="planner-walkthrough">
                <Footprints /> {t("walkthrough")}
              </Button>
            </div>
            <svg className="pl-compass" viewBox="-30 -30 60 60" aria-hidden>
              <circle r={26} fill="#fbf6ec" stroke={INK} strokeWidth={1.2} />
              <g transform={`rotate(${data.apartment.northAngleDeg - s.camera.rotation})`}>
                <path d="M0 -20L6 4 0 0-6 4Z" fill={CLAY} stroke={INK} strokeWidth={1} />
                <path d="M0 20L4 4 0 0-4 4Z" fill="#fbf6ec" stroke={INK} strokeWidth={1} />
                <text y={-22} x={-3} fontFamily="var(--mono)" fontSize={8} fontWeight={600}>
                  N
                </text>
              </g>
            </svg>
            <div className="pl-sbar">
              <span>{t("orbitHint")}</span>
              <span className="adv">{s.scene.foldWalls ? t("foldHint") : ""}</span>
            </div>
          </>
        ) : (
          <div className="pl-walkui">
            <div className="wtop">
              {location && <span className="pl-wchip">{location === "__doorway" ? t("doorway") : location}</span>}
              <Button size="sm" variant="outline" onClick={stopWalk}>
                <X /> {t("exitWalk")}
              </Button>
            </div>
            <i className="pl-cross" />
            <div className="pl-whint">{locked ? t("walkHintLocked") : coarse ? t("walkHintTouch") : t("walkHintFree")}</div>
            {!locked && (
              <>
                <div className="pl-wpad">
                  {[
                    ["", ""],
                    ["w", "▲"],
                    ["", ""],
                    ["a", "◀"],
                    ["s", "▼"],
                    ["d", "▶"],
                  ].map(([k, label], i) =>
                    k ? (
                      <button
                        key={i}
                        type="button"
                        aria-label={t(`walk_${k}` as "walk_w")}
                        onPointerDown={() => walkApiRef.current?.move(k, true)}
                        onPointerUp={() => walkApiRef.current?.move(k, false)}
                        onPointerLeave={() => walkApiRef.current?.move(k, false)}
                      >
                        {label}
                      </button>
                    ) : (
                      <span key={i} />
                    ),
                  )}
                </div>
                <Button size="sm" variant="outline" className="pl-wdoor" onClick={() => walkApiRef.current?.toggleNearestDoor()}>
                  <DoorOpen /> {t("doorToggle")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- sun ---------------- */

function sunVector(hour: number, lat: number, northAngleDeg: number) {
  const now = new Date();
  // Longitude is not stored; local solar time at 0° is close enough for light direction.
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0));
  // suncalc 2.x: degrees, azimuth clockwise from north.
  const pos = getPosition(at, lat, 0);
  const theta = ((northAngleDeg + pos.azimuth) * Math.PI) / 180; // plan angle, clockwise from up
  const alt = (Math.max(pos.altitude, 3) * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(alt), Math.sin(alt), -Math.cos(theta) * Math.cos(alt)).normalize();
  const up = pos.altitude > 0;
  const warm = hour < 9 || hour > 18;
  return {
    dir,
    intensity: up ? (warm ? 1.6 : 2.6) : 0.3,
    color: warm ? "#ffd2a1" : "#fff4e2",
    sky: !up ? "#b9b3b8" : warm ? "#f1dcc6" : "#ece6d8",
  };
}

/* ---------------- scene ---------------- */

const SceneContents = memo(function SceneContents({ placed, sun }: { placed: Placed[]; sun: ReturnType<typeof sunVector> }) {
  const { s } = usePlanner();
  const center = useMemo(() => {
    const v = new THREE.Vector3();
    placed.forEach((p) => {
      const b = bbox(p.r.room.polygon);
      v.add(new THREE.Vector3(p.origin.x + b.x + b.w / 2, 0, p.origin.y + b.y + b.d / 2));
    });
    return placed.length ? v.multiplyScalar(1 / placed.length) : v;
  }, [placed]);
  const sunPos = useMemo(() => center.clone().add(sun.dir.clone().multiplyScalar(3000)), [center, sun.dir]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(center);
    return o;
  }, [center]);

  return (
    <>
      <hemisphereLight args={["#fff7ea", "#d8c6a8", 1.35]} />
      <ambientLight intensity={0.35} color="#fff3e2" />
      <directionalLight
        position={sunPos}
        target={target}
        intensity={sun.intensity}
        color={sun.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
        shadow-camera-near={10}
        shadow-camera-far={8000}
        shadow-bias={-0.0004}
        shadow-normalBias={3}
      />
      <primitive object={target} />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.2} position={[0, 5, -9]} scale={[10, 5, 1]} color="#fff4e6" />
        <Lightformer intensity={0.6} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#f2e6d6" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[center.x, -1.5, center.z]} receiveShadow>
        <circleGeometry args={[3000, 48]} />
        <meshStandardMaterial color="#e3d5bd" roughness={1} />
      </mesh>
      {placed.map((p) => (
        <Room3D key={p.r.room.id} placed={p} />
      ))}
      {s.scene.ceilingLights &&
        placed.map((p) => {
          const b = bbox(p.r.room.polygon);
          return <pointLight key={p.r.room.id} position={[p.origin.x + b.x + b.w / 2, p.r.room.ceilingHeight - 20, p.origin.y + b.y + b.d / 2]} intensity={1.4} distance={900} decay={0} color="#ffc98a" />;
        })}
    </>
  );
});

function Room3D({ placed }: { placed: Placed }) {
  const { s } = usePlanner();
  const { r, origin, finish } = placed;
  const room = r.room;
  const walls = useMemo(() => wallsOf(room.polygon), [room.polygon]);
  const floorGeo = useMemo(() => {
    const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(Math.PI / 2);
    return g;
  }, [room.polygon]);
  const tex = useMemo(() => floorTexture(finish.floor), [finish.floor]);
  const lamps = r.furniture.filter((f) => f.category === "floor_lamp").slice(0, 6);

  return (
    <group position={[origin.x, 0, origin.y]}>
      <mesh geometry={floorGeo} receiveShadow>
        <meshStandardMaterial map={tex} color={tex ? "#ffffff" : "#cfa77a"} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {walls.map((w) => (
        <FoldGroup key={w.index} wall={w} origin={origin}>
          <Wall3D room={room} wall={w} color={WALL_COLOR[finish.walls]} />
          {room.openings
            .filter((o) => o.wallIndex === w.index && o.kind !== "radiator")
            .map((o) => (
              <Opening3D key={o.id} roomId={room.id} walls={walls} o={o} ceiling={room.ceilingHeight} />
            ))}
        </FoldGroup>
      ))}
      {room.openings
        .filter((o) => o.kind === "radiator")
        .map((o) => (
          <Opening3D key={o.id} roomId={room.id} walls={walls} o={o} ceiling={room.ceilingHeight} />
        ))}
      {room.fixedElements.map((f) => (
        <mesh key={f.id} position={[f.rect.x + f.rect.w / 2, Math.min(f.height, room.ceilingHeight) / 2, f.rect.y + f.rect.d / 2]} castShadow receiveShadow>
          <boxGeometry args={[f.rect.w, Math.min(f.height, room.ceilingHeight), f.rect.d]} />
          <meshStandardMaterial color="#e8dcc6" roughness={0.9} />
          <Edges color={INK} threshold={15} />
        </mesh>
      ))}
      {r.furniture.map((f) => (
        <Piece3D key={f.id} roomId={room.id} f={f} ceiling={room.ceilingHeight} showLabel={s.scene.labels} />
      ))}
      {lamps.map((f) => (
        <pointLight key={f.id} position={[f.x, Math.max(80, f.h - 20), f.y]} intensity={s.scene.ceilingLights || s.scene.hour > 18 ? 1.1 : 0.35} distance={450} decay={0} color="#ffb46b" />
      ))}
    </group>
  );
}

/** Hides its children while the camera is outside `wall` (dollhouse cutaway), unless folding is off or walking. */
function FoldGroup({ wall, origin, children }: { wall: Wall; origin: Vec; children: React.ReactNode }) {
  const { s } = usePlanner();
  const group = useRef<THREE.Group>(null);
  const outward = useMemo(() => new THREE.Vector3(-wall.inward.x, 0, -wall.inward.y), [wall]);
  const mid = useMemo(() => new THREE.Vector3(origin.x + (wall.a.x + wall.b.x) / 2, 0, origin.y + (wall.a.y + wall.b.y) / 2), [wall, origin]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const fold = s.scene.foldWalls && !s.walking;
    group.current.visible = !fold || tmp.subVectors(camera.position, mid).dot(outward) < 0;
  });
  return <group ref={group}>{children}</group>;
}

/** One wall, split into solid boxes around its openings. */
function Wall3D({ room, wall, color }: { room: Room; wall: Wall; color: string }) {
  const pieces = useMemo(() => wallPieces(wall.length, room.ceilingHeight, room.openings.filter((o) => o.wallIndex === wall.index)), [wall, room.ceilingHeight, room.openings]);
  const angle = -Math.atan2(wall.dir.y, wall.dir.x);
  return (
    <group position={[wall.a.x, 0, wall.a.y]} rotation-y={angle}>
      {pieces.map((p, i) => (
        <mesh key={i} position={[(p.from + p.to) / 2, (p.y0 + p.y1) / 2, -W / 2 * sideSign(wall)]} castShadow receiveShadow>
          <boxGeometry args={[p.to - p.from, p.y1 - p.y0, W]} />
          <meshStandardMaterial color={color} roughness={0.95} />
          <Edges color={INK} threshold={15} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * After rotating the wall group so local +x runs along the wall, the room's
 * inside is +z or −z depending on winding; walls sit on the outside.
 */
function sideSign(wall: Wall): number {
  // Local +z after rotation by −atan2(dir.y, dir.x) is the plan direction perpCw(dir) = (−dir.y, dir.x).
  const pz = { x: -wall.dir.y, y: wall.dir.x };
  return pz.x * wall.inward.x + pz.y * wall.inward.y > 0 ? 1 : -1;
}

function Opening3D({ roomId, walls, o, ceiling }: { roomId: string; walls: readonly Wall[]; o: Opening; ceiling: number }) {
  const span = openingSpan(walls, o);
  if (!span) return null;
  const { wall } = span;
  const angle = -Math.atan2(wall.dir.y, wall.dir.x);
  const side = sideSign(wall);
  if (o.kind === "window") {
    const h = Math.min(o.height, ceiling - o.sillHeight);
    return (
      <group position={[wall.a.x, 0, wall.a.y]} rotation-y={angle}>
        <group position={[o.offset + o.width / 2, o.sillHeight + h / 2, (-W / 2) * side]}>
          <mesh>
            <boxGeometry args={[o.width - 8, h - 8, 1]} />
            <meshPhysicalMaterial color="#cdd9d5" transparent opacity={0.28} roughness={0.05} metalness={0} />
          </mesh>
          {[
            [0, h / 2 - 2, o.width, 4],
            [0, -h / 2 + 2, o.width, 4],
            [-o.width / 2 + 2, 0, 4, h],
            [o.width / 2 - 2, 0, 4, h],
            [0, 0, 4, h],
          ].map(([x, y, w, hh], i) => (
            <mesh key={i} position={[x!, y!, 0]} castShadow>
              <boxGeometry args={[w!, hh!, 6]} />
              <meshStandardMaterial color={WALNUT} roughness={0.7} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }
  if (o.kind === "door") return <Door3D roomId={roomId} walls={walls} door={o} ceiling={ceiling} />;
  if (o.kind === "radiator") {
    return (
      <group position={[wall.a.x, 0, wall.a.y]} rotation-y={angle}>
        <mesh position={[o.offset + o.width / 2, 15 + o.height / 2, (o.depth / 2 + 3) * side]} castShadow>
          <boxGeometry args={[o.width, o.height, o.depth]} />
          <meshStandardMaterial color="#f6f1e8" roughness={0.6} />
          <Edges color={INK} threshold={15} />
        </mesh>
      </group>
    );
  }
  return null;
}

/** A leaf hinged at the door's hinge side; swings 90° over 0.8 s. Click to open or close. */
function Door3D({ roomId, walls, door, ceiling }: { roomId: string; walls: readonly Wall[]; door: Door; ceiling: number }) {
  const { s, dispatch } = usePlanner();
  const pivot = useRef<THREE.Group>(null);
  const key = doorKey(roomId, door.id);
  const open = !!s.doorsOpen[key];
  const leaf = doorLeaf(walls, door);
  const span = openingSpan(walls, door);

  const geo = useMemo(() => {
    if (!leaf || !span) return null;
    const closed = new THREE.Vector2(leaf.closedTip.x - leaf.hinge.x, leaf.closedTip.y - leaf.hinge.y);
    const opened = new THREE.Vector2(leaf.openTip.x - leaf.hinge.x, leaf.openTip.y - leaf.hinge.y);
    const a0 = -Math.atan2(closed.y, closed.x);
    const a1 = -Math.atan2(opened.y, opened.x);
    let delta = a1 - a0;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return { a0, delta };
  }, [leaf, span]);
  const progress = useRef(open ? 1 : 0);

  useFrame((_, dt) => {
    if (!pivot.current || !geo) return;
    const step = dt / 0.8;
    progress.current = open ? Math.min(1, progress.current + step) : Math.max(0, progress.current - step);
    const eased = progress.current < 0.5 ? 2 * progress.current ** 2 : 1 - (-2 * progress.current + 2) ** 2 / 2;
    pivot.current.rotation.y = geo.a0 + geo.delta * eased;
  });

  if (!leaf || !span || !geo) return null;
  const h = Math.min(door.height, ceiling);
  return (
    <group position={[leaf.hinge.x, 0, leaf.hinge.y]}>
      <group ref={pivot} rotation-y={geo.a0}>
        <mesh
          position={[door.width / 2, h / 2, 0]}
          castShadow
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            dispatch({ type: "set", patch: { doorsOpen: { ...s.doorsOpen, [key]: !open } } });
          }}
        >
          <boxGeometry args={[door.width - 2, h - 2, 4]} />
          <meshStandardMaterial color={DOOR} roughness={0.6} />
          <Edges color={WALNUT} threshold={15} />
        </mesh>
      </group>
    </group>
  );
}

function Piece3D({ roomId, f, ceiling, showLabel }: { roomId: string; f: FurnitureItem; ceiling: number; showLabel: boolean }) {
  const { s, dispatch } = usePlanner();
  const selected = s.selection?.kind === "item" && s.selection.id === f.id && s.selection.roomId === roomId;
  const rug = f.placement === "floor_covering";
  const h = rug ? 1 : Math.max(1, Math.min(f.h, ceiling));
  const y = f.placement === "wall" ? f.elevation + h / 2 : f.placement === "ceiling" ? ceiling - h / 2 : h / 2 + (rug ? 0.5 : 0);
  return (
    <group position={[f.x, y, f.y]} rotation-y={(-f.rotation * Math.PI) / 180}>
      <mesh
        castShadow={!rug}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (s.walking) return;
          e.stopPropagation();
          dispatch({ type: "set", patch: { selection: { kind: "item", roomId, id: f.id }, tab3d: "selection" } });
        }}
      >
        <boxGeometry args={[f.w, h, f.d]} />
        <meshStandardMaterial color={f.colorHex} roughness={0.75} />
        <Edges color={selected ? CLAY : INK} lineWidth={selected ? 2.5 : 1} threshold={15} />
      </mesh>
      {showLabel && (
        <Html position={[0, h / 2 + 12, 0]} center style={{ pointerEvents: "none" }}>
          <span style={{ font: "500 10px var(--mono)", background: "#fbf6ec", border: "1px solid #2b2622", padding: "1px 5px", whiteSpace: "nowrap" }}>{f.name}</span>
        </Html>
      )}
    </group>
  );
}

/* ---------------- camera ---------------- */

/** Orbit controls that follow the camera panel, and feed orbiting back into it. */
function OrbitRig({ cx, cz, radius }: { cx: number; cz: number; radius: number }) {
  const { s, dispatch } = usePlanner();
  const get = useThree((st) => st.get);
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const cam = s.camera;
  const fromControls = useRef(false);
  // Distance at which the rooms in view just fit the lens (×1 = "Room").
  const fitFor = useCallback((fov: number) => (radius / Math.tan((fov * Math.PI) / 360)) * 1.05, [radius]);

  useEffect(() => {
    if (fromControls.current) {
      fromControls.current = false;
      return;
    }
    const persp = get().camera as THREE.PerspectiveCamera;
    persp.fov = fovOf(cam.lens);
    persp.updateProjectionMatrix();
    // Same framing across lenses: a longer lens stands further away.
    const r = fitFor(persp.fov) * cam.distance;
    const polar = (clamp(cam.tilt, 1, 89) * Math.PI) / 180;
    const az = (cam.rotation * Math.PI) / 180;
    const ty = Math.min(cam.eyeHeight, 250) * 0.35;
    const target = new THREE.Vector3(cx, ty, cz);
    persp.position.set(cx + r * Math.sin(polar) * Math.sin(az), ty + r * Math.cos(polar), cz + r * Math.sin(polar) * Math.cos(az));
    persp.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [cam, get, cx, cz, fitFor]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      maxPolarAngle={Math.PI / 2 - 0.02}
      onEnd={() => {
        const c = controls.current;
        if (!c) return;
        const persp = get().camera as THREE.PerspectiveCamera;
        const offset = persp.position.clone().sub(c.target);
        const r = offset.length();
        const unit = fitFor(persp.fov);
        const tilt = Math.round((Math.acos(clamp(offset.y / r, -1, 1)) * 180) / Math.PI);
        const rotation = Math.round(((Math.atan2(offset.x, offset.z) * 180) / Math.PI + 360) % 360);
        fromControls.current = true;
        dispatch({ type: "camera", patch: { tilt, rotation, distance: Math.round((r / unit) * 100) / 100 }, preset: null });
      }}
    />
  );
}

/* ---------------- walkthrough ---------------- */

function WalkControls({
  placed,
  onLocation,
  apiRef,
  coarse,
  onExit,
}: {
  placed: Placed[];
  onLocation: (name: string | null) => void;
  apiRef: React.RefObject<{ toggleNearestDoor: () => void; move: (key: string, down: boolean) => void } | null>;
  coarse: boolean;
  onExit: () => void;
}) {
  const { s, dispatch } = usePlanner();
  const gl = useThree((st) => st.gl);
  const rooms: WalkRoom[] = useMemo(() => placed.map((p) => ({ id: p.r.room.id, room: p.r.room, origin: p.origin, furniture: p.r.furniture })), [placed]);
  const doors = useRef(s.doorsOpen);
  useEffect(() => {
    doors.current = s.doorsOpen;
  }, [s.doorsOpen]);
  const isOpen = (roomId: string, id: string) => !!doors.current[doorKey(roomId, id)];
  const player = useRef<Vec | null>(null);
  const yaw = useRef(90);
  const pitch = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const lastLoc = useRef<string | null>(null);
  const eye = s.camera.eyeHeight;

  const toggleNearestDoor = () => {
    const p = player.current;
    if (!p) return;
    let best: { key: string; d: number } | null = null;
    for (const r of rooms) {
      const walls = wallsOf(r.room.polygon);
      for (const o of r.room.openings) {
        if (o.kind !== "door" || o.swing === "none") continue;
        const span = openingSpan(walls, o);
        if (!span) continue;
        const c = { x: r.origin.x + (span.start.x + span.end.x) / 2, y: r.origin.y + (span.start.y + span.end.y) / 2 };
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < DOOR_REACH && (!best || d < best.d)) best = { key: doorKey(r.id, o.id), d };
      }
    }
    if (best) dispatch({ type: "set", patch: { doorsOpen: { ...doors.current, [best.key]: !doors.current[best.key] } } });
  };

  useEffect(() => {
    apiRef.current = { toggleNearestDoor, move: (k, down) => (keys.current[k] = down) };
  });

  useEffect(() => {
    const el = gl.domElement;
    const lock = () => {
      if (coarse) return;
      try {
        const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
        res?.catch?.(() => undefined);
      } catch {
        // Pointer lock refused: drag-to-look and the pad still work.
      }
    };
    lock();
    let dragging: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement === el) {
        yaw.current -= e.movementX * YAW_PER_PX;
        pitch.current = clamp(pitch.current - e.movementY * PITCH_PER_PX, -PITCH_MAX, PITCH_MAX);
      } else if (dragging) {
        yaw.current -= (e.clientX - dragging.x) * YAW_PER_PX;
        pitch.current = clamp(pitch.current - (e.clientY - dragging.y) * PITCH_PER_PX, -PITCH_MAX, PITCH_MAX);
        dragging = { x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: PointerEvent) => {
      if (document.pointerLockElement === el) return;
      dragging = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => (dragging = null);
    const onClick = () => document.pointerLockElement !== el && lock();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current[k] = e.type === "keydown";
        e.preventDefault();
      }
      if (e.type === "keydown" && k === "e") toggleNearestDoor();
      if (e.type === "keydown" && k === "escape" && document.pointerLockElement !== el) onExit();
    };
    const wasLocked = { current: false };
    const onLockChange = () => {
      // Esc releases the lock; leaving the lock ends the walk on desktop.
      if (document.pointerLockElement !== el && !coarse && wasLocked.current) onExit();
      wasLocked.current = document.pointerLockElement === el;
    };
    window.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per walk
  }, [gl, coarse]);

  useFrame((state, dtRaw) => {
    player.current ??= startSpot(rooms, isOpen);
    const p = player.current;
    if (!p) return;
    const camera = state.camera as THREE.PerspectiveCamera;
    if (camera.fov !== WALK_FOV) {
      // Wide view on foot; the orbit rig restores the chosen lens afterwards.
      camera.fov = WALK_FOV;
      camera.updateProjectionMatrix();
    }
    const dt = Math.min(0.05, dtRaw);
    const k = keys.current;
    const turn = (k["arrowright"] ? 1 : 0) - (k["arrowleft"] ? 1 : 0);
    yaw.current -= turn * TURN_SPEED * dt;
    const fwd = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
    const str = (k["d"] ? 1 : 0) - (k["a"] ? 1 : 0);
    if (fwd || str) {
      const a = (yaw.current * Math.PI) / 180;
      // Yaw 0 looks toward plan +x; yaw grows counter-clockwise on screen.
      const f = { x: Math.cos(a), y: -Math.sin(a) };
      const r = { x: Math.sin(a), y: Math.cos(a) };
      const dx = (f.x * fwd + r.x * str) * WALK_SPEED * dt;
      const dy = (f.y * fwd + r.y * str) * WALK_SPEED * dt;
      const both = { x: p.x + dx, y: p.y + dy };
      if (canStand(both, rooms, isOpen)) player.current = both;
      else if (canStand({ x: p.x + dx, y: p.y }, rooms, isOpen)) player.current = { x: p.x + dx, y: p.y };
      else if (canStand({ x: p.x, y: p.y + dy }, rooms, isOpen)) player.current = { x: p.x, y: p.y + dy };
    }
    const q = player.current!;
    camera.position.set(q.x, eye, q.y);
    const a = (yaw.current * Math.PI) / 180;
    const pt = (pitch.current * Math.PI) / 180;
    camera.lookAt(q.x + Math.cos(a) * Math.cos(pt) * 100, eye + Math.sin(pt) * 100, q.y - Math.sin(a) * Math.cos(pt) * 100);
    const here = roomAt(q, rooms);
    const name = here ? here.room.name : "__doorway";
    if (name !== lastLoc.current) {
      lastLoc.current = name;
      onLocation(name);
    }
  });

  return null;
}
