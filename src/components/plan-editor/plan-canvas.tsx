"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { bbox, isAxisAlignedRect } from "@/domain/geometry/polygon";
import { snap } from "@/domain/geometry/units";
import type { Vec } from "@/domain/geometry/vec";
import { nearestWall, wallOrientations, wallsOf, type Wall } from "@/domain/geometry/walls";
import type { OpeningKind, RoomShape } from "@/domain/schemas/room";
import { FixedElementShape, OpeningShape, RoomOutline, WallDimension } from "../plan-view/shapes";
import { CompassBadge } from "./compass";

export type Tool = "select" | OpeningKind;

export const MIN_ROOM_SIDE = 50;

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { type: "draw"; start: Vec; current: Vec }
  | { type: "resize"; edge: "right" | "bottom" | "corner" }
  | { type: "opening"; id: string; wall: Wall; grab: number }
  | { type: "pan"; startClient: Vec; startView: View };

interface PlanCanvasProps {
  /** null = nothing drawn yet: drag to draw a rectangle. */
  room: RoomShape | null;
  northAngleDeg: number;
  tool: Tool;
  selectedId: string | null;
  onDrawRect: (w: number, d: number) => void;
  onResize: (w: number, d: number) => void;
  onPlaceOpening: (kind: OpeningKind, wallIndex: number, centerOffset: number) => void;
  onMoveOpening: (id: string, offset: number) => void;
  onSelect: (id: string | null) => void;
}

function fitView(room: RoomShape | null): View {
  if (!room) return { x: -50, y: -50, w: 700, h: 525 };
  const b = bbox(room.polygon);
  const m = Math.max(b.w, b.d) * 0.2 + 30;
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.d + 2 * m };
}

export function PlanCanvas(props: PlanCanvasProps) {
  const { room, northAngleDeg, tool, selectedId } = props;
  const t = useTranslations("RoomEditor");
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(() => fitView(room));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ wall: Wall; offset: number } | null>(null);

  const walls = room ? wallsOf(room.polygon) : [];
  const dirs = room ? wallOrientations(room.polygon, northAngleDeg, room.wallOrientationOverrides) : [];
  const isRect = room ? isAxisAlignedRect(room.polygon) : false;
  const b = room ? bbox(room.polygon) : null;
  const unit = view.w / 100; // ~1% of the visible width, for handles and text
  const hitDist = Math.max(15, unit * 3);

  const toPlan = (e: { clientX: number; clientY: number }): Vec => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const zoom = (factor: number, center?: Vec) => {
    setView((v) => {
      const c = center ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const w = Math.min(5000, Math.max(100, v.w * factor));
      const k = w / v.w;
      return { x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k, w, h: v.h * k };
    });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const p = toPlan(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!room) {
      const s = { x: snap(p.x), y: snap(p.y) };
      setDrag({ type: "draw", start: s, current: s });
      return;
    }
    if (tool !== "select") {
      const hit = nearestWall(walls, p, hitDist);
      if (hit) props.onPlaceOpening(tool, hit.wall.index, hit.offset);
      return;
    }
    props.onSelect(null);
    setDrag({ type: "pan", startClient: { x: e.clientX, y: e.clientY }, startView: view });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    if (!drag) {
      if (room && tool !== "select") {
        const hit = nearestWall(walls, p, hitDist);
        setHover(hit ? { wall: hit.wall, offset: hit.offset } : null);
      }
      return;
    }
    switch (drag.type) {
      case "draw":
        setDrag({ ...drag, current: { x: snap(p.x), y: snap(p.y) } });
        break;
      case "resize": {
        if (!b) break;
        const w = drag.edge === "bottom" ? b.w : Math.max(MIN_ROOM_SIDE, snap(p.x - b.x));
        const d = drag.edge === "right" ? b.d : Math.max(MIN_ROOM_SIDE, snap(p.y - b.y));
        if (w !== b.w || d !== b.d) props.onResize(w, d);
        break;
      }
      case "opening": {
        const rel = { x: p.x - drag.wall.a.x, y: p.y - drag.wall.a.y };
        const along = rel.x * drag.wall.dir.x + rel.y * drag.wall.dir.y;
        props.onMoveOpening(drag.id, along - drag.grab);
        break;
      }
      case "pan": {
        const svg = svgRef.current;
        if (!svg) break;
        const k = drag.startView.w / svg.clientWidth;
        setView({
          ...drag.startView,
          x: drag.startView.x - (e.clientX - drag.startClient.x) * k,
          y: drag.startView.y - (e.clientY - drag.startClient.y) * k,
        });
        break;
      }
    }
  };

  const onPointerUp = () => {
    if (drag?.type === "draw") {
      const w = Math.abs(drag.current.x - drag.start.x);
      const d = Math.abs(drag.current.y - drag.start.y);
      if (w >= MIN_ROOM_SIDE && d >= MIN_ROOM_SIDE) props.onDrawRect(w, d);
    }
    setDrag(null);
  };

  // Single handlers that read data-* attributes (no per-item closures created during render).
  const onHandleDown = (e: React.PointerEvent<SVGElement>) => {
    const edge = e.currentTarget.dataset["edge"];
    if (edge !== "right" && edge !== "bottom" && edge !== "corner") return;
    e.stopPropagation();
    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
    setDrag({ type: "resize", edge });
  };

  const onOpeningDown = (e: React.PointerEvent<SVGGElement>) => {
    if (tool !== "select" || !room) return;
    const id = e.currentTarget.dataset["openingId"];
    const o = room.openings.find((x) => x.id === id);
    const wall = o ? walls[o.wallIndex] : undefined;
    if (!o || !wall) return;
    e.stopPropagation();
    props.onSelect(o.id);
    const p = toPlan(e);
    const along = (p.x - wall.a.x) * wall.dir.x + (p.y - wall.a.y) * wall.dir.y;
    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
    setDrag({ type: "opening", id: o.id, wall, grab: along - o.offset });
  };

  // Native listener: React registers wheel as passive, so it cannot stop page scroll.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1, toPlan(e));
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const listener = (e: WheelEvent) => onWheel(e);
    svg.addEventListener("wheel", listener, { passive: false });
    return () => svg.removeEventListener("wheel", listener);
  }, []);

  const draft = drag?.type === "draw" ? drag : null;
  const handle = unit * 1.6;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg border bg-muted/20">
        <svg
          ref={svgRef}
          data-testid="plan-canvas"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="aspect-[4/3] w-full touch-none select-none"
          style={{ cursor: !room ? "crosshair" : tool !== "select" ? "copy" : drag?.type === "pan" ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <pattern id="grid-minor" width={50} height={50} patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" className="fill-none stroke-border" strokeWidth={0.5} />
            </pattern>
            <pattern id="grid-major" width={100} height={100} patternUnits="userSpaceOnUse">
              <rect width={100} height={100} fill="url(#grid-minor)" />
              <path d="M 100 0 L 0 0 0 100" className="fill-none stroke-border" strokeWidth={1.2} />
            </pattern>
          </defs>
          <rect x={view.x - view.w} y={view.y - view.h} width={view.w * 3} height={view.h * 3} fill="url(#grid-major)" />

          {room && (
            <>
              <RoomOutline polygon={room.polygon} />
              {room.fixedElements.map((f) => (
                <FixedElementShape key={f.id} el={f} />
              ))}
              {room.openings.map((o) => (
                <OpeningShape key={o.id} walls={walls} opening={o} selected={o.id === selectedId} onPointerDown={onOpeningDown} />
              ))}
              {walls.map((w) => (
                <WallDimension
                  key={w.index}
                  wall={w}
                  distance={unit * 5}
                  fontSize={unit * 2.6}
                  label={`${t("wall")} ${w.index + 1} · ${Math.round(w.length)} cm · ${dirs[w.index]}`}
                />
              ))}
              {hover && (
                <line
                  x1={hover.wall.a.x}
                  y1={hover.wall.a.y}
                  x2={hover.wall.b.x}
                  y2={hover.wall.b.y}
                  className="stroke-blue-500/60"
                  strokeWidth={unit * 1.5}
                  pointerEvents="none"
                />
              )}
              {tool === "select" && isRect && b && (
                <g className="fill-blue-600 stroke-background" strokeWidth={unit * 0.3}>
                  <rect
                    data-testid="handle-right"
                    x={b.x + b.w - handle / 2}
                    y={b.y + b.d / 2 - handle}
                    width={handle}
                    height={handle * 2}
                    className="cursor-ew-resize"
                    data-edge="right"
                    onPointerDown={onHandleDown}
                  />
                  <rect
                    data-testid="handle-bottom"
                    x={b.x + b.w / 2 - handle}
                    y={b.y + b.d - handle / 2}
                    width={handle * 2}
                    height={handle}
                    className="cursor-ns-resize"
                    data-edge="bottom"
                    onPointerDown={onHandleDown}
                  />
                  <circle
                    data-testid="handle-corner"
                    cx={b.x + b.w}
                    cy={b.y + b.d}
                    r={handle}
                    className="cursor-nwse-resize"
                    data-edge="corner"
                    onPointerDown={onHandleDown}
                  />
                </g>
              )}
              {b && <CompassBadge angle={northAngleDeg} x={view.x + view.w - unit * 7} y={view.y + unit * 7} size={unit * 10} />}
            </>
          )}

          {draft && (
            <g pointerEvents="none">
              <rect
                x={Math.min(draft.start.x, draft.current.x)}
                y={Math.min(draft.start.y, draft.current.y)}
                width={Math.abs(draft.current.x - draft.start.x)}
                height={Math.abs(draft.current.y - draft.start.y)}
                className="fill-blue-500/10 stroke-blue-600"
                strokeWidth={unit * 0.4}
              />
              <text x={draft.current.x + unit * 2} y={draft.current.y + unit * 4} fontSize={unit * 3} className="fill-blue-700">
                {Math.abs(draft.current.x - draft.start.x)} × {Math.abs(draft.current.y - draft.start.y)} cm
              </text>
            </g>
          )}
        </svg>
        {!room && (
          <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-muted-foreground">{t("drawHint")}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" aria-label={t("zoomIn")} onClick={() => zoom(1 / 1.25)}>
          +
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label={t("zoomOut")} onClick={() => zoom(1.25)}>
          −
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setView(fitView(room))}>
          {t("fit")}
        </Button>
      </div>
    </div>
  );
}
