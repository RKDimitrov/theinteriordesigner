"use client";

import { useTranslations } from "next-intl";
import { createContext, type Dispatch, type ReactNode, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { area, bbox } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import type { Vec } from "@/domain/geometry/vec";
import { blankDesign, type CataloguePiece, cataloguePieces, withFurniture } from "@/domain/planner/items";
import { fromLegacy } from "@/domain/materials/library";
import { floorOrigins } from "@/domain/planner/floor-layout";
import { layoutRooms } from "@/domain/planner/layout";
import type { ViewRotation } from "@/domain/planner/view";
import { checkRoom, type RoomIssue } from "@/domain/room/check-room";
import { removeOpening } from "@/domain/room/inner-walls";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Room, RoomShape } from "@/domain/schemas/room";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { validateDesign } from "@/domain/validator";
import { saveRoomFinishesAction, savePlannerRoomAction, saveRoomPositionsAction } from "@/server/actions/planner";
import { updateRoomAction } from "@/server/actions/rooms";
import type { PlannerData } from "@/server/planner";
import { copySelection, type Clip, nudgeSelection, pasteClip, turnSelection } from "./edit-ops";
import { matchShortcut } from "./shortcuts";
import { type Action, type Annotation, initialState, type SavedView, type Plan, type PlannerState, type PlannerView, reducer, TOOLS, type Units } from "./state";

/* ---------- plan context ---------- */

export interface RoomChecks {
  room: RoomIssue[];
  design: ValidationIssue[];
}

type SaveState = "saved" | "saving" | "error";

interface PlannerCtx {
  s: PlannerState;
  dispatch: Dispatch<Action>;
  data: PlannerData;
  view: PlannerView;
  pieces: CataloguePiece[];
  pieceName: (p: CataloguePiece) => string;
  /** Length in the chosen display unit, e.g. "210" or "82.7". */
  len: (cm: number) => string;
  unit: string;
  checks: Map<string, RoomChecks>;
  save: { state: SaveState; at: Date | null };
  /** Save pending edits now (e.g. before a redesign reads them). */
  flush: () => Promise<void>;
  toast: (message: string) => void;
  toastMessage: string | null;
  /** Area in m² of a room. */
  roomArea: (roomId: string) => number;
}

const Ctx = createContext<PlannerCtx | null>(null);

export function usePlanner(): PlannerCtx {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("usePlanner outside PlannerProvider");
  return ctx;
}

/* ---------- view context (zoom and pan change often; kept apart so panels do not re-render) ---------- */

export interface ViewState {
  zoom: number;
  pan: Vec;
  /** Quarter turns of the plan view; the rooms do not change. */
  rot: ViewRotation;
}

export interface StageApi {
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** Screen (stage-relative px) to apartment cm. */
  toWorld: (p: Vec) => Vec;
  /** The pointer on the plan (apartment cm), or null when it is off the plan. */
  cursor: () => Vec | null;
  /** True while the wall tool has corners down. */
  drawing: () => boolean;
  /** Close the outline being drawn into a room. */
  finish: () => void;
  /** Take back the last corner drawn. */
  back: () => void;
  /** Turn the plan view a quarter: 1 clockwise, −1 back. */
  rotateView: (dir: 1 | -1) => void;
}

interface ViewCtx {
  v: ViewState;
  setV: (fn: (v: ViewState) => ViewState) => void;
  stage: React.RefObject<StageApi | null>;
}

const ViewContext = createContext<ViewCtx | null>(null);

export function useView(): ViewCtx {
  const ctx = use(ViewContext);
  if (!ctx) throw new Error("useView outside PlannerProvider");
  return ctx;
}

/** px per cm at 100 % zoom. */
export const PX_PER_CM = 1.2;
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 3;
export const SNAP_CM = 5;

/* ---------- local persistence for data that has no column yet ---------- */

interface LocalPlan {
  origins?: Record<string, Vec>;
  annotations?: Annotation[];
  /** Finishes were kept here before Room.finishes existed; read once and moved to the rooms. */
  finishes?: Record<string, unknown>;
  savedViews?: SavedView[];
}

const localKey = (apartmentId: string) => `rp-planner:${apartmentId}`;

function readLocal(apartmentId: string): LocalPlan {
  try {
    const raw = window.localStorage.getItem(localKey(apartmentId));
    return raw ? (JSON.parse(raw) as LocalPlan) : {};
  } catch {
    return {};
  }
}

function writeLocal(apartmentId: string, value: LocalPlan) {
  try {
    window.localStorage.setItem(localKey(apartmentId), JSON.stringify(value));
  } catch {
    // Private mode or full storage: positions just are not remembered.
  }
}

/** Positions saved with the rooms; rooms never placed are left out. */
const storedOrigins = (rooms: readonly { room: Room }[]): Map<string, Vec> => new Map(rooms.flatMap((r) => (r.room.plan ? [[r.room.id, r.room.plan] as const] : [])));

function initialPlan(data: PlannerData): Plan {
  const rooms = data.rooms.map((r) => ({ room: r.room, furniture: r.design?.furniture ?? [] }));
  const origins = Object.fromEntries(floorOrigins(rooms.map((r) => ({ id: r.room.id, polygon: r.room.polygon, plan: r.room.plan }))));
  return { rooms, origins, annotations: [] };
}

/* ---------- provider ---------- */

export function PlannerProvider({
  data,
  scope,
  view,
  arm = null,
  children,
}: {
  data: PlannerData;
  scope: "all" | string;
  view: PlannerView;
  arm?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations("Planner");
  const tf = useTranslations("FurnitureCategory");
  const [s, dispatch] = useReducer(reducer, undefined, () => {
    const st = initialState(initialPlan(data), scope, null, data.apartment.fitOut);
    const valid = arm !== null && cataloguePieces(data.mustKeep).some((p) => p.key === arm);
    return valid ? { ...st, armed: arm, drawerOpen: true } : st;
  });
  const [v, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 }, rot: 0 });
  const setV = useCallback((fn: (v: ViewState) => ViewState) => setViewState(fn), []);
  const stage = useRef<StageApi | null>(null);
  const units: Units = s.units;

  // Restore room positions and notes kept on this device, once.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const local = readLocal(data.apartment.id);
    if (local.savedViews) dispatch({ type: "set", patch: { savedViews: local.savedViews } });
    // Finishes chosen before they were saved to the room: move them to rooms that have none yet.
    const legacy = Object.entries(local.finishes ?? {}).flatMap(([roomId, raw]) => {
      const room = data.rooms.find((r) => r.room.id === roomId)?.room;
      const f = fromLegacy(raw);
      const unset = room && !room.finishes.floor && !room.finishes.walls && !room.finishes.ceiling;
      return f && unset ? [{ roomId, finishes: f }] : [];
    });
    if (legacy.length) {
      dispatch({ type: "set", patch: { finishes: { ...Object.fromEntries(data.rooms.map((r) => [r.room.id, r.room.finishes])), ...Object.fromEntries(legacy.map((l) => [l.roomId, l.finishes])) } } });
      void saveRoomFinishesAction({ apartmentId: data.apartment.id, rooms: legacy }).catch(() => undefined);
    }
    if (!local.origins && !local.annotations) return;
    dispatch({
      type: "edit",
      transient: true,
      fn: (p) => {
        // Saved positions win; this device's positions fill in rooms not saved yet.
        const stored = storedOrigins(p.rooms);
        const known = new Map([...Object.entries(local.origins ?? {}).filter(([id]) => p.rooms.some((r) => r.room.id === id) && !stored.has(id)), ...stored]);
        const origins = Object.fromEntries(layoutRooms(p.rooms.map((r) => ({ id: r.room.id, polygon: r.room.polygon })), known));
        return { ...p, origins, annotations: local.annotations ?? [] };
      },
    });
    stage.current?.fit();
  }, [data.apartment.id, data.rooms]);

  // Save room positions with the rooms once the user moves one; the first arrangement is not a change.
  const savedOrigins = useRef<Record<string, Vec> | null>(null);
  useEffect(() => {
    if (!restored.current) return;
    if (savedOrigins.current === null) {
      savedOrigins.current = s.plan.origins;
      return;
    }
    const before = savedOrigins.current;
    const moved = Object.entries(s.plan.origins).filter(([id, o]) => !before[id] || before[id].x !== o.x || before[id].y !== o.y);
    if (moved.length === 0) return;
    const timer = window.setTimeout(() => {
      savedOrigins.current = s.plan.origins;
      void saveRoomPositionsAction({ apartmentId: data.apartment.id, rooms: moved.map(([roomId, o]) => ({ roomId, x: o.x, y: o.y })) }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data.apartment.id, s.plan.origins]);

  useEffect(() => {
    if (!restored.current) return;
    writeLocal(data.apartment.id, { origins: s.plan.origins, annotations: s.plan.annotations, savedViews: s.savedViews });
  }, [data.apartment.id, s.plan.origins, s.plan.annotations, s.savedViews]);

  /* ---- live checks: the same rules the server runs ---- */
  const checks = useMemo(() => {
    const out = new Map<string, RoomChecks>();
    for (const r of s.plan.rooms) {
      const info = data.rooms.find((x) => x.room.id === r.room.id);
      const roomIssues = checkRoom(r.room);
      let design: ValidationIssue[] = [];
      if (roomIssues.length === 0 && (r.furniture.length > 0 || info?.design)) {
        design = validateDesign({
          room: r.room,
          design: designFor(info, r.furniture),
          mustKeep: info?.mustKeep ?? [],
          budgetEur: info?.budgetEur ?? null,
          renter: data.renter,
        });
      }
      out.set(r.room.id, { room: roomIssues, design });
    }
    return out;
  }, [s.plan.rooms, data]);

  /* ---- autosave ---- */
  const [save, setSave] = useState<{ state: SaveState; at: Date | null }>({ state: "saved", at: data.savedAt ? new Date(data.savedAt) : null });
  const saved = useRef(new Map(s.plan.rooms.map((r) => [r.room.id, { furniture: JSON.stringify(r.furniture), room: JSON.stringify(r.room) }])));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastMessage, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const latestPlan = useRef(s.plan);
  const latestChecks = useRef(checks);
  useEffect(() => {
    latestPlan.current = s.plan;
    latestChecks.current = checks;
  });

  const flush = useCallback(async () => {
    const plan = latestPlan.current;
    const jobs: Promise<boolean>[] = [];
    for (const r of plan.rooms) {
      const last = saved.current.get(r.room.id) ?? { furniture: "[]", room: "" };
      const roomJson = JSON.stringify(r.room);
      const furnJson = JSON.stringify(r.furniture);
      // A room outline with problems is not saved until it is fixed; Checks shows why.
      const roomOk = (latestChecks.current.get(r.room.id)?.room.length ?? 0) === 0;
      if (roomJson !== last.room && roomOk) {
        const id = r.room.id;
        jobs.push(
          updateRoomAction(id, roomShape(r.room)).then((res) => {
            if (res.ok) saved.current.set(id, { ...(saved.current.get(id) ?? last), room: roomJson });
            return res.ok;
          }),
        );
      }
      if (furnJson !== last.furniture && roomOk) {
        jobs.push(
          savePlannerRoomAction({ apartmentId: data.apartment.id, roomId: r.room.id, furniture: r.furniture }).then((res) => {
            if (res.ok) saved.current.set(r.room.id, { ...(saved.current.get(r.room.id) ?? last), furniture: furnJson });
            return res.ok;
          }),
        );
      }
    }
    if (jobs.length === 0) return;
    setSave((x) => ({ ...x, state: "saving" }));
    const results = await Promise.all(jobs.map((j) => j.catch(() => false)));
    const ok = results.every(Boolean);
    setSave({ state: ok ? "saved" : "error", at: ok ? new Date() : null });
    if (!ok) toast(t("saveError"));
  }, [data.apartment.id, t, toast]);

  useEffect(() => {
    if (s.gestureBase) return; // wait for the drag to finish
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [s.plan.rooms, s.gestureBase, flush]);

  // Save pending edits when leaving the page.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  /* ---- keyboard ---- */
  const sRef = useRef(s);
  const clip = useRef<Clip | null>(null);
  const toastRef = useRef<(m: string) => void>(() => undefined);
  const tRef = useRef(t);
  useEffect(() => {
    sRef.current = s;
    tRef.current = t;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const st = sRef.current;
      // The walkthrough has its own keys.
      if (st.walking) return;
      const action = matchShortcut(e, st.mode === "2d" && !!stage.current?.drawing());
      if (!action) return;
      const sel = st.selection;
      const done = () => e.preventDefault();
      switch (action) {
        case "undo":
        case "redo":
          done();
          return dispatch({ type: action });
        case "copy": {
          const c = copySelection(st.plan, sel);
          if (!c) return;
          done();
          clip.current = c;
          return toastRef.current(tRef.current("copied"));
        }
        case "paste":
        case "duplicate": {
          const c = action === "paste" ? clip.current : copySelection(st.plan, sel);
          if (!c) return;
          done();
          const at = action === "paste" && st.mode === "2d" ? (stage.current?.cursor() ?? undefined) : undefined;
          const res = pasteClip(st.plan, c, { at });
          if (!res) return;
          dispatch({ type: "edit", fn: () => res.plan });
          return dispatch({ type: "select", selection: res.selection });
        }
        case "delete":
          if (!sel) return;
          done();
          dispatch({ type: "edit", fn: (p) => removeSelected(p, sel) });
          return dispatch({ type: "select", selection: null });
        case "escape":
          dispatch({ type: "set", patch: { selection: null, armed: null, swapFor: null, helpOpen: false } });
          if (st.tool !== "select") dispatch({ type: "tool", tool: "select" });
          return;
        case "finish":
          if (st.mode !== "2d" || !stage.current?.drawing()) return;
          done();
          return stage.current.finish();
        case "back":
          done();
          return stage.current?.back();
        case "nudgeLeft":
        case "nudgeRight":
        case "nudgeUp":
        case "nudgeDown": {
          if (!sel || st.mode !== "2d") return;
          done();
          const step = e.shiftKey ? 10 : 1;
          const [dx, dy] = { nudgeLeft: [-step, 0], nudgeRight: [step, 0], nudgeUp: [0, -step], nudgeDown: [0, step] }[action];
          // Arrows move on screen, which the plan view may have turned.
          const v = stage.current?.toWorld({ x: dx!, y: dy! });
          const o = stage.current?.toWorld({ x: 0, y: 0 });
          const len = v && o ? Math.hypot(v.x - o.x, v.y - o.y) || 1 : 1;
          const mx = v && o ? Math.round(((v.x - o.x) / len) * step) : dx!;
          const my = v && o ? Math.round(((v.y - o.y) / len) * step) : dy!;
          return dispatch({ type: "edit", fn: (p) => nudgeSelection(p, sel, mx, my) });
        }
        case "turnLeft":
        case "turnRight":
          if (sel?.kind !== "item") return;
          done();
          return dispatch({ type: "edit", fn: (p) => turnSelection(p, sel, action === "turnLeft" ? -45 : 45) });
        case "viewLeft":
        case "viewRight":
          if (st.mode !== "2d") return;
          done();
          return stage.current?.rotateView(action === "viewLeft" ? -1 : 1);
        case "toggle3d":
          return dispatch({ type: "mode", mode: st.mode === "2d" ? "3d" : "2d" });
        case "help":
          done();
          return dispatch({ type: "set", patch: { helpOpen: !st.helpOpen } });
        default:
          if (st.mode !== "2d") return;
          return dispatch({ type: "tool", tool: action.slice(5) as (typeof TOOLS)[number] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pieces = useMemo(() => cataloguePieces(data.mustKeep), [data.mustKeep]);
  const value = useMemo<PlannerCtx>(() => {
    const INCH = 2.54;
    return {
      s,
      dispatch,
      data,
      view,
      pieces,
      pieceName: (p) => p.name ?? tf(p.category),
      len: (cm) => (units === "in" ? (cm / INCH).toFixed(1) : String(Math.round(cm))),
      unit: units === "in" ? "in" : "cm",
      checks,
      save,
      flush,
      toast,
      toastMessage,
      roomArea: (roomId) => {
        const r = s.plan.rooms.find((x) => x.room.id === roomId);
        return r ? m2(area(r.room.polygon)) : 0;
      },
    };
  }, [s, data, view, pieces, tf, units, checks, save, flush, toast, toastMessage]);

  return (
    <Ctx value={value}>
      <ViewContext value={{ v, setV, stage }}>{children}</ViewContext>
    </Ctx>
  );
}

/** The design content the validator sees for a room's current pieces: the stored design with the planner's furniture, as the server saves it. */
function designFor(info: PlannerData["rooms"][number] | undefined, furniture: readonly FurnitureItem[]) {
  return info?.design ? withFurniture(info.design.content, furniture) : blankDesign(info?.room.name ?? "", furniture);
}

/** The editable part of a room, as the room actions take it. */
export function roomShape(room: Room): RoomShape {
  return {
    name: room.name,
    type: room.type,
    polygon: room.polygon,
    ceilingHeight: room.ceilingHeight,
    openings: room.openings,
    fixedElements: room.fixedElements,
    wallOrientationOverrides: room.wallOrientationOverrides,
    roofSlopes: room.roofSlopes,
    innerWalls: room.innerWalls,
    floorZones: room.floorZones,
  };
}

/** Plan without the selected piece or opening. */
export function removeSelected(p: Plan, sel: NonNullable<PlannerState["selection"]>): Plan {
  return {
    ...p,
    rooms: p.rooms.map((r) =>
      r.room.id !== sel.roomId
        ? r
        : sel.kind === "item"
          ? { ...r, furniture: r.furniture.filter((f) => f.id !== sel.id) }
          : sel.kind === "fixed"
            ? { ...r, room: { ...r.room, fixedElements: r.room.fixedElements.filter((f) => f.id !== sel.id) } }
            : sel.kind === "innerWall"
              ? { ...r, room: { ...r.room, innerWalls: r.room.innerWalls.filter((w) => w.id !== sel.id) } }
              : sel.kind === "zone"
                ? { ...r, room: { ...r.room, floorZones: r.room.floorZones.filter((z) => z.id !== sel.id) } }
                : { ...r, room: removeOpening(r.room, sel.id) },
    ),
  };
}

/** Bounding box of a room at its origin, in apartment cm. */
export function roomBox(p: Plan, roomId: string) {
  const r = p.rooms.find((x) => x.room.id === roomId);
  if (!r) return null;
  const o = p.origins[roomId] ?? { x: 0, y: 0 };
  const b = bbox(r.room.polygon);
  return { x: b.x + o.x, y: b.y + o.y, w: b.w, d: b.d };
}
