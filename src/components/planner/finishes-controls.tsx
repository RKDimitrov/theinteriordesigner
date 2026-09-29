"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Material, type MaterialGroup, materialsFor, resolveFinishes, type RoomFinishes, type Surface } from "@/domain/materials/library";
import { wallsOf } from "@/domain/geometry/walls";
import { saveRoomFinishesAction } from "@/server/actions/planner";
import { usePlanner } from "./planner-context";
import { materialSwatch } from "./three/surface-materials";

const EMPTY: RoomFinishes = { wallOverrides: {} };

/**
 * Floor, wall and ceiling materials for the rooms in view, saved to each
 * room. With one room in view, a single wall can take its own material.
 */
export function FinishesBlock() {
  const t = useTranslations("Planner");
  const { s, dispatch, data, toast } = usePlanner();
  const targets = s.visible3d.length > 0 ? s.visible3d : s.plan.rooms.map((r) => r.room.id);
  const first = s.finishes[targets[0] ?? ""] ?? EMPTY;
  const resolved = resolveFinishes(first);
  const single = targets.length === 1 ? s.plan.rooms.find((r) => r.room.id === targets[0]) : undefined;
  const wallCount = single ? wallsOf(single.room.polygon).length : 0;
  const [wall, setWall] = useState<number | null>(null);
  const accent = wall !== null && wall < wallCount ? wall : null;

  /** Applies `change` to every room in view (each keeps its own accent walls), then saves. */
  const save = async (change: (f: RoomFinishes) => RoomFinishes) => {
    const before = s.finishes;
    const rooms = targets.map((roomId) => ({ roomId, finishes: change(s.finishes[roomId] ?? EMPTY) }));
    dispatch({ type: "set", patch: { finishes: { ...s.finishes, ...Object.fromEntries(rooms.map((r) => [r.roomId, r.finishes])) } } });
    const res = await saveRoomFinishesAction({ apartmentId: data.apartment.id, rooms }).catch(() => null);
    if (!res?.ok) {
      dispatch({ type: "set", patch: { finishes: before } });
      toast(t("finishesSaveFailed"));
    }
  };

  const wallValue = accent === null ? resolved.walls : resolved.wall(accent);
  const override = accent !== null ? first.wallOverrides[String(accent)] : undefined;

  return (
    <>
      <MaterialPicker surface="floor" label={t("floor")} value={resolved.floor} onPick={(id) => save((f) => ({ ...f, floor: id }))} testId="finish-floor" />
      <div className="pl-blk" data-testid="finish-walls">
        {single && wallCount > 0 && (
          <div className="pl-styles" role="radiogroup" aria-label={t("accentWall")} style={{ marginBottom: 8 }}>
            <button type="button" role="radio" aria-checked={accent === null} onClick={() => setWall(null)}>
              {t("allWalls")}
            </button>
            {Array.from({ length: wallCount }, (_, i) => (
              <button key={i} type="button" role="radio" aria-checked={accent === i} onClick={() => setWall(i)}>
                {t("wallN", { n: i + 1 })}
              </button>
            ))}
          </div>
        )}
        <MaterialPicker
          surface="wall"
          label={accent === null ? t("walls") : `${t("accentWall")} · ${t("wallN", { n: accent + 1 })}`}
          value={wallValue}
          bare
          onPick={(id) =>
            save((f) => (accent === null ? { ...f, walls: id } : { ...f, wallOverrides: { ...f.wallOverrides, [String(accent)]: id } }))
          }
        />
        {override && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() =>
              save((f) => {
                const rest = { ...f.wallOverrides };
                delete rest[String(accent)];
                return { ...f, wallOverrides: rest };
              })
            }
          >
            {t("clearAccent")}
          </Button>
        )}
      </div>
      <MaterialPicker surface="ceiling" label={t("ceiling")} value={resolved.ceiling} onPick={(id) => save((f) => ({ ...f, ceiling: id }))} testId="finish-ceiling" />
    </>
  );
}

/** Swatches for one surface, grouped (paint, plaster, wood …) and searchable by name. */
function MaterialPicker({ surface, label, value, onPick, bare = false, testId }: { surface: Surface; label: string; value: Material; onPick: (id: string) => void; bare?: boolean; testId?: string }) {
  const t = useTranslations("Planner");
  const tMat = useTranslations("Material");
  const tGroup = useTranslations("MaterialGroup");
  // Every id has a name in en, de and bg (checked in materials-i18n.test.ts).
  const tm = (id: string) => tMat(id as Parameters<typeof tMat>[0]);
  const tg = (g: MaterialGroup) => tGroup(g);
  const [group, setGroup] = useState<MaterialGroup | null>(null);
  const [query, setQuery] = useState("");
  const all = useMemo(() => materialsFor(surface), [surface]);
  const groups = useMemo(() => [...new Set(all.map((m) => m.group))], [all]);
  const q = query.trim().toLowerCase();
  const shown = all.filter((m) => (!group || m.group === group) && (!q || tm(m.id).toLowerCase().includes(q) || tg(m.group).toLowerCase().includes(q)));

  const body = (
    <>
      <h3>
        <span>{label}</span>
        <span>{tm(value.id)}</span>
      </h3>
      <div className="pl-styles" role="radiogroup" aria-label={`${label}: ${t("categories")}`}>
        {groups.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(group === g ? null : g)}>
            {tg(g)}
          </button>
        ))}
      </div>
      <label className="pl-search" style={{ margin: "8px 0" }}>
        <Search className="ic" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchMaterials")} aria-label={`${label}: ${t("searchMaterials")}`} />
      </label>
      {shown.length === 0 ? (
        <p className="pl-hint">{t("noMaterials")}</p>
      ) : (
        <div className="pl-sws pl-sws-fine" role="radiogroup" aria-label={label}>
          {shown.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={value.id === m.id}
              aria-label={tm(m.id)}
              title={tm(m.id)}
              data-material={m.id}
              style={{ background: materialSwatch(m) }}
              onClick={() => onPick(m.id)}
            />
          ))}
        </div>
      )}
    </>
  );
  return bare ? body : (
    <div className="pl-blk" data-testid={testId}>
      {body}
    </div>
  );
}
