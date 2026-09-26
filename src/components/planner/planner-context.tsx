"use client";

import { useTranslations } from "next-intl";
import { createContext, type Dispatch, type ReactNode, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { area, bbox } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import type { Vec } from "@/domain/geometry/vec";
import { blankDesign, type CataloguePiece, cataloguePieces, withFurniture } from "@/domain/planner/items";
import { layoutRooms } from "@/domain/planner/layout";
import { checkRoom, type RoomIssue } from "@/domain/room/check-room";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Room, RoomShape } from "@/domain/schemas/room";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { validateDesign } from "@/domain/validator";
import { savePlannerRoomAction } from "@/server/actions/planner";
import { updateRoomAction } from "@/server/actions/rooms";
import type { PlannerData } from "@/server/planner";
import { type Action, type Annotation, type Finish, initialState, type SavedView, type Plan, type PlannerState, type PlannerView, reducer, TOOL_KEY, TOOLS, type Units } from "./state";

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
}

export interface StageApi {
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** Screen (stage-relative px) to apartment cm. */
  toWorld: (p: Vec) => Vec;
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
  finishes?: Record<string, Finish>;
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

function initialPlan(data: PlannerData): Plan {
  const rooms = data.rooms.map((r) => ({ room: r.room, furniture: r.design?.furniture ?? [] }));
  const origins = Object.fromEntries(layoutRooms(rooms.map((r) => ({ id: r.room.id, polygon: r.room.polygon }))));
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
    const st = initialState(initialPlan(data), scope);
    const valid = arm !== null && cataloguePieces(data.mustKeep).some((p) => p.key === arm);
    return valid ? { ...st, armed: arm, drawerOpen: true } : st;
  });
  const [v, setViewState] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const setV = useCallback((fn: (v: ViewState) => ViewState) => setViewState(fn), []);
  const stage = useRef<StageApi | null>(null);
  const units: Units = s.units;

  // Restore room positions and notes kept on this device, once.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const local = readLocal(data.apartment.id);
    if (local.finishes || local.savedViews) dispatch({ type: "set", patch: { finishes: local.finishes ?? {}, savedViews: local.savedViews ?? [] } });
    if (!local.origins && !local.annotations) return;
    dispatch({
      type: "edit",
      transient: true,
      fn: (p) => {
        const known = new Map(Object.entries(local.origins ?? {}).filter(([id]) => p.rooms.some((r) => r.room.id === id)));
        const origins = Object.fromEntries(layoutRooms(p.rooms.map((r) => ({ id: r.room.id, polygon: r.room.polygon })), known));
        return { ...p, origins, annotations: local.annotations ?? [] };
      },
    });
    stage.current?.fit();
  }, [data.apartment.id]);

  useEffect(() => {
    if (!restored.current) return;
    writeLocal(data.apartment.id, { origins: s.plan.origins, annotations: s.plan.annotations, finishes: s.finishes, savedViews: s.savedViews });
  }, [data.apartment.id, s.plan.origins, s.plan.annotations, s.finishes, s.savedViews]);

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
  useEffect(() => {
    sRef.current = s;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const st = sRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        dispatch({ type: "set", patch: { selection: null, armed: null, swapFor: null } });
        if (st.tool !== "select") dispatch({ type: "tool", tool: "select" });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = st.selection;
        if (!sel) return;
        e.preventDefault();
        dispatch({ type: "edit", fn: (p) => removeSelected(p, sel) });
        dispatch({ type: "select", selection: null });
        return;
      }
      if (e.key === "3") {
        dispatch({ type: "mode", mode: st.mode === "2d" ? "3d" : "2d" });
        return;
      }
      if (st.mode !== "2d") return;
      const tool = TOOLS.find((k) => TOOL_KEY[k].toLowerCase() === e.key.toLowerCase());
      if (tool) dispatch({ type: "tool", tool });
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
          : { ...r, room: { ...r.room, openings: r.room.openings.filter((o) => o.id !== sel.id) } },
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
