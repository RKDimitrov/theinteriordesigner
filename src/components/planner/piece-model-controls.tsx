"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Button } from "@/components/ui/button";
import { DECOR_HOSTS, dressPiece } from "@/domain/design/decor";
import type { FurnitureItem, PieceDecor } from "@/domain/schemas/design";
import { StyleKey } from "@/domain/schemas/profile";
import { usePlanner } from "./planner-context";
import { mapRoom } from "./state";
import { ASSET_CATALOGUE, BUILT_CATEGORIES, BUILT_MODEL, modelPicture, PIECE_MODELS, pieceModel } from "./three/assets";

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
  const autoPicture = auto === BUILT_MODEL ? undefined : modelPicture(auto.id);
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
              {autoPicture ? <Image src={autoPicture} alt="" width={96} height={96} unoptimized /> : <span className="pl-model-auto">{t("auto")}</span>}
              <small>{autoPicture ? `${t("auto")} · ${autoTitle}` : autoTitle}</small>
            </button>
            {models.map((m) => {
              const e = ASSET_CATALOGUE[m.id];
              const src = modelPicture(m.id);
              return (
                <button key={m.id} type="button" role="radio" aria-checked={current === m.id} data-model={m.id} title={m.styles.flatMap((s) => (isStyle(s) ? [ts(s)] : [])).join(", ")} onClick={() => set({ modelId: m.id })}>
                  {src ? <Image src={src} alt="" width={96} height={96} unoptimized /> : <span className="pl-model-auto" />}
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
      {DECOR_HOSTS[f.category] && <DecorFields roomId={roomId} f={f} set={set} />}
    </div>
  );
}

/** The props on the selected piece: remove or bring back each one, re-roll them all, or none. */
function DecorFields({ roomId, f, set }: { roomId: string; f: FurnitureItem; set: (patch: Partial<FurnitureItem>) => void }) {
  const t = useTranslations("PieceModel");
  const tk = useTranslations("DecorKind");
  const { dispatch } = usePlanner();
  const decor = f.decor ?? { seed: 0, hidden: [] };
  const all = dressPiece({ ...f, decor: { seed: decor.seed, hidden: [] } });
  const reroll = (d: PieceDecor): PieceDecor => ({ seed: (d.seed + 1) % 1_000_000, hidden: [] });

  // Dev: re-rolls every piece in the room, to see many dressings quickly.
  const rerollRoom = () =>
    dispatch({
      type: "edit",
      fn: (p) => mapRoom(p, roomId, (r) => ({ ...r, furniture: r.furniture.map((x) => (DECOR_HOSTS[x.category] ? { ...x, decor: reroll(x.decor ?? { seed: 0, hidden: [] }) } : x)) })),
    });

  return (
    <div data-testid="piece-decor">
      <span className="pl-sub" style={{ marginTop: 10 }}>
        <span>{t("decor")}</span>
        <FillSampleButton label={t("rerollRoom")} onFill={rerollRoom} />
      </span>
      {!decor.off && all.length > 0 && (
        <div className="pl-decor" role="group" aria-label={t("decor")}>
          {all.map((p) => {
            const shown = !decor.hidden.includes(p.slot);
            return (
              <button
                key={p.slot}
                type="button"
                aria-pressed={shown}
                data-testid={`decor-prop-${p.slot}`}
                onClick={() => set({ decor: { ...decor, hidden: shown ? [...decor.hidden, p.slot] : decor.hidden.filter((h) => h !== p.slot) } })}
              >
                {tk(p.kind)}
              </button>
            );
          })}
        </div>
      )}
      <div className="pl-row" style={{ marginTop: 6 }}>
        <Button size="sm" variant="outline" data-testid="decor-reroll" onClick={() => set({ decor: reroll(decor) })}>
          {t("reroll")}
        </Button>
        <Button size="sm" variant="ghost" data-testid="decor-off" onClick={() => set({ decor: { ...decor, off: !decor.off } })}>
          {decor.off ? t("decorOn") : t("decorOff")}
        </Button>
      </div>
    </div>
  );
}
