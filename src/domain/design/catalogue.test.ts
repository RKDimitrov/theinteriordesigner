import { describe, expect, it } from "vitest";
import { FurnitureCategory } from "../schemas/design";
import { CATALOGUE, catalogueSize, maxItems, minFreeSpan, nearestSizeClass, suitsRoom, unsuitedFor, wallElevation } from "./catalogue";

describe("catalogue", () => {
  it("has three size classes with growing width for every category", () => {
    for (const c of FurnitureCategory.options) {
      const { small, medium, large } = CATALOGUE[c].sizes;
      expect(small[0], c).toBeLessThanOrEqual(medium[0]);
      expect(medium[0], c).toBeLessThanOrEqual(large[0]);
      for (const s of [small, medium, large]) expect(s.every((n) => Number.isInteger(n) && n > 0), c).toBe(true);
    }
  });

  it("returns dimensions with ergonomic heights", () => {
    expect(catalogueSize("sofa", "medium")).toEqual({ w: 220, d: 95, h: 85 });
    expect(catalogueSize("desk", "small").h).toBe(74);
    expect(catalogueSize("dining_table", "large").h).toBe(75);
  });

  it("includes clearances in the free span", () => {
    expect(minFreeSpan("bed", "medium")).toEqual({ length: 260, depth: 260 });
    expect(minFreeSpan("bed", "small")).toEqual({ length: 150, depth: 260 });
    expect(minFreeSpan("sofa", "medium")).toEqual({ length: 220, depth: 175 });
    expect(minFreeSpan("dining_table", "medium")).toEqual({ length: 290, depth: 240 });
    expect(minFreeSpan("plant", "medium")).toEqual({ length: 45, depth: 45 });
  });

  it("caps the number of pieces by area and room type", () => {
    expect(maxItems(4.8, "hallway")).toBe(3);
    expect(maxItems(8, "hallway")).toBe(5);
    expect(maxItems(5, "living")).toBe(4);
    expect(maxItems(10, "bedroom")).toBe(8);
    expect(maxItems(16, "living")).toBe(9);
    expect(maxItems(60, "living")).toBe(14);
    expect(maxItems(12, "bath")).toBe(3);
  });

  it("finds the nearest size class for existing pieces", () => {
    expect(nearestSizeClass("bed", 145, 210)).toBe("medium");
    expect(nearestSizeClass("sideboard", 45, 200)).toBe("large");
  });

  it("centres wall items on eye height", () => {
    expect(wallElevation(70)).toBe(115);
    expect(wallElevation(180)).toBe(60);
    expect(wallElevation(300)).toBe(10);
  });
});

describe("suitsRoom", () => {
  it("keeps seating groups, beds, desks and dining tables out of a hallway", () => {
    for (const category of ["sofa", "coffee_table", "tv_unit", "bed", "nightstand", "desk", "office_chair", "dining_table", "dining_chair"] as const) {
      expect(suitsRoom(category, "hallway"), category).toBe(false);
    }
  });

  it("lets a hallway have what a hallway is for", () => {
    for (const category of ["bench", "shoe_cabinet", "coat_rack", "mirror", "wardrobe", "rug", "plant", "art"] as const) {
      expect(suitsRoom(category, "hallway"), category).toBe(true);
    }
  });

  it("does not restrict living rooms, bedrooms or rooms of no set kind", () => {
    for (const type of ["living", "bedroom", "office", "dining", "kids", "other"] as const) expect(unsuitedFor(type)).toEqual([]);
  });

  it("keeps beds and upholstery out of bathrooms and storage rooms", () => {
    expect(suitsRoom("bed", "bath")).toBe(false);
    expect(suitsRoom("sofa", "storage")).toBe(false);
    expect(suitsRoom("storage", "bath")).toBe(true);
  });
});
