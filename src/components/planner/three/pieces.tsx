"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hashSeed, mulberry32 } from "@/domain/design/solver/random";
import type { FurnitureCategory } from "@/domain/schemas/design";
import { BUILT_MODEL, pieceModel } from "./assets";
import { cmUV, fitToBox } from "./geometry";
import { tintFor, usePbr } from "./textures";

/*
 * Realistic furniture. Every piece is drawn in a local frame with the floor
 * at y = 0, width along x, depth along z and its front facing +z; sizes in cm.
 * Suspends while its model or textures load.
 */

export type V3 = readonly [number, number, number];

interface PieceProps {
  category: FurnitureCategory;
  /** The model the user picked, if any (see pieceModel). */
  modelId?: string;
  /** Style scores from the profile, which steer the default model. */
  styles?: Readonly<Partial<Record<string, number>>> | null;
  w: number;
  d: number;
  h: number;
  hex: string;
  /** Lamps glow in the evening or with the ceiling lights on. */
  lit: boolean;
  /** Stable per piece, for details like book spines. */
  seed: string;
}

export function RealPiece(p: PieceProps) {
  const m = pieceModel(p.category, p.modelId, p.w, p.d, p.h, p.styles ?? null);
  if (m === BUILT_MODEL) return <Built {...p} />;
  return <ModelPiece url={`/models/${m.id}.glb`} turn={m.turn ?? 0} fabric={m.fabric} hex={p.hex} w={p.w} d={p.d} h={p.h} />;
}

/** A glTF stretched to exactly the piece's size, its upholstery tinted to `hex`. */
function ModelPiece({ url, turn, fabric, hex, w, d, h }: { url: string; turn: number; fabric: RegExp | undefined; hex: string; w: number; d: number; h: number }) {
  // Meshopt-compressed; its decoder ships with three-stdlib, so no Draco CDN.
  const { scene } = useGLTF(url, false, true);
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Clones share materials with the cached scene; tint a copy.
      if (fabric) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => tinted(m, fabric, hex)) : tinted(mesh.material, fabric, hex);
    });
    return fitToBox(copy, w, h, d, turn);
  }, [scene, w, h, d, turn, fabric, hex]);
  return <primitive object={object} />;
}

/** A copy of an upholstery material whose colour lands the fabric's average on `hex`. */
function tinted(m: THREE.Material, fabric: RegExp, hex: string): THREE.Material {
  const std = m as THREE.MeshStandardMaterial;
  if (!fabric.test(m.name) || !std.color) return m;
  const copy = std.clone();
  const target = new THREE.Color(hex);
  const mean = std.map ? textureMean(std.map) : null;
  // Capped, so a dark fabric turns a light colour without glowing.
  copy.color = mean ? new THREE.Color(Math.min(8, target.r / mean.r), Math.min(8, target.g / mean.g), Math.min(8, target.b / mean.b)) : target;
  return copy;
}

const means = new WeakMap<THREE.Texture, THREE.Color | null>();

/** Linear mean colour of a loaded texture (read once from an 8 × 8 copy); null if unreadable. */
function textureMean(tex: THREE.Texture): THREE.Color | null {
  if (means.has(tex)) return means.get(tex)!;
  let mean: THREE.Color | null = null;
  const img = tex.image as CanvasImageSource | undefined;
  const ctx = img ? document.createElement("canvas").getContext("2d", { willReadFrequently: true }) : null;
  if (img && ctx) {
    ctx.canvas.width = ctx.canvas.height = 8;
    ctx.drawImage(img, 0, 0, 8, 8);
    const px = ctx.getImageData(0, 0, 8, 8).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c]! += px[i + c]!;
    const n = px.length / 4;
    const c = new THREE.Color().setRGB(sum[0]! / n / 255, sum[1]! / n / 255, sum[2]! / n / 255, THREE.SRGBColorSpace);
    // A near-black map cannot be lifted to a light colour without blowing out.
    if (Math.max(c.r, c.g, c.b) > 0.01) mean = new THREE.Color(Math.max(c.r, 0.02), Math.max(c.g, 0.02), Math.max(c.b, 0.02));
  }
  means.set(tex, mean);
  return mean;
}

/* ---------------- parts and materials ---------------- */

/** Frees GPU memory for geometry this component built itself. */
function useDispose(value: { dispose: () => void }) {
  useEffect(() => () => value.dispose(), [value]);
}

/** A box (rounded when `r` > 0) centred at `at`, textured at real scale. */
export function Part({ size, at, r = 0, children }: { size: V3; at: V3; r?: number; children: React.ReactNode }) {
  const [w, h, d] = size;
  const geo = useMemo(() => {
    const rr = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    return cmUV(rr > 0.2 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d));
  }, [w, h, d, r]);
  useDispose(geo);
  return (
    <mesh geometry={geo} position={at} castShadow receiveShadow>
      {children}
    </mesh>
  );
}

export function Cyl({ top, bottom, h, at, open = false, children }: { top: number; bottom: number; h: number; at: V3; open?: boolean; children: React.ReactNode }) {
  const geo = useMemo(() => cmUV(new THREE.CylinderGeometry(top, bottom, h, 40, 1, open)), [top, bottom, h, open]);
  useDispose(geo);
  return (
    <mesh geometry={geo} position={at} castShadow receiveShadow>
      {children}
    </mesh>
  );
}

export function Wood({ hex }: { hex: string }) {
  const t = usePbr("oak_veneer_01");
  const color = useMemo(() => tintFor(hex, "oak_veneer_01"), [hex]);
  return <meshStandardMaterial {...t} color={color} />;
}

function Fabric({ hex }: { hex: string }) {
  const t = usePbr("poly_wool_herringbone");
  const color = useMemo(() => tintFor(hex, "poly_wool_herringbone"), [hex]);
  return <meshStandardMaterial {...t} color={color} normalScale={[0.7, 0.7]} />;
}

const LINEN = "#ebe5da";
const Paint = ({ hex, rough = 0.55 }: { hex: string; rough?: number }) => <meshStandardMaterial color={hex} roughness={rough} />;
const Metal = () => <meshStandardMaterial color="#2c2825" metalness={0.75} roughness={0.35} />;

/* ---------------- pieces ---------------- */

function Built(p: PieceProps) {
  switch (p.category) {
    case "sofa":
      return <Sofa {...p} />;
    case "bed":
      return <Bed {...p} />;
    case "wardrobe":
      return <Cabinet {...p} rows={1} cols={Math.max(2, Math.round(p.w / 50))} />;
    case "dresser":
      return <Cabinet {...p} rows={3} cols={p.w >= 110 ? 2 : 1} drawers />;
    case "storage":
      return <Cabinet {...p} rows={p.h > 95 ? 2 : 1} cols={p.w >= 70 ? 2 : 1} />;
    case "shoe_cabinet":
      return <Cabinet {...p} rows={2} cols={1} drawers />;
    case "bookshelf":
      return <Bookshelf {...p} />;
    case "desk":
      return <Table {...p} top={3} leg={4} metalLegs />;
    case "dining_table":
      return <Table {...p} top={4} leg={6} />;
    case "bench":
      return <Bench {...p} />;
    case "rug":
      return (
        <Part size={[p.w, p.h, p.d]} at={[0, p.h / 2, 0]}>
          <Fabric hex={p.hex} />
        </Part>
      );
    case "floor_lamp":
      return <FloorLamp {...p} />;
    case "mirror":
      return <Mirror {...p} />;
    case "wall_shelf":
      return <WallShelf {...p} />;
    case "coat_rack":
      return <CoatRack {...p} />;
    default:
      return (
        <Part size={[p.w, p.h, p.d]} at={[0, p.h / 2, 0]} r={2}>
          <Paint hex={p.hex} />
        </Part>
      );
  }
}

function Sofa({ w, d, h, hex }: PieceProps) {
  const leg = 10;
  const seat = Math.min(42, h * 0.5);
  const arm = Math.min(Math.max(w * 0.08, 12), 20);
  const armH = Math.min(62, h - 5);
  const back = Math.min(Math.max(d * 0.25, 16), 24);
  const inner = w - 2 * arm;
  const n = inner >= 170 ? 3 : 2;
  const cw = inner / n;
  const cushionD = d - back - 2;
  return (
    <>
      <Part size={[w, seat - 12 - leg, d]} at={[0, leg + (seat - 12 - leg) / 2, 0]} r={3}>
        <Fabric hex={hex} />
      </Part>
      {[-1, 1].map((s) => (
        <Part key={s} size={[arm, armH - leg, d]} at={[s * (w / 2 - arm / 2), leg + (armH - leg) / 2, 0]} r={6}>
          <Fabric hex={hex} />
        </Part>
      ))}
      <Part size={[inner, h - leg, back]} at={[0, leg + (h - leg) / 2, -d / 2 + back / 2]} r={6}>
        <Fabric hex={hex} />
      </Part>
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} size={[cw - 1, 13, cushionD]} at={[-inner / 2 + cw * (i + 0.5), seat - 6, -d / 2 + back + cushionD / 2]} r={5}>
          <Fabric hex={hex} />
        </Part>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} size={[4, leg, 4]} at={[sx * (w / 2 - 7), leg / 2, sz * (d / 2 - 7)]}>
            <Wood hex="#5a4030" />
          </Part>
        )),
      )}
    </>
  );
}

function Bed({ w, d, h, hex }: PieceProps) {
  const frameTop = 30;
  const mattress = 20;
  const head = 8;
  const pillows = w >= 120 ? 2 : 1;
  const pw = (w - 16) / pillows - 6;
  const duvetD = (d - head) * 0.68;
  return (
    <>
      <Part size={[w, frameTop - 8, d]} at={[0, 8 + (frameTop - 8) / 2, 0]} r={1}>
        <Wood hex="#b08a62" />
      </Part>
      <Part size={[w - 6, mattress, d - head - 4]} at={[0, frameTop + mattress / 2, head / 2 + 1]} r={5}>
        <Fabric hex={LINEN} />
      </Part>
      <Part size={[w - 2, 6, duvetD]} at={[0, frameTop + mattress + 2, d / 2 - duvetD / 2 - 2]} r={3}>
        <Fabric hex={hex} />
      </Part>
      {Array.from({ length: pillows }, (_, i) => (
        <Part key={i} size={[pw, 13, 38]} at={[-w / 2 + 8 + (pw + 6) * (i + 0.5), frameTop + mattress + 6, -d / 2 + head + 23]} r={6}>
          <Fabric hex={LINEN} />
        </Part>
      ))}
      <Part size={[w, h, head]} at={[0, h / 2, -d / 2 + head / 2]} r={3}>
        <Fabric hex={hex} />
      </Part>
    </>
  );
}

/** Carcass on a recessed plinth with a grid of doors or drawer fronts. */
function Cabinet({ w, d, h, hex, rows, cols, drawers = false }: PieceProps & { rows: number; cols: number; drawers?: boolean }) {
  const plinth = 8;
  const front = 2;
  const gap = 0.5;
  const body = h - plinth;
  const rh = body / rows;
  const cw = w / cols;
  const fronts = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + cw * (c + 0.5);
      const y = plinth + rh * (r + 0.5);
      // Doors in pairs open from the middle; drawers get a centred pull.
      const hx = drawers ? x : c % 2 === 0 && c + 1 < cols ? x + cw / 2 - 5 : x - cw / 2 + 5;
      const handle: V3 = drawers ? [Math.min(24, cw * 0.4), 1.2, 1.5] : [1.2, Math.min(30, rh * 0.3), 1.5];
      fronts.push(
        <group key={`${r}-${c}`}>
          <Part size={[cw - gap, rh - gap, front]} at={[x, y, d / 2 - front / 2]} r={0.4}>
            <Wood hex={hex} />
          </Part>
          <Part size={handle} at={[hx, drawers ? y + rh * 0.2 : Math.min(y, plinth + 105), d / 2 + 0.75]}>
            <Metal />
          </Part>
        </group>,
      );
    }
  return (
    <>
      <Part size={[w, body, d - front]} at={[0, plinth + body / 2, -front / 2]}>
        <Wood hex={hex} />
      </Part>
      <Part size={[w - 6, plinth, d - front - 4]} at={[0, plinth / 2, -front / 2 - 2]}>
        <Paint hex="#2e2a26" rough={0.8} />
      </Part>
      {fronts}
    </>
  );
}

const BOOK_COLORS = ["#7b5e45", "#a44a3f", "#3f5b6b", "#c9b79c", "#556b4a", "#2f2b28", "#d8cfc0", "#8c6d3f"];

/** Book spines for each compartment, merged into one mesh with vertex colours. */
function booksGeometry(slots: { x0: number; y: number; width: number; maxH: number }[], depth: number, seed: string): THREE.BufferGeometry {
  const rand = mulberry32(hashSeed(seed));
  const parts: THREE.BufferGeometry[] = [];
  for (const s of slots) {
    let x = s.x0 + rand() * s.width * 0.3;
    const end = x + s.width * (0.4 + rand() * 0.4);
    while (x < Math.min(end, s.x0 + s.width - 3)) {
      const bw = 2.5 + rand() * 3.5;
      const bh = Math.min(s.maxH, 17 + rand() * 11);
      if (bh < 10) break;
      const bd = depth * (0.7 + rand() * 0.2);
      const g = new THREE.BoxGeometry(bw, bh, bd);
      g.translate(x + bw / 2, s.y + bh / 2, -depth / 2 + bd / 2 + 1);
      const c = new THREE.Color(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]);
      const colors = new Float32Array(g.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(g);
      x += bw + (rand() < 0.1 ? 4 : 0.3);
    }
  }
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

function Bookshelf({ w, d, h, hex, seed }: PieceProps) {
  const t = 2;
  const base = 6;
  const y0 = base + t;
  const y1 = h - t;
  const n = Math.max(2, Math.round((y1 - y0) / 35));
  const pitch = (y1 - y0) / n;
  const books = useMemo(
    () =>
      booksGeometry(
        Array.from({ length: n }, (_, i) => ({ x0: -w / 2 + t, y: y0 + pitch * i, width: w - 2 * t, maxH: pitch - t - 3 })),
        d - 2,
        seed,
      ),
    [w, d, n, y0, pitch, seed],
  );
  useDispose(books);
  return (
    <>
      {[-1, 1].map((s) => (
        <Part key={s} size={[t, h, d]} at={[s * (w / 2 - t / 2), h / 2, 0]}>
          <Wood hex={hex} />
        </Part>
      ))}
      <Part size={[w - 2 * t, t, d]} at={[0, h - t / 2, 0]}>
        <Wood hex={hex} />
      </Part>
      <Part size={[w - 2 * t, base, d - 3]} at={[0, base / 2, -1.5]}>
        <Wood hex={hex} />
      </Part>
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} size={[w - 2 * t, t, d - 1]} at={[0, y0 + pitch * i - t / 2, 0.5]}>
          <Wood hex={hex} />
        </Part>
      ))}
      <Part size={[w - 2 * t, h - base - t, 1]} at={[0, base + (h - base - t) / 2, -d / 2 + 0.5]}>
        <Wood hex={hex} />
      </Part>
      <mesh geometry={books} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
    </>
  );
}

function Table({ w, d, h, hex, top, leg, metalLegs = false }: PieceProps & { top: number; leg: number; metalLegs?: boolean }) {
  const inset = leg / 2 + 5;
  return (
    <>
      <Part size={[w, top, d]} at={[0, h - top / 2, 0]} r={0.8}>
        <Wood hex={hex} />
      </Part>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} size={[leg, h - top, leg]} at={[sx * (w / 2 - inset), (h - top) / 2, sz * (d / 2 - inset)]}>
            {metalLegs ? <Metal /> : <Wood hex={hex} />}
          </Part>
        )),
      )}
    </>
  );
}

function Bench({ w, d, h, hex }: PieceProps) {
  return (
    <>
      <Part size={[w, 4, d]} at={[0, h - 2, 0]} r={0.8}>
        <Wood hex={hex} />
      </Part>
      {[-1, 1].map((s) => (
        <Part key={s} size={[3, h - 4, d - 4]} at={[s * (w / 2 - 8), (h - 4) / 2, 0]}>
          <Wood hex={hex} />
        </Part>
      ))}
    </>
  );
}

function FloorLamp({ w, d, h, hex, lit }: PieceProps) {
  const r = Math.min(w, d) / 2;
  const shade = 28;
  return (
    <>
      <Cyl top={r * 0.7} bottom={r * 0.7} h={2.5} at={[0, 1.25, 0]}>
        <Metal />
      </Cyl>
      <Cyl top={1.2} bottom={1.2} h={h - shade / 2} at={[0, (h - shade / 2) / 2, 0]}>
        <Metal />
      </Cyl>
      <Cyl top={r * 0.65} bottom={r * 0.95} h={shade} at={[0, h - shade / 2, 0]} open>
        <meshStandardMaterial color={hex} roughness={0.9} side={THREE.DoubleSide} emissive="#ffc98a" emissiveIntensity={lit ? 0.9 : 0} />
      </Cyl>
    </>
  );
}

function Mirror({ w, d, h }: PieceProps) {
  const f = 2.5;
  return (
    <>
      <Part size={[w - 2 * f, h - 2 * f, 0.6]} at={[0, h / 2, -d / 2 + 1.2]}>
        <meshStandardMaterial color="#e9eff1" metalness={1} roughness={0.03} />
      </Part>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Part size={[w, f, d]} at={[0, h / 2 + s * (h / 2 - f / 2), 0]}>
            <Metal />
          </Part>
          <Part size={[f, h - 2 * f, d]} at={[s * (w / 2 - f / 2), h / 2, 0]}>
            <Metal />
          </Part>
        </group>
      ))}
    </>
  );
}

function WallShelf({ w, d, h, hex, seed }: PieceProps) {
  const bracket = Math.min(12, h * 0.4);
  const books = useMemo(() => booksGeometry([{ x0: -w / 2 + 4, y: bracket + 3, width: w * 0.6, maxH: h - bracket - 3 }], d - 2, seed), [w, d, h, bracket, seed]);
  useDispose(books);
  return (
    <>
      <Part size={[w, 3, d]} at={[0, bracket + 1.5, 0]} r={0.5}>
        <Wood hex={hex} />
      </Part>
      {[-1, 1].map((s) => (
        <Part key={s} size={[1.5, bracket, d - 4]} at={[s * (w / 2 - 10), bracket / 2, -2]}>
          <Metal />
        </Part>
      ))}
      <mesh geometry={books} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
    </>
  );
}

function CoatRack({ w, d, h, hex }: PieceProps) {
  const n = Math.max(3, Math.round(w / 15));
  return (
    <>
      <Part size={[w, h, 2]} at={[0, h / 2, -d / 2 + 1]} r={0.5}>
        <Wood hex={hex} />
      </Part>
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} size={[1.4, 1.4, d - 2]} at={[-w / 2 + (w / n) * (i + 0.5), h * 0.45, 1]}>
          <Metal />
        </Part>
      ))}
    </>
  );
}
