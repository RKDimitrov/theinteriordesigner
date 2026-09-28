"use client";

import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Rect } from "@/domain/room/opening-parts";
import { cmUV } from "./geometry";
import { sweep, type P2 } from "./sweep";

type MeshProps = Omit<ThreeElements["mesh"], "geometry">;

/** Frees GPU memory for geometry a component built itself. */
function useDisposed<T extends THREE.BufferGeometry>(g: T): T {
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

/** A moulding: `profile` swept along `path` (see sweep.ts), rebuilt only when its shape changes. */
export function Swept({
  profile,
  path,
  closed,
  before,
  after,
  children,
  ...mesh
}: MeshProps & { profile: readonly P2[]; path: readonly P2[]; closed?: boolean; before?: P2; after?: P2; children: React.ReactNode }) {
  const key = JSON.stringify([profile, path, closed, before, after]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes every input
  const geo = useDisposed(useMemo(() => sweep(profile, path, { closed, before, after }), [key]));
  return (
    <mesh geometry={geo} castShadow receiveShadow {...mesh}>
      {children}
    </mesh>
  );
}

/**
 * A board covering `r` in the x–y plane, `t` thick, centred on z = `z`, with
 * slightly rounded arrises like machined timber.
 */
export function Board({ r, t, z = 0, round = 0.25, children }: { r: Rect; t: number; z?: number; round?: number; children: React.ReactNode }) {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const geo = useDisposed(
    useMemo(() => {
      const rr = Math.min(round, w / 2 - 0.01, h / 2 - 0.01, t / 2 - 0.01);
      return cmUV(rr > 0.05 ? new RoundedBoxGeometry(w, h, t, 2, rr) : new THREE.BoxGeometry(w, h, t));
    }, [w, h, t, round]),
  );
  return (
    <mesh geometry={geo} position={[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z]} castShadow receiveShadow>
      {children}
    </mesh>
  );
}

/** Geometries merged into one, for repeated parts like radiator sections and grille bars. */
export function useMerged(build: () => THREE.BufferGeometry[], key: string): THREE.BufferGeometry {
  return useDisposed(
    useMemo(() => {
      const parts = build();
      const merged = mergeAll(parts);
      parts.forEach((g) => g.dispose());
      return merged;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes the parts
    }, [key]),
  );
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // mergeGeometries needs the same attributes everywhere; keep the ones all parts share.
  const names = ["position", "normal", "uv"].filter((n) => parts.every((g) => g.getAttribute(n)));
  const clean = parts.map((g) => {
    const c = (g.index ? g.toNonIndexed() : g.clone()) as THREE.BufferGeometry;
    for (const n of Object.keys(c.attributes)) if (!names.includes(n)) c.deleteAttribute(n);
    return c;
  });
  const merged = mergeGeometries(clean) ?? new THREE.BufferGeometry();
  clean.forEach((g) => g.dispose());
  return merged;
}
