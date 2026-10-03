"use client";

import apartmentHdri from "@pmndrs/assets/hdri/apartment.exr";
import { Edges, Environment, Html, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Aperture, Armchair, Bookmark, Camera as CameraIcon, DoorOpen, Footprints, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPosition } from "suncalc";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Button } from "@/components/ui/button";
import { openingSpan } from "@/domain/geometry/openings";
import { bbox } from "@/domain/geometry/polygon";
import { clamp } from "@/domain/geometry/units";
import type { Vec } from "@/domain/geometry/vec";
import { type Wall, wallsOf } from "@/domain/geometry/walls";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { fixtureWall } from "@/domain/room/fixtures";
import { type Material, resolveFinishes } from "@/domain/materials/library";
import { roomLit, skyLight } from "@/domain/planner/lighting";
import { QUALITY } from "@/domain/planner/quality";
import { skirtingPieces } from "@/domain/room/opening-parts";
import { ceilingPatches, wallTop } from "@/domain/room/roof";
import { canStand, roomAt, sharedWallInfo, startSpot, type WalkRoom, type WallShare, wallPieces, windowSpot } from "@/domain/planner/walls3d";
import { approach, EYE_SITTING, EYE_STANDING, shortestTurn, smoothstep } from "@/domain/planner/walk-motion";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Opening, Room } from "@/domain/schemas/room";
import { newSavedView } from "./panels-3d";
import { usePlanner } from "./planner-context";
import { type Camera, type PlanRoom, type WalkSpot } from "./state";
import { AssetBoundary } from "./three/asset-boundary";
import { cmUV } from "./three/geometry";
import { FlatSurface, RealSurface } from "./three/surface-materials";
import { Opening3D, sideSign } from "./three/openings3d";
import { Fixed3D } from "./three/fixtures3d";
import { Backdrop } from "./three/backdrop3d";
import { RoomLights } from "./three/lights3d";
import { PhotoCapture, type PhotoApi } from "./three/photo";
import { SkirtingBoard } from "./three/trim3d";
import { PieceDecor3D } from "./three/decor3d";
import { RealPiece } from "./three/pieces";
import { FrameRateWatch } from "./three/frame-rate-watch";
import { useQuality } from "./three/use-quality";

const INK = "#2b2622";
const CLAY = "#c8794a";
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
  finish: ReturnType<typeof resolveFinishes>;
}

export default function Stage3D() {
  const t = useTranslations("Planner");
  const { s, dispatch, data, toast } = usePlanner();
  const gl = useRef<THREE.WebGLRenderer | null>(null);
  const [locked, setLocked] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const walkApiRef = useRef<WalkApi | null>(null);

  const placed: Placed[] = useMemo(
    () =>
      s.plan.rooms
        .filter((r) => s.visible3d.includes(r.room.id))
        .map((r) => ({ r, origin: s.plan.origins[r.room.id] ?? { x: 0, y: 0 }, finish: resolveFinishes(s.finishes[r.room.id]) })),
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

  const photoApi = useRef<PhotoApi | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photo = async () => {
    const url = await photoApi.current?.capture();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.projectCode}-photo.png`;
    a.click();
    toast(t("photoSaved"));
  };

  const [sitting, setSitting] = useState(false);
  const startWalk = () => {
    setSitting(false);
    dispatch({ type: "set", patch: { walking: true } });
  };
  // A saved view that reopens the walk: at this spot, with this light.
  const saveWalkView = () => {
    const spot = walkApiRef.current?.spot() ?? null;
    const view = newSavedView(s, t("savedViewName", { n: s.savedViews.length + 1 }), spot);
    dispatch({ type: "set", patch: { savedViews: [...s.savedViews, view] } });
    toast(t("viewSaved"));
  };
  // A saved view sitting down reopens the walk seated.
  const [prevStart, setPrevStart] = useState(s.walkStart);
  if (s.walkStart !== prevStart) {
    setPrevStart(s.walkStart);
    if (s.walkStart) setSitting(s.walkStart.eye <= EYE_SITTING);
  }
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

  // Photo mode always renders at the best level.
  const quality = useQuality();
  const q = QUALITY[photoBusy ? "high" : quality.level];

  const empty = placed.length === 0;
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  return (
    <div className="pl-stage">
      <div className="pl-scene3" style={{ "--sky": sun.sky } as React.CSSProperties} data-testid="planner-scene-3d">
        {!empty && (
          <Canvas
            shadows="percentage"
            // Nothing moves by itself in orbit mode, so a frame is drawn only when something changed.
            frameloop={s.walking || photoBusy ? "always" : "demand"}
            // Photo mode renders at twice the pixel density.
            dpr={photoBusy ? 2 : [q.dpr[0], q.dpr[1]]}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ fov: fovOf(s.camera.lens), near: 5, far: 40000, position: [bounds.cx + 800, 700, bounds.cz + 800] }}
            onCreated={(state) => {
              gl.current = state.gl;
              // Neutral keeps paint and fabric colours true; the composer below takes over while mounted.
              state.gl.toneMapping = THREE.NeutralToneMapping;
              // Reading back every shader's log stalls the first frames; keep it for development.
              if (process.env.NODE_ENV === "production") state.gl.debug.checkShaderErrors = false;
            }}
            onPointerMissed={() => !s.walking && dispatch({ type: "select", selection: null })}
          >
            <FrameRateWatch />
            <RedrawOnChange />
            <SceneContents placed={placed} sun={sun} shadowMap={q.shadowMap} maxLights={q.maxLights} />
            <PhotoCapture apiRef={photoApi} onBusy={setPhotoBusy} />
            <EffectComposer multisampling={4}>
              {/* Scene units are cm: occlusion reaches ~40 cm from contact. Photo mode renders it at full quality. */}
              <N8AO enabled={q.ao} aoRadius={40} distanceFalloff={1} intensity={2.5} quality={photoBusy ? "high" : "medium"} halfRes={!photoBusy} />
              {/* A soft glow round lit lamps and bright windows. */}
              <Bloom mipmapBlur intensity={q.bloom ? 0.3 : 0} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
              {/* Walking, the eye adapts: a dim room brightens, a bright window does not blow out. */}
              <ToneMapping
                key={s.walking ? "adaptive" : "neutral"}
                mode={s.walking ? ToneMappingMode.REINHARD2_ADAPTIVE : ToneMappingMode.NEUTRAL}
                resolution={256}
                middleGrey={0.62}
                maxLuminance={14}
                averageLuminance={1}
                adaptationRate={1.2}
              />
            </EffectComposer>
            {s.walking ? (
              <WalkControls
                placed={placed}
                onLocation={setLocation}
                apiRef={walkApiRef}
                coarse={!!coarse}
                onExit={stopWalk}
                onSit={setSitting}
                onSaveView={saveWalkView}
                onPhoto={() => void photo()}
              />
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
              <Button size="sm" variant="outline" onClick={photo} disabled={empty || photoBusy} data-testid="planner-photo">
                <Aperture /> {photoBusy ? t("photoRendering") : t("photo")}
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
              <Button
                size="sm"
                variant="outline"
                data-testid="walk-sit"
                onClick={() => walkApiRef.current?.toggleSit()}
              >
                <Armchair /> {sitting ? t("walkStand") : t("walkSit")}
              </Button>
              <Button size="sm" variant="outline" data-testid="walk-save-view" onClick={saveWalkView}>
                <Bookmark /> {t("saveView")}
              </Button>
              <Button size="sm" variant="outline" onClick={photo} disabled={photoBusy} data-testid="walk-photo">
                <Aperture /> {photoBusy ? t("photoRendering") : t("photo")}
              </Button>
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
  const altitudeDeg = pos.altitude;
  const theta = ((northAngleDeg + pos.azimuth) * Math.PI) / 180; // plan angle, clockwise from up
  const alt = (Math.max(pos.altitude, 3) * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(alt), Math.sin(alt), -Math.cos(theta) * Math.cos(alt)).normalize();
  const up = pos.altitude > 0;
  const warm = hour < 9 || hour > 18;
  return {
    dir,
    intensity: up ? (warm ? 1.6 : 2.6) : 0.3,
    envIntensity: up ? (warm ? 0.45 : 0.6) : 0.2,
    color: warm ? "#ffd2a1" : "#fff4e2",
    sky: !up ? "#b9b3b8" : warm ? "#f1dcc6" : "#ece6d8",
    /** Brightness and tint of the sky in the scene. */
    sky3d: skyLight(altitudeDeg),
  };
}

/* ---------------- scene ---------------- */

/**
 * The view draws on demand. Changes to three.js objects made through React ask for a frame by themselves;
 * this covers what does not (a wall folding away as the state changes, an environment map arriving).
 */
function RedrawOnChange() {
  const { s } = usePlanner();
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    invalidate();
    const late = window.setTimeout(() => invalidate(), 300);
    return () => window.clearTimeout(late);
  }, [s, invalidate]);
  return null;
}

const SceneContents = memo(function SceneContents({ placed, sun, shadowMap, maxLights }: { placed: Placed[]; sun: ReturnType<typeof sunVector>; shadowMap: number; maxLights: number }) {
  const center = useMemo(() => {
    const v = new THREE.Vector3();
    placed.forEach((p) => {
      const b = bbox(p.r.room.polygon);
      v.add(new THREE.Vector3(p.origin.x + b.x + b.w / 2, 0, p.origin.y + b.y + b.d / 2));
    });
    return placed.length ? v.multiplyScalar(1 / placed.length) : v;
  }, [placed]);
  // Walls two rooms share: each draws its own half, so the faces do not overlap and flicker.
  const shares = useMemo(() => sharedWallInfo(placed.map((p) => ({ id: p.r.room.id, polygon: p.r.room.polygon, origin: p.origin, openings: p.r.room.openings })), W), [placed]);
  const sunPos = useMemo(() => center.clone().add(sun.dir.clone().multiplyScalar(3000)), [center, sun.dir]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(center);
    return o;
  }, [center]);

  return (
    <>
      {/* The interior HDRI does most of the fill; these only warm it up. */}
      <hemisphereLight args={["#fff7ea", "#d8c6a8", 0.35]} />
      <ambientLight intensity={0.1} color="#fff3e2" />
      <directionalLight
        // A shadow map keeps the size it was made with; a new size needs a new light.
        key={shadowMap}
        position={sunPos}
        target={target}
        intensity={sun.intensity}
        color={sun.color}
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-radius={4}
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
      <Environment files={apartmentHdri} environmentIntensity={sun.envIntensity} />
      <Backdrop center={center} sky={sun.sky3d} />
      {placed.map((p) => (
        <Room3D key={p.r.room.id} placed={p} shares={shares[p.r.room.id]} />
      ))}
      <RoomLights placed={placed} max={maxLights} />
    </>
  );
});

function Room3D({ placed, shares }: { placed: Placed; shares?: WallShare[] }) {
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
  const trim = s.fitOut.trim;
  const lit = roomLit(room.id, s.lightsSwitched, s.scene.hour);
  // Fixtures against a wall fold away with it in the cut-away view.
  const fixedWall = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of room.fixedElements) {
      const wall = fixtureWall(walls, f);
      if (wall) m.set(f.id, wall.index);
    }
    return m;
  }, [walls, room.fixedElements]);
  const skirting = useMemo(() => (trim.skirting ? skirtingPieces(walls, room.openings, trim.skirtingHeight) : []), [walls, room.openings, trim.skirting, trim.skirtingHeight]);

  return (
    <group position={[origin.x, 0, origin.y]}>
      <mesh geometry={floorGeo} receiveShadow>
        <Surface m={finish.floor} realistic={s.scene.realistic} side={THREE.DoubleSide} />
      </mesh>
      {s.walking && <Ceiling room={room} m={finish.ceiling} realistic={s.scene.realistic} />}
      {walls.map((w) => (
        <FoldGroup key={w.index} wall={w} origin={origin}>
          <Wall3D room={room} wall={w} m={finish.wall(w.index)} realistic={s.scene.realistic} share={shares?.[w.index]} />
          {room.fixedElements
            .filter((f) => fixedWall.get(f.id) === w.index)
            .map((f) => (
              <Fixed3D key={f.id} f={f} ceiling={room.ceilingHeight} realistic={s.scene.realistic} lit={lit} />
            ))}
          {skirting
            .filter((p) => p.wallIndex === w.index)
            .map((p, i) => (
              <SkirtingBoard key={`sk${i}`} piece={p} wall={w} trim={trim} realistic={s.scene.realistic} />
            ))}
          {room.openings
            .filter((o) => o.wallIndex === w.index)
            .map((o) => (
              <RoomOpening key={o.id} roomId={room.id} walls={walls} o={o} ceiling={room.ceilingHeight} />
            ))}
        </FoldGroup>
      ))}
      {room.fixedElements
        .filter((f) => !fixedWall.has(f.id))
        .map((f) => (
          <Fixed3D key={f.id} f={f} ceiling={room.ceilingHeight} realistic={s.scene.realistic} lit={lit} />
        ))}
      {r.furniture.map((f) => (
        <Piece3D key={f.id} roomId={room.id} f={f} ceiling={room.ceilingHeight} showLabel={s.scene.labels} />
      ))}
    </group>
  );
}

/** A wall, floor or ceiling material: photographed PBR when realistic (flat colour while it loads), else flat. */
function Surface({ m, realistic, side }: { m: Material; realistic: boolean; side?: THREE.Side }) {
  const flat = <FlatSurface m={m} side={side} />;
  if (!realistic) return flat;
  return (
    <AssetBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <RealSurface m={m} side={side} />
      </Suspense>
    </AssetBoundary>
  );
}

/** The ceiling, seen from below while walking through. Exposed beams run across the shorter span. */
function Ceiling({ room, m, realistic }: { room: Room; m: Material; realistic: boolean }) {
  const sloped = (room.roofSlopes ?? []).length > 0;
  const geo = useMemo(() => (sloped ? slopedCeiling(room) : flatCeiling(room)), [room, sloped]);
  useEffect(() => () => geo.dispose(), [geo]);
  const beams = m.group === "beams";
  const b = useMemo(() => bbox(room.polygon), [room.polygon]);
  const acrossX = b.w <= b.d;
  const span = acrossX ? b.w : b.d;
  const run = acrossX ? b.d : b.w;
  const count = Math.max(1, Math.floor(run / 70));
  return (
    <group>
      <mesh geometry={geo} position-y={sloped ? 0 : room.ceilingHeight}>
        {beams ? <meshStandardMaterial color="#f4f1ea" roughness={0.95} side={THREE.DoubleSide} /> : <Surface m={m} realistic={realistic} side={THREE.DoubleSide} />}
      </mesh>
      {beams &&
        Array.from({ length: count }, (_, i) => {
          const t = ((i + 0.5) * run) / count;
          const x = acrossX ? b.x + b.w / 2 : b.x + t;
          const z = acrossX ? b.y + t : b.y + b.d / 2;
          return (
            <mesh key={i} position={[x, room.ceilingHeight - 10, z]} castShadow>
              <boxGeometry args={acrossX ? [span, 20, 12] : [12, 20, span]} />
              <Surface m={m} realistic={realistic} />
            </mesh>
          );
        })}
    </group>
  );
}

function flatCeiling(room: Room): THREE.BufferGeometry {
  const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
  const g = cmUV(new THREE.ShapeGeometry(shape));
  g.rotateX(Math.PI / 2);
  return g;
}

/** The ceiling under a roof: the flat middle and a sloped piece along each sloped wall, at their real heights. */
function slopedCeiling(room: Room): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const patch of ceilingPatches(room)) {
    const contour = patch.polygon.map((p) => new THREE.Vector2(p.x, p.y));
    for (const tri of THREE.ShapeUtils.triangulateShape(contour, [])) {
      for (const i of tri) positions.push(patch.polygon[i]!.x, patch.heights[i]!, patch.polygon[i]!.y);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return cmUV(g);
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

/**
 * One wall, split into solid boxes around its openings and merged into one
 * mesh. UVs are in cm in the wall's own frame, so a brick or tile pattern
 * runs on across the pieces above and below windows.
 */
function Wall3D({ room, wall, m, realistic, share }: { room: Room; wall: Wall; m: Material; realistic: boolean; share?: WallShare }) {
  // A shared wall is half as thick on each side; the neighbour's openings are cut through this half too.
  const T = share?.shared ? W / 2 : W;
  const cuts = share?.cuts;
  const pieces = useMemo(() => wallPieces(wall.length, room.ceilingHeight, [...room.openings.filter((o) => o.wallIndex === wall.index), ...(cuts ?? [])]), [wall, room.ceilingHeight, room.openings, cuts]);
  const side = sideSign(wall);
  const top = useMemo(() => wallTop(room, wall), [room, wall]);
  const geo = useMemo(() => {
    // Under a roof slope the wall's top follows the ceiling; elsewhere the pieces are plain boxes.
    const flat = top.every((p) => p.h >= room.ceilingHeight);
    const parts = pieces.flatMap((p) => (flat ? [new THREE.BoxGeometry(p.to - p.from, p.y1 - p.y0, T).translate((p.from + p.to) / 2, (p.y0 + p.y1) / 2, (-T / 2) * side)] : slopedPiece(p, top, side, T)));
    const merged = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose());
    return cmUV(merged);
  }, [pieces, side, top, room.ceilingHeight, T]);
  useEffect(() => () => geo.dispose(), [geo]);
  const angle = -Math.atan2(wall.dir.y, wall.dir.x);
  return (
    <group position={[wall.a.x, 0, wall.a.y]} rotation-y={angle}>
      <mesh geometry={geo} castShadow receiveShadow>
        <Surface m={m} realistic={realistic} />
        {!realistic && <Edges color={INK} threshold={15} />}
      </mesh>
    </group>
  );
}

/** Height of a wall's top at `t` cm along it, from its profile. */
function topAt(top: readonly { t: number; h: number }[], t: number): number {
  for (let i = 1; i < top.length; i++) {
    const a = top[i - 1]!;
    const b = top[i]!;
    if (t <= b.t) return a.h + ((b.h - a.h) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
  }
  return top[top.length - 1]!.h;
}

/**
 * One wall piece (beside, above or below an opening) whose top may run into
 * the roof: its outline is cut by the wall's top profile, then given the
 * wall's thickness. Pieces wholly under the roof line vanish.
 */
function slopedPiece(p: { from: number; to: number; y0: number; y1: number }, top: readonly { t: number; h: number }[], side: number, thickness: number): THREE.BufferGeometry[] {
  const ts = [p.from, ...top.map((q) => q.t).filter((t) => t > p.from && t < p.to), p.to];
  const heights = ts.map((t) => Math.min(p.y1, topAt(top, t)));
  if (heights.every((h) => h <= p.y0 + 0.5)) return [];
  const shape = new THREE.Shape();
  shape.moveTo(p.from, p.y0);
  shape.lineTo(p.to, p.y0);
  for (let i = ts.length - 1; i >= 0; i--) shape.lineTo(ts[i]!, Math.max(p.y0, heights[i]!));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // Extruded along +z from 0 to the thickness; walls sit on the side away from the room.
  if (side > 0) g.translate(0, 0, -thickness);
  return [g.toNonIndexed()];
}

/** A door, window or radiator, with the planner's open doors and finishes. Click a door to open or close it. */
function RoomOpening({ roomId, walls, o, ceiling }: { roomId: string; walls: readonly Wall[]; o: Opening; ceiling: number }) {
  const { s, dispatch } = usePlanner();
  const key = doorKey(roomId, o.id);
  const open = !!s.doorsOpen[key];
  return (
    // Windows are tagged so a click in the walkthrough can walk up to them.
    <group userData={o.kind === "window" ? { walkWindow: { roomId, id: o.id } } : {}}>
      <Opening3D
        walls={walls}
        o={o}
        ceiling={ceiling}
        fitOut={s.fitOut}
        realistic={s.scene.realistic}
        open={open}
        onToggle={() =>
          o.kind === "switch"
            ? // A light switch flips its room's lights.
              dispatch({ type: "set", patch: { lightsSwitched: { ...s.lightsSwitched, [roomId]: !roomLit(roomId, s.lightsSwitched, s.scene.hour) } } })
            : dispatch({ type: "set", patch: { doorsOpen: { ...s.doorsOpen, [key]: !open } } })
        }
      />
    </group>
  );
}

function Piece3D({ roomId, f, ceiling, showLabel }: { roomId: string; f: FurnitureItem; ceiling: number; showLabel: boolean }) {
  const { s, data, dispatch } = usePlanner();
  const selected = s.selection?.kind === "item" && s.selection.id === f.id && s.selection.roomId === roomId;
  const rug = f.placement === "floor_covering";
  const h = rug ? 1 : Math.max(1, Math.min(f.h, ceiling));
  const y = f.placement === "wall" ? f.elevation + h / 2 : f.placement === "ceiling" ? ceiling - h / 2 : h / 2 + (rug ? 0.5 : 0);
  const lit = roomLit(roomId, s.lightsSwitched, s.scene.hour);
  const decor = QUALITY[useQuality().level].decor;
  const box = (
    <mesh castShadow={!rug} receiveShadow>
      <boxGeometry args={[f.w, h, f.d]} />
      <meshStandardMaterial color={f.colorHex} roughness={0.75} />
      <Edges color={selected ? CLAY : INK} lineWidth={selected ? 2.5 : 1} threshold={15} />
    </mesh>
  );
  return (
    <group
      position={[f.x, y, f.y]}
      rotation-y={(-f.rotation * Math.PI) / 180}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (s.walking) return;
        e.stopPropagation();
        dispatch({ type: "set", patch: { selection: { kind: "item", roomId, id: f.id }, tab3d: "selection" } });
      }}
    >
      {s.scene.realistic ? (
        <AssetBoundary fallback={box}>
          <Suspense fallback={box}>
            <group position-y={-h / 2}>
              <RealPiece category={f.category} modelId={f.modelId} styles={data.styles} w={f.w} d={f.d} h={h} hex={f.colorHex} lit={lit} seed={f.id} />
            </group>
            {selected && (
              <mesh>
                <boxGeometry args={[f.w + 2, h + 2, f.d + 2]} />
                <meshBasicMaterial visible={false} />
                <Edges color={CLAY} lineWidth={2.5} threshold={15} />
              </mesh>
            )}
          </Suspense>
        </AssetBoundary>
      ) : (
        box
      )}
      {s.scene.realistic && s.scene.decor && decor && (
        <group position-y={-h / 2}>
          <PieceDecor3D f={f} h={h} />
        </group>
      )}
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
    get().invalidate();
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

export interface WalkApi {
  toggleNearestDoor: () => void;
  move: (key: string, down: boolean) => void;
  /** Sit down or stand up (eye height 115 or 165 cm). */
  toggleSit: () => void;
  /** Where the walker is and looks, for a saved view. */
  spot: () => WalkSpot | null;
}

/** Seconds to glide up to a window. */
const GLIDE_S = 1.1;
/** How fast speed and gaze catch up with the keys and the mouse (per second). */
const ACCEL_RATE = 9;
const LOOK_RATE = 16;
const EYE_RATE = 5;

function WalkControls({
  placed,
  onLocation,
  apiRef,
  coarse,
  onExit,
  onSit,
  onSaveView,
  onPhoto,
}: {
  placed: Placed[];
  onLocation: (name: string | null) => void;
  apiRef: React.RefObject<WalkApi | null>;
  coarse: boolean;
  onExit: () => void;
  onSit: (sitting: boolean) => void;
  onSaveView: () => void;
  onPhoto: () => void;
}) {
  const { s, dispatch } = usePlanner();
  const gl = useThree((st) => st.gl);
  const get = useThree((st) => st.get);
  const rooms: WalkRoom[] = useMemo(() => placed.map((p) => ({ id: p.r.room.id, room: p.r.room, origin: p.origin, furniture: p.r.furniture })), [placed]);
  const doors = useRef(s.doorsOpen);
  const lights = useRef({ switched: s.lightsSwitched, hour: s.scene.hour });
  useEffect(() => {
    lights.current = { switched: s.lightsSwitched, hour: s.scene.hour };
  }, [s.lightsSwitched, s.scene.hour]);
  useEffect(() => {
    doors.current = s.doorsOpen;
  }, [s.doorsOpen]);
  const isOpen = (roomId: string, id: string) => !!doors.current[doorKey(roomId, id)];
  // A saved view starts the walk where it was saved; used once.
  const [start] = useState(s.walkStart);
  useEffect(() => {
    if (start) dispatch({ type: "set", patch: { walkStart: null } });
  }, [start, dispatch]);
  const player = useRef<Vec | null>(start ? { x: start.x, y: start.y } : null);
  // Where the keys and mouse point (yaw, pitch) and what the camera shows, easing after them.
  const yaw = useRef(start?.yaw ?? 90);
  const pitch = useRef(start?.pitch ?? 0);
  const shown = useRef({ yaw: start?.yaw ?? 90, pitch: start?.pitch ?? 0 });
  const vel = useRef({ x: 0, y: 0 });
  const eye0 = start?.eye ?? EYE_STANDING;
  const eyeTarget = useRef(eye0);
  const eyeNow = useRef(eye0);
  const glide = useRef<{ from: Vec; to: Vec; yaw0: number; yaw1: number; pitch0: number; t: number } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const lastLoc = useRef<string | null>(null);

  const toggleNearestDoor = () => {
    const p = player.current;
    if (!p) return;
    // The nearest door or light switch within reach.
    let best: { key: string; roomId: string; kind: "door" | "switch"; d: number } | null = null;
    for (const r of rooms) {
      const walls = wallsOf(r.room.polygon);
      for (const o of r.room.openings) {
        if (!(o.kind === "door" && o.swing !== "none") && o.kind !== "switch") continue;
        const span = openingSpan(walls, o);
        if (!span) continue;
        const c = { x: r.origin.x + (span.start.x + span.end.x) / 2, y: r.origin.y + (span.start.y + span.end.y) / 2 };
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < DOOR_REACH && (!best || d < best.d)) best = { key: doorKey(r.id, o.id), roomId: r.id, kind: o.kind === "switch" ? "switch" : "door", d };
      }
    }
    if (best?.kind === "switch") {
      const { switched, hour } = lights.current;
      dispatch({ type: "set", patch: { lightsSwitched: { ...switched, [best.roomId]: !roomLit(best.roomId, switched, hour) } } });
    } else if (best) dispatch({ type: "set", patch: { doorsOpen: { ...doors.current, [best.key]: !doors.current[best.key] } } });
  };

  // The key handler binds once per walk; it calls the latest callbacks through this ref.
  const callbacks = useRef({ onSit, onSaveView, onPhoto });
  useEffect(() => {
    callbacks.current = { onSit, onSaveView, onPhoto };
  });
  const toggleSit = () => {
    eyeTarget.current = eyeTarget.current > EYE_SITTING ? EYE_SITTING : EYE_STANDING;
    callbacks.current.onSit(eyeTarget.current <= EYE_SITTING);
  };

  /** The window under the screen point (normalised device coordinates), if the nearest thing hit is one. */
  const pickWindow = (ndc: THREE.Vector2): { roomId: string; id: string } | null => {
    const { camera, scene, raycaster } = get();
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.visible);
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const w = o.userData["walkWindow"] as { roomId: string; id: string } | undefined;
      if (w) return w;
    }
    return null;
  };

  const goToWindow = (w: { roomId: string; id: string }) => {
    const p = player.current;
    const spot = windowSpot(w.roomId, w.id, rooms, isOpen);
    if (!p || !spot) return false;
    glide.current = { from: { ...p }, to: { x: spot.x, y: spot.y }, yaw0: shown.current.yaw, yaw1: spot.yaw, pitch0: shown.current.pitch, t: 0 };
    return true;
  };

  useEffect(() => {
    apiRef.current = {
      toggleNearestDoor,
      move: (k, down) => (keys.current[k] = down),
      toggleSit,
      spot: () => (player.current ? { ...player.current, yaw: Math.round(yaw.current * 10) / 10, pitch: Math.round(pitch.current * 10) / 10, eye: eyeTarget.current } : null),
    };
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
    let dragged = 0;
    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement === el) {
        yaw.current -= e.movementX * YAW_PER_PX;
        pitch.current = clamp(pitch.current - e.movementY * PITCH_PER_PX, -PITCH_MAX, PITCH_MAX);
      } else if (dragging) {
        dragged += Math.abs(e.clientX - dragging.x) + Math.abs(e.clientY - dragging.y);
        yaw.current -= (e.clientX - dragging.x) * YAW_PER_PX;
        pitch.current = clamp(pitch.current - (e.clientY - dragging.y) * PITCH_PER_PX, -PITCH_MAX, PITCH_MAX);
        dragging = { x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: PointerEvent) => {
      dragged = 0;
      if (document.pointerLockElement === el) return;
      dragging = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => (dragging = null);
    const onClick = (e: MouseEvent) => {
      // A drag to look around is not a click.
      if (dragged > 6) return;
      const locked = document.pointerLockElement === el;
      const rect = el.getBoundingClientRect();
      // Locked, the crosshair in the middle aims; otherwise the pointer does.
      const ndc = locked ? new THREE.Vector2(0, 0) : new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const w = pickWindow(ndc);
      if (w && goToWindow(w)) return;
      if (!locked) lock();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current[k] = e.type === "keydown";
        e.preventDefault();
      }
      if (e.type === "keydown" && k === "e") toggleNearestDoor();
      // With the pointer locked the buttons are out of reach, so each has a key.
      if (e.type === "keydown" && k === "c") toggleSit();
      if (e.type === "keydown" && k === "v") callbacks.current.onSaveView();
      if (e.type === "keydown" && k === "p") callbacks.current.onPhoto();
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
    const fwd = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
    const str = (k["d"] ? 1 : 0) - (k["a"] ? 1 : 0);
    const g = glide.current;
    // Any key takes back control from a glide.
    if (g && (fwd || str || turn)) glide.current = null;

    if (glide.current && g) {
      g.t = Math.min(1, g.t + dt / GLIDE_S);
      const e = smoothstep(g.t);
      player.current = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
      yaw.current = g.yaw0 + shortestTurn(g.yaw0, g.yaw1) * e;
      pitch.current = g.pitch0 * (1 - e);
      shown.current = { yaw: yaw.current, pitch: pitch.current };
      vel.current = { x: 0, y: 0 };
      if (g.t >= 1) glide.current = null;
    } else {
      yaw.current -= turn * TURN_SPEED * dt;
      const a = (yaw.current * Math.PI) / 180;
      // Yaw 0 looks toward plan +x; yaw grows counter-clockwise on screen.
      const f = { x: Math.cos(a), y: -Math.sin(a) };
      const r = { x: Math.sin(a), y: Math.cos(a) };
      // Speed eases up and down instead of starting and stopping dead.
      const v = vel.current;
      v.x = approach(v.x, (f.x * fwd + r.x * str) * WALK_SPEED, ACCEL_RATE, dt);
      v.y = approach(v.y, (f.y * fwd + r.y * str) * WALK_SPEED, ACCEL_RATE, dt);
      if (Math.hypot(v.x, v.y) > 0.5) {
        const dx = v.x * dt;
        const dy = v.y * dt;
        if (canStand({ x: p.x + dx, y: p.y + dy }, rooms, isOpen)) player.current = { x: p.x + dx, y: p.y + dy };
        else if (canStand({ x: p.x + dx, y: p.y }, rooms, isOpen)) {
          player.current = { x: p.x + dx, y: p.y };
          v.y = 0;
        } else if (canStand({ x: p.x, y: p.y + dy }, rooms, isOpen)) {
          player.current = { x: p.x, y: p.y + dy };
          v.x = 0;
        } else vel.current = { x: 0, y: 0 };
      }
      // The gaze follows the mouse closely but without jitter.
      const follow = 1 - Math.exp(-LOOK_RATE * dt);
      shown.current = {
        yaw: shown.current.yaw + shortestTurn(shown.current.yaw, yaw.current) * follow,
        pitch: approach(shown.current.pitch, pitch.current, LOOK_RATE, dt),
      };
    }
    eyeNow.current = approach(eyeNow.current, eyeTarget.current, EYE_RATE, dt);

    const q = player.current!;
    const eye = eyeNow.current;
    camera.position.set(q.x, eye, q.y);
    const a = (shown.current.yaw * Math.PI) / 180;
    const pt = (shown.current.pitch * Math.PI) / 180;
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
