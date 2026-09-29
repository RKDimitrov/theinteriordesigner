"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import type { FurnitureItem } from "@/domain/schemas/design";
import { StyleKey } from "@/domain/schemas/profile";
import { usePlanner } from "./planner-context";
import { mapRoom } from "./state";
import { ASSET_CATALOGUE, BUILT_CATEGORIES, BUILT_MODEL, PIECE_MODELS, pieceModel } from "./three/assets";

const isStyle = (s: string): s is StyleKey => (StyleKey.options as readonly string[]).includes(s);

/**
 * The selected piece's look in 3D: its colour (upholstery takes it) and which
 * real model shows it. "Automatic" lets the planner choose for the size and
 * the style profile.
 */
export function PieceLook({ roomId, f, set }: { roomId: string; f: FurnitureItem; set: (patch: Partial<FurnitureItem>) => void }) {
  const t = useTranslations("PieceModel");
  const ts = useTranslations("StyleName");
  const { data, dispatch } = usePlanner();
  const models = PIECE_MODELS[f.category];
  const built = BUILT_CATEGORIES.has(f.category);
  const auto = pieceModel(f.category, undefined, f.w, f.d, f.h, data.styles);
  const autoTitle = auto === BUILT_MODEL ? t("built") : (ASSET_CATALOGUE[auto.id]?.title ?? auto.id);
  const current = f.modelId && (f.modelId === BUILT_MODEL ? built : models.some((m) => m.id === f.modelId)) ? f.modelId : undefined;

  // Dev: moves every piece in the room on to its next model, to check them all quickly.
  const vary = () =>
    dispatch({
      type: "edit",
      fn: (p) =>
        mapRoom(p, roomId, (r) => ({
          ...r,
          furniture: r.furniture.map((x) => {
            const opts = PIECE_MODELS[x.category];
            const at = opts.findIndex((o) => o.id === x.modelId);
            return opts.length === 0 ? x : { ...x, modelId: opts[(at + 1) % opts.length]!.id };
          }),
        })),
    });

  return (
    <div className="pl-field" data-testid="piece-look">
      <div className="pl-sub">
        <span>{t("colour")}</span>
        <input type="color" className="pl-colour" value={f.colorHex} aria-label={t("colour")} data-testid="sel-colour" onChange={(e) => set({ colorHex: e.target.value })} />
      </div>
      {models.length > 0 && (
        <>
          <span className="pl-sub">
            <span>{t("title")}</span>
            <FillSampleButton label={t("vary")} onFill={vary} />
          </span>
          <div className="pl-models" role="radiogroup" aria-label={t("title")} data-testid="piece-models">
            <button type="button" role="radio" aria-checked={current === undefined} data-model="" onClick={() => set({ modelId: undefined })}>
              <span className="pl-model-auto">{t("auto")}</span>
              <small>{autoTitle}</small>
            </button>
            {models.map((m) => {
              const e = ASSET_CATALOGUE[m.id];
              return (
                <button key={m.id} type="button" role="radio" aria-checked={current === m.id} data-model={m.id} title={m.styles.flatMap((s) => (isStyle(s) ? [ts(s)] : [])).join(", ")} onClick={() => set({ modelId: m.id })}>
                  {e?.thumb ? <Image src={e.thumb} alt="" width={96} height={96} unoptimized /> : <span className="pl-model-auto" />}
                  <small>{e?.title ?? m.id}</small>
                </button>
              );
            })}
            {built && (
              <button type="button" role="radio" aria-checked={current === BUILT_MODEL} data-model={BUILT_MODEL} onClick={() => set({ modelId: BUILT_MODEL })}>
                <span className="pl-model-auto">{t("built")}</span>
                <small>{t("builtHint")}</small>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
