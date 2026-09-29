"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Vec } from "@/domain/geometry/vec";
import { kelvinToHex, lampSources, lampWorld, nearestLights, roomLit } from "@/domain/planner/lighting";
import { usePlanner } from "../planner-context";
import type { PlanRoom } from "../state";

/** Real-time point lights are costly; the rest of the lit lamps only glow. */
export const MAX_LIGHTS = 8;
/** How often the nearest lamps are picked again as the camera moves. */
const PICK_EVERY_S = 0.4;

/**
 * The lamps of every lit room in view: pendants, chandeliers, floor lamps, or
 * one ceiling light where a room has none. Only the nearest MAX_LIGHTS to the
 * camera cast light.
 */
export function RoomLights({ placed }: { placed: readonly { r: PlanRoom; origin: Vec }[] }) {
  const { s } = usePlanner();
  const lamps = useMemo(
    () =>
      placed.flatMap(({ r, origin }) =>
        roomLit(r.room.id, s.lightsSwitched, s.scene.hour)
          ? lampSources(r.room, r.furniture).map((l) => ({ key: `${r.room.id}:${l.id}`, kind: l.kind, pos: lampWorld(l, origin) }))
          : [],
      ),
    [placed, s.lightsSwitched, s.scene.hour],
  );
  const [shown, setShown] = useState<typeof lamps>([]);
  const since = useRef(PICK_EVERY_S);
  const lastKeys = useRef("");
  useFrame(({ camera }, dt) => {
    since.current += dt;
    if (since.current < PICK_EVERY_S) return;
    since.current = 0;
    const next = nearestLights(lamps, camera.position, MAX_LIGHTS);
    const keys = next.map((l) => l.key).join("|");
    // Changing the number of lights recompiles shaders; only update when the set changes.
    if (keys !== lastKeys.current) {
      lastKeys.current = keys;
      setShown(next);
    }
  });
  const color = kelvinToHex(s.scene.lightKelvin);
  return (
    <>
      {shown.map((l) => (
        <pointLight
          key={l.key}
          position={[l.pos.x, l.pos.y, l.pos.z]}
          color={color}
          intensity={l.kind === "floor_lamp" ? 1 : 1.3}
          distance={l.kind === "floor_lamp" ? 480 : 750}
          decay={0}
        />
      ))}
    </>
  );
}
