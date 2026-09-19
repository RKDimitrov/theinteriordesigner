import type { ValidationIssue } from "../../schemas/validation-issue";
import {
  BUDGET_WARNING_FACTOR,
  CLEARANCE,
  MAX_ANCHOR_TREND_RISK,
  PALETTE_SUM_TOLERANCE,
  PALETTE_TARGET,
  PALETTE_TOLERANCE,
  TILED_ROOM_TYPES,
} from "../clearances";
import { eur } from "../hints";
import type { Rule } from "../types";
import type { DesignContent } from "../../schemas/design";

/** Total price range of everything that must be bought (existing pieces and lamps counted as furniture excluded). */
export function designCost(d: DesignContent): { min: number; max: number } {
  const ranges = [
    ...d.furniture.filter((f) => !f.existing).map((f) => f.price),
    ...d.lighting.filter((l) => l.itemId === undefined).map((l) => l.price),
    ...d.textiles.map((t) => t.price),
    ...d.surfaces.flatMap((s) => (s.price ? [s.price] : [])),
  ];
  return ranges.reduce((acc, p) => ({ min: acc.min + p.min, max: acc.max + p.max }), { min: 0, max: 0 });
}

export const budgetRule: Rule = ({ design, budgetEur }) => {
  if (budgetEur === null || budgetEur <= 0) return [];
  const cost = designCost(design);
  if (cost.min > budgetEur) {
    return [
      {
        code: "OVER_BUDGET",
        severity: "error",
        itemIds: [],
        message: `Even the low estimate (${eur(cost.min)}) is over the room budget of ${eur(budgetEur)}`,
        measured: cost.min,
        required: budgetEur,
        hint: `cut about ${eur(cost.min - budgetEur)}: cheaper swappable items first, keep anchors`,
      },
    ];
  }
  if (cost.max > budgetEur * BUDGET_WARNING_FACTOR) {
    return [
      {
        code: "OVER_BUDGET",
        severity: "warning",
        itemIds: [],
        message: `The high estimate (${eur(cost.max)}) exceeds the budget of ${eur(budgetEur)} by more than 10 %`,
        measured: cost.max,
        required: budgetEur,
        hint: "narrow price ranges or choose cheaper decor",
      },
    ];
  }
  return [];
};

/** Big-ticket items and major surfaces must be timeless. */
export const longevityRule: Rule = ({ design }) => {
  const issues: ValidationIssue[] = [];
  for (const f of design.furniture) {
    if (f.investmentTier !== "anchor" || f.trendRisk <= MAX_ANCHOR_TREND_RISK) continue;
    issues.push({
      code: "ANCHOR_TREND_RISK",
      severity: "error",
      itemIds: [f.id],
      message: `${f.name} is a big-ticket anchor with trend risk ${f.trendRisk}`,
      measured: f.trendRisk,
      required: MAX_ANCHOR_TREND_RISK,
      hint: `choose a timeless version (trendRisk ≤ ${MAX_ANCHOR_TREND_RISK}) and move the trend into cushions, throws or decor`,
    });
  }
  for (const s of design.surfaces) {
    if ((s.surface !== "floor" && s.surface !== "walls") || s.trendRisk <= MAX_ANCHOR_TREND_RISK) continue;
    issues.push({
      code: "ANCHOR_TREND_RISK",
      severity: "error",
      itemIds: [],
      message: `The ${s.surface} finish "${s.material}" has trend risk ${s.trendRisk}`,
      measured: s.trendRisk,
      required: MAX_ANCHOR_TREND_RISK,
      hint: "keep floors and main walls timeless; put trend colours on an accent wall or textiles",
    });
  }
  return issues;
};

export const renterRule: Rule = ({ design, renter, room }) => {
  if (!renter?.applies) return [];
  const issues: ValidationIssue[] = [];
  const tiled = TILED_ROOM_TYPES.has(room.type);
  for (const s of design.surfaces) {
    if (s.renterFriendly) continue;
    issues.push({
      code: "RENTER_VIOLATION",
      severity: "error",
      itemIds: [],
      message: `The ${s.surface} change "${s.material}" is not reversible, but the apartment is rented`,
      hint: "use a reversible option: paint, rugs, loose-lay or click flooring, removable wallpaper",
    });
  }
  const drilled = [...design.furniture.map((f) => ({ id: f.id, name: f.name, drill: f.requiresDrilling, friendly: f.renterFriendly })), ...design.lighting.map((l) => ({ id: l.id, name: l.fixture, drill: l.requiresDrilling, friendly: true }))];
  for (const x of drilled) {
    if (x.drill && (renter.drilling === "avoid" || tiled)) {
      issues.push({
        code: "RENTER_VIOLATION",
        severity: "error",
        itemIds: [x.id],
        message: tiled ? `${x.name} needs drilling in a tiled room of a rented flat` : `${x.name} needs drilling, which this lease situation should avoid`,
        hint: "use a freestanding, adhesive, tension-rod or plug-in alternative",
      });
    } else if (!x.friendly) {
      issues.push({ code: "RENTER_VIOLATION", severity: "warning", itemIds: [x.id], message: `${x.name} is marked as not renter-friendly`, hint: "prefer a reversible alternative" });
    }
  }
  return issues;
};

export const mustKeepRule: Rule = ({ design, mustKeep }) => {
  const tol = CLEARANCE.mustKeepTolerance;
  const close = (a: number, b: number) => Math.abs(a - b) <= tol;
  return mustKeep.flatMap((k) => {
    const found = design.furniture.some(
      (f) => f.existing && f.category === k.category && close(f.h, k.h) && ((close(f.w, k.w) && close(f.d, k.d)) || (close(f.w, k.d) && close(f.d, k.w))),
    );
    return found
      ? []
      : [
          {
            code: "MUST_KEEP_MISSING" as const,
            severity: "error" as const,
            itemIds: [],
            message: `The existing "${k.name}" (${k.category}, ${k.w}×${k.d}×${k.h} cm) is missing`,
            hint: `include it with existing: true, category ${k.category} and exactly ${k.w}×${k.d}×${k.h} cm, price 0`,
          },
        ];
  });
};

export const paletteRule: Rule = ({ design }) => {
  const p = design.palette;
  const issues: ValidationIssue[] = [];
  const sum = p.base.share + p.secondary.share + p.accent.share;
  const off = (["base", "secondary", "accent"] as const).filter((k) => Math.abs(p[k].share - PALETTE_TARGET[k]) > PALETTE_TOLERANCE);
  if (Math.abs(sum - 1) > PALETTE_SUM_TOLERANCE || off.length > 0) {
    issues.push({
      code: "PALETTE_SHARES",
      severity: "warning",
      itemIds: [],
      message: `Palette shares are ${Math.round(p.base.share * 100)}/${Math.round(p.secondary.share * 100)}/${Math.round(p.accent.share * 100)} instead of about 60/30/10`,
      hint: "set base ≈ 0.6, secondary ≈ 0.3, accent ≈ 0.1",
    });
  }
  return issues;
};
