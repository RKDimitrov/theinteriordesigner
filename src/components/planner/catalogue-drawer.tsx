"use client";

import { ChevronDown, Search, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Fragment, useMemo, useState } from "react";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { CATALOGUE_GROUPS, type CatalogueGroup, type CataloguePiece, swapItem, SYMBOL_OF } from "@/domain/planner/items";
import { sampleModel } from "@/lib/dev/samples";
import { usePlanner } from "./planner-context";
import { mapItem } from "./state";
import { SymbolPreview } from "./symbols";
import { ASSET_CATALOGUE, BUILT_MODEL, modelPicture, PIECE_MODELS, pieceModel } from "./three/assets";

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
  const { s, dispatch, data, pieces, pieceName, len, unit, toast } = usePlanner();
  const [query, setQuery] = useState("");
  /** The card whose models are laid out for browsing. */
  const [browsing, setBrowsing] = useState<string | null>(null);

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

  /** Picks a piece; with `modelId`, that exact model instead of the automatic choice. */
  const pick = (key: string, modelId?: string) => {
    const piece = pieces.find((p) => p.key === key);
    if (!piece) return;
    if (swapTarget) {
      dispatch({ type: "edit", fn: (pl) => mapItem(pl, swapTarget.roomId, swapTarget.item.id, (f) => ({ ...swapItem(f, piece, pieceName(piece)), modelId })) });
      dispatch({ type: "set", patch: { swapFor: null } });
      toast(t("swapped", { name: pieceName(piece) }));
      return;
    }
    const again = s.armed === key && (s.armedModel ?? undefined) === modelId;
    dispatch({ type: "set", patch: { armed: again ? null : key, armedModel: again ? null : (modelId ?? null), tool: "select" } });
  };

  /** The real models of a piece's category; the user's own pieces have none to choose from. */
  const modelsOf = (p: CataloguePiece) => (p.mine ? [] : PIECE_MODELS[p.category]);

  /** The picture of the model that will be placed: the one picked from the strip, else the automatic choice. */
  const pictureOf = (p: CataloguePiece): string | undefined => {
    if (p.mine) return undefined;
    if (s.armed === p.key && s.armedModel && modelsOf(p).some((m) => m.id === s.armedModel)) return modelPicture(s.armedModel);
    const auto = pieceModel(p.category, undefined, p.w, p.d, p.h, data.styles);
    return auto === BUILT_MODEL ? undefined : modelPicture(auto.id);
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
        <button type="button" className="pl-ib" onClick={() => dispatch({ type: "set", patch: { drawerOpen: false, armed: null, armedModel: null, swapFor: null } })} aria-label={t("closeCatalogue")}>
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
          const picture = pictureOf(p);
          const models = modelsOf(p);
          const open = browsing === p.key;
          const drawing = <SymbolPreview kind={SYMBOL_OF[p.category]} w={p.w} d={p.d} color={p.colorHex} />;
          return (
            <Fragment key={p.key}>
              <div className="pl-pc-cell">
                <button type="button" className="pl-pc" aria-pressed={s.armed === p.key} data-testid={`catalogue-piece-${p.key}`} onClick={() => pick(p.key)}>
                  {tag && (
                    <span className="pl-pc-tag" data-mine={p.mine ? "" : undefined}>
                      {tag}
                    </span>
                  )}
                  {picture ? (
                    <span className="pl-pc-pic">
                      <Image src={picture} alt="" width={192} height={192} unoptimized />
                      {/* The footprint, drawn to scale like the plan. */}
                      <span className="pl-pc-foot">{drawing}</span>
                    </span>
                  ) : (
                    drawing
                  )}
                  <b>{pieceName(p)}</b>
                  <small>
                    {t("pieceSize", { w: len(p.w), d: len(p.d), unit })} · {p.mine ? ts("existing") : t(`size_${p.sizeClass}`)}
                  </small>
                </button>
                {models.length > 1 && (
                  <button type="button" className="pl-pc-more" aria-expanded={open} data-testid={`catalogue-models-${p.key}`} onClick={() => setBrowsing(open ? null : p.key)}>
                    {t("modelsCount", { count: models.length })} <ChevronDown className="ic" />
                  </button>
                )}
              </div>
              {open && (
                <div className="pl-pc-strip" data-testid="catalogue-model-strip">
                  <span className="pl-sub">
                    <span>{t("modelsOf", { name: pieceName(p) })}</span>
                    <FillSampleButton label={t("armSample")} onFill={(n) => pick(p.key, sampleModel(p.category, models.map((m) => m.id), n))} />
                  </span>
                  <div className="pl-models" role="radiogroup" aria-label={t("modelsOf", { name: pieceName(p) })}>
                    {models.map((m) => {
                      const src = modelPicture(m.id);
                      return (
                        <button key={m.id} type="button" role="radio" aria-checked={s.armed === p.key && s.armedModel === m.id} data-model={m.id} onClick={() => pick(p.key, m.id)}>
                          {src ? <Image src={src} alt="" width={96} height={96} unoptimized /> : <span className="pl-model-auto" />}
                          <small>{ASSET_CATALOGUE[m.id]?.title ?? m.id}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      <footer aria-live="polite">{footer}</footer>
    </aside>
  );
}
