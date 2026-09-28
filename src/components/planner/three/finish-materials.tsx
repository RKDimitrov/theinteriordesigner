"use client";

import { Edges } from "@react-three/drei";
import type { Look } from "./fit-out-look";
import { Wood } from "./pieces";

export const INK = "#2b2622";

/**
 * Material for a finish. Realistic mode: tinted photographed wood,
 * clear-coated lacquer, powder coat, polished metal. Drawing mode: flat colour.
 */
export function FinishMat({ look, realistic }: { look: Look; realistic: boolean }) {
  switch (look.kind) {
    case "wood":
      return realistic ? <Wood hex={look.color} /> : <meshStandardMaterial color={look.color} roughness={0.6} />;
    case "paint":
      // Factory lacquer has a thin clear coat that catches window light.
      return realistic ? (
        <meshPhysicalMaterial color={look.color} roughness={look.rough} clearcoat={look.rough < 0.4 ? 0.5 : 0.15} clearcoatRoughness={0.2} />
      ) : (
        <meshStandardMaterial color={look.color} roughness={look.rough} />
      );
    case "metal":
      return <meshStandardMaterial color={look.color} metalness={1} roughness={look.rough} />;
    case "glass":
      // Frameless glass doors: the fittings are black aluminium.
      return <meshStandardMaterial color="#2a2a2b" metalness={0.6} roughness={0.4} />;
  }
}

/** Float glass: clear with a faint green edge tint, reflective, cheap (no transmission pass). */
export function GlassMat({ realistic }: { realistic: boolean }) {
  return realistic ? (
    // No depth write, so ambient occlusion and things behind still show.
    <meshPhysicalMaterial color="#dfe9e6" transparent opacity={0.16} roughness={0.02} metalness={0} ior={1.52} envMapIntensity={1.4} depthWrite={false} />
  ) : (
    <meshStandardMaterial color="#cdd9d5" transparent opacity={0.28} roughness={0.05} depthWrite={false} />
  );
}

/** Ink outlines in drawing mode only. */
export const Ink = ({ realistic }: { realistic: boolean }) => (realistic ? null : <Edges color={INK} threshold={15} />);
