import type { Vec } from "@/domain/geometry/vec";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Room } from "@/domain/schemas/room";

export type Mode = "2d" | "3d";
export type Units = "cm" | "in";
export type PlannerView = "calm" | "quiet" | "full";

export const TOOLS = ["select", "pan", "wall", "room", "door", "window", "pass", "radiator", "socket", "measure", "dimension", "label", "note"] as const;
export type Tool = (typeof TOOLS)[number];

/** Keyboard shortcut per tool. */
export const TOOL_KEY: Readonly<Record<Tool, string>> = {
  select: "V",
  pan: "H",
  wall: "W",
  room: "R",
  door: "D",
  window: "N",
  pass: "P",
  radiator: "J",
  socket: "K",
  measure: "M",
  dimension: "I",
  label: "L",
  note: "T",
};

export const LAYERS = ["walls", "openings", "furniture", "suggestions", "labels", "dimensions", "electrical", "floor", "grid", "reference"] as const;
export type LayerId = (typeof LAYERS)[number];
/** Layers the Simple view lists before "+ All layers". */
export const BASIC_LAYERS: readonly LayerId[] = ["walls", "openings", "furniture", "suggestions", "dimensions"];

export interface PlanRoom {
  room: Room;
  furniture: FurnitureItem[];
}

/** Pinned dimension or margin note, in apartment coordinates. Kept on this device for now. */
export interface Annotation {
  id: string;
  kind: "dimension" | "note";
  a: Vec;
  b?: Vec;
  text?: string;
}

/** Everything undo/redo covers. */
export interface Plan {
  rooms: PlanRoom[];
  /** Room origin in apartment coordinates (cm). */
  origins: Record<string, Vec>;
  annotations: Annotation[];
}

export type Selection = { kind: "item"; roomId: string; id: string } | { kind: "opening"; roomId: string; id: string } | null;

export interface Camera {
  eyeHeight: number;
  rotation: number;
  tilt: number;
  lens: 24 | 35 | 85;
  distance: number;
}

export const CAMERA_PRESETS = {
  eye: { eyeHeight: 165, rotation: 330, tilt: 80, lens: 24, distance: 1.35 },
  architect: { eyeHeight: 165, rotation: 325, tilt: 58, lens: 35, distance: 1 },
  bird: { eyeHeight: 400, rotation: 340, tilt: 35, lens: 35, distance: 0.75 },
  plan: { eyeHeight: 250, rotation: 0, tilt: 0, lens: 85, distance: 1 },
} as const satisfies Record<string, Camera>;
export type CameraPreset = keyof typeof CAMERA_PRESETS;

export const FLOOR_FINISHES = ["oak", "ash", "terracotta", "microcement"] as const;
export type FloorFinish = (typeof FLOOR_FINISHES)[number];
export const WALL_FINISHES = ["limewash", "warmwhite", "clay", "sage"] as const;
export type WallFinish = (typeof WALL_FINISHES)[number];
export interface Finish {
  floor: FloorFinish;
  walls: WallFinish;
}
export const DEFAULT_FINISH: Finish = { floor: "oak", walls: "limewash" };

export interface SceneSettings {
  /** Hour of day, 7–21. */
  hour: number;
  ceilingLights: boolean;
  labels: boolean;
  foldWalls: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  camera: Camera;
  /** Small JPEG data URL. */
  thumb: string | null;
}

export interface PlannerState {
  plan: Plan;
  past: Plan[];
  future: Plan[];
  /** Plan at the start of a drag; the whole drag becomes one undo step. */
  gestureBase: Plan | null;
  scope: "all" | string;
  mode: Mode;
  tool: Tool;
  /** Catalogue piece waiting to be placed with a click on the plan. */
  armed: string | null;
  /** Item the next catalogue pick replaces ("Swap"). */
  swapFor: string | null;
  selection: Selection;
  hidden: LayerId[];
  /** null = automatic: open on wide screens, closed below 1200 px (decided by CSS, so SSR matches). */
  drawerOpen: boolean | null;
  tab2d: "plan" | "designer";
  tab3d: "selection" | "finishes" | "scene";
  units: Units;
  snap: boolean;
  skipped: string[];
  /** Rooms shown in 3D. */
  visible3d: string[];
  camera: Camera;
  preset: CameraPreset | null;
  /** Kept on this device until finishes get a column. */
  finishes: Record<string, Finish>;
  scene: SceneSettings;
  /** Door open state by "roomId:openingId", shared by orbit and walkthrough. */
  doorsOpen: Record<string, boolean>;
  savedViews: SavedView[];
  walking: boolean;
}

export type Action =
  | { type: "edit"; fn: (plan: Plan) => Plan; transient?: boolean }
  | { type: "gesture-start" }
  | { type: "gesture-end" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "add-room"; room: PlanRoom; origin: Vec }
  | { type: "set"; patch: Partial<Omit<PlannerState, "plan" | "past" | "future" | "gestureBase">> }
  | { type: "tool"; tool: Tool }
  | { type: "scope"; scope: "all" | string }
  | { type: "mode"; mode: Mode }
  | { type: "toggle-layer"; layer: LayerId }
  | { type: "select"; selection: Selection }
  | { type: "camera"; patch: Partial<Camera>; preset?: CameraPreset | null };

const HISTORY = 100;

export function initialState(plan: Plan, scope: "all" | string, drawerOpen: boolean | null = null): PlannerState {
  const ids = plan.rooms.map((r) => r.room.id);
  return {
    plan,
    past: [],
    future: [],
    gestureBase: null,
    scope,
    mode: "2d",
    tool: "select",
    armed: null,
    swapFor: null,
    selection: null,
    hidden: ["reference"],
    drawerOpen,
    tab2d: "plan",
    tab3d: "finishes",
    units: "cm",
    snap: true,
    skipped: [],
    visible3d: scope === "all" ? ids : ids.filter((id) => id === scope),
    camera: { ...CAMERA_PRESETS.architect },
    preset: "architect",
    finishes: {},
    scene: { hour: 16, ceilingLights: false, labels: false, foldWalls: true },
    doorsOpen: {},
    savedViews: [],
    walking: false,
  };
}

export function reducer(s: PlannerState, a: Action): PlannerState {
  switch (a.type) {
    case "edit": {
      const plan = a.fn(s.plan);
      if (plan === s.plan) return s;
      if (a.transient || s.gestureBase) return { ...s, plan };
      return { ...s, plan, past: [...s.past, s.plan].slice(-HISTORY), future: [] };
    }
    case "gesture-start":
      return s.gestureBase ? s : { ...s, gestureBase: s.plan };
    case "gesture-end": {
      const base = s.gestureBase;
      if (!base) return s;
      if (base === s.plan) return { ...s, gestureBase: null };
      return { ...s, gestureBase: null, past: [...s.past, base].slice(-HISTORY), future: [] };
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev || s.gestureBase) return s;
      return { ...s, plan: prev, past: s.past.slice(0, -1), future: [s.plan, ...s.future], selection: keepSelection(prev, s.selection) };
    }
    case "redo": {
      const next = s.future[0];
      if (!next || s.gestureBase) return s;
      return { ...s, plan: next, past: [...s.past, s.plan], future: s.future.slice(1), selection: keepSelection(next, s.selection) };
    }
    case "add-room": {
      // The room already exists on the server, so undo must not take it away: add it to every snapshot.
      const add = (p: Plan): Plan =>
        p.rooms.some((r) => r.room.id === a.room.room.id)
          ? p
          : { ...p, rooms: [...p.rooms, a.room], origins: { ...p.origins, [a.room.room.id]: a.origin } };
      return {
        ...s,
        plan: add(s.plan),
        past: s.past.map(add),
        future: s.future.map(add),
        gestureBase: s.gestureBase && add(s.gestureBase),
        visible3d: s.scope === "all" ? [...s.visible3d, a.room.room.id] : s.visible3d,
      };
    }
    case "set":
      return { ...s, ...a.patch };
    case "tool":
      return { ...s, tool: a.tool, armed: a.tool === "select" ? s.armed : null, swapFor: null };
    case "scope": {
      const ids = s.plan.rooms.map((r) => r.room.id);
      return { ...s, scope: a.scope, visible3d: a.scope === "all" ? ids : [a.scope], selection: null };
    }
    case "mode":
      return { ...s, mode: a.mode, tool: a.mode === "3d" ? "select" : s.tool, armed: null, walking: a.mode === "3d" ? s.walking : false };
    case "toggle-layer":
      return { ...s, hidden: s.hidden.includes(a.layer) ? s.hidden.filter((l) => l !== a.layer) : [...s.hidden, a.layer] };
    case "select":
      return { ...s, selection: a.selection, swapFor: a.selection?.kind === "item" && a.selection.id === s.swapFor ? s.swapFor : null };
    case "camera":
      return { ...s, camera: { ...s.camera, ...a.patch }, preset: a.preset === undefined ? null : a.preset };
  }
}

function keepSelection(plan: Plan, sel: Selection): Selection {
  if (!sel) return null;
  const room = plan.rooms.find((r) => r.room.id === sel.roomId);
  if (!room) return null;
  const exists = sel.kind === "item" ? room.furniture.some((f) => f.id === sel.id) : room.room.openings.some((o) => o.id === sel.id);
  return exists ? sel : null;
}

/** Plan with one room replaced through `fn`. */
export function mapRoom(plan: Plan, roomId: string, fn: (r: PlanRoom) => PlanRoom): Plan {
  let changed = false;
  const rooms = plan.rooms.map((r) => {
    if (r.room.id !== roomId) return r;
    const next = fn(r);
    if (next !== r) changed = true;
    return next;
  });
  return changed ? { ...plan, rooms } : plan;
}

/** Plan with one furniture item replaced through `fn`. */
export function mapItem(plan: Plan, roomId: string, id: string, fn: (f: FurnitureItem) => FurnitureItem): Plan {
  return mapRoom(plan, roomId, (r) => {
    const i = r.furniture.findIndex((f) => f.id === id);
    if (i < 0) return r;
    const next = fn(r.furniture[i]!);
    if (next === r.furniture[i]) return r;
    const furniture = [...r.furniture];
    furniture[i] = next;
    return { ...r, furniture };
  });
}

export const inScope = (scope: "all" | string, roomId: string): boolean => scope === "all" || scope === roomId;
