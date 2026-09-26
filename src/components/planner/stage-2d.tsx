"use client";

import { Copy, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import { itemFootprint } from "@/domain/geometry/obb";
import { area, bbox, containsPoint, rectPolygon, toClockwise } from "@/domain/geometry/polygon";
import { clamp, m2 } from "@/domain/geometry/units";
import { distance, sub, type Vec } from "@/domain/geometry/vec";
import { nearestWall, wallsOf } from "@/domain/geometry/walls";
import { newPlannerItem, snapTo, SYMBOL_OF, turn } from "@/domain/planner/items";
import { roomsBounds } from "@/domain/planner/layout";
import { clampOffset, newOpening, newPassThrough, nextId } from "@/domain/room/openings-edit";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Opening, OpeningKind } from "@/domain/schemas/room";
import { createRoomAction } from "@/server/actions/rooms";
import { PX_PER_CM, removeSelected, roomBox, SNAP_CM, usePlanner, useView, ZOOM_MAX, ZOOM_MIN } from "./planner-context";
import { FloorPattern, OpeningHits, RoomDimensions, RoomLabel, RoomShell, WallGrip } from "./plan-room";
import { inScope, mapItem, mapRoom, type Plan, type PlanRoom, type Tool } from "./state";
import { PieceSymbol } from "./symbols";

const CLAY = "#c8794a";
const CLAY_DARK = "#8e4f2f";
const FIT_PAD_CM = 85;
const OPENING_TOOLS: Partial<Record<Tool, OpeningKind | "pass">> = { door: "door", window: "window", pass: "pass", radiator: "radiator", socket: "socket" };

type Drag =
  | { kind: "pan"; start: Vec; pan0: Vec; moved: boolean }
  | { kind: "item"; roomId: string; id: string; start: Vec; x0: number; y0: number; moved: boolean }
  | { kind: "rotate"; roomId: string; id: string; center: Vec }
  | { kind: "opening"; roomId: string; id: string; start: Vec; offset0: number; moved: boolean }
  | { kind: "room"; roomId: string; start: Vec; origin0: Vec; moved: boolean }
  | { kind: "rect"; start: Vec; cur: Vec };

interface Popover {
  kind: "label" | "note";
  screen: Vec;
  world: Vec;
  roomId?: string;
  value: string;
}

export function Stage2D() {
  const t = useTranslations("Planner");
  const tk = useTranslations("OpeningKind");
  const { s, dispatch, data, len, unit, pieces, pieceName, toast } = usePlanner();
  const { v, setV, stage } = useView();
  const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [hoverWall, setHoverWall] = useState<{ roomId: string; a: Vec; b: Vec } | null>(null);
  const [measure, setMeasure] = useState<{ a: Vec; b?: Vec } | null>(null);
  const [dimStart, setDimStart] = useState<Vec | null>(null);
  const [wallPts, setWallPts] = useState<Vec[]>([]);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const [rect, setRect] = useState<{ a: Vec; b: Vec } | null>(null);
  const [panning, setPanning] = useState(false);

  const k = PX_PER_CM * v.zoom;
  const hidden = new Set(s.hidden);
  const plan = s.plan;
  const snap = (x: number) => (s.snap ? snapTo(x, SNAP_CM) : Math.round(x));
  const snapV = (p: Vec) => ({ x: snap(p.x), y: snap(p.y) });

  /* ---- size, fit, zoom ---- */
  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scopeBox = useCallback(() => {
    if (s.scope !== "all") return roomBox(plan, s.scope);
    return roomsBounds(
      plan.rooms.map((r) => ({ id: r.room.id, polygon: r.room.polygon })),
      new Map(Object.entries(plan.origins)),
    );
  }, [plan, s.scope]);

  const fit = useCallback(() => {
    const el = paper.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const b = scopeBox() ?? { x: 0, y: 0, w: 400, d: 300 };
    const zoom = clamp(Math.min(w / ((b.w + FIT_PAD_CM * 2) * PX_PER_CM), h / ((b.d + FIT_PAD_CM * 2) * PX_PER_CM)), ZOOM_MIN, 2.5);
    const kk = PX_PER_CM * zoom;
    setV(() => ({ zoom, pan: { x: w / 2 - (b.x + b.w / 2) * kk, y: h / 2 - (b.y + b.d / 2) * kk - 10 } }));
  }, [scopeBox, setV]);

  const zoomAt = useCallback(
    (factor: number, at?: Vec) => {
      setV((cur) => {
        const zoom = clamp(cur.zoom * factor, ZOOM_MIN, ZOOM_MAX);
        const m = at ?? { x: (paper.current?.clientWidth ?? 0) / 2, y: (paper.current?.clientHeight ?? 0) / 2 };
        const r = zoom / cur.zoom;
        return { zoom, pan: { x: m.x - (m.x - cur.pan.x) * r, y: m.y - (m.y - cur.pan.y) * r } };
      });
    },
    [setV],
  );

  const toWorld = useCallback((p: Vec): Vec => ({ x: (p.x - v.pan.x) / k, y: (p.y - v.pan.y) / k }), [v.pan, k]);
  useImperativeHandle(stage, () => ({ zoomBy: (f) => zoomAt(f), fit, toWorld }), [zoomAt, fit, toWorld]);

  // Fit on load (once the stage has a size) and whenever the scope changes.
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (size.w === 0 || fitted.current === s.scope) return;
    fitted.current = s.scope;
    fit();
  }, [size.w, s.scope, fit]);

  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Leaving a drawing tool drops its half-finished shape.
  const [toolSeen, setToolSeen] = useState(s.tool);
  if (toolSeen !== s.tool) {
    setToolSeen(s.tool);
    setWallPts([]);
    setMeasure(null);
    setDimStart(null);
    setHoverWall(null);
    setPopover(null);
  }

  /* ---- geometry helpers ---- */
  const local = (roomId: string, w: Vec): Vec => {
    const o = plan.origins[roomId] ?? { x: 0, y: 0 };
    return { x: w.x - o.x, y: w.y - o.y };
  };
  const scopeRooms = plan.rooms.filter((r) => inScope(s.scope, r.room.id));
  const roomAt = (w: Vec): PlanRoom | undefined => scopeRooms.find((r) => containsPoint(r.room.polygon, local(r.room.id, w)));
  const eventPoint = (e: { clientX: number; clientY: number }): Vec => {
    const r = paper.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const wallHit = (w: Vec) => {
    let best: { room: PlanRoom; hit: NonNullable<ReturnType<typeof nearestWall>> } | null = null;
    for (const r of scopeRooms) {
      const hit = nearestWall(wallsOf(r.room.polygon), local(r.room.id, w), Math.max(30, 24 / k));
      if (hit && (!best || hit.distance < best.hit.distance)) best = { room: r, hit };
    }
    return best;
  };

  /* ---- actions ---- */
  const select = (sel: typeof s.selection) => dispatch({ type: "select", selection: sel });

  const place = (w: Vec) => {
    const piece = pieces.find((p) => p.key === s.armed);
    if (!piece) return;
    const target = roomAt(w);
    if (!target) return toast(t("placeInside"));
    const p = snapV(local(target.room.id, w));
    const taken = plan.rooms.flatMap((r) => r.furniture.map((f) => f.id));
    const item = newPlannerItem(piece, p, pieceName(piece), taken);
    dispatch({ type: "edit", fn: (pl) => mapRoom(pl, target.room.id, (r) => ({ ...r, furniture: [...r.furniture, item] })) });
    dispatch({ type: "set", patch: { armed: null, selection: { kind: "item", roomId: target.room.id, id: item.id } } });
  };

  const addOpening = (w: Vec, kind: OpeningKind | "pass") => {
    const hit = wallHit(w);
    if (!hit) return toast(t("clickWall"));
    const { room, hit: h } = hit;
    const id = nextId(kind === "pass" ? "pass" : kind, room.room.openings.map((o) => o.id));
    const opening = kind === "pass" ? newPassThrough(id, h.wall.index, h.offset, h.wall.length) : newOpening(kind, id, h.wall.index, h.offset, h.wall.length);
    dispatch({ type: "edit", fn: (pl) => mapRoom(pl, room.room.id, (r) => ({ ...r, room: { ...r.room, openings: [...r.room.openings, opening] } })) });
    dispatch({ type: "select", selection: { kind: "opening", roomId: room.room.id, id } });
  };

  const createRoom = async (polygonWorld: Vec[]) => {
    const poly = toClockwise(polygonWorld.map(snapV));
    const b = bbox(poly);
    const shape = {
      name: t("newRoomName", { n: plan.rooms.length + 1 }),
      type: "other" as const,
      polygon: poly.map((p) => ({ x: p.x - b.x, y: p.y - b.y })),
      ceilingHeight: 250,
      openings: [],
      fixedElements: [],
      wallOrientationOverrides: {},
    };
    const res = await createRoomAction(data.apartment.id, shape);
    if (!res.ok) {
      sonner.error(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      return;
    }
    dispatch({ type: "add-room", room: { room: res.data, furniture: [] }, origin: { x: b.x, y: b.y } });
    toast(t("roomAdded", { name: res.data.name }));
  };

  /* ---- pointer handling ---- */
  const tool = s.tool;
  const drawing = tool !== "select" && tool !== "pan";

  const onPaperDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const sp = eventPoint(e);
    const w = toWorld(sp);
    paper.current?.setPointerCapture(e.pointerId);
    if (tool === "room") {
      const a = snapV(w);
      drag.current = { kind: "rect", start: a, cur: a };
      setRect({ a, b: a });
      return;
    }
    if (drawing && e.button === 0) return; // tools act on click (pointer up)
    drag.current = { kind: "pan", start: sp, pan0: v.pan, moved: false };
  };

  const onPaperMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sp = eventPoint(e);
    const w = toWorld(sp);
    setCursor(w);
    const d = drag.current;
    if (!d) {
      const kind = OPENING_TOOLS[tool];
      if (kind) {
        const hit = wallHit(w);
        if (hit) {
          const o = plan.origins[hit.room.room.id] ?? { x: 0, y: 0 };
          const width = Math.min(90, hit.hit.wall.length);
          const at = clamp(hit.hit.offset - width / 2, 0, hit.hit.wall.length - width);
          const a = { x: hit.hit.wall.a.x + hit.hit.wall.dir.x * at + o.x, y: hit.hit.wall.a.y + hit.hit.wall.dir.y * at + o.y };
          setHoverWall({ roomId: hit.room.room.id, a, b: { x: a.x + hit.hit.wall.dir.x * width, y: a.y + hit.hit.wall.dir.y * width } });
        } else setHoverWall(null);
      }
      return;
    }
    switch (d.kind) {
      case "pan": {
        const dx = sp.x - d.start.x;
        const dy = sp.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        setPanning(true);
        setV((cur) => ({ ...cur, pan: { x: d.pan0.x + dx, y: d.pan0.y + dy } }));
        return;
      }
      case "item": {
        const dx = w.x - d.start.x;
        const dy = w.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * k < 3) return;
        d.moved = true;
        dispatch({ type: "edit", fn: (pl) => mapItem(pl, d.roomId, d.id, (f) => ({ ...f, x: snap(d.x0 + dx), y: snap(d.y0 + dy) })) });
        return;
      }
      case "rotate": {
        const ang = (Math.atan2(w.y - d.center.y, w.x - d.center.x) * 180) / Math.PI + 90;
        const r = turn(Math.round(ang / 15) * 15, 0);
        dispatch({ type: "edit", fn: (pl) => mapItem(pl, d.roomId, d.id, (f) => (f.rotation === r ? f : { ...f, rotation: r })) });
        return;
      }
      case "opening": {
        const pr = plan.rooms.find((r) => r.room.id === d.roomId);
        const op = pr?.room.openings.find((o) => o.id === d.id);
        const wall = pr && op ? wallsOf(pr.room.polygon)[op.wallIndex] : undefined;
        if (!wall || !op) return;
        const along = (w.x - d.start.x) * wall.dir.x + (w.y - d.start.y) * wall.dir.y;
        if (!d.moved && Math.abs(along) * k < 3) return;
        d.moved = true;
        const offset = clampOffset(d.offset0 + along, op.width, wall.length);
        dispatch({
          type: "edit",
          fn: (pl) =>
            mapRoom(pl, d.roomId, (r) => ({ ...r, room: { ...r.room, openings: r.room.openings.map((o) => (o.id === d.id && o.offset !== offset ? { ...o, offset } : o)) } })),
        });
        return;
      }
      case "room": {
        const dx = w.x - d.start.x;
        const dy = w.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * k < 3) return;
        d.moved = true;
        const origin = { x: snap(d.origin0.x + dx), y: snap(d.origin0.y + dy) };
        dispatch({ type: "edit", fn: (pl) => ({ ...pl, origins: { ...pl.origins, [d.roomId]: origin } }) });
        return;
      }
      case "rect": {
        d.cur = snapV(w);
        setRect({ a: d.start, b: d.cur });
        return;
      }
    }
  };

  const onPaperUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (paper.current?.hasPointerCapture(e.pointerId)) paper.current.releasePointerCapture(e.pointerId);
    const w = toWorld(eventPoint(e));
    if (d && d.kind !== "pan" && d.kind !== "rect") {
      dispatch({ type: "gesture-end" });
      return;
    }
    if (d?.kind === "rect") {
      setRect(null);
      const wdt = Math.abs(d.cur.x - d.start.x);
      const dep = Math.abs(d.cur.y - d.start.y);
      if (wdt >= 50 && dep >= 50) void createRoom(rectPolygon(wdt, dep, Math.min(d.start.x, d.cur.x), Math.min(d.start.y, d.cur.y)));
      else toast(t("roomTooSmall"));
      return;
    }
    if (d?.kind === "pan" && d.moved) return;
    if (e.button !== 0) return;

    // A click on the paper.
    const kind = OPENING_TOOLS[tool];
    if (kind) return addOpening(w, kind);
    switch (tool) {
      case "select":
      case "pan":
        if (s.armed) return place(w);
        return select(null);
      case "measure":
        if (!measure || measure.b) return setMeasure({ a: snapV(w) });
        return setMeasure({ ...measure, b: snapV(w) });
      case "dimension": {
        if (!dimStart) return setDimStart(snapV(w));
        const b = snapV(w);
        const a = dimStart;
        setDimStart(null);
        if (distance(a, b) < 5) return;
        const id = nextId("dim", plan.annotations.map((x) => x.id));
        dispatch({ type: "edit", fn: (pl) => ({ ...pl, annotations: [...pl.annotations, { id, kind: "dimension", a, b }] }) });
        return;
      }
      case "wall": {
        const p = snapV(w);
        const first = wallPts[0];
        if (first && wallPts.length >= 3 && distance(first, p) * k < 12) {
          void createRoom(wallPts);
          setWallPts([]);
          return;
        }
        setWallPts((ps) => [...ps, p]);
        return;
      }
      case "label": {
        const r = roomAt(w);
        if (!r) return toast(t("placeInside"));
        return setPopover({ kind: "label", screen: eventPoint(e), world: w, roomId: r.room.id, value: r.room.name });
      }
      case "note":
        return setPopover({ kind: "note", screen: eventPoint(e), world: snapV(w), value: "" });
    }
  };

  const onDoubleClick = () => {
    if (tool === "wall" && wallPts.length >= 3) {
      void createRoom(wallPts);
      setWallPts([]);
    }
  };

  const startItemDrag = (r: PlanRoom, f: FurnitureItem, e: React.PointerEvent) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    paper.current?.setPointerCapture(e.pointerId);
    select({ kind: "item", roomId: r.room.id, id: f.id });
    dispatch({ type: "gesture-start" });
    drag.current = { kind: "item", roomId: r.room.id, id: f.id, start: toWorld(eventPoint(e)), x0: f.x, y0: f.y, moved: false };
  };

  const startRotate = (r: PlanRoom, f: FurnitureItem, e: React.PointerEvent) => {
    e.stopPropagation();
    paper.current?.setPointerCapture(e.pointerId);
    dispatch({ type: "gesture-start" });
    const o = plan.origins[r.room.id] ?? { x: 0, y: 0 };
    drag.current = { kind: "rotate", roomId: r.room.id, id: f.id, center: { x: f.x + o.x, y: f.y + o.y } };
  };

  const startOpeningDrag = (r: PlanRoom, o: Opening, e: React.PointerEvent) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    paper.current?.setPointerCapture(e.pointerId);
    select({ kind: "opening", roomId: r.room.id, id: o.id });
    dispatch({ type: "gesture-start" });
    drag.current = { kind: "opening", roomId: r.room.id, id: o.id, start: toWorld(eventPoint(e)), offset0: o.offset, moved: false };
  };

  const startRoomDrag = (r: PlanRoom, e: React.PointerEvent) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    paper.current?.setPointerCapture(e.pointerId);
    dispatch({ type: "gesture-start" });
    drag.current = { kind: "room", roomId: r.room.id, start: toWorld(eventPoint(e)), origin0: plan.origins[r.room.id] ?? { x: 0, y: 0 }, moved: false };
  };

  const submitPopover = () => {
    const p = popover;
    setPopover(null);
    if (!p) return;
    const value = p.value.trim();
    if (!value) return;
    if (p.kind === "label" && p.roomId) {
      const roomId = p.roomId;
      dispatch({ type: "edit", fn: (pl) => mapRoom(pl, roomId, (r) => (r.room.name === value ? r : { ...r, room: { ...r.room, name: value.slice(0, 60) } })) });
    } else if (p.kind === "note") {
      const id = nextId("note", plan.annotations.map((x) => x.id));
      dispatch({ type: "edit", fn: (pl) => ({ ...pl, annotations: [...pl.annotations, { id, kind: "note", a: p.world, text: value.slice(0, 200) }] }) });
    }
  };

  /* ---- derived drawing ---- */
  const selected = useMemo(() => {
    const sel = s.selection;
    if (sel?.kind !== "item") return null;
    const r = plan.rooms.find((x) => x.room.id === sel.roomId);
    const f = r?.furniture.find((x) => x.id === sel.id);
    return r && f ? { r, f } : null;
  }, [s.selection, plan]);

  const ftb = useMemo(() => {
    if (!selected) return null;
    const o = plan.origins[selected.r.room.id] ?? { x: 0, y: 0 };
    const corners = itemFootprint(selected.f).map((p) => ({ x: (p.x + o.x) * k + v.pan.x, y: (p.y + o.y) * k + v.pan.y }));
    const xs = corners.map((c) => c.x);
    const top = Math.min(...corners.map((c) => c.y));
    return { x: Math.max(120, (Math.min(...xs) + Math.max(...xs)) / 2) + 24, y: Math.max(34, top - 50 + 24) };
  }, [selected, plan.origins, k, v.pan]);

  const act = (a: "rot" | "dup" | "swap" | "del") => {
    if (!selected) return;
    const { r, f } = selected;
    if (a === "rot") dispatch({ type: "edit", fn: (pl) => mapItem(pl, r.room.id, f.id, (x) => ({ ...x, rotation: turn(x.rotation, 45) })) });
    if (a === "dup") {
      const taken = plan.rooms.flatMap((x) => x.furniture.map((y) => y.id));
      const id = nextId(f.id.replace(/-\d+$/, "").slice(0, 26), taken);
      const copy = { ...f, id, x: f.x + 20, y: f.y + 20, existing: false };
      dispatch({ type: "edit", fn: (pl) => mapRoom(pl, r.room.id, (x) => ({ ...x, furniture: [...x.furniture, copy] })) });
      select({ kind: "item", roomId: r.room.id, id });
    }
    if (a === "swap") {
      dispatch({ type: "set", patch: { swapFor: f.id, drawerOpen: true } });
      toast(t("swapPick", { name: f.name }));
    }
    if (a === "del") {
      dispatch({ type: "edit", fn: (pl) => removeSelected(pl, { kind: "item", roomId: r.room.id, id: f.id }) });
      select(null);
      toast(t("removed", { name: f.name }));
    }
  };

  const bounds = scopeBox();
  const scopeName = s.scope === "all" ? t("wholeApartment") : (plan.rooms.find((r) => r.room.id === s.scope)?.room.name ?? "");
  const scopeArea = scopeRooms.reduce((n, r) => n + m2(area(r.room.polygon)), 0);
  const cursorKind = panning ? "grabbing" : tool === "pan" ? "grab" : drawing ? "crosshair" : undefined;

  const M = 50 * k;
  const m = 10 * k;
  const step = v.zoom < 0.7 ? 100 : 50;
  const ticksX: number[] = [];
  const ticksY: number[] = [];
  for (let cm = Math.ceil(-v.pan.x / k / step) * step; cm * k + v.pan.x < size.w; cm += step) ticksX.push(cm);
  for (let cm = Math.ceil(-v.pan.y / k / step) * step; cm * k + v.pan.y < size.h; cm += step) ticksY.push(cm);

  const suggestions = hidden.has("suggestions")
    ? []
    : data.rooms.flatMap((pr) =>
        inScope(s.scope, pr.room.id)
          ? pr.suggestions
              .filter((sg) => sg.item && !s.skipped.includes(`${pr.room.id}:${sg.id}`))
              .filter((sg) => !plan.rooms.find((r) => r.room.id === pr.room.id)?.furniture.some((f) => f.id === sg.id))
              .map((sg) => ({ roomId: pr.room.id, sg }))
          : [],
      );

  const hint = s.armed ? t("hint_place", { name: pieceName(pieces.find((p) => p.key === s.armed)!) }) : t(`hint_${tool}`);

  return (
    <div className="pl-stage" data-testid="planner-stage">
      <div className="pl-corner">{unit}</div>
      <div className="pl-rx" style={{ backgroundSize: `${10 * k}px 6px`, backgroundPositionX: `${v.pan.x}px` }} aria-hidden>
        {ticksX.map((cm) => (
          <span key={cm} className="tk" style={{ left: v.pan.x + cm * k }}>
            {len(cm)}
          </span>
        ))}
      </div>
      <div className="pl-ry" style={{ backgroundSize: `6px ${10 * k}px`, backgroundPositionY: `${v.pan.y}px` }} aria-hidden>
        {ticksY.map((cm) => (
          <span key={cm} className="tk" style={{ top: v.pan.y + cm * k }}>
            {len(cm)}
          </span>
        ))}
      </div>
      <div
        ref={paper}
        className="pl-paper"
        data-testid="plan-canvas"
        data-cursor={cursorKind}
        data-nogrid={hidden.has("grid") ? "" : undefined}
        style={{
          backgroundSize: `${M}px ${M}px,${M}px ${M}px,${m}px ${m}px,${m}px ${m}px`,
          backgroundPosition: `${v.pan.x}px ${v.pan.y}px`,
        }}
        onPointerDown={onPaperDown}
        onPointerMove={onPaperMove}
        onPointerUp={onPaperUp}
        onPointerLeave={() => {
          setCursor(null);
          setHoverWall(null);
        }}
        onDoubleClick={onDoubleClick}
      >
        <svg role="img" aria-label={t("planLabel", { name: scopeName })}>
          <FloorPattern k={k} />
          <g transform={`translate(${v.pan.x} ${v.pan.y}) scale(${k})`}>
            {reference && bounds && !hidden.has("reference") && (
              <image href={reference} x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.d} opacity={0.45} preserveAspectRatio="xMidYMid meet" />
            )}
            <RoomsLayer plan={plan} scope={s.scope} hidden={s.hidden} k={k} selection={s.selection} tool={tool} onItemDown={startItemDrag} onRotateDown={startRotate} onOpeningDown={startOpeningDrag} onRoomDown={startRoomDrag} len={len} kindLabel={(o) => (o.kind === "door" && o.swing === "none" ? t("passShort") : tk(o.kind).toLowerCase())} />
            {suggestions.map(({ roomId, sg }) => {
              const o = plan.origins[roomId] ?? { x: 0, y: 0 };
              const f = sg.item!;
              return (
                <g
                  key={`${roomId}-${sg.id}`}
                  className="pl-ghost"
                  data-testid={`designer-suggestion-ghost-${sg.id}`}
                  transform={`translate(${o.x + f.x} ${o.y + f.y}) rotate(${f.rotation})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "set", patch: { tab2d: "designer" } });
                  }}
                >
                  <rect x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill={CLAY} fillOpacity={0.1} stroke={CLAY} strokeWidth={1.3} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
                  <text y={0} fontSize={8 / k} textAnchor="middle" dominantBaseline="central" fill={CLAY_DARK} fontFamily="var(--mono)" transform={`rotate(${-f.rotation})`} pointerEvents="none">
                    ✦ {sg.name.toLowerCase()}
                  </text>
                </g>
              );
            })}
            {!hidden.has("dimensions") &&
              plan.annotations.filter((a) => a.kind === "dimension" && a.b).map((a) => <FreeDim key={a.id} a={a.a} b={a.b!} k={k} label={len(distance(a.a, a.b!))} />)}
            {plan.annotations
              .filter((a) => a.kind === "note")
              .map((a) => (
                <text key={a.id} x={a.a.x} y={a.a.y} fontSize={16 / k} fill="#2b2622" fontStyle="italic" fontFamily="var(--serif)">
                  {a.text}
                </text>
              ))}
            {measure && (cursor || measure.b) && <FreeDim a={measure.a} b={measure.b ?? snapV(cursor!)} k={k} label={`${len(distance(measure.a, measure.b ?? snapV(cursor!)))} ${unit}`} accent />}
            {dimStart && cursor && <FreeDim a={dimStart} b={snapV(cursor)} k={k} label={len(distance(dimStart, snapV(cursor)))} accent />}
            {wallPts.length > 0 && (
              <polyline
                points={[...wallPts, ...(cursor ? [snapV(cursor)] : [])].map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={CLAY}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {rect && (
              <rect
                x={Math.min(rect.a.x, rect.b.x)}
                y={Math.min(rect.a.y, rect.b.y)}
                width={Math.abs(rect.b.x - rect.a.x)}
                height={Math.abs(rect.b.y - rect.a.y)}
                fill={CLAY}
                fillOpacity={0.08}
                stroke={CLAY}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {hoverWall && <line x1={hoverWall.a.x} y1={hoverWall.a.y} x2={hoverWall.b.x} y2={hoverWall.b.y} stroke={CLAY} strokeWidth={4} vectorEffect="non-scaling-stroke" />}
          </g>
        </svg>
      </div>

      <svg className="pl-compass" viewBox="-30 -30 60 60" aria-hidden>
        <circle r={26} fill="#fbf6ec" stroke="#2b2622" strokeWidth={1.2} />
        <circle r={21} fill="none" stroke="#b8a58a" strokeDasharray="2 3" />
        <g transform={`rotate(${data.apartment.northAngleDeg})`}>
          <path d="M0 -20L6 4 0 0-6 4Z" fill={CLAY} stroke="#2b2622" strokeWidth={1} />
          <path d="M0 20L4 4 0 0-4 4Z" fill="#fbf6ec" stroke="#2b2622" strokeWidth={1} />
          <text y={-22} x={-3} fontFamily="var(--mono)" fontSize={8} fontWeight={600}>
            N
          </text>
        </g>
      </svg>

      <dl className="pl-tb adv grid grid-cols-2 border-[1.5px] border-foreground bg-titleblock font-mono text-[11px]">
        {[
          [t("tbProject"), data.projectCode],
          [t("tbSheet"), scopeName],
          [t("tbScale"), "1 : 50"],
          [t("tbArea"), `${scopeArea.toFixed(2)} m²`],
        ].map(([key, value], i) => (
          <div key={key} className={["px-3 py-2", i % 2 === 0 ? "border-r border-foreground" : "", i < 2 ? "border-b border-foreground" : ""].join(" ")}>
            <dt className="text-[9.5px] tracking-[0.1em] text-muted-foreground uppercase">{key}</dt>
            <dd className="truncate text-[13px] font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {ftb && selected && tool === "select" && (
        <div className="pl-ftb" style={{ left: ftb.x, top: ftb.y }} role="toolbar" aria-label={t("pieceTools")}>
          <span className="pl-ftb-dim adv">
            {len(selected.f.w)} × {len(selected.f.d)}
          </span>
          <button type="button" onClick={() => act("rot")} title={t("rotate")} aria-label={t("rotate")}>
            <RotateCw className="ic" />
          </button>
          <button type="button" className="adv" onClick={() => act("dup")} title={t("duplicate")} aria-label={t("duplicate")}>
            <Copy className="ic" />
          </button>
          <button type="button" className="ai" onClick={() => act("swap")}>
            <Sparkles className="ic" /> {t("swap")}
          </button>
          <button type="button" onClick={() => act("del")} title={t("remove")} aria-label={t("remove")}>
            <Trash2 className="ic" />
          </button>
        </div>
      )}

      <div className="pl-tg pl-zfl calm-only" role="group" aria-label={t("zoom")}>
        <button type="button" onClick={() => zoomAt(1.2)} aria-label={t("zoomIn")}>
          +
        </button>
        <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label={t("zoomOut")}>
          −
        </button>
        <button type="button" onClick={fit} aria-label={t("fit")}>
          ⤢
        </button>
      </div>

      {popover && (
        <form
          className="pl-input-pop"
          style={{ left: Math.min(popover.screen.x + 24, size.w - 260), top: popover.screen.y + 24 }}
          onSubmit={(e) => {
            e.preventDefault();
            submitPopover();
          }}
        >
          <input
            autoFocus
            aria-label={popover.kind === "label" ? t("roomName") : t("noteLabel")}
            placeholder={popover.kind === "note" ? t("notePlaceholder") : undefined}
            value={popover.value}
            maxLength={popover.kind === "label" ? 60 : 200}
            onChange={(e) => setPopover({ ...popover, value: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && setPopover(null)}
          />
          <button type="submit" className="pl-chip">
            {t("ok")}
          </button>
        </form>
      )}

      <input
        id="pl-reference-input"
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setReference((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(file);
          });
          if (hidden.has("reference")) dispatch({ type: "toggle-layer", layer: "reference" });
        }}
      />

      <div className="pl-sbar">
        <span className="adv">{cursor ? t("cursor", { x: len(cursor.x), y: len(cursor.y), unit }) : t("cursor", { x: "—", y: "—", unit })}</span>
        <span className="adv">{t.rich("snapStatus", { n: s.snap ? SNAP_CM : 1, b: (c) => <b>{c}</b> })}</span>
        <span className="adv">{t.rich("wallsStatus", { n: 12, b: (c) => <b>{c}</b> })}</span>
        <span>{wallPts.length > 0 ? t("hint_wall_more") : hint}</span>
      </div>
    </div>
  );
}

/** A free dimension between two points (measure tool, pinned dimensions). */
function FreeDim({ a, b, k, label, accent }: { a: Vec; b: Vec; k: number; label: string; accent?: boolean }) {
  const color = accent ? CLAY_DARK : "#2b2622";
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y) || 1;
  const n = { x: -d.y / len, y: d.x / len };
  const tick = 4 / k;
  let angle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const fs = 10 / k;
  const tw = label.length * fs * 0.62 + 6 / k;
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray={accent ? "5 3" : undefined} />
      {[a, b].map((p, i) => (
        <line key={i} x1={p.x - n.x * tick} y1={p.y - n.y * tick} x2={p.x + n.x * tick} y2={p.y + n.y * tick} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <g transform={`rotate(${angle} ${mid.x} ${mid.y})`}>
        <rect x={mid.x - tw / 2} y={mid.y - fs * 0.7} width={tw} height={fs * 1.4} fill="#fbf6ec" />
        <text x={mid.x} y={mid.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={color} fontFamily="var(--mono)">
          {label}
        </text>
      </g>
    </g>
  );
}

interface RoomsLayerProps {
  plan: Plan;
  scope: string;
  hidden: readonly string[];
  k: number;
  selection: ReturnType<typeof usePlanner>["s"]["selection"];
  tool: Tool;
  onItemDown: (r: PlanRoom, f: FurnitureItem, e: React.PointerEvent) => void;
  onRotateDown: (r: PlanRoom, f: FurnitureItem, e: React.PointerEvent) => void;
  onOpeningDown: (r: PlanRoom, o: Opening, e: React.PointerEvent) => void;
  onRoomDown: (r: PlanRoom, e: React.PointerEvent) => void;
  len: (cm: number) => string;
  kindLabel: (o: Opening) => string;
}

const LAYER_ORDER: Record<FurnitureItem["placement"], number> = { floor_covering: 0, floor: 1, wall: 2, ceiling: 3 };

/** Every room: shell, furniture, labels, dimensions and the selection box. */
const RoomsLayer = memo(function RoomsLayer({ plan, scope, hidden, k, selection, tool, onItemDown, onRotateDown, onOpeningDown, onRoomDown, len, kindLabel }: RoomsLayerProps) {
  const off = new Set(hidden);
  const layers = { walls: !off.has("walls"), openings: !off.has("openings"), electrical: !off.has("electrical"), floor: !off.has("floor") };
  return (
    <>
      {plan.rooms.map((r) => {
        const o = plan.origins[r.room.id] ?? { x: 0, y: 0 };
        const active = inScope(scope, r.room.id);
        return (
          <g key={r.room.id} transform={`translate(${o.x} ${o.y})`} data-room={r.room.id}>
            <RoomShell room={r.room} layers={layers} dim={!active} />
            {!off.has("furniture") &&
              [...r.furniture]
                .sort((a, b) => LAYER_ORDER[a.placement] - LAYER_ORDER[b.placement])
                .map((f) => {
                  const sel = selection?.kind === "item" && selection.id === f.id && selection.roomId === r.room.id;
                  return (
                    <g
                      key={f.id}
                      className="pl-piece"
                      data-testid={`plan-item-${f.id}`}
                      data-dim={active ? undefined : ""}
                      transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
                      onPointerDown={(e) => onItemDown(r, f, e)}
                      style={{ cursor: tool === "select" ? "move" : undefined }}
                    >
                      <g className="pl-sym" transform={`translate(${-f.w / 2} ${-f.d / 2})`}>
                        <PieceSymbol kind={SYMBOL_OF[f.category]} w={f.w} d={f.d} color={f.colorHex} />
                      </g>
                      {sel && <SelectionBox f={f} k={k} onRotateDown={(e) => onRotateDown(r, f, e)} />}
                    </g>
                  );
                })}
            {active && tool === "select" && layers.walls && <WallGrip room={r.room} onDown={(e) => onRoomDown(r, e)} />}
            {active && tool === "select" && layers.openings && (
              <OpeningHits room={r.room} onDown={(op, e) => onOpeningDown(r, op, e)} selectedId={selection?.kind === "opening" && selection.roomId === r.room.id ? selection.id : null} />
            )}
            {!off.has("labels") && <RoomLabel room={r.room} k={k} />}
            {!off.has("dimensions") && active && <RoomDimensions room={r.room} k={k} len={len} kindLabel={kindLabel} />}
          </g>
        );
      })}
    </>
  );
});

/** Clay dashed box 5 cm out, four sheet handles and a rotate handle 22 cm above the back edge. */
function SelectionBox({ f, k, onRotateDown }: { f: FurnitureItem; k: number; onRotateDown: (e: React.PointerEvent) => void }) {
  const hw = f.w / 2 + 5;
  const hd = f.d / 2 + 5;
  const hs = 7;
  const thin = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <g>
      <rect x={-hw} y={-hd} width={hw * 2} height={hd * 2} fill="none" stroke={CLAY} strokeWidth={1.3} strokeDasharray="5 3" {...thin} pointerEvents="none" />
      {[
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ].map(([x, y], i) => (
        <rect key={i} x={x! - hs / 2} y={y! - hs / 2} width={hs} height={hs} fill="#fbf6ec" stroke={CLAY} strokeWidth={1.3} {...thin} pointerEvents="none" />
      ))}
      <line x1={0} y1={-hd} x2={0} y2={-hd - 22} stroke={CLAY} strokeWidth={1.3} {...thin} pointerEvents="none" />
      <circle cx={0} cy={-hd - 22} r={Math.max(5, 7 / k)} fill={CLAY} stroke="#fbf6ec" strokeWidth={1} {...thin} style={{ cursor: "grab" }} onPointerDown={onRotateDown} data-testid="rotate-handle" />
    </g>
  );
}
