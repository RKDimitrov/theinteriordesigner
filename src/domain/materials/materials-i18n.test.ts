import { describe, expect, it } from "vitest";
import bg from "@/messages/bg.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { MATERIAL_GROUPS, MATERIALS } from "./library";

describe("material names", () => {
  it.each([
    ["en", en],
    ["de", de],
    ["bg", bg],
  ] as const)("every material and group has a name in %s", (_, messages) => {
    const names = messages.Material as Record<string, string>;
    const groups = messages.MaterialGroup as Record<string, string>;
    for (const m of MATERIALS) expect(names[m.id], m.id).toBeTruthy();
    for (const g of MATERIAL_GROUPS) expect(groups[g], g).toBeTruthy();
  });
});
