"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { roomLit } from "@/domain/planner/lighting";
import { usePlanner } from "./planner-context";

const TEMPERATURES = [2700, 3000, 4000] as const;

/**
 * Light switches for the rooms in view (lights come on by themselves after
 * dark until switched by hand) and the lamps' colour temperature.
 */
export function LightsBlock() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const rooms = s.plan.rooms.filter((r) => s.visible3d.length === 0 || s.visible3d.includes(r.room.id));
  const setRoom = (id: string, on: boolean) => dispatch({ type: "set", patch: { lightsSwitched: { ...s.lightsSwitched, [id]: on } } });
  return (
    <div className="pl-blk" data-testid="planner-lights">
      <h3>
        <span>{t("lights")}</span>
        <span>{t(`kelvin_${s.scene.lightKelvin}` as `kelvin_${(typeof TEMPERATURES)[number]}`)}</span>
      </h3>
      {rooms.map((r) => (
        <label key={r.room.id} className="pl-toggle">
          <span>{r.room.name}</span>
          <Switch checked={roomLit(r.room.id, s.lightsSwitched, s.scene.hour)} onCheckedChange={(on) => setRoom(r.room.id, on)} aria-label={t("lightsIn", { room: r.room.name })} />
        </label>
      ))}
      <div className="pl-styles" role="radiogroup" aria-label={t("lightColour")} style={{ marginTop: 8 }}>
        {TEMPERATURES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={s.scene.lightKelvin === k} onClick={() => dispatch({ type: "set", patch: { scene: { ...s.scene, lightKelvin: k } } })}>
            {t(`kelvin_${k}`)}
          </button>
        ))}
      </div>
      <p className="pl-hint">{t("lightsHint")}</p>
    </div>
  );
}
