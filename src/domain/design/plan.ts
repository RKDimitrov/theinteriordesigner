import { itemFootprint } from "../geometry/obb";
import { bbox, type Rect } from "../geometry/polygon";
import type { DesignContent, DesignPatch, DesignPlanInput, FurnitureItem, Intent, PlanItem } from "../schemas/design";
import type { MustKeepItem } from "../schemas/profile";
import { CATALOGUE, catalogueSize, defaultIntent, nearestSizeClass, wallElevation } from "./catalogue";

/** Position chosen by the solver. */
export interface Pose {
  x: number;
  y: number;
  rotation: number;
}

/** A plan item with real dimensions and a clean intent. */
export interface PlannedItem extends PlanItem {
  w: number;
  d: number;
  h: number;
  elevation: number;
}

export interface PlannedDesign extends Omit<DesignPlanInput, "items"> {
  items: PlannedItem[];
}

const RELATIONAL: ReadonlySet<Intent["anchor"]> = new Set(["beside", "front_of", "under"]);
export const isRelational = (i: Intent): boolean => RELATIONAL.has(i.anchor);

/** Deterministic retailer search query, e.g. "3-seat sofa, wool blend, 220 × 95 cm". */
export function productQuery(item: Pick<PlannedItem, "name" | "material" | "w" | "d">): string {
  return `${item.name}, ${item.material}, ${item.w} × ${item.d} cm`.slice(0, 160);
}

function keptPieceItem(k: MustKeepItem, taken: ReadonlySet<string>): PlanItem {
  const base = `keep-${k.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`.slice(0, 32);
  let id = base.length >= 2 ? base : "keep-item";
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, 29)}-${n}`;
  return {
    id,
    category: k.category,
    sizeClass: nearestSizeClass(k.category, k.w, k.d),
    name: k.name,
    material: "Existing piece",
    colorHex: k.colorHex,
    paletteRole: "neutral",
    placement: CATALOGUE[k.category].placement,
    intent: defaultIntent(k.category),
    priority: 1,
    price: { min: 0, max: 0, currency: "EUR" },
    trendRisk: 0,
    investmentTier: "anchor",
    renterFriendly: true,
    requiresDrilling: false,
    existing: true,
    rationale: "A piece the household already owns and keeps.",
  };
}

/**
 * Give a relational intent a valid target, or fall back to the category's
 * default: a missing or self reference, or one that forms a cycle, becomes
 * a wall/free/corner intent.
 */
function cleanIntents(items: PlanItem[]): PlanItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const withTarget = items.map((item): PlanItem => {
    const intent = item.intent;
    if (!isRelational(intent)) return intent.relativeTo === undefined ? item : { ...item, intent: { ...intent, relativeTo: undefined } };
    const target = intent.relativeTo !== undefined ? byId.get(intent.relativeTo) : undefined;
    if (target && target.id !== item.id) return item;
    const wants = CATALOGUE[item.category].wants;
    const guess = "of" in wants ? items.find((o) => o.id !== item.id && wants.of.includes(o.category)) : undefined;
    if (guess) return { ...item, intent: { ...intent, anchor: wants.anchor, relativeTo: guess.id } };
    const fallback = wants.anchor === "front_of" || wants.anchor === "beside" || wants.anchor === "under" ? "free" : wants.anchor;
    return { ...item, intent: { anchor: fallback, wallIndex: intent.wallIndex, zoneId: intent.zoneId } };
  });
  // Break cycles: follow each chain; an item that meets itself becomes free-standing.
  const next = new Map(withTarget.map((i) => [i.id, i]));
  for (const item of withTarget) {
    const seen = new Set<string>();
    let cur: PlanItem | undefined = next.get(item.id);
    while (cur && isRelational(cur.intent) && cur.intent.relativeTo !== undefined) {
      if (seen.has(cur.id)) {
        next.set(cur.id, { ...cur, intent: { anchor: "free", zoneId: cur.intent.zoneId } });
        break;
      }
      seen.add(cur.id);
      cur = next.get(cur.intent.relativeTo);
    }
  }
  return withTarget.map((i) => next.get(i.id)!);
}

/**
 * Catalogue step: real dimensions for every item. Existing pieces take the
 * must-keep dimensions (matched by category); must-keep pieces the model
 * forgot are added as priority 1.
 */
export function resolvePlan(plan: DesignPlanInput, opts: { mustKeep: readonly MustKeepItem[]; ceilingHeight: number }): PlannedDesign {
  const unused = [...opts.mustKeep];
  const dims = new Map<string, { w: number; d: number; h: number }>();
  for (const item of plan.items) {
    if (!item.existing) continue;
    const k = unused.findIndex((m) => m.category === item.category);
    if (k < 0) continue;
    const [m] = unused.splice(k, 1);
    dims.set(item.id, { w: m!.w, d: m!.d, h: m!.h });
  }
  const taken = new Set(plan.items.map((i) => i.id));
  const injected = unused.map((k) => {
    const item = keptPieceItem(k, taken);
    taken.add(item.id);
    dims.set(item.id, { w: k.w, d: k.d, h: k.h });
    return item;
  });

  const items = cleanIntents([...plan.items, ...injected]).map((item): PlannedItem => {
    const placement = item.category === "other" ? item.placement : CATALOGUE[item.category].placement;
    const size = dims.get(item.id) ?? catalogueSize(item.category, item.sizeClass);
    const elevation = placement === "wall" ? wallElevation(size.h) : placement === "ceiling" ? Math.max(0, opts.ceilingHeight - size.h) : 0;
    return { ...item, placement, ...size, elevation, priority: item.existing ? 1 : item.priority };
  });
  return { ...plan, items };
}

/** One stored furniture item from a planned item and its pose. */
export function toFurnitureItem(item: PlannedItem, pose: Pose, zoneId?: string): FurnitureItem {
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    placement: item.placement,
    w: item.w,
    d: item.d,
    h: item.h,
    x: Math.round(pose.x * 10) / 10,
    y: Math.round(pose.y * 10) / 10,
    rotation: pose.rotation,
    elevation: item.elevation,
    ...(zoneId !== undefined ? { zoneId } : {}),
    material: item.material,
    colorHex: item.colorHex,
    paletteRole: item.paletteRole,
    price: item.price,
    ...(item.existing ? {} : { productQuery: productQuery(item) }),
    investmentTier: item.investmentTier,
    trendRisk: item.trendRisk,
    renterFriendly: item.renterFriendly,
    requiresDrilling: item.requiresDrilling,
    existing: item.existing,
    rationale: item.rationale,
    sizeClass: item.sizeClass,
    intent: item.intent,
    priority: item.priority,
  };
}

const ZONE_PADDING = 20;

function clipRect(r: Rect, to: Rect): Rect {
  const x0 = Math.max(r.x, to.x);
  const y0 = Math.max(r.y, to.y);
  const x1 = Math.min(r.x + r.w, to.x + to.w);
  const y1 = Math.min(r.y + r.d, to.y + to.d);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), d: Math.max(0, y1 - y0) };
}

const intRect = (r: Rect) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), d: Math.round(r.d) });

/**
 * Build the stored DesignContent from the planned design and the solver's
 * poses. Items without a pose were dropped; references to them are removed.
 * Zone rectangles wrap their items; empty zones get `fallbackRect`.
 */
export function toDesignContent(planned: PlannedDesign, poses: ReadonlyMap<string, Pose>, bounds: { room: Rect; fallback: Rect }): DesignContent {
  const zoneIds = new Set(planned.zones.map((z) => z.id));
  const furniture = planned.items.flatMap((item): FurnitureItem[] => {
    const pose = poses.get(item.id);
    if (!pose) return [];
    const zoneId = item.intent.zoneId !== undefined && zoneIds.has(item.intent.zoneId) ? item.intent.zoneId : undefined;
    return [toFurnitureItem(item, pose, zoneId)];
  });

  const zones = planned.zones.map((z) => {
    const members = furniture.filter((f) => f.zoneId === z.id && f.placement !== "ceiling");
    if (members.length === 0) return { ...z, rect: intRect(bounds.fallback) };
    const b = bbox(members.flatMap((f) => itemFootprint(f)));
    const padded = { x: b.x - ZONE_PADDING, y: b.y - ZONE_PADDING, w: b.w + 2 * ZONE_PADDING, d: b.d + 2 * ZONE_PADDING };
    return { ...z, rect: intRect(clipRect(padded, bounds.room)) };
  });

  const furnitureIds = new Set(furniture.map((f) => f.id));
  const lighting = planned.lighting.filter((l) => l.itemId === undefined || furnitureIds.has(l.itemId));
  const known = new Set([...furnitureIds, ...lighting.map((l) => l.id), ...planned.textiles.map((t) => t.id)]);

  return {
    concept: planned.concept,
    zones,
    furniture,
    palette: planned.palette,
    surfaces: planned.surfaces,
    lighting,
    textiles: planned.textiles,
    longevity: { summary: planned.longevity.summary, trendItems: planned.longevity.trendItems.filter((id) => known.has(id)) },
  };
}

/** Remove furniture and every reference to it (lights on it, trend list). */
export function removeFurniture(content: DesignContent, ids: ReadonlySet<string>): DesignContent {
  const furniture = content.furniture.filter((f) => !ids.has(f.id));
  const lighting = content.lighting.filter((l) => l.itemId === undefined || !ids.has(l.itemId));
  const gone = new Set([...ids, ...content.lighting.filter((l) => !lighting.includes(l)).map((l) => l.id)]);
  return { ...content, furniture, lighting, longevity: { ...content.longevity, trendItems: content.longevity.trendItems.filter((id) => !gone.has(id)) } };
}

/**
 * Apply a repair patch to the model's plan. Unknown ids are ignored, added
 * items never replace existing ids; the resolver cleans any broken relation.
 */
export function applyPatch(plan: DesignPlanInput, patch: DesignPatch): DesignPlanInput {
  const removed = new Set(patch.remove);
  const moves = new Map(patch.move.map((m) => [m.id, m]));
  const sizes = new Map(patch.resize.map((r) => [r.id, r.sizeClass]));
  const items = plan.items
    .filter((i) => !removed.has(i.id))
    .map((item): PlanItem => {
      const m = moves.get(item.id);
      const sizeClass = sizes.get(item.id) ?? item.sizeClass;
      if (!m) return sizeClass === item.sizeClass ? item : { ...item, sizeClass };
      const anchor = m.anchor ?? (m.relativeTo !== undefined ? (isRelational(item.intent) ? item.intent.anchor : "beside") : m.wallIndex !== undefined && isRelational(item.intent) ? "wall" : item.intent.anchor);
      const relational = anchor === "beside" || anchor === "front_of" || anchor === "under";
      const intent: Intent = {
        anchor,
        ...(m.wallIndex !== undefined ? { wallIndex: m.wallIndex } : !relational && item.intent.wallIndex !== undefined ? { wallIndex: item.intent.wallIndex } : {}),
        ...(relational ? { relativeTo: m.relativeTo ?? item.intent.relativeTo } : {}),
        ...(item.intent.zoneId !== undefined ? { zoneId: item.intent.zoneId } : {}),
      };
      return { ...item, sizeClass, intent };
    });
  const ids = new Set(items.map((i) => i.id));
  for (const a of patch.add) {
    if (ids.has(a.id)) continue;
    items.push(a);
    ids.add(a.id);
  }
  return { ...plan, items };
}
