import { area, bbox } from "@/domain/geometry/polygon";
import { wallsOf } from "@/domain/geometry/walls";
import { floorBounds, floorOrigins } from "@/domain/planner/floor-layout";
import type { Room } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";
import { CompassBadge } from "./compass";
import { FixedElementShape, OpeningShape, RoomOutline } from "./shapes";

/** Read-only plan of a whole apartment: every room where it stands, with doors, windows and names. */
export function FloorPlan({ rooms, northAngleDeg, className, names = true }: { rooms: readonly Room[]; northAngleDeg: number; className?: string; names?: boolean }) {
  const origins = floorOrigins(rooms);
  const b = floorBounds(rooms, origins);
  if (!b) return null;
  const size = Math.max(b.w, b.d);
  const margin = size * 0.08;
  const font = size / 46;
  return (
    <svg viewBox={`${b.x - margin} ${b.y - margin} ${b.w + 2 * margin} ${b.d + 2 * margin}`} className={cn("h-auto w-full", className)} role="img" aria-label={rooms.map((r) => r.name).join(", ")} data-testid="floor-plan">
      {rooms.map((r) => {
        const o = origins.get(r.id) ?? { x: 0, y: 0 };
        const walls = wallsOf(r.polygon);
        const rb = bbox(r.polygon);
        // Names only where they fit: a room at least as wide as its name.
        const fits = names && rb.w > r.name.length * font * 0.55 && area(r.polygon) > 30_000;
        return (
          <g key={r.id} transform={`translate(${o.x} ${o.y})`}>
            <RoomOutline polygon={r.polygon} />
            {r.fixedElements.map((f) => (
              <FixedElementShape key={f.id} el={f} />
            ))}
            {r.openings.map((op) => (
              <OpeningShape key={op.id} walls={walls} opening={op} />
            ))}
            {fits && (
              <text x={rb.x + rb.w / 2} y={rb.y + rb.d / 2} fontSize={font} textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontFamily="var(--serif)">
                {r.name}
              </text>
            )}
          </g>
        );
      })}
      <CompassBadge angle={northAngleDeg} x={b.x + b.w + margin * 0.5} y={b.y - margin * 0.5} size={margin * 0.8} />
    </svg>
  );
}
