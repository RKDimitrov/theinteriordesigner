import type { ValidationIssue } from "../../schemas/validation-issue";
import type { Rule } from "../types";

/** Duplicate ids and references to things that do not exist. */
export const referencesRule: Rule = ({ design }) => {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const ids = [...design.furniture.map((f) => f.id), ...design.lighting.map((l) => l.id), ...design.textiles.map((t) => t.id)];
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({ code: "DANGLING_REFERENCE", severity: "error", itemIds: [id], message: `Id "${id}" is used more than once`, hint: "give every item, light and textile a unique id" });
    }
    seen.add(id);
  }
  const zones = new Set(design.zones.map((z) => z.id));
  const furniture = new Set(design.furniture.map((f) => f.id));
  for (const f of design.furniture) {
    if (f.zoneId !== undefined && !zones.has(f.zoneId)) {
      issues.push({ code: "DANGLING_REFERENCE", severity: "error", itemIds: [f.id], message: `${f.name} refers to unknown zone "${f.zoneId}"`, hint: "use an id from zones or omit zoneId" });
    }
  }
  for (const l of design.lighting) {
    if (l.itemId !== undefined && !furniture.has(l.itemId)) {
      issues.push({ code: "DANGLING_REFERENCE", severity: "error", itemIds: [l.id], message: `Light "${l.fixture}" refers to unknown item "${l.itemId}"`, hint: "reference an existing furniture id or omit itemId" });
    }
  }
  for (const id of design.longevity.trendItems) {
    if (!seen.has(id)) {
      issues.push({ code: "DANGLING_REFERENCE", severity: "error", itemIds: [id], message: `longevity.trendItems lists unknown id "${id}"`, hint: "list only ids of furniture, lights or textiles" });
    }
  }
  return issues;
};
