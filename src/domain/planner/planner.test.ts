import { describe, expect, it } from "vitest";
import { rectPolygon } from "../geometry/polygon";
import { FurnitureItem } from "../schemas/design";
import { validateDesign } from "../validator";
import { blankDesign, cataloguePieces, newPlannerItem, nextItemId, swapItem, turn, withFurniture } from "./items";
import { layoutRooms, PLANNER_WALL_CM, roomsBounds } from "./layout";

const room = (id: string, w: number, d: number) => ({ id, polygon: rectPolygon(w, d) });

describe("layoutRooms", () => {
  it("puts rooms side by side, one wall apart", () => {
    const o = layoutRooms([room("a", 400, 300), room("b", 300, 200)]);
    expect(o.get("a")).toEqual({ x: 0, y: 0 });
    expect(o.get("b")).toEqual({ x: 400 + PLANNER_WALL_CM, y: 0 });
  });

  it("wraps to a new row when the row gets long", () => {
    const o = layoutRooms([room("a", 700, 300), room("b", 600, 200)]);
    expect(o.get("b")).toEqual({ x: 0, y: 300 + PLANNER_WALL_CM });
  });

  it("keeps known origins and places new rooms below them", () => {
    const rooms = [room("a", 400, 300), room("new", 300, 300)];
    const o = layoutRooms(rooms, new Map([["a", { x: 50, y: 40 }]]));
    expect(o.get("a")).toEqual({ x: 50, y: 40 });
    expect(o.get("new")!.y).toBe(40 + 300 + PLANNER_WALL_CM);
  });

  it("bounds cover every room", () => {
    const rooms = [room("a", 400, 300), room("b", 300, 500)];
    expect(roomsBounds(rooms, layoutRooms(rooms))).toEqual({ x: 0, y: 0, w: 712, d: 500 });
    expect(roomsBounds([], new Map())).toBeNull();
  });
});

describe("planner items", () => {
  const pieces = cataloguePieces([
    { id: "m1", name: "Grandma's chair", category: "armchair", w: 72, d: 80, h: 90, colorHex: "#aa8866", roomId: null },
  ]);

  it("lists the user's own pieces first, then every catalogue size", () => {
    expect(pieces[0]).toMatchObject({ key: "mine-m1", mine: "m1", name: "Grandma's chair" });
    expect(pieces.filter((p) => !p.mine)).toHaveLength(26 * 3);
  });

  it("builds a schema-valid furniture item", () => {
    const sofa = pieces.find((p) => p.key === "sofa-medium")!;
    const item = newPlannerItem(sofa, { x: 200, y: 150 }, "Sofa", ["sofa-1"]);
    expect(FurnitureItem.parse(item)).toMatchObject({ id: "sofa-2", w: 220, d: 95, x: 200, y: 150, existing: false });
    const mirror = newPlannerItem(pieces.find((p) => p.key === "mirror-small")!, { x: 0, y: 0 }, "Mirror", []);
    expect(mirror.placement).toBe("wall");
    expect(mirror.elevation).toBeGreaterThan(0);
    expect(newPlannerItem(pieces[0]!, { x: 0, y: 0 }, "Grandma's chair", []).existing).toBe(true);
  });

  it("ids stay inside the schema pattern", () => {
    expect(nextItemId("shoe_cabinet", [])).toBe("shoe-cabinet-1");
    expect(FurnitureItem.shape.id.safeParse(nextItemId("coffee_table", ["coffee-table-1"])).success).toBe(true);
  });

  it("swapping keeps the id, position and turn", () => {
    const base = newPlannerItem(pieces.find((p) => p.key === "sofa-small")!, { x: 120, y: 90 }, "Sofa", []);
    const swapped = swapItem({ ...base, rotation: 90 }, pieces.find((p) => p.key === "sofa-large")!, "Sofa");
    expect(swapped).toMatchObject({ id: base.id, x: 120, y: 90, rotation: 90, w: 260 });
  });

  it("turns wrap around", () => {
    expect(turn(315, 45)).toBe(0);
    expect(turn(0, -45)).toBe(315);
  });

  it("removing a piece drops references to it, so the validator stays quiet about it", () => {
    const lamp = newPlannerItem(pieces.find((p) => p.key === "floor_lamp-medium")!, { x: 40, y: 40 }, "Lamp", []);
    const content = blankDesign("Study", [lamp]);
    const withLight = {
      ...content,
      lighting: [
        {
          id: "l1",
          layer: "ambient" as const,
          fixture: "Paper lamp",
          mount: "floor" as const,
          itemId: lamp.id,
          colorTempK: 2700,
          lumens: 800,
          dimmable: true,
          requiresDrilling: false,
          price: { min: 0, max: 0, currency: "EUR" as const },
          trendRisk: 0,
          rationale: "-",
        },
      ],
      longevity: { summary: "-", trendItems: [lamp.id] },
    };
    const pruned = withFurniture(withLight, []);
    expect(pruned.lighting[0]!.itemId).toBeUndefined();
    expect(pruned.longevity.trendItems).toEqual([]);
    const issues = validateDesign({
      room: { name: "Study", type: "office", polygon: rectPolygon(300, 300), ceilingHeight: 250, openings: [], fixedElements: [], wallOrientationOverrides: {} },
      design: pruned,
      mustKeep: [],
      budgetEur: null,
      renter: null,
    });
    expect(issues.filter((i) => i.code === "DANGLING_REFERENCE")).toEqual([]);
  });
});
