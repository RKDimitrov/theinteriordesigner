"use client";

import { useTranslations } from "next-intl";
import { itemFootprint } from "@/domain/geometry/obb";
import { bbox } from "@/domain/geometry/polygon";
import { add, scale, sub, type Vec } from "@/domain/geometry/vec";
import { wallsOf } from "@/domain/geometry/walls";
import type { DesignContent, FurnitureItem } from "@/domain/schemas/design";
import type { RoomShape } from "@/domain/schemas/room";
import { cn } from "@/lib/utils";
import { CompassBadge } from "../plan-editor/compass";
import { OpeningShape, RoomOutline, WallDimension } from "../plan-view/shapes";

const pts = (ps: readonly Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

interface Props {
  room: RoomShape;
  northAngleDeg: number;
  design: DesignContent;
  /** Ids of items with errors (red) and the currently selected item. */
  errorIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const LAYER_ORDER: Record<FurnitureItem["placement"], number> = { floor_covering: 0, floor: 1, wall: 2, ceiling: 3 };

export function DesignPlan({ room, northAngleDeg, design, errorIds, selectedId, onSelect }: Props) {
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
    >
      <RoomOutline polygon={room.polygon} />
      {design.zones.map((z) => (
        <g key={z.id}>
          <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.d} className="fill-none stroke-muted-foreground/60" strokeWidth={1} strokeDasharray="10 8" />
          <text x={z.rect.x + 4} y={z.rect.y + font} fontSize={font * 0.8} className="fill-muted-foreground">
            {z.name}
          </text>
        </g>
      ))}

      {items.map((f) => {
        const poly = itemFootprint(f);
        const selected = f.id === selectedId;
        const error = errorIds.has(f.id);
        const front = scale(add(poly[2]!, poly[3]!), 0.5);
        const back = scale(add(poly[0]!, poly[1]!), 0.5);
        const tick = add(front, scale(sub(back, front), 0.12));
        return (
          <g
            key={f.id}
            data-testid={`plan-item-${f.id}`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? null : f.id);
            }}
          >
            <polygon
              points={pts(poly)}
              fill={f.colorHex}
              fillOpacity={f.placement === "floor_covering" ? 0.35 : 0.85}
              className={cn("stroke-foreground", error && "stroke-destructive", selected && "stroke-blue-600")}
              strokeWidth={error || selected ? 4 : 1.5}
              strokeDasharray={f.placement === "wall" ? "8 6" : undefined}
            />
            {f.placement === "floor" && <line x1={front.x} y1={front.y} x2={tick.x} y2={tick.y} className="stroke-foreground/70" strokeWidth={1.5} />}
            <text x={f.x} y={f.y} fontSize={font} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none fill-foreground">
              {f.name.length > 18 ? `${f.name.slice(0, 17)}…` : f.name}
            </text>
          </g>
        );
      })}

      {design.lighting
        .filter((l) => l.position && (l.mount === "ceiling" || l.mount === "wall"))
        .map((l) => (
          <circle key={l.id} cx={l.position!.x} cy={l.position!.y} r={font * 0.8} className="fill-yellow-200 stroke-foreground" strokeWidth={1.5} strokeDasharray="4 3" />
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
