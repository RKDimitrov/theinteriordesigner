"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FIXTURE_KINDS, FIXTURE_SPEC, type FixtureKind, fixtureSize, isFixtureKind, resizeFixture } from "@/domain/room/fixtures";
import type { FixedElement, KitchenOptions } from "@/domain/schemas/room";
import { NumField } from "./inspector";
import { removeSelected, usePlanner } from "./planner-context";
import { mapRoom } from "./state";
import { ASSET_CATALOGUE } from "./three/assets";
import { FIXTURE_MODELS, fixtureModel } from "./three/fixture-assets";

/** What the fixture tool places next (shown while the tool is active). */
export function FixturePicker() {
  const t = useTranslations("Fixture");
  const { s, dispatch } = usePlanner();
  return (
    <div className="pl-blk" data-testid="fixture-picker">
      <h3>
        <span>{t("title")}</span>
      </h3>
      <div className="pl-field">
        <span className="pl-sub">{t("pick")}</span>
        <div className="pl-styles" role="radiogroup" aria-label={t("pick")}>
          {FIXTURE_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={s.fixtureKind === k} onClick={() => dispatch({ type: "set", patch: { fixtureKind: k } })}>
              {t(`kind_${k}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The selected fixed element: size, kitchen options, model, remove. */
export function FixedBlock({ roomId, f, ceiling }: { roomId: string; f: FixedElement; ceiling: number }) {
  const t = useTranslations("Fixture");
  const tp = useTranslations("Planner");
  const { dispatch } = usePlanner();
  const set = (next: FixedElement) =>
    dispatch({ type: "edit", fn: (p) => mapRoom(p, roomId, (r) => ({ ...r, room: { ...r.room, fixedElements: r.room.fixedElements.map((x) => (x.id === f.id ? next : x)) } })) });
  const size = fixtureSize(f);
  const fixture = isFixtureKind(f.kind) ? f.kind : null;
  const kitchen = f.kitchen ?? { sink: true, hob: true, oven: true, wallUnits: true };
  const setKitchen = (patch: Partial<KitchenOptions>) => set({ ...f, kitchen: { ...kitchen, ...patch } });

  return (
    <div className="pl-blk" data-testid="planner-selection">
      <h3>
        <span>{tp("selected")}</span>
        <span>{t(`kind_${f.kind}`)}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: "#e8dcc6" }} />
        <div>
          <b>{f.label}</b>
          <small>
            {t("fixedHint")}
            {fixture && FIXTURE_SPEC[fixture].front > 0 && <> · {t("clearance", { cm: FIXTURE_SPEC[fixture].front })}</>}
          </small>
        </div>
      </div>
      <div className="pl-fg3">
        <NumField label={tp("width")} value={size.w} unit="cm" min={10} max={600} onChange={(w) => set(resizeFixture(f, { ...size, w }))} />
        <NumField label={tp("depth")} value={size.d} unit="cm" min={10} max={300} onChange={(d) => set(resizeFixture(f, { ...size, d }))} />
        <NumField label={tp("height")} value={f.height} unit="cm" min={5} max={ceiling} onChange={(height) => set({ ...f, height })} />
      </div>
      {f.kind === "kitchen_run" && (
        <div className="pl-tg" role="group" aria-label={t("kind_kitchen_run")}>
          {(
            [
              ["sink", kitchen.sink, () => setKitchen({ sink: !kitchen.sink })],
              ["cooker", kitchen.hob || kitchen.oven, () => setKitchen({ hob: !(kitchen.hob || kitchen.oven), oven: !(kitchen.hob || kitchen.oven) })],
              ["wallUnits", kitchen.wallUnits, () => setKitchen({ wallUnits: !kitchen.wallUnits })],
            ] as const
          ).map(([key, on, toggle]) => (
            <button key={key} type="button" aria-pressed={on} style={{ flex: 1 }} onClick={toggle}>
              {t(key)}
            </button>
          ))}
        </div>
      )}
      {fixture && fixture !== "kitchen_run" && FIXTURE_MODELS[fixture].length > 1 && <ModelPicker kind={fixture} f={f} set={set} />}
      <div className="pl-row">
        <Button
          size="sm"
          variant="ghost-destructive"
          onClick={() => {
            dispatch({ type: "edit", fn: (p) => removeSelected(p, { kind: "fixed", roomId, id: f.id }) });
            dispatch({ type: "select", selection: null });
          }}
        >
          {tp("remove")}
        </Button>
      </div>
    </div>
  );
}

function ModelPicker({ kind, f, set }: { kind: Exclude<FixtureKind, "kitchen_run">; f: FixedElement; set: (f: FixedElement) => void }) {
  const t = useTranslations("Fixture");
  const current = fixtureModel(kind, f.model).id;
  return (
    <div className="pl-field">
      <span className="pl-sub">{t("model")}</span>
      <div className="pl-styles" role="radiogroup" aria-label={t("model")}>
        {FIXTURE_MODELS[kind].map((v) => (
          <button key={v.id} type="button" role="radio" aria-checked={current === v.id} onClick={() => set({ ...f, model: v.id })}>
            {ASSET_CATALOGUE[v.id]?.title ?? v.id}
          </button>
        ))}
      </div>
    </div>
  );
}
