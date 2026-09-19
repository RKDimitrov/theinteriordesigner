import type { ApartmentInput } from "@/domain/schemas/apartment";
import { QUIZ_PAIRS } from "@/domain/profile/quiz";
import type { StyleKey, StyleProfileInput } from "@/domain/schemas/profile";
import type { RoomShape } from "@/domain/schemas/room";

/**
 * Template data for manual testing. Shown via dev-only "Fill sample data"
 * buttons. Every preset is checked against the real input schemas in
 * samples.test.ts, so these always pass validation.
 */

export const SAMPLE_APARTMENTS: readonly ApartmentInput[] = [
  {
    name: "Altbau Neukölln",
    address: "Weserstraße 42",
    city: "Berlin",
    country: "DE",
    floorLevel: 3,
    tenure: "rent",
    totalAreaM2: 68,
    yearBuilt: 1905,
    northAngleDeg: 20,
  },
  {
    name: "Lozenets flat",
    address: "ul. Krichim 12",
    city: "Sofia",
    country: "BG",
    floorLevel: 5,
    tenure: "own",
    totalAreaM2: 82,
    yearBuilt: 2012,
    northAngleDeg: 0,
  },
];

/**
 * Rectangular rooms. Walls: 0 = top, 1 = right, 2 = bottom, 3 = left.
 * Each has a door, windows and a radiator so later phases have something to
 * validate against.
 */
export const SAMPLE_ROOMS: readonly RoomShape[] = [
  {
    name: "Living room",
    type: "living",
    polygon: rect(420, 380),
    ceilingHeight: 280,
    openings: [
      { id: "door-1", kind: "door", wallIndex: 2, offset: 30, width: 90, height: 210, hinge: "start", swing: "in" },
      { id: "window-1", kind: "window", wallIndex: 0, offset: 60, width: 120, height: 150, sillHeight: 80, openable: true },
      { id: "window-2", kind: "window", wallIndex: 0, offset: 240, width: 120, height: 150, sillHeight: 80, openable: true },
      { id: "radiator-1", kind: "radiator", wallIndex: 0, offset: 70, width: 100, height: 60, depth: 10 },
      { id: "socket-1", kind: "socket", wallIndex: 1, offset: 180, width: 10, height: 30, socketType: "tv" },
    ],
    fixedElements: [],
    wallOrientationOverrides: {},
  },
  {
    name: "Bedroom",
    type: "bedroom",
    polygon: rect(350, 320),
    ceilingHeight: 280,
    openings: [
      { id: "door-1", kind: "door", wallIndex: 3, offset: 220, width: 80, height: 210, hinge: "end", swing: "in" },
      { id: "window-1", kind: "window", wallIndex: 1, offset: 100, width: 120, height: 150, sillHeight: 85, openable: true },
      { id: "radiator-1", kind: "radiator", wallIndex: 1, offset: 110, width: 100, height: 60, depth: 10 },
      { id: "socket-1", kind: "socket", wallIndex: 0, offset: 60, width: 10, height: 30, socketType: "power" },
    ],
    fixedElements: [],
    wallOrientationOverrides: {},
  },
  {
    name: "Home office",
    type: "office",
    polygon: rect(300, 260),
    ceilingHeight: 260,
    openings: [
      { id: "door-1", kind: "door", wallIndex: 2, offset: 190, width: 80, height: 200, hinge: "end", swing: "in" },
      { id: "window-1", kind: "window", wallIndex: 0, offset: 90, width: 120, height: 140, sillHeight: 90, openable: true },
      { id: "radiator-1", kind: "radiator", wallIndex: 0, offset: 100, width: 100, height: 60, depth: 10 },
      { id: "socket-1", kind: "socket", wallIndex: 3, offset: 120, width: 10, height: 30, socketType: "network" },
    ],
    fixedElements: [{ id: "fixed-1", label: "Chimney", kind: "chimney", rect: { x: 250, y: 100, w: 50, d: 60 }, height: 260 }],
    wallOrientationOverrides: {},
  },
  {
    name: "Kitchen",
    type: "kitchen",
    polygon: rect(320, 280),
    ceilingHeight: 280,
    openings: [
      { id: "door-1", kind: "door", wallIndex: 3, offset: 20, width: 90, height: 210, hinge: "start", swing: "sliding" },
      { id: "window-1", kind: "window", wallIndex: 1, offset: 90, width: 100, height: 130, sillHeight: 100, openable: true },
    ],
    fixedElements: [{ id: "fixed-1", label: "Kitchen run", kind: "kitchen_run", rect: { x: 0, y: 0, w: 320, d: 60 }, height: 90 }],
    wallOrientationOverrides: {},
  },
];

interface RoomLike {
  id: string;
  type: string;
}

/** Answers every quiz pair, preferring styles earlier in `prefs` (falls back to option a). */
function quizFor(prefs: readonly StyleKey[]) {
  return QUIZ_PAIRS.map((p) => {
    const ia = prefs.indexOf(p.a);
    const ib = prefs.indexOf(p.b);
    if (ia === -1 && ib === -1) return { pairId: p.id, choice: p.a };
    if (ia === -1) return { pairId: p.id, choice: p.b };
    if (ib === -1) return { pairId: p.id, choice: p.a };
    return { pairId: p.id, choice: ia <= ib ? p.a : p.b };
  });
}

function budgets(rooms: readonly RoomLike[], perType: Readonly<Record<string, number>>, fallback: number) {
  return Object.fromEntries(rooms.map((r) => [r.id, perType[r.type] ?? fallback]));
}

const roomOf = (rooms: readonly RoomLike[], ...types: string[]) => rooms.find((r) => types.includes(r.type))?.id ?? null;

/**
 * Style profiles. Each preset is a function of the apartment's rooms, so
 * budgets and must-keep assignments point at real room ids.
 */
export const SAMPLE_PROFILES: readonly ((rooms: readonly RoomLike[]) => StyleProfileInput)[] = [
  // Family with two kids and a dog.
  (rooms) => ({
    household: { adults: 2, kids: [{ age: 4 }, { age: 9 }], pets: [{ type: "dog", count: 1 }], wfhDaysPerWeek: 1 },
    budgetPerRoom: budgets(rooms, { living: 4500, bedroom: 2500, kids: 2000, kitchen: 3000, dining: 2000 }, 1200),
    quizAnswers: quizFor(["scandinavian", "japandi", "mediterranean", "minimal"]),
    colorsLiked: ["#F4EFE6", "#A3B09A", "#C19A6B"],
    colorsDisliked: ["#141414", "#6E2A33"],
    mustKeep: [
      { id: "keep-1", name: "Grandma's sideboard", category: "sideboard", w: 160, d: 45, h: 85, colorHex: "#5C4033", roomId: roomOf(rooms, "living", "dining") },
    ],
  }),
  // Couple, both working from home three days a week.
  (rooms) => ({
    household: { adults: 2, kids: [], pets: [{ type: "cat", count: 2 }], wfhDaysPerWeek: 3 },
    budgetPerRoom: budgets(rooms, { living: 6000, bedroom: 3000, office: 3500, kitchen: 2500 }, 1500),
    quizAnswers: quizFor(["mid_century", "industrial", "modern_classic"]),
    colorsLiked: ["#5C4033", "#C9962C", "#23324A"],
    colorsDisliked: ["#E3B9B0"],
    mustKeep: [
      { id: "keep-1", name: "Standing desk", category: "desk", w: 160, d: 80, h: 75, colorHex: "#3A3A3C", roomId: roomOf(rooms, "office", "living") },
      { id: "keep-2", name: "Record shelf", category: "bookshelf", w: 147, d: 39, h: 147, colorHex: "#F4EFE6", roomId: roomOf(rooms, "living") },
    ],
  }),
  // Student on a small budget.
  (rooms) => ({
    household: { adults: 1, kids: [], pets: [], wfhDaysPerWeek: 5 },
    budgetPerRoom: budgets(rooms, { living: 900, bedroom: 700, office: 500, kitchen: 400 }, 300),
    quizAnswers: quizFor(["minimal", "boho", "japandi"]),
    colorsLiked: ["#E6DCCB", "#C0683F", "#7A7D4A"],
    colorsDisliked: ["#23324A", "#8FA6B8"],
    mustKeep: [
      { id: "keep-1", name: "Bed 140×200", category: "bed", w: 145, d: 210, h: 90, colorHex: "#C19A6B", roomId: roomOf(rooms, "bedroom", "living") },
    ],
  }),
];

function rect(w: number, d: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

/** Preset at `counter`, cycling. Use for preset factories (functions cannot be cloned). */
export function samplePreset<T>(list: readonly T[], counter: number): T {
  const item = list[counter % list.length];
  if (item === undefined) throw new Error("Empty sample list");
  return item;
}

/** Deep copy of the preset at `counter`, cycling, so callers can mutate it freely. */
export function pickSample<T>(list: readonly T[], counter: number): T {
  return structuredClone(samplePreset(list, counter));
}
