"use client";

import { createContext, memo, use } from "react";
import { pts, wallBand } from "@/components/plan-view/shapes";
import { type DoorSwing, doorLeaves, openingSpan } from "@/domain/geometry/openings";
import { doorStyle, radiatorStyle, slides, windowStyle } from "@/domain/room/fit-out";
import { area, bbox, offsetPolygon } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { add, cross, scale, sub, type Vec } from "@/domain/geometry/vec";
import { type Wall, wallsOf } from "@/domain/geometry/walls";
import { fitLabel, labelWidth, openingChain } from "@/domain/planner/dimensions";
import type { DimensionTarget } from "@/domain/room/edit-dimensions";
import { PLANNER_WALL_CM } from "@/domain/planner/layout";
import { uprightAngle, type ViewRotation } from "@/domain/planner/view";
import { isCeilingKind, kitchenSlots } from "@/domain/room/fixtures";
import { slopeBands } from "@/domain/room/roof";
import type { FixedElement, Opening, Room } from "@/domain/schemas/room";

const INK = "#2b2622";
const SHEET = "#fbf6ec";
const CLAY = "#c8794a";
const W = PLANNER_WALL_CM;

/** How far the plan view is turned; labels turn back so they stay upright. */
export const ViewRotationContext = createContext<ViewRotation>(0);

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
      {/* Under a roof slope: thin diagonal hatching. */}
      <pattern id="pl-slope" patternUnits="userSpaceOnUse" width={12} height={12} patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={12} stroke="#b8a58a" strokeWidth={1.2 / k} />
      </pattern>
      <pattern id="pl-planks" patternUnits="userSpaceOnUse" width={120} height={20}>
        <rect width={120} height={20} fill="#f3e7d0" />
        <line x1={0} y1={19.6} x2={120} y2={19.6} stroke="#dcc9a8" strokeWidth={0.7 / k} />
      </pattern>
    </defs>
  );
});

/** Floor, walls as a solid band outside the interior line, and the openings cut into them. */
export const RoomShell = memo(function RoomShell({ room, layers, dim, k = 1 }: { room: Room; layers: Layers; dim: boolean; k?: number }) {
  const walls = wallsOf(room.polygon);
  const outer = offsetPolygon(room.polygon, W);
  return (
    <g>
      <polygon points={pts(room.polygon)} fill={layers.floor ? "url(#pl-planks)" : SHEET} opacity={dim ? 0.4 : 1} data-testid={`room-floor-${room.id}`} />
      <RoofSlopes room={room} k={k} dim={dim} />
      {room.fixedElements.map((f) => (
        <g key={f.id} opacity={dim ? 0.4 : 1}>
          <FixedMark f={f} />
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

/**
 * Where the roof cuts the ceiling: the strip along the wall is hatched, the
 * line where the full height starts is dashed, and a small label gives the
 * height at the wall and the full height.
 */
function RoofSlopes({ room, k, dim }: { room: Room; k: number; dim: boolean }) {
  const rot = use(ViewRotationContext);
  const bands = slopeBands(room);
  if (bands.length === 0) return null;
  const walls = wallsOf(room.polygon);
  return (
    <g pointerEvents="none" opacity={dim ? 0.4 : 1} data-roof-slopes={room.id}>
      {bands.map((b) => {
        const wall = walls[b.slope.wallIndex]!;
        const [p, q] = b.line;
        const mid = { x: (p.x + q.x) / 2 - wall.inward.x * (b.slope.depth / 2), y: (p.y + q.y) / 2 - wall.inward.y * (b.slope.depth / 2) };
        const angle = uprightAngle((Math.atan2(wall.dir.y, wall.dir.x) * 180) / Math.PI, rot);
        const fs = 8 / k;
        const text = `${b.slope.kneeHeight} → ${room.ceilingHeight}`;
        return (
          <g key={b.slope.wallIndex}>
            <polygon points={pts(b.polygon)} fill="url(#pl-slope)" opacity={0.7} />
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            <g transform={`rotate(${angle} ${mid.x} ${mid.y})`}>
              <rect x={mid.x - (text.length * fs * 0.32 + 3 / k)} y={mid.y - fs * 0.7} width={text.length * fs * 0.64 + 6 / k} height={fs * 1.4} fill={SHEET} opacity={0.9} />
              <text x={mid.x} y={mid.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={INK} fontFamily="var(--mono)">
                {text}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function OpeningMark({ walls, opening }: { walls: readonly Wall[]; opening: Opening }) {
  const span = openingSpan(walls, opening);
  if (!span) return null;
  const { wall, start, end } = span;
  const thin = { vectorEffect: "non-scaling-stroke" as const };
  const cut = <polygon points={pts(wallBand(start, end, wall, 0.5, W + 0.5))} fill={SHEET} />;
  switch (opening.kind) {
    case "window": {
      // Along the wall at depth `off` (0 = room face, W = outside face), from `t0` to `t1` of the width.
      const run = (off: number, t0 = 0, t1 = 1) => {
        const a = add(add(start, scale(sub(end, start), t0)), scale(wall.inward, -off));
        const b = add(add(start, scale(sub(end, start), t1)), scale(wall.inward, -off));
        return [a, b] as const;
      };
      const style = windowStyle(opening);
      const lines = [run(0), run(W), [start, add(start, scale(wall.inward, -W))] as const, [end, add(end, scale(wall.inward, -W))] as const];
      // Glass: sliding sashes overlap, a fixed pane is one heavy line, openable sashes one line.
      const glass = style === "sliding" ? [run(W / 3, 0, 0.6), run((2 * W) / 3, 0.4, 1)] : [run(W / 2)];
      return (
        <g data-opening-id={opening.id}>
          {cut}
          {lines.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={1.2} {...thin} />
          ))}
          {glass.map(([a, b], i) => (
            <line key={`g${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={style === "fixed" ? 2.4 : 1.2} {...thin} />
          ))}
          {style === "floor_to_ceiling" && (
            // Glazing down to the floor: dashed sill line on the room side.
            <line x1={run(-6)[0].x} y1={run(-6)[0].y} x2={run(-6)[1].x} y2={run(-6)[1].y} stroke={INK} strokeWidth={1} strokeDasharray="3 3" {...thin} />
          )}
        </g>
      );
    }
    case "door": {
      if (opening.swing === "none") return <g data-opening-id={opening.id}>{cut}</g>;
      const style = doorStyle(opening);
      if (slides(opening)) {
        const park = opening.hinge === "start" ? -1 : 1;
        // The leaf's closed position, and where it parks when open (towards the hinge end).
        const shift = scale(wall.dir, park * opening.width);
        const parkFrom = park < 0 ? start : end;
        const parkTo = add(parkFrom, shift);
        const inset = style === "pocket" ? -W / 2 : style === "barn" ? 6 : 4;
        const onFace = (p: Vec) => add(p, scale(wall.inward, inset));
        const [a, b] = [onFace(start), onFace(end)];
        const [pa, pb] = [onFace(parkFrom), onFace(parkTo)];
        return (
          <g data-opening-id={opening.id}>
            {cut}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={2.5} {...thin} />
            {/* Where the leaf runs to: inside the wall for a pocket door, along the face otherwise. */}
            <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={INK} strokeWidth={1} strokeDasharray="4 3" {...thin} />
            {style === "barn" && (
              // Rail above the leaf, spanning opening and parking run.
              <line x1={onFace(start).x + wall.inward.x * 3} y1={onFace(start).y + wall.inward.y * 3} x2={pb.x + wall.inward.x * 3} y2={pb.y + wall.inward.y * 3} stroke={INK} strokeWidth={0.8} {...thin} />
            )}
          </g>
        );
      }
      const glazed = style === "glazed" || style === "balcony";
      return (
        <g data-opening-id={opening.id}>
          {cut}
          {doorLeaves(walls, opening).map((leaf, i) => (
            <LeafMark key={i} leaf={leaf} glazed={glazed} fold={style === "bifold"} />
          ))}
        </g>
      );
    }
    case "radiator": {
      const style = radiatorStyle(opening);
      const a = add(start, scale(wall.inward, 3));
      const b = add(end, scale(wall.inward, 3));
      const band = wallBand(a, b, wall, opening.depth, 0);
      const step = style === "column" ? 3.5 : style === "towel" ? 12 : style === "convector" ? 4 : 6;
      const fins: Vec[][] = [];
      for (let t = step; t < opening.width - 3; t += step) {
        const p = add(a, scale(wall.dir, t));
        fins.push([p, add(p, scale(wall.inward, opening.depth))]);
      }
      return (
        <g data-opening-id={opening.id}>
          <polygon points={pts(band)} fill={SHEET} stroke={INK} strokeWidth={1.2} strokeDasharray={style === "convector" ? "4 2" : undefined} {...thin} />
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
    case "switch": {
      // The electrical symbol: a small circle with a slanted stroke.
      const c = add(add(start, scale(sub(end, start), 0.5)), scale(wall.inward, 6));
      const tip = add(c, add(scale(wall.inward, 8), scale(wall.dir, 5)));
      return (
        <g data-opening-id={opening.id}>
          <circle cx={c.x} cy={c.y} r={3.5} fill={INK} {...thin} />
          <line x1={c.x} y1={c.y} x2={tip.x} y2={tip.y} stroke={INK} strokeWidth={1.2} {...thin} />
        </g>
      );
    }
  }
}

/**
 * A fixed element in plan. Structure (chimney, column …) is a crossed box;
 * fixtures get their usual plan symbols, drawn in a frame where the fixture's
 * front faces down (+y) and then turned to its facing. Ceiling lights are
 * dashed, since they hang above the furniture.
 */
function FixedMark({ f }: { f: FixedElement }) {
  const thin = { vectorEffect: "non-scaling-stroke" as const, stroke: INK, strokeWidth: 1.2 };
  const { x, y, w: rw, d: rd } = f.rect;
  const cx = x + rw / 2;
  const cy = y + rd / 2;
  if (isCeilingKind(f.kind)) {
    const r = Math.min(rw, rd) / 2;
    const q = r * 0.7;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" strokeDasharray="4 3" {...thin} />
        <path d={`M${cx - q} ${cy - q}L${cx + q} ${cy + q}M${cx + q} ${cy - q}L${cx - q} ${cy + q}`} fill="none" {...thin} />
      </g>
    );
  }
  if (f.facing === undefined) {
    return (
      <>
        <rect x={x} y={y} width={rw} height={rd} fill="#e8dcc6" {...thin} />
        <path d={`M${x} ${y}L${x + rw} ${y + rd}M${x + rw} ${y}L${x} ${y + rd}`} strokeOpacity={0.45} fill="none" {...thin} />
      </>
    );
  }
  // Local frame: width along x, depth along y, back at −d/2, front at +d/2.
  const side = f.facing === 90 || f.facing === 270;
  const w = side ? rd : rw;
  const d = side ? rw : rd;
  const body = <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#f1ebe0" {...thin} />;
  let glyph: React.ReactNode = null;
  switch (f.kind) {
    case "kitchen_run": {
      const k = f.kitchen ?? { sink: true, hob: true, oven: true, wallUnits: true };
      const slots = kitchenSlots(w, { sink: k.sink, cooker: k.hob || k.oven });
      glyph = (
        <>
          {slots.slice(1).map((sl, i) => (
            <line key={i} x1={sl.from - w / 2} y1={-d / 2} x2={sl.from - w / 2} y2={d / 2} strokeOpacity={0.4} {...thin} />
          ))}
          {slots.map((sl, i) => {
            const mx = (sl.from + sl.to) / 2 - w / 2;
            if (sl.unit === "sink") return <rect key={`u${i}`} x={mx - 22} y={-d / 2 + 10} width={44} height={36} rx={6} fill="none" {...thin} />;
            if (sl.unit === "cooker")
              return (
                <g key={`u${i}`}>
                  {[-1, 1].flatMap((a) => [-1, 1].map((b) => <circle key={`${a}${b}`} cx={mx + a * 12} cy={b * 12} r={7} fill="none" {...thin} />))}
                </g>
              );
            return null;
          })}
        </>
      );
      break;
    }
    case "fridge":
      glyph = <path d={`M${-w / 2} ${-d / 2}L${w / 2} ${d / 2}`} fill="none" {...thin} />;
      break;
    case "wc":
      glyph = (
        <>
          <rect x={-w / 2} y={-d / 2} width={w} height={16} fill="#f1ebe0" {...thin} />
          <ellipse cx={0} cy={6} rx={w / 2 - 3} ry={d / 2 - 8} fill="none" {...thin} />
        </>
      );
      break;
    case "basin":
      glyph = <ellipse cx={0} cy={3} rx={w / 2 - 6} ry={d / 2 - 8} fill="none" {...thin} />;
      break;
    case "shower":
      glyph = (
        <>
          <path d={`M${-w / 2} ${-d / 2}L${w / 2} ${d / 2}M${w / 2} ${-d / 2}L${-w / 2} ${d / 2}`} strokeOpacity={0.5} fill="none" {...thin} />
          <circle cx={0} cy={0} r={3} fill={INK} />
        </>
      );
      break;
    case "bathtub":
      glyph = (
        <>
          <rect x={-w / 2 + 6} y={-d / 2 + 6} width={w - 12} height={d - 12} rx={Math.min(20, d / 3)} fill="none" {...thin} />
          <circle cx={-w / 2 + 22} cy={0} r={2.5} fill={INK} />
        </>
      );
      break;
  }
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${f.facing - 180})`}>
      {body}
      {glyph}
    </g>
  );
}

/** Invisible hit areas for fixed elements, with the selection outline. */
export function FixedHits({ room, onDown, selectedId }: { room: Room; onDown: (f: FixedElement, e: React.PointerEvent) => void; selectedId: string | null }) {
  return (
    <g>
      {room.fixedElements.map((f) => (
        <g key={f.id} data-testid={`fixed-${f.id}`} onPointerDown={(e) => onDown(f, e)} style={{ cursor: "pointer" }}>
          <rect x={f.rect.x} y={f.rect.y} width={f.rect.w} height={f.rect.d} fill="transparent" />
          {f.id === selectedId && (
            <rect x={f.rect.x - 5} y={f.rect.y - 5} width={f.rect.w + 10} height={f.rect.d + 10} fill="none" stroke={CLAY} strokeWidth={1.3} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          )}
        </g>
      ))}
    </g>
  );
}

/** One swinging leaf: the leaf itself and its dashed swing arc. Glazed leaves are drawn hollow; a bifold shows its fold. */
function LeafMark({ leaf, glazed, fold }: { leaf: DoorSwing; glazed: boolean; fold: boolean }) {
  const thin = { vectorEffect: "non-scaling-stroke" as const };
  const sweep = cross(sub(leaf.closedTip, leaf.hinge), sub(leaf.openTip, leaf.hinge)) > 0 ? 1 : 0;
  const mid = scale(add(leaf.hinge, leaf.openTip), 0.5);
  const out = scale(sub(leaf.closedTip, leaf.hinge), 0.25);
  return (
    <>
      {fold ? (
        // Folded panels: a zigzag from the hinge to the open tip.
        <polyline points={pts([leaf.hinge, add(mid, out), leaf.openTip])} fill="none" stroke={INK} strokeWidth={2.2} {...thin} />
      ) : (
        <line x1={leaf.hinge.x} y1={leaf.hinge.y} x2={leaf.openTip.x} y2={leaf.openTip.y} stroke={INK} strokeWidth={glazed ? 4 : 2.5} {...thin} />
      )}
      {glazed && <line x1={leaf.hinge.x} y1={leaf.hinge.y} x2={leaf.openTip.x} y2={leaf.openTip.y} stroke={SHEET} strokeWidth={1.6} {...thin} />}
      <path
        d={`M ${leaf.closedTip.x} ${leaf.closedTip.y} A ${leaf.radius} ${leaf.radius} 0 0 ${sweep} ${leaf.openTip.x} ${leaf.openTip.y}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.2}
        strokeDasharray="4 3"
        {...thin}
      />
    </>
  );
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

/** Mono dimension with slash ticks and a sheet knockout behind the label. `off` is cm outside the wall; negative is inside the room. */
function Dim({ a, b, wall, off, label, k, onPick }: { a: Vec; b: Vec; wall: Wall; off: number; label: string | null; k: number; onPick?: (e: React.MouseEvent) => void }) {
  const o = scale(wall.inward, -off);
  const p = add(a, o);
  const q = add(b, o);
  const mid = add(p, scale(sub(q, p), 0.5));
  const rot = use(ViewRotationContext);
  const angle = uprightAngle((Math.atan2(wall.dir.y, wall.dir.x) * 180) / Math.PI, rot);
  const fs = 10 / k;
  const tick = scale(add(wall.dir, scale(wall.inward, -1)), 4 / k);
  const tw = labelWidth(label ?? "", fs) + 6 / k;
  return (
    <g>
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {[p, q].map((e, i) => (
        <line key={i} x1={e.x - tick.x} y1={e.y - tick.y} x2={e.x + tick.x} y2={e.y + tick.y} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {label !== null && (
        <g
          transform={`rotate(${angle} ${mid.x} ${mid.y})`}
          // A figure that can be changed: click it to type a new value.
          {...(onPick
            ? { pointerEvents: "all", style: { cursor: "text" }, role: "button", "data-dim-edit": "", onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: onPick }
            : {})}
        >
          <rect x={mid.x - tw / 2} y={mid.y - fs * 0.7} width={tw} height={fs * 1.4} fill={SHEET} />
          <text x={mid.x} y={mid.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={INK} fontFamily="var(--mono)">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

/** Where a focused room's dimensions go on a wall it shares: inside the room, clear of the room next door. */
const INSIDE_CHAIN_CM = 16;
const INSIDE_LENGTH_CM = 38;

/**
 * Overall wall lengths 52 cm outside the wall, and a chain of openings at 30 cm.
 * A wall shared with another room has no outside: its dimensions would lie on
 * the neighbour's floor, so they show only for the room or wall in `focus`,
 * and then inside the room.
 */
export const RoomDimensions = memo(function RoomDimensions({
  room,
  k,
  len,
  kindLabel,
  shared,
  focus,
  onEdit,
}: {
  room: Room;
  k: number;
  len: (cm: number) => string;
  kindLabel: (o: Opening) => string;
  /** Per wall: true when another room lies on its other side. */
  shared: readonly boolean[];
  /** The whole room, one of its walls (by index), or nothing is being worked on. */
  focus: "room" | number | null;
  /** Click on a figure to change it: what it measures, its current length (cm) and where it was clicked. */
  onEdit?: (target: DimensionTarget, cm: number, e: React.MouseEvent) => void;
}) {
  const walls = wallsOf(room.polygon);
  const fs = 10 / k;
  return (
    <g pointerEvents="none">
      {walls.map((w) => {
        const inside = shared[w.index] ?? false;
        if (inside && focus !== "room" && focus !== w.index) return null;
        const ops = room.openings.filter((o) => o.wallIndex === w.index && (o.kind === "door" || o.kind === "window"));
        const pointAt = (t: number) => add(w.a, scale(w.dir, t));
        const chain = openingChain(w.length, ops);
        return (
          <g key={w.index}>
            <Dim a={w.a} b={w.b} wall={w} off={inside ? -(chain.length ? INSIDE_LENGTH_CM : INSIDE_CHAIN_CM) : W + 40} label={len(w.length)} k={k} onPick={onEdit && ((e) => onEdit({ kind: "wall", wallIndex: w.index }, w.length, e))} />
            {chain.map((c, i) => {
              const size = len(c.to - c.from);
              const o = c.opening === null ? undefined : ops[c.opening];
              // A stretch too short for its label keeps its ticks and drops the words, then the number.
              const label = fitLabel(o ? [`${size} ${kindLabel(o)}`, size] : [size], c.to - c.from, fs, 6 / k);
              // The opening itself, the stretch before the next opening, or the stretch after the last one.
              const next = ops[chain.slice(i + 1).find((x) => x.opening !== null)?.opening ?? -1];
              const prev = ops[[...chain.slice(0, i)].reverse().find((x) => x.opening !== null)?.opening ?? -1];
              const target: DimensionTarget | null = o ? { kind: "opening", openingId: o.id } : next ? { kind: "before", openingId: next.id } : prev ? { kind: "after", openingId: prev.id } : null;
              return <Dim key={i} a={pointAt(c.from)} b={pointAt(c.to)} wall={w} off={inside ? -INSIDE_CHAIN_CM : W + 18} label={label} k={k} onPick={onEdit && target ? (e) => onEdit(target, c.to - c.from, e) : undefined} />;
            })}
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
  const rot = use(ViewRotationContext);
  const b = bbox(room.polygon);
  const c = { x: b.x + b.w / 2, y: b.y + b.d / 2 };
  const name = room.name;
  const areaText = `${m2(area(room.polygon)).toFixed(2)} m²`;
  const fsName = 14 / k;
  const fsArea = 8 / k;
  const w = Math.max(name.length * fsName * 0.5, areaText.length * fsArea * 0.62) + 16 / k;
  const h = fsName + fsArea + 12 / k;
  return (
    <g pointerEvents="none" data-room-label={room.id} transform={`rotate(${-rot} ${c.x} ${c.y})`}>
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
