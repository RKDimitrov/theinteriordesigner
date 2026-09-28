"use client";

import { useTranslations } from "next-intl";
import { applyDoorStyle, applyRadiatorStyle, applyWindowStyle, doorStyle, type FitOut, radiatorStyle, slides, windowStyle } from "@/domain/room/fit-out";
import { DoorFinish, DoorStyle, FrameFinish, type Opening, RadiatorFinish, RadiatorStyle, WindowStyle } from "@/domain/schemas/room";
import { saveFitOutAction } from "@/server/actions/planner";
import { usePlanner } from "./planner-context";
import { DOOR_LOOK, FRAME_LOOK, type Look, RADIATOR_LOOK, swatchOf } from "./three/fit-out-look";

/* ---------------- pickers ---------------- */

function StylePicker<T extends string>({ label, value, options, name, onPick }: { label: string; value: T; options: readonly T[]; name: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className="pl-field">
      <span className="pl-sub">{label}</span>
      <div className="pl-styles" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} title={name(o)} onClick={() => onPick(o)}>
            {name(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Finish swatches. With `fallback` (the apartment default) the first swatch
 * clears the override; `value` undefined means "use the default".
 */
function FinishPicker<T extends string>({
  label,
  value,
  looks,
  name,
  onPick,
  fallback,
}: {
  label: string;
  value: T | undefined;
  looks: Readonly<Record<T, Look>>;
  name: (v: T) => string;
  onPick: (v: T | undefined) => void;
  fallback?: T;
}) {
  const t = useTranslations("FitOut");
  const options = Object.keys(looks) as T[];
  const current = value ?? fallback;
  return (
    <div className="pl-field">
      <span className="pl-sub">
        {label}
        {current && <em>{value === undefined && fallback ? `${t("default")} · ${name(fallback)}` : name(current)}</em>}
      </span>
      <div className="pl-sws pl-sws-fine" role="radiogroup" aria-label={label}>
        {fallback && (
          <button
            type="button"
            role="radio"
            className="def"
            aria-checked={value === undefined}
            aria-label={`${t("default")} (${name(fallback)})`}
            title={`${t("default")} (${name(fallback)})`}
            style={{ background: swatchOf(looks[fallback]) }}
            onClick={() => onPick(undefined)}
          />
        )}
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} aria-label={name(o)} title={name(o)} style={{ background: swatchOf(looks[o]) }} onClick={() => onPick(o)} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- one selected opening (inspector) ---------------- */

/**
 * Type and finish of the selected door, window or radiator. `set` replaces
 * the opening; it keeps the opening on its wall.
 */
export function OpeningStyleFields({ o, ceiling, set }: { o: Opening; ceiling: number; set: (next: Opening) => void }) {
  const t = useTranslations("FitOut");
  const tp = useTranslations("Planner");
  const { s } = usePlanner();

  if (o.kind === "door") {
    // A pass-through has no leaf: only in/out/none, so it can become a door again.
    const swingOptions = o.swing === "none" ? (["in", "out", "none"] as const) : (["in", "out"] as const);
    const style = doorStyle(o);
    return (
      <>
        {o.swing !== "none" && <StylePicker label={t("type")} value={style} options={DoorStyle.options} name={(v) => t(`door_${v}`)} onPick={(v) => set(applyDoorStyle(o, v))} />}
        {!slides(o) && (
          <div className="pl-field pl-tg" role="radiogroup" aria-label={tp("swing")}>
            {swingOptions.map((sw) => (
              <button key={sw} type="button" role="radio" aria-checked={o.swing === sw} style={{ flex: 1 }} onClick={() => set({ ...o, swing: sw })}>
                {tp(`swing_${sw}`)}
              </button>
            ))}
          </div>
        )}
        {o.swing !== "none" && style !== "double" && (
          <div className="pl-field pl-tg" role="radiogroup" aria-label={slides(o) ? t("slideTo") : tp("hinge")}>
            {(["start", "end"] as const).map((h) => (
              <button key={h} type="button" role="radio" aria-checked={o.hinge === h} style={{ flex: 1 }} onClick={() => set({ ...o, hinge: h })}>
                {tp(`hinge_${h}`)}
              </button>
            ))}
          </div>
        )}
        {o.swing !== "none" && (
          <FinishPicker label={t("finish")} value={o.finish} looks={DOOR_LOOK} name={(v) => t(`doorFinish_${v}`)} fallback={s.fitOut.doors.finish} onPick={(finish) => set({ ...o, finish })} />
        )}
      </>
    );
  }
  if (o.kind === "window")
    return (
      <>
        <StylePicker label={t("type")} value={windowStyle(o)} options={WindowStyle.options} name={(v) => t(`window_${v}`)} onPick={(v) => set(applyWindowStyle(o, v, ceiling))} />
        <FinishPicker label={t("frame")} value={o.finish} looks={FRAME_LOOK} name={(v) => t(`frameFinish_${v}`)} fallback={s.fitOut.windows.finish} onPick={(finish) => set({ ...o, finish })} />
      </>
    );
  if (o.kind === "radiator")
    return (
      <>
        <StylePicker label={t("type")} value={radiatorStyle(o)} options={RadiatorStyle.options} name={(v) => t(`radiator_${v}`)} onPick={(v) => set(applyRadiatorStyle(o, v))} />
        <FinishPicker label={t("finish")} value={o.finish} looks={RADIATOR_LOOK} name={(v) => t(`radiatorFinish_${v}`)} fallback={s.fitOut.radiators.finish} onPick={(finish) => set({ ...o, finish })} />
      </>
    );
  return null;
}

/* ---------------- apartment defaults (Finishes tab) ---------------- */

export function FitOutBlock() {
  const t = useTranslations("FitOut");
  const { s, dispatch, data, toast } = usePlanner();
  const fit = s.fitOut;

  const save = async (next: FitOut) => {
    const before = fit;
    dispatch({ type: "set", patch: { fitOut: next } });
    const res = await saveFitOutAction({ apartmentId: data.apartment.id, fitOut: next }).catch(() => null);
    if (!res?.ok) {
      dispatch({ type: "set", patch: { fitOut: before } });
      toast(t("saveFailed"));
    }
  };

  return (
    <div className="pl-blk" data-testid="planner-fit-out">
      <h3>
        <span>{t("title")}</span>
      </h3>
      <p className="pl-hint">{t("hint")}</p>
      <h4 className="pl-sub">{t("doors")}</h4>
      <StylePicker label={t("type")} value={fit.doors.style} options={DoorStyle.options} name={(v) => t(`door_${v}`)} onPick={(style) => save({ ...fit, doors: { ...fit.doors, style } })} />
      <FinishPicker label={t("finish")} value={fit.doors.finish} looks={DOOR_LOOK} name={(v: DoorFinish) => t(`doorFinish_${v}`)} onPick={(finish) => finish && save({ ...fit, doors: { ...fit.doors, finish } })} />
      <h4 className="pl-sub">{t("windows")}</h4>
      <StylePicker label={t("type")} value={fit.windows.style} options={WindowStyle.options} name={(v) => t(`window_${v}`)} onPick={(style) => save({ ...fit, windows: { ...fit.windows, style } })} />
      <FinishPicker label={t("frame")} value={fit.windows.finish} looks={FRAME_LOOK} name={(v: FrameFinish) => t(`frameFinish_${v}`)} onPick={(finish) => finish && save({ ...fit, windows: { ...fit.windows, finish } })} />
      <h4 className="pl-sub">{t("radiators")}</h4>
      <StylePicker label={t("type")} value={fit.radiators.style} options={RadiatorStyle.options} name={(v) => t(`radiator_${v}`)} onPick={(style) => save({ ...fit, radiators: { ...fit.radiators, style } })} />
      <FinishPicker label={t("finish")} value={fit.radiators.finish} looks={RADIATOR_LOOK} name={(v: RadiatorFinish) => t(`radiatorFinish_${v}`)} onPick={(finish) => finish && save({ ...fit, radiators: { ...fit.radiators, finish } })} />
    </div>
  );
}
