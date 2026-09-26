import { doorLeaf, openingSpan } from "@/domain/geometry/openings";
import { add, cross, scale, sub, type Vec } from "@/domain/geometry/vec";
import type { Wall } from "@/domain/geometry/walls";
import type { FixedElement, Opening } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";

/** Plan drawing primitives. All coordinates in cm (the SVG viewBox is in cm). */

export const WALL_CM = 12;

export const pts = (ps: readonly Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

/** Floor fill, ink walls with round joins and a faint offset pencil line. */
export function RoomOutline({ polygon, className }: { polygon: readonly Vec[]; className?: string }) {
  const off = WALL_CM * 0.45;
  return (
    <g className={className}>
      <polygon points={pts(polygon)} pathLength={1} className="plan-wall fill-[rgba(255,250,240,.55)] stroke-foreground" strokeWidth={WALL_CM} strokeLinejoin="round" />
      <polygon
        points={pts(polygon.map((p) => ({ x: p.x + off, y: p.y + off })))}
        className="fill-none stroke-foreground"
        strokeOpacity={0.35}
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        aria-hidden
      />
    </g>
  );
}

/** Band along a wall between two points, `inner`/`outer` cm to each side. */
export function wallBand(a: Vec, b: Vec, wall: Wall, inner: number, outer: number): Vec[] {
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
  const hl = selected ? "stroke-primary" : "stroke-foreground";

  let body: React.ReactNode;
  switch (opening.kind) {
    case "door": {
      const leaf = doorLeaf(walls, opening);
      const gap = <polygon points={pts(wallBand(start, end, wall, half, half))} className="fill-card stroke-none" />;
      if (opening.swing === "none") {
        // Pass-through: just the gap.
        body = gap;
      } else if (!leaf) {
        // Sliding: two offset panels.
        const mid = add(start, scale(sub(end, start), 0.5));
        body = (
          <>
            {gap}
            <line x1={start.x} y1={start.y} x2={mid.x + (end.x - start.x) * 0.1} y2={mid.y + (end.y - start.y) * 0.1} className={cn("stroke-[2.5]", hl)} />
            <line
              x1={mid.x - (end.x - start.x) * 0.1 + wall.inward.x * 4}
              y1={mid.y - (end.y - start.y) * 0.1 + wall.inward.y * 4}
              x2={end.x + wall.inward.x * 4}
              y2={end.y + wall.inward.y * 4}
              className={cn("stroke-[2.5]", hl)}
            />
          </>
        );
      } else {
        const sweep = cross(sub(leaf.closedTip, leaf.hinge), sub(leaf.openTip, leaf.hinge)) > 0 ? 1 : 0;
        body = (
          <>
            {gap}
            <line x1={leaf.hinge.x} y1={leaf.hinge.y} x2={leaf.openTip.x} y2={leaf.openTip.y} className={cn("stroke-[2.5]", hl)} />
            <path
              d={`M ${leaf.closedTip.x} ${leaf.closedTip.y} A ${leaf.radius} ${leaf.radius} 0 0 ${sweep} ${leaf.openTip.x} ${leaf.openTip.y}`}
              className="fill-none stroke-primary"
              strokeWidth={1.4}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          </>
        );
      }
      break;
    }
    case "window":
      body = (
        <>
          <polygon points={pts(wallBand(start, end, wall, half, half))} className={cn("fill-glass stroke-[1.5]", hl)} />
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={cn("stroke-[1.5]", hl)} />
        </>
      );
      break;
    case "radiator": {
      const off = WALL_CM / 2 + 2;
      const a = add(start, scale(wall.inward, off));
      const b = add(end, scale(wall.inward, off));
      body = <polygon points={pts(wallBand(a, b, wall, opening.depth, 0))} className={cn("fill-primary stroke-[1.5]", selected ? "stroke-primary-foreground" : "stroke-clay-dark")} />;
      break;
    }
    case "socket": {
      const c = add(add(start, scale(sub(end, start), 0.5)), scale(wall.inward, WALL_CM / 2 + 6));
      body = <circle cx={c.x} cy={c.y} r={6} className={cn("fill-primary stroke-[1.5]", selected ? "stroke-foreground" : "stroke-clay-dark")} />;
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
      {selected && (
        <g pointerEvents="none" aria-hidden>
          <polygon
            points={pts(wallBand(start, end, wall, half + 6, half + 6))}
            className="fill-none stroke-primary"
            strokeWidth={1.4}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={start.x} cy={start.y} r={5} className="fill-primary stroke-card" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle cx={end.x} cy={end.y} r={5} className="fill-primary stroke-card" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {/* Invisible, wider hit area for touch. */}
      {onPointerDown && <polygon points={pts(wallBand(start, end, wall, 30, 30))} className="fill-transparent stroke-none" />}
    </g>
  );
}

export function FixedElementShape({ el }: { el: FixedElement }) {
  const { x, y, w, d } = el.rect;
  return (
    <g>
      <rect x={x} y={y} width={w} height={d} className="fill-secondary stroke-foreground stroke-[1.5]" />
      <line x1={x} y1={y} x2={x + w} y2={y + d} className="stroke-muted-foreground" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={x + w} y1={y} x2={x} y2={y + d} className="stroke-muted-foreground" strokeWidth={1} vectorEffect="non-scaling-stroke" />
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
  // 45° ticks at both ends.
  const tick = scale(add(wall.dir, wall.inward), fontSize * 0.35);
  return (
    <g className="text-dim" aria-hidden>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-current" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {[a, b].map((p, i) => (
        <line key={i} x1={p.x - tick.x} y1={p.y - tick.y} x2={p.x + tick.x} y2={p.y + tick.y} className="stroke-current" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      ))}
      <text
        x={text.x}
        y={text.y}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${angle} ${text.x} ${text.y})`}
        className="fill-current font-mono"
      >
        {label ?? `${Math.round(wall.length)}`}
      </text>
    </g>
  );
}
