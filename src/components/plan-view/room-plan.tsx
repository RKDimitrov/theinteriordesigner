import { bbox } from "@/domain/geometry/polygon";
import { wallOrientations, wallsOf } from "@/domain/geometry/walls";
import type { RoomShape } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";
import { CompassBadge } from "../plan-editor/compass";
import { FixedElementShape, OpeningShape, RoomOutline, WallDimension } from "./shapes";

interface RoomPlanProps {
  room: RoomShape;
  northAngleDeg: number;
  className?: string;
  showDimensions?: boolean;
}

/** Read-only plan of one room. */
export function RoomPlan({ room, northAngleDeg, className, showDimensions = true }: RoomPlanProps) {
  const walls = wallsOf(room.polygon);
  const dirs = wallOrientations(room.polygon, northAngleDeg, room.wallOrientationOverrides);
  const b = bbox(room.polygon);
  const size = Math.max(b.w, b.d);
  const margin = size * 0.18;
  const font = size / 22;

  return (
    <svg
      viewBox={`${b.x - margin} ${b.y - margin} ${b.w + 2 * margin} ${b.d + 2 * margin}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={room.name}
    >
      <RoomOutline polygon={room.polygon} />
      {room.fixedElements.map((f) => (
        <FixedElementShape key={f.id} el={f} />
      ))}
      {room.openings.map((o) => (
        <OpeningShape key={o.id} walls={walls} opening={o} />
      ))}
      {showDimensions &&
        walls.map((w) => (
          <WallDimension key={w.index} wall={w} distance={margin * 0.45} fontSize={font} label={`${Math.round(w.length)} · ${dirs[w.index]}`} />
        ))}
      <CompassBadge angle={northAngleDeg} x={b.x + b.w + margin * 0.55} y={b.y - margin * 0.55} size={margin * 0.8} />
    </svg>
  );
}
