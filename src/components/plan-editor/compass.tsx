"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { snap } from "@/domain/geometry/units";
import { planAngle } from "@/domain/geometry/walls";
import { NumberField } from "@/components/wizard/fields";

const SIZE = 140;
const C = SIZE / 2;

/** North arrow; `angle` = plan angle of north (clockwise from plan up). */
function Arrow({ angle, r }: { angle: number; r: number }) {
  return (
    <g transform={`rotate(${angle})`}>
      <polygon points={`0,${-r} ${r * 0.22},0 0,${-r * 0.15} ${-r * 0.22},0`} className="fill-red-600" />
      <polygon points={`0,${r} ${r * 0.22},0 0,${r * 0.15} ${-r * 0.22},0`} className="fill-muted-foreground/40" />
      <text y={-r - 4} textAnchor="middle" className="fill-foreground text-[11px] font-semibold" transform={`rotate(${-angle} 0 ${-r - 8})`}>
        N
      </text>
    </g>
  );
}

export function CompassInput({ value, onChange }: { value: number; onChange: (deg: number) => void }) {
  const t = useTranslations("Compass");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const setFromPointer = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const v = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
    if (v.x === 0 && v.y === 0) return;
    onChange(snap(planAngle(v), 5) % 360);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        ref={svgRef}
        role="slider"
        aria-label={t("label")}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={value}
        tabIndex={0}
        width={SIZE}
        height={SIZE}
        viewBox={`${-C} ${-C} ${SIZE} ${SIZE}`}
        className="cursor-grab touch-none rounded-full border bg-muted/30 select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && setFromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((value + 5) % 360);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((value + 355) % 360);
        }}
      >
        <circle r={C - 6} className="fill-none stroke-border" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} y1={-(C - 6)} y2={-(C - 14)} transform={`rotate(${a})`} className="stroke-muted-foreground" />
        ))}
        <Arrow angle={value} r={C - 26} />
      </svg>
      <NumberField
        className="w-28"
        label={t("label")}
        value={value}
        min={0}
        max={359}
        suffix="°"
        onChange={(v) => v !== null && onChange(((Math.round(v) % 360) + 360) % 360)}
      />
    </div>
  );
}

/** Small read-only north indicator for plan views. */
export function CompassBadge({ angle, x, y, size = 36 }: { angle: number; x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <circle r={size / 2} className="fill-background/80 stroke-border" vectorEffect="non-scaling-stroke" />
      <Arrow angle={angle} r={size / 2 - 6} />
    </g>
  );
}
