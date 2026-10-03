"use client";

import { useTranslations } from "next-intl";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Button } from "@/components/ui/button";
import type { FloorZone, InnerWall } from "@/domain/schemas/room";
import { samplePreset, SAMPLE_ZONE_HEIGHTS } from "@/lib/dev/samples";
import { NumField } from "./inspector";
import { removeSelected, usePlanner } from "./planner-context";
import { mapRoom } from "./state";

/** The selected inner wall: its length (kept from its start), thickness, and Remove. */
export function InnerWallBlock({ roomId, w }: { roomId: string; w: InnerWall }) {
  const t = useTranslations("Planner");
  const { dispatch } = usePlanner();
  const set = (next: InnerWall) =>
    dispatch({ type: "edit", fn: (p) => mapRoom(p, roomId, (r) => ({ ...r, room: { ...r.room, innerWalls: r.room.innerWalls.map((x) => (x.id === w.id ? next : x)) } })) });
  const length = Math.round(Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y));
  const setLength = (len: number) => {
    const k = length > 0 ? len / length : 1;
    set({ ...w, b: { x: Math.round(w.a.x + (w.b.x - w.a.x) * k), y: Math.round(w.a.y + (w.b.y - w.a.y) * k) } });
  };

  return (
    <div className="pl-blk" data-testid="planner-selection">
      <h3>
        <span>{t("selected")}</span>
        <span>{t("innerWall")}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: "#2b2620" }} />
        <div>
          <b>{t("innerWall")}</b>
          <small>{t("innerWallHint")}</small>
        </div>
      </div>
      <div className="pl-fg3">
        <NumField label={t("innerWallLength")} value={length} unit="cm" min={20} max={2000} onChange={setLength} testId="inner-wall-length" />
        <NumField label={t("innerWallThickness")} value={w.thickness} unit="cm" min={4} max={40} onChange={(thickness) => set({ ...w, thickness })} testId="inner-wall-thickness" />
      </div>
      <div className="pl-row">
        <Button
          size="sm"
          variant="ghost-destructive"
          onClick={() => {
            dispatch({ type: "edit", fn: (p) => removeSelected(p, { kind: "innerWall", roomId, id: w.id }) });
            dispatch({ type: "select", selection: null });
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}

/** The selected floor area: how far above or below the room's floor it is, its size, and Remove. */
export function ZoneBlock({ roomId, z }: { roomId: string; z: FloorZone }) {
  const t = useTranslations("Planner");
  const { dispatch } = usePlanner();
  const set = (next: FloorZone) =>
    dispatch({ type: "edit", fn: (p) => mapRoom(p, roomId, (r) => ({ ...r, room: { ...r.room, floorZones: r.room.floorZones.map((x) => (x.id === z.id ? next : x)) } })) });
  const label = `${z.height > 0 ? "+" : ""}${z.height} cm`;

  return (
    <div className="pl-blk" data-testid="planner-selection">
      <h3>
        <span>{t("selected")}</span>
        <span>{t("zone")}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: "#e8dcc6" }} />
        <div>
          <b>
            {t("zone")} {label}
          </b>
          <small>{t("zoneHeightHint")}</small>
        </div>
      </div>
      <div className="pl-fg3">
        {/* 0 is the room's own floor, so it is skipped rather than saved. */}
        <NumField label={t("zoneHeight")} value={z.height} unit="cm" min={-60} max={100} onChange={(height) => height !== 0 && set({ ...z, height })} testId="zone-height" />
        <NumField label={t("width")} value={z.rect.w} unit="cm" min={20} max={2000} onChange={(w) => set({ ...z, rect: { ...z.rect, w } })} />
        <NumField label={t("depth")} value={z.rect.d} unit="cm" min={20} max={2000} onChange={(d) => set({ ...z, rect: { ...z.rect, d } })} />
      </div>
      <FillSampleButton label={t("zoneSample")} onFill={(n) => set({ ...z, height: samplePreset(SAMPLE_ZONE_HEIGHTS, n) })} />
      <div className="pl-row">
        <Button
          size="sm"
          variant="ghost-destructive"
          onClick={() => {
            dispatch({ type: "edit", fn: (p) => removeSelected(p, { kind: "zone", roomId, id: z.id }) });
            dispatch({ type: "select", selection: null });
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}
