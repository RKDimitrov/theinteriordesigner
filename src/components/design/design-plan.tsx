"use client";

import { useTranslations } from "next-intl";
import { itemFootprint } from "@/domain/geometry/obb";
import { bbox } from "@/domain/geometry/polygon";
import { add, scale, sub, type Vec } from "@/domain/geometry/vec";
import { wallsOf } from "@/domain/geometry/walls";
import type { DesignContent, FurnitureItem } from "@/domain/schemas/design";
import type { RoomShape } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";
import { CompassBadge } from "../plan-view/compass";
import { OpeningShape, RoomOutline, WallDimension } from "../plan-view/shapes";

const pts = (ps: readonly Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

interface Props {
  room: RoomShape;
  northAngleDeg: number;
  design: DesignContent;
  /** Ids of items with errors (red) and the highlighted item (hovered or selected). */
  errorIds: ReadonlySet<string>;
  selectedId: string | null;
  highlightId: string | null;
  /** 1-based list number per item id. */
  numbers: ReadonlyMap<string, number>;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null, at?: { x: number; y: number }) => void;
}

const LAYER_ORDER: Record<FurnitureItem["placement"], number> = { floor_covering: 0, floor: 1, wall: 2, ceiling: 3 };

/** Pieces drawn as circles. */
const ROUND = new Set<FurnitureItem["category"]>(["plant", "floor_lamp"]);

export function DesignPlan({ room, northAngleDeg, design, errorIds, selectedId, highlightId, numbers, onSelect, onHover }: Props) {
  const t = useTranslations("Design");
  const walls = wallsOf(room.polygon);
  const b = bbox(room.polygon);
  const size = Math.max(b.w, b.d);
  const margin = size * 0.16;
  const font = size / 40;
  const items = [...design.furniture].sort((a, z) => LAYER_ORDER[a.placement] - LAYER_ORDER[z.placement]);

  return (
    <svg
      viewBox={`${b.x - margin} ${b.y - margin} ${b.w + 2 * margin} ${b.d + 2 * margin}`}
      className="h-auto w-full touch-manipulation select-none"
      role="img"
      aria-label={`${t("plan")}: ${room.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      onPointerLeave={() => onHover(null)}
    >
      <RoomOutline polygon={room.polygon} />
      {design.zones.map((z) => (
        <g key={z.id} aria-hidden>
          <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.d} className="fill-none stroke-rule" strokeWidth={1} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          <text x={z.rect.x + 4} y={z.rect.y + font} fontSize={font * 0.8} className="fill-muted-foreground font-mono uppercase">
            {z.name}
          </text>
        </g>
      ))}

      {items.map((f, i) => {
        const poly = itemFootprint(f);
        const lit = f.id === highlightId || f.id === selectedId;
        const error = errorIds.has(f.id);
        const rug = f.placement === "floor_covering";
        const front = scale(add(poly[2]!, poly[3]!), 0.5);
        const back = scale(add(poly[0]!, poly[1]!), 0.5);
        const tick = add(front, scale(sub(back, front), 0.12));
        const shapeProps = {
          fill: f.colorHex,
          fillOpacity: rug ? 0.55 : 0.85,
          className: cn("stroke-foreground transition-[stroke-width]", error && "stroke-destructive", lit && "stroke-primary"),
          strokeWidth: lit ? 3 : error ? 2.5 : 1.2,
          strokeDasharray: rug || f.placement === "wall" ? "4 3" : undefined,
          vectorEffect: "non-scaling-stroke" as const,
        };
        const n = numbers.get(f.id);
        return (
          <g
            key={f.id}
            data-testid={`plan-item-${f.id}`}
            data-highlighted={lit || undefined}
            className="plan-item cursor-pointer"
            style={{ "--i": i } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(f.id === selectedId ? null : f.id);
            }}
            onPointerMove={(e) => onHover(f.id, { x: e.clientX, y: e.clientY })}
          >
            {ROUND.has(f.category) ? <circle cx={f.x} cy={f.y} r={Math.min(f.w, f.d) / 2} {...shapeProps} /> : <polygon points={pts(poly)} {...shapeProps} />}
            {f.placement === "floor" && !ROUND.has(f.category) && (
              <line x1={front.x} y1={front.y} x2={tick.x} y2={tick.y} className="stroke-foreground/70" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            )}
            {n !== undefined && (
              <text
                x={f.x}
                y={f.y}
                fontSize={font * 1.1}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none fill-foreground font-mono font-medium"
              >
                {n}
              </text>
            )}
          </g>
        );
      })}

      {design.lighting
        .filter((l) => l.position && (l.mount === "ceiling" || l.mount === "wall"))
        .map((l) => (
          <circle
            key={l.id}
            cx={l.position!.x}
            cy={l.position!.y}
            r={font * 0.8}
            className="pointer-events-none fill-sticky stroke-primary"
            strokeWidth={1.2}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {room.openings.map((o) => (
        <OpeningShape key={o.id} walls={walls} opening={o} />
      ))}
      {walls.map((w) => (
        <WallDimension key={w.index} wall={w} distance={margin * 0.4} fontSize={font} label={`${Math.round(w.length)}`} />
      ))}
      <CompassBadge angle={northAngleDeg} x={b.x + b.w + margin * 0.5} y={b.y - margin * 0.5} size={margin * 0.7} />
    </svg>
  );
}
