import { doorLeaf, openingSpan } from "@/domain/geometry/openings";
import { add, cross, scale, sub, type Vec } from "@/domain/geometry/vec";
import type { Wall } from "@/domain/geometry/walls";
import type { FixedElement, Opening } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";

/** Plan drawing primitives. All coordinates in cm (the SVG viewBox is in cm). */

export const WALL_CM = 12;

const pts = (ps: readonly Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

export function RoomOutline({ polygon, className }: { polygon: readonly Vec[]; className?: string }) {
  return (
    <polygon
      points={pts(polygon)}
      className={cn("fill-background stroke-foreground", className)}
      strokeWidth={WALL_CM}
      strokeLinejoin="miter"
    />
  );
}

/** Band along a wall between two points, `inner`/`outer` cm to each side. */
function wallBand(a: Vec, b: Vec, wall: Wall, inner: number, outer: number): Vec[] {
  const i = scale(wall.inward, inner);
  const o = scale(wall.inward, -outer);
  return [add(a, o), add(b, o), add(b, i), add(a, i)];
}

interface OpeningShapeProps {
  walls: readonly Wall[];
  opening: Opening;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function OpeningShape({ walls, opening, selected, onPointerDown }: OpeningShapeProps) {
  const span = openingSpan(walls, opening);
  if (!span) return null;
  const { wall, start, end } = span;
  const half = WALL_CM / 2 + 1;
  const hl = selected ? "stroke-blue-600" : "stroke-foreground";

  let body: React.ReactNode;
  switch (opening.kind) {
    case "door": {
      const leaf = doorLeaf(walls, opening);
      const gap = <polygon points={pts(wallBand(start, end, wall, half, half))} className="fill-background stroke-none" />;
      if (!leaf) {
        // Sliding: two offset panels.
        const mid = add(start, scale(sub(end, start), 0.5));
        body = (
          <>
            {gap}
            <line x1={start.x} y1={start.y} x2={mid.x + (end.x - start.x) * 0.1} y2={mid.y + (end.y - start.y) * 0.1} className={cn("stroke-[3]", hl)} />
            <line
              x1={mid.x - (end.x - start.x) * 0.1 + wall.inward.x * 4}
              y1={mid.y - (end.y - start.y) * 0.1 + wall.inward.y * 4}
              x2={end.x + wall.inward.x * 4}
              y2={end.y + wall.inward.y * 4}
              className={cn("stroke-[3]", hl)}
            />
          </>
        );
      } else {
        const sweep = cross(sub(leaf.closedTip, leaf.hinge), sub(leaf.openTip, leaf.hinge)) > 0 ? 1 : 0;
        body = (
          <>
            {gap}
            <line x1={leaf.hinge.x} y1={leaf.hinge.y} x2={leaf.openTip.x} y2={leaf.openTip.y} className={cn("stroke-[3]", hl)} />
            <path
              d={`M ${leaf.closedTip.x} ${leaf.closedTip.y} A ${leaf.radius} ${leaf.radius} 0 0 ${sweep} ${leaf.openTip.x} ${leaf.openTip.y}`}
              className={cn("fill-none stroke-1", hl)}
              strokeDasharray="6 4"
            />
          </>
        );
      }
      break;
    }
    case "window":
      body = (
        <>
          <polygon points={pts(wallBand(start, end, wall, half, half))} className={cn("fill-sky-100 stroke-2", hl)} />
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={cn("stroke-2", hl)} />
        </>
      );
      break;
    case "radiator": {
      const off = WALL_CM / 2 + 2;
      const a = add(start, scale(wall.inward, off));
      const b = add(end, scale(wall.inward, off));
      body = <polygon points={pts(wallBand(a, b, wall, opening.depth, 0))} className={cn("fill-orange-200 stroke-2", hl)} />;
      break;
    }
    case "socket": {
      const c = add(add(start, scale(sub(end, start), 0.5)), scale(wall.inward, WALL_CM / 2 + 6));
      body = <circle cx={c.x} cy={c.y} r={6} className={cn("fill-yellow-300 stroke-2", hl)} />;
      break;
    }
  }

  return (
    <g
      data-opening-id={opening.id}
      data-kind={opening.kind}
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-pointer" : undefined}
    >
      {body}
      {/* Invisible, wider hit area for touch. */}
      {onPointerDown && <polygon points={pts(wallBand(start, end, wall, 30, 30))} className="fill-transparent stroke-none" />}
    </g>
  );
}

export function FixedElementShape({ el }: { el: FixedElement }) {
  const { x, y, w, d } = el.rect;
  return (
    <g>
      <rect x={x} y={y} width={w} height={d} className="fill-muted stroke-muted-foreground stroke-2" />
      <line x1={x} y1={y} x2={x + w} y2={y + d} className="stroke-muted-foreground stroke-1" />
      <line x1={x + w} y1={y} x2={x} y2={y + d} className="stroke-muted-foreground stroke-1" />
    </g>
  );
}

/** Dimension line parallel to a wall, drawn outside the room. */
export function WallDimension({ wall, distance, fontSize, label }: { wall: Wall; distance: number; fontSize: number; label?: string }) {
  const out = scale(wall.inward, -distance);
  const a = add(wall.a, out);
  const b = add(wall.b, out);
  const mid = add(a, scale(sub(b, a), 0.5));
  const text = add(mid, scale(wall.inward, -fontSize * 0.6));
  let angle = (Math.atan2(wall.dir.y, wall.dir.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180; // keep text upright
  return (
    <g className="text-muted-foreground" aria-hidden>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-current stroke-1" />
      <text
        x={text.x}
        y={text.y}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${angle} ${text.x} ${text.y})`}
        className="fill-current"
      >
        {label ?? `${Math.round(wall.length)}`}
      </text>
    </g>
  );
}
