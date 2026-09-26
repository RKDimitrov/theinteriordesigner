"use client";

import { memo } from "react";
import { pts, wallBand } from "@/components/plan-view/shapes";
import { doorLeaf, openingSpan } from "@/domain/geometry/openings";
import { area, bbox, offsetPolygon } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { add, cross, scale, sub, type Vec } from "@/domain/geometry/vec";
import { type Wall, wallsOf } from "@/domain/geometry/walls";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import type { Opening, Room } from "@/domain/schemas/room";

const INK = "#2b2622";
const SHEET = "#fbf6ec";
const CLAY = "#c8794a";
const W = PLANNER_WALL_CM;

interface Layers {
  walls: boolean;
  openings: boolean;
  electrical: boolean;
  floor: boolean;
}

/** Floor with a plank line every 20 cm. */
export const FloorPattern = memo(function FloorPattern({ k }: { k: number }) {
  return (
    <defs>
      <pattern id="pl-planks" patternUnits="userSpaceOnUse" width={120} height={20}>
        <rect width={120} height={20} fill="#f3e7d0" />
        <line x1={0} y1={19.6} x2={120} y2={19.6} stroke="#dcc9a8" strokeWidth={0.7 / k} />
      </pattern>
    </defs>
  );
});

/** Floor, walls as a solid band outside the interior line, and the openings cut into them. */
export const RoomShell = memo(function RoomShell({ room, layers, dim }: { room: Room; layers: Layers; dim: boolean }) {
  const walls = wallsOf(room.polygon);
  const outer = offsetPolygon(room.polygon, W);
  return (
    <g>
      <polygon points={pts(room.polygon)} fill={layers.floor ? "url(#pl-planks)" : SHEET} opacity={dim ? 0.4 : 1} data-testid={`room-floor-${room.id}`} />
      {room.fixedElements.map((f) => (
        <g key={f.id} opacity={dim ? 0.4 : 1}>
          <rect x={f.rect.x} y={f.rect.y} width={f.rect.w} height={f.rect.d} fill="#e8dcc6" stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <path d={`M${f.rect.x} ${f.rect.y}L${f.rect.x + f.rect.w} ${f.rect.y + f.rect.d}M${f.rect.x + f.rect.w} ${f.rect.y}L${f.rect.x} ${f.rect.y + f.rect.d}`} stroke={INK} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {layers.walls && <path d={`M${pts(outer)}Z M${pts(room.polygon)}Z`} fill={INK} fillRule="evenodd" />}
      {room.openings.map((o) => {
        const through = o.kind === "door" || o.kind === "window";
        if (through ? !layers.openings : !layers.electrical) return null;
        return <OpeningMark key={o.id} walls={walls} opening={o} />;
      })}
    </g>
  );
});

function OpeningMark({ walls, opening }: { walls: readonly Wall[]; opening: Opening }) {
  const span = openingSpan(walls, opening);
  if (!span) return null;
  const { wall, start, end } = span;
  const thin = { vectorEffect: "non-scaling-stroke" as const };
  const cut = <polygon points={pts(wallBand(start, end, wall, 0.5, W + 0.5))} fill={SHEET} />;
  switch (opening.kind) {
    case "window": {
      const lines = [0, W / 2, W].map((off) => [add(start, scale(wall.inward, -off)), add(end, scale(wall.inward, -off))] as const);
      const capA = [start, add(start, scale(wall.inward, -W))] as const;
      const capB = [end, add(end, scale(wall.inward, -W))] as const;
      return (
        <g data-opening-id={opening.id}>
          {cut}
          {[...lines, capA, capB].map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={1.2} {...thin} />
          ))}
        </g>
      );
    }
    case "door": {
      const leaf = doorLeaf(walls, opening);
      if (!leaf) {
        // Sliding door: a panel along the wall. Pass-through: just the gap.
        return (
          <g data-opening-id={opening.id}>
            {cut}
            {opening.swing === "sliding" && (
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={INK} strokeWidth={2.5} {...thin} transform={`translate(${-wall.inward.x * 3} ${-wall.inward.y * 3})`} />
            )}
          </g>
        );
      }
      const sweep = cross(sub(leaf.closedTip, leaf.hinge), sub(leaf.openTip, leaf.hinge)) > 0 ? 1 : 0;
      return (
        <g data-opening-id={opening.id}>
          {cut}
          <line x1={leaf.hinge.x} y1={leaf.hinge.y} x2={leaf.openTip.x} y2={leaf.openTip.y} stroke={INK} strokeWidth={2.5} {...thin} />
          <path
            d={`M ${leaf.closedTip.x} ${leaf.closedTip.y} A ${leaf.radius} ${leaf.radius} 0 0 ${sweep} ${leaf.openTip.x} ${leaf.openTip.y}`}
            fill="none"
            stroke={INK}
            strokeWidth={1.2}
            strokeDasharray="4 3"
            {...thin}
          />
        </g>
      );
    }
    case "radiator": {
      const a = add(start, scale(wall.inward, 3));
      const b = add(end, scale(wall.inward, 3));
      const band = wallBand(a, b, wall, opening.depth, 0);
      const fins: Vec[][] = [];
      for (let t = 6; t < opening.width - 3; t += 6) {
        const p = add(a, scale(wall.dir, t));
        fins.push([p, add(p, scale(wall.inward, opening.depth))]);
      }
      return (
        <g data-opening-id={opening.id}>
          <polygon points={pts(band)} fill={SHEET} stroke={INK} strokeWidth={1.2} {...thin} />
          {fins.map(([p, q], i) => (
            <line key={i} x1={p!.x} y1={p!.y} x2={q!.x} y2={q!.y} stroke={INK} strokeWidth={0.8} {...thin} />
          ))}
        </g>
      );
    }
    case "socket": {
      const c = add(add(start, scale(sub(end, start), 0.5)), scale(wall.inward, 6));
      const r = 5;
      const pin = (dx: number) => {
        const p = add(c, scale(wall.dir, dx));
        return <line x1={p.x - wall.inward.x * 2} y1={p.y - wall.inward.y * 2} x2={p.x + wall.inward.x * 2} y2={p.y + wall.inward.y * 2} stroke={INK} strokeWidth={1.2} {...thin} />;
      };
      return (
        <g data-opening-id={opening.id}>
          <circle cx={c.x} cy={c.y} r={r} fill={SHEET} stroke={INK} strokeWidth={1.2} {...thin} />
          {pin(-2)}
          {pin(2)}
        </g>
      );
    }
  }
}

/** Invisible wide hit areas for openings, drawn above furniture so they stay clickable. */
export function OpeningHits({ room, onDown, selectedId }: { room: Room; onDown: (o: Opening, e: React.PointerEvent) => void; selectedId: string | null }) {
  const walls = wallsOf(room.polygon);
  return (
    <g>
      {room.openings.map((o) => {
        const span = openingSpan(walls, o);
        if (!span) return null;
        const band = wallBand(span.start, span.end, span.wall, 22, W + 10);
        const sel = o.id === selectedId;
        return (
          <g key={o.id} data-testid={`opening-${o.id}`} onPointerDown={(e) => onDown(o, e)} style={{ cursor: "pointer" }}>
            <polygon points={pts(band)} fill="transparent" />
            {sel && (
              <polygon points={pts(wallBand(span.start, span.end, span.wall, 18, W + 6))} fill="none" stroke={CLAY} strokeWidth={1.3} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Mono dimension with slash ticks and a sheet knockout behind the label. */
function Dim({ a, b, wall, off, label, k }: { a: Vec; b: Vec; wall: Wall; off: number; label: string; k: number }) {
  const o = scale(wall.inward, -off);
  const p = add(a, o);
  const q = add(b, o);
  const mid = add(p, scale(sub(q, p), 0.5));
  let angle = (Math.atan2(wall.dir.y, wall.dir.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180;
  const fs = 10 / k;
  const tick = scale(add(wall.dir, scale(wall.inward, -1)), 4 / k);
  const tw = label.length * fs * 0.62 + 6 / k;
  return (
    <g>
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {[p, q].map((e, i) => (
        <line key={i} x1={e.x - tick.x} y1={e.y - tick.y} x2={e.x + tick.x} y2={e.y + tick.y} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <g transform={`rotate(${angle} ${mid.x} ${mid.y})`}>
        <rect x={mid.x - tw / 2} y={mid.y - fs * 0.7} width={tw} height={fs * 1.4} fill={SHEET} />
        <text x={mid.x} y={mid.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={INK} fontFamily="var(--mono)">
          {label}
        </text>
      </g>
    </g>
  );
}

/** Overall wall lengths 52 cm outside the wall, and a chain of openings at 30 cm. */
export const RoomDimensions = memo(function RoomDimensions({
  room,
  k,
  len,
  kindLabel,
}: {
  room: Room;
  k: number;
  len: (cm: number) => string;
  kindLabel: (o: Opening) => string;
}) {
  const walls = wallsOf(room.polygon);
  return (
    <g pointerEvents="none">
      {walls.map((w) => {
        const ops = room.openings
          .filter((o) => o.wallIndex === w.index && (o.kind === "door" || o.kind === "window"))
          .sort((a, b) => a.offset - b.offset);
        const pointAt = (t: number) => add(w.a, scale(w.dir, t));
        const chain: { from: number; to: number; label: string }[] = [];
        let cursor = 0;
        for (const o of ops) {
          if (o.offset > cursor + 1) chain.push({ from: cursor, to: o.offset, label: len(o.offset - cursor) });
          chain.push({ from: o.offset, to: o.offset + o.width, label: `${len(o.width)} ${kindLabel(o)}` });
          cursor = o.offset + o.width;
        }
        if (ops.length > 0 && w.length - cursor > 1) chain.push({ from: cursor, to: w.length, label: len(w.length - cursor) });
        return (
          <g key={w.index}>
            <Dim a={w.a} b={w.b} wall={w} off={W + 40} label={len(w.length)} k={k} />
            {chain.map((c, i) => (
              <Dim key={i} a={pointAt(c.from)} b={pointAt(c.to)} wall={w} off={W + 18} label={c.label} k={k} />
            ))}
          </g>
        );
      })}
    </g>
  );
});

/** Invisible band over the walls: grab a wall to move the whole room. */
export function WallGrip({ room, onDown }: { room: Room; onDown: (e: React.PointerEvent) => void }) {
  const outer = offsetPolygon(room.polygon, W);
  return <path d={`M${pts(outer)}Z M${pts(room.polygon)}Z`} fill="transparent" fillRule="evenodd" style={{ cursor: "move" }} onPointerDown={onDown} data-wall-grip={room.id} />;
}

/** Sheet box with the room name (serif) and area (mono), at the room's centre. Click-through, so pieces under it stay reachable. */
export function RoomLabel({ room, k }: { room: Room; k: number }) {
  const b = bbox(room.polygon);
  const c = { x: b.x + b.w / 2, y: b.y + b.d / 2 };
  const name = room.name;
  const areaText = `${m2(area(room.polygon)).toFixed(2)} m²`;
  const fsName = 14 / k;
  const fsArea = 8 / k;
  const w = Math.max(name.length * fsName * 0.5, areaText.length * fsArea * 0.62) + 16 / k;
  const h = fsName + fsArea + 12 / k;
  return (
    <g pointerEvents="none" data-room-label={room.id}>
      <rect x={c.x - w / 2} y={c.y - h / 2} width={w} height={h} fill={SHEET} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <text x={c.x} y={c.y - h / 2 + 5 / k + fsName * 0.85} fontSize={fsName} textAnchor="middle" fill={INK} fontFamily="var(--serif)">
        {name}
      </text>
      <text x={c.x} y={c.y + h / 2 - 5 / k} fontSize={fsArea} textAnchor="middle" fill={INK} fontFamily="var(--mono)">
        {areaText}
      </text>
    </g>
  );
}
