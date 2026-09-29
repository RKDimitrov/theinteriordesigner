"use client";

import { useTranslations } from "next-intl";
import { defaultOutlook, Outlook, type WallOutlooks } from "@/domain/context/outside";
import { saveRoomOutlooksAction } from "@/server/actions/planner";
import { usePlanner } from "./planner-context";

/**
 * The world outside, in the Scene tab: the apartment's surroundings and
 * floor (set in the apartment form), and, with one room in view, what each
 * of its windowed walls looks onto.
 */
export function OutsideBlock() {
  const t = useTranslations("Outside");
  const ta = useTranslations("ApartmentForm");
  const { s, dispatch, data, toast } = usePlanner();
  const sur = data.apartment.surroundings;
  const targets = s.visible3d.length > 0 ? s.visible3d : s.plan.rooms.map((r) => r.room.id);
  const single = targets.length === 1 ? s.plan.rooms.find((r) => r.room.id === targets[0]) : undefined;
  const windowWalls = single ? [...new Set(single.room.openings.filter((o) => o.kind === "window" || (o.kind === "door" && o.style === "balcony")).map((o) => o.wallIndex))].sort((a, b) => a - b) : [];
  const current: WallOutlooks = single ? (s.outlooks[single.room.id] ?? {}) : {};

  const save = async (wall: number, outlook: Outlook | null) => {
    if (!single) return;
    const before = s.outlooks;
    const next = { ...current };
    if (outlook) next[String(wall)] = outlook;
    else delete next[String(wall)];
    dispatch({ type: "set", patch: { outlooks: { ...s.outlooks, [single.room.id]: next } } });
    const res = await saveRoomOutlooksAction({ apartmentId: data.apartment.id, roomId: single.room.id, outlooks: next }).catch(() => null);
    if (!res?.ok) {
      dispatch({ type: "set", patch: { outlooks: before } });
      toast(t("saveFailed"));
    }
  };

  const extras = [sur.waterfront && ta("waterfront"), sur.mountains && ta("mountains")].filter(Boolean);
  return (
    <div className="pl-blk" data-testid="planner-outside">
      <h3>
        <span>{t("title")}</span>
        <span>{t("floor", { n: data.apartment.floorLevel })}</span>
      </h3>
      <p className="pl-hint">
        {ta(`surroundings_${sur.kind}`)}
        {extras.length > 0 && ` · ${extras.join(" · ")}`}
      </p>
      <p className="pl-hint">{t("hint")}</p>
      {windowWalls.map((i) => {
        const value = current[String(i)];
        return (
          <div key={i} className="pl-field">
            <span className="pl-sub">
              {t("wallN", { n: i + 1 })} · {t("outlook")}
            </span>
            <div className="pl-styles" role="radiogroup" aria-label={`${t("wallN", { n: i + 1 })} ${t("outlook")}`}>
              <button type="button" role="radio" aria-checked={value === undefined} onClick={() => save(i, null)}>
                {t("outlookDefault")} · {t(`outlook_${defaultOutlook(sur.kind)}`)}
              </button>
              {Outlook.options.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => save(i, o)}>
                  {t(`outlook_${o}`)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
