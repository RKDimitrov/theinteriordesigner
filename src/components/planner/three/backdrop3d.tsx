"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/*
 * What surrounds the apartment: a plain ground and a soft sky that fades
 * from a pale horizon to a light blue overhead. Nothing is photographed, so
 * windows show calm daylight whatever the flat looks onto.
 */

/** The sky dome; the camera's far plane (40 000) stays outside it. */
const SKY_RADIUS_CM = 30000;
const GROUND_RADIUS_CM = 12000;
const GROUND = "#e3d5bd";
const HORIZON = new THREE.Color("#efe8dc");
const ZENITH = new THREE.Color("#c3d6e6");

export function Backdrop({ center, sky }: { center: THREE.Vector3; sky: { light: number; tint: string } }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(SKY_RADIUS_CM, 32, 24);
    const y = g.getAttribute("position");
    const colours = new Float32Array(y.count * 3);
    const c = new THREE.Color();
    const ground = new THREE.Color(GROUND);
    for (let i = 0; i < y.count; i++) {
      const up = y.getY(i) / SKY_RADIUS_CM;
      // Most of the fade happens low in the sky; below the horizon the dome takes the ground's colour.
      if (up >= 0) c.copy(HORIZON).lerp(ZENITH, Math.sqrt(up));
      else c.copy(HORIZON).lerp(ground, Math.min(1, -up * 8));
      c.toArray(colours, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  // The sky follows the sun: warm and dimmer when it is low, dark blue after dusk.
  const tint = useMemo(() => new THREE.Color(sky.tint).multiplyScalar(sky.light), [sky.tint, sky.light]);

  return (
    <group position={[center.x, 0, center.z]}>
      {/* Clicks go through the sky and the ground to "nothing", which clears the selection. */}
      <mesh geometry={geo} renderOrder={-1} raycast={() => {}}>
        <meshBasicMaterial vertexColors color={tint} side={THREE.BackSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-1.5} receiveShadow raycast={() => {}}>
        <circleGeometry args={[GROUND_RADIUS_CM, 64]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
    </group>
  );
}
