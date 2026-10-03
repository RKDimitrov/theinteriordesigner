import { describe, expect, it } from "vitest";
import { rectPolygon } from "@/domain/geometry/polygon";
import { cataloguePieces, newPlannerItem } from "@/domain/planner/items";
import type { Room } from "@/domain/schemas/room";
import { initialState, mapItem, type Plan, reducer } from "./state";

const room: Room = {
  id: "r1",
  apartmentId: "a1",
  finishes: { wallOverrides: {} },
  wallOutlooks: {},
  roofSlopes: [],
  innerWalls: [],
  floorZones: [],
  plan: null,
  sortOrder: 0,
  name: "Living",
  type: "living",
  polygon: rectPolygon(400, 300),
  ceilingHeight: 250,
  openings: [],
  fixedElements: [],
  wallOrientationOverrides: {},
};
const sofa = newPlannerItem(cataloguePieces([]).find((p) => p.key === "sofa-medium")!, { x: 200, y: 100 }, "Sofa", []);
const plan: Plan = { rooms: [{ room, furniture: [sofa] }], origins: { r1: { x: 0, y: 0 } }, annotations: [] };
const move = (x: number) => ({ type: "edit" as const, fn: (p: Plan) => mapItem(p, "r1", sofa.id, (f) => ({ ...f, x })) });
const xOf = (s: ReturnType<typeof initialState>) => s.plan.rooms[0]!.furniture[0]!.x;

describe("planner reducer", () => {
  it("undoes and redoes edits", () => {
    let s = initialState(plan, "all", true);
    s = reducer(s, move(210));
    s = reducer(s, move(220));
    expect(xOf(s)).toBe(220);
    s = reducer(s, { type: "undo" });
    expect(xOf(s)).toBe(210);
    s = reducer(s, { type: "undo" });
    expect(xOf(s)).toBe(200);
    s = reducer(s, { type: "redo" });
    expect(xOf(s)).toBe(210);
    // A new edit drops the redo branch.
    s = reducer(s, move(300));
    expect(s.future).toEqual([]);
  });

  it("turns a whole drag into one undo step", () => {
    let s = initialState(plan, "all", true);
    s = reducer(s, { type: "gesture-start" });
    for (const x of [205, 210, 215, 240]) s = reducer(s, move(x));
    s = reducer(s, { type: "gesture-end" });
    expect(s.past).toHaveLength(1);
    s = reducer(s, { type: "undo" });
    expect(xOf(s)).toBe(200);
  });

  it("a drag that changes nothing adds no history", () => {
    let s = initialState(plan, "all", true);
    s = reducer(s, { type: "gesture-start" });
    s = reducer(s, { type: "gesture-end" });
    expect(s.past).toEqual([]);
  });

  it("drops the selection when undo removes the piece", () => {
    let s = initialState({ ...plan, rooms: [{ room, furniture: [] }] }, "all", true);
    s = reducer(s, { type: "edit", fn: (p) => ({ ...p, rooms: [{ room, furniture: [sofa] }] }) });
    s = reducer(s, { type: "select", selection: { kind: "item", roomId: "r1", id: sofa.id } });
    s = reducer(s, { type: "undo" });
    expect(s.selection).toBeNull();
  });

  it("scope drives which rooms 3D shows", () => {
    let s = initialState(plan, "all", true);
    expect(s.visible3d).toEqual(["r1"]);
    s = reducer(s, { type: "scope", scope: "r1" });
    expect(s.visible3d).toEqual(["r1"]);
    expect(s.selection).toBeNull();
  });

  it("a room added from the planner survives undo", () => {
    let s = initialState(plan, "all", true);
    s = reducer(s, move(250));
    s = reducer(s, { type: "add-room", room: { room: { ...room, id: "r2", name: "Hall" }, furniture: [] }, origin: { x: 412, y: 0 } });
    s = reducer(s, { type: "undo" });
    expect(s.plan.rooms.map((r) => r.room.id)).toEqual(["r1", "r2"]);
    expect(s.plan.origins["r2"]).toEqual({ x: 412, y: 0 });
    expect(s.visible3d).toContain("r2");
  });
});

describe("saved views", () => {
  const camera = { eyeHeight: 165, rotation: 90, tilt: 80, lens: 24 as const, distance: 1 };

  it("restore the time of day and the lights they were saved with", () => {
    const s = reducer(initialState(plan, "all"), {
      type: "apply-view",
      view: { id: "v", name: "Evening", camera, thumb: null, light: { hour: 21, lightKelvin: 3000, lightsSwitched: { r1: false } } },
    });
    expect(s.scene.hour).toBe(21);
    expect(s.scene.lightKelvin).toBe(3000);
    expect(s.lightsSwitched).toEqual({ r1: false });
    expect(s.camera).toEqual(camera);
    expect(s.walking).toBe(false);
  });

  it("reopen the walkthrough at the spot saved while walking, and keep the lights of older views", () => {
    const walk = { x: 120, y: 80, yaw: 45, pitch: -5, eye: 115 };
    let s = initialState(plan, "all");
    s = reducer(s, { type: "set", patch: { lightsSwitched: { r1: true } } });
    s = reducer(s, { type: "apply-view", view: { id: "v", name: "Sofa", camera, thumb: null, walk } });
    expect(s.walking).toBe(true);
    expect(s.walkStart).toEqual(walk);
    expect(s.lightsSwitched).toEqual({ r1: true });
  });
});
