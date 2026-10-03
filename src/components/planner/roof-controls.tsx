"use client";

import { useTranslations } from "next-intl";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Switch } from "@/components/ui/switch";
import { wallsOf } from "@/domain/geometry/walls";
import type { RoofSlope } from "@/domain/schemas/room";
import { sampleRoofSlopes } from "@/lib/dev/samples";
import { NumField } from "./inspector";
import { usePlanner } from "./planner-context";
import { mapRoom } from "./state";

/** A slope as most attic rooms have it: 170 cm at the wall, full height 90 cm in. */
const DEFAULT_SLOPE = { kneeHeight: 170, depth: 90 } as const;

/**
 * Where the roof cuts the room in focus: per wall, whether the ceiling comes
 * down there, how high it is at the wall, and how far in the full height starts.
 */
export function RoofBlock() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const room = s.scope === "all" ? undefined : s.plan.rooms.find((r) => r.room.id === s.scope)?.room;
  if (!room) return null;
  const walls = wallsOf(room.polygon);
  const slopes = room.roofSlopes ?? [];
  const setSlopes = (next: RoofSlope[]) =>
    dispatch({ type: "edit", fn: (p) => mapRoom(p, room.id, (r) => ({ ...r, room: { ...r.room, roofSlopes: [...next].sort((a, b) => a.wallIndex - b.wallIndex) } })) });
  const patch = (wallIndex: number, change: Partial<RoofSlope>) => setSlopes(slopes.map((x) => (x.wallIndex === wallIndex ? { ...x, ...change } : x)));
  const maxKnee = room.ceilingHeight - 1;

  return (
    <div className="pl-blk" data-testid="planner-roof">
      <h3>
        <span>{t("roofSlopes")}</span>
        <FillSampleButton label={t("roofSample")} onFill={(n) => setSlopes(sampleRoofSlopes(room.polygon, n))} />
      </h3>
      {walls.map((w) => {
        const slope = slopes.find((x) => x.wallIndex === w.index);
        const label = `${t("wallN", { n: w.index + 1 })} · ${Math.round(w.length)} cm`;
        return (
          <div key={w.index} data-testid={`roof-wall-${w.index}`}>
            <label className="pl-toggle">
              <span>{label}</span>
              <Switch
                checked={!!slope}
                aria-label={t("roofOnWall", { n: w.index + 1 })}
                onCheckedChange={(on) => setSlopes(on ? [...slopes, { wallIndex: w.index, kneeHeight: Math.min(DEFAULT_SLOPE.kneeHeight, maxKnee), depth: DEFAULT_SLOPE.depth }] : slopes.filter((x) => x.wallIndex !== w.index))}
              />
            </label>
            {slope && (
              <div className="pl-row" style={{ marginBottom: 8 }}>
                <NumField label={t("roofKnee")} value={slope.kneeHeight} unit="cm" min={30} max={maxKnee} onChange={(kneeHeight) => patch(w.index, { kneeHeight })} testId={`roof-knee-${w.index}`} />
                <NumField label={t("roofDepth")} value={slope.depth} unit="cm" min={10} max={1000} onChange={(depth) => patch(w.index, { depth })} testId={`roof-depth-${w.index}`} />
              </div>
            )}
          </div>
        );
      })}
      <p className="pl-hint">{t("roofHint", { full: room.ceilingHeight })}</p>
    </div>
  );
}
