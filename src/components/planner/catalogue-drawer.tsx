"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CATALOGUE_GROUPS, type CatalogueGroup, swapItem, SYMBOL_OF } from "@/domain/planner/items";
import { usePlanner } from "./planner-context";
import { mapItem } from "./state";
import { SymbolPreview } from "./symbols";

const CATS: readonly { g: CatalogueGroup; adv?: boolean }[] = [
  { g: "living" },
  { g: "bedroom" },
  { g: "dining" },
  { g: "office" },
  { g: "storage", adv: true },
  { g: "lighting", adv: true },
  { g: "textiles", adv: true },
  { g: "plants" },
  { g: "mine" },
];

export function CatalogueDrawer({ category, onCategory }: { category: CatalogueGroup | null; onCategory: (g: CatalogueGroup | null) => void }) {
  const t = useTranslations("Planner");
  const ts = useTranslations("Design");
  const { s, dispatch, pieces, pieceName, len, unit, toast } = usePlanner();
  const [query, setQuery] = useState("");

  const inPlan = useMemo(() => new Set(s.plan.rooms.flatMap((r) => r.furniture.map((f) => `${f.category}-${f.sizeClass ?? ""}`))), [s.plan.rooms]);
  const ownedInPlan = useMemo(() => new Set(s.plan.rooms.flatMap((r) => r.furniture.filter((f) => f.existing).map((f) => f.name))), [s.plan.rooms]);

  const swapTarget = useMemo(() => {
    if (!s.swapFor || s.selection?.kind !== "item") return null;
    const sel = s.selection;
    const f = s.plan.rooms.find((r) => r.room.id === sel.roomId)?.furniture.find((x) => x.id === s.swapFor);
    return f ? { roomId: sel.roomId, item: f } : null;
  }, [s.swapFor, s.selection, s.plan.rooms]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cat = swapTarget ? null : category;
    return pieces.filter((p) => {
      if (swapTarget && p.category !== swapTarget.item.category) return false;
      if (cat === "mine" && !p.mine) return false;
      if (cat && cat !== "mine" && !(CATALOGUE_GROUPS[cat] as readonly string[]).includes(p.category)) return false;
      if (q && !pieceName(p).toLowerCase().includes(q) && !p.category.includes(q)) return false;
      return true;
    });
  }, [pieces, category, query, pieceName, swapTarget]);

  const armedPiece = pieces.find((p) => p.key === s.armed);

  const pick = (key: string) => {
    const piece = pieces.find((p) => p.key === key);
    if (!piece) return;
    if (swapTarget) {
      dispatch({ type: "edit", fn: (pl) => mapItem(pl, swapTarget.roomId, swapTarget.item.id, (f) => swapItem(f, piece, pieceName(piece))) });
      dispatch({ type: "set", patch: { swapFor: null } });
      toast(t("swapped", { name: pieceName(piece) }));
      return;
    }
    dispatch({ type: "set", patch: { armed: s.armed === key ? null : key, tool: "select" } });
  };

  const footer = swapTarget
    ? t("swapPick", { name: swapTarget.item.name })
    : armedPiece
      ? t("placeArmed", { name: pieceName(armedPiece) })
      : t("catalogueFoot");

  return (
    <aside className="pl-drawer" aria-label={t("catalogue")}>
      <header>
        <div>
          <h2>{t("catalogue")}</h2>
          <small>{t("catalogueCount", { count: pieces.length })}</small>
        </div>
        <button type="button" className="pl-ib" onClick={() => dispatch({ type: "set", patch: { drawerOpen: false, armed: null, swapFor: null } })} aria-label={t("closeCatalogue")}>
          <X className="ic" />
        </button>
      </header>
      <label className="pl-search">
        <Search className="ic" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
      </label>
      <div className="pl-cats" role="radiogroup" aria-label={t("categories")}>
        {CATS.map(({ g, adv }) => (
          <button
            key={g}
            type="button"
            role="radio"
            className={`pl-chip${adv ? " adv" : ""}`}
            aria-checked={category === g}
            onClick={() => onCategory(category === g ? null : g)}
          >
            {t(`cat_${g}`)}
          </button>
        ))}
      </div>
      <div className="pl-pieces">
        {shown.length === 0 && <p className="pl-hint" style={{ gridColumn: "1 / -1" }}>{t("noPieces")}</p>}
        {shown.map((p) => {
          const tag = p.mine ? (ownedInPlan.has(p.name ?? "") ? t("tagInPlan") : t("tagMine")) : inPlan.has(`${p.category}-${p.sizeClass}`) ? t("tagInPlan") : null;
          return (
            <button
              key={p.key}
              type="button"
              className="pl-pc"
              aria-pressed={s.armed === p.key}
              data-testid={`catalogue-piece-${p.key}`}
              onClick={() => pick(p.key)}
            >
              {tag && (
                <span className="pl-pc-tag" data-mine={p.mine ? "" : undefined}>
                  {tag}
                </span>
              )}
              <SymbolPreview kind={SYMBOL_OF[p.category]} w={p.w} d={p.d} color={p.colorHex} />
              <b>{pieceName(p)}</b>
              <small>
                {t("pieceSize", { w: len(p.w), d: len(p.d), unit })} · {p.mine ? ts("existing") : t(`size_${p.sizeClass}`)}
              </small>
            </button>
          );
        })}
      </div>
      <footer aria-live="polite">{footer}</footer>
    </aside>
  );
}
