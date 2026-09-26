"use client";

import { BrickWall, Box, DoorOpen, Eye, EyeOff, Grid3x3, Image, Layers, MoveHorizontal, PlugZap, Sparkles, Type, type LucideIcon, Armchair } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clampOffset } from "@/domain/room/openings-edit";
import { wallsOf } from "@/domain/geometry/walls";
import type { FurnitureItem } from "@/domain/schemas/design";
import type { Opening } from "@/domain/schemas/room";
import { DesignerTab } from "./designer-tab";
import { removeSelected, usePlanner } from "./planner-context";
import { BASIC_LAYERS, type LayerId, LAYERS, mapItem, mapRoom } from "./state";

const LAYER_ICON: Record<LayerId, LucideIcon> = {
  walls: BrickWall,
  openings: DoorOpen,
  furniture: Armchair,
  suggestions: Sparkles,
  labels: Type,
  dimensions: MoveHorizontal,
  electrical: PlugZap,
  floor: Layers,
  grid: Grid3x3,
  reference: Image,
};

export function Inspector2D() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  return (
    <aside className="pl-insp" aria-label={t("inspector")}>
      <div className="pl-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={s.tab2d === "plan"} onClick={() => dispatch({ type: "set", patch: { tab2d: "plan" } })}>
          <Layers className="ic" /> {t("tabPlan")}
        </button>
        <button type="button" role="tab" aria-selected={s.tab2d === "designer"} data-testid="planner-tab-designer" onClick={() => dispatch({ type: "set", patch: { tab2d: "designer" } })}>
          <Sparkles className="ic" /> {t("tabDesigner")}
        </button>
      </div>
      <div className="pl-pane" role="tabpanel">
        {s.tab2d === "plan" ? (
          <>
            <SelectionBlock />
            <LayersBlock />
          </>
        ) : (
          <DesignerTab />
        )}
      </div>
    </aside>
  );
}

/** Selected piece or opening, or the empty hint. Also used in 3D's Selection tab. */
export function SelectionBlock() {
  const t = useTranslations("Planner");
  const { s, view } = usePlanner();
  const sel = s.selection;
  const room = sel ? s.plan.rooms.find((r) => r.room.id === sel.roomId) : undefined;

  if (sel?.kind === "item" && room) {
    const f = room.furniture.find((x) => x.id === sel.id);
    if (f) return <ItemBlock roomId={room.room.id} f={f} calm={view === "calm"} />;
  }
  if (sel?.kind === "opening" && room) {
    const o = room.room.openings.find((x) => x.id === sel.id);
    if (o) return <OpeningBlock roomId={room.room.id} o={o} wallLength={wallsOf(room.room.polygon)[o.wallIndex]?.length ?? 0} ceiling={room.room.ceilingHeight} />;
  }
  return (
    <div className="pl-blk" data-empty="">
      <div className="pl-empty">
        <Box className="ic" />
        <p>{t("emptyTitle")}</p>
        <ul>
          <li>{t.rich("emptyPiece", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("emptyWall", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("emptyOpening", { b: (c) => <b>{c}</b> })}</li>
        </ul>
      </div>
    </div>
  );
}

function NumField({ label, value, unit, min, max, onChange, testId }: { label: string; value: number; unit: string; min?: number; max?: number; onChange: (v: number) => void; testId?: string }) {
  const [text, setText] = useState(String(Math.round(value)));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (Number(text) !== Math.round(value)) setText(String(Math.round(value)));
  }
  return (
    <div className="pl-field">
      <label>
        {label}
        <span className="pl-inp" style={{ marginTop: 4 }}>
          <input
            type="number"
            inputMode="decimal"
            value={text}
            min={min}
            max={max}
            data-testid={testId}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(Math.round(n));
            }}
          />
          <span>{unit}</span>
        </span>
      </label>
    </div>
  );
}

function ItemBlock({ roomId, f, calm }: { roomId: string; f: FurnitureItem; calm: boolean }) {
  const t = useTranslations("Planner");
  const td = useTranslations("Design");
  const format = useFormatter();
  const { dispatch, toast } = usePlanner();
  const set = (patch: Partial<FurnitureItem>) => dispatch({ type: "edit", fn: (p) => mapItem(p, roomId, f.id, (x) => ({ ...x, ...patch })) });
  const price =
    f.existing || f.price.max === 0
      ? f.existing
        ? t("owned")
        : "—"
      : f.price.min === f.price.max
        ? format.number(f.price.max, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
        : `${format.number(f.price.min, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}–${format.number(f.price.max, { maximumFractionDigits: 0 })}`;

  return (
    <div className="pl-blk" data-testid="planner-selection">
      <h3>
        <span>{t("selected")}</span>
        <span>{td(`tier_${f.investmentTier}`)}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: f.colorHex }} />
        <div>
          <b>{f.name}</b>
          <small>
            {price} · {f.w} × {f.d} × {f.h}
          </small>
        </div>
      </div>
      <div className="pl-fg3">
        <NumField label={t("width")} value={f.w} unit="cm" min={5} max={600} onChange={(w) => set({ w })} testId="sel-w" />
        <NumField label={t("depth")} value={f.d} unit="cm" min={3} max={600} onChange={(d) => set({ d })} testId="sel-d" />
        {calm ? (
          <NumField label={t("turn")} value={f.rotation} unit="°" min={0} max={359} onChange={(rotation) => set({ rotation })} />
        ) : (
          <NumField label={t("height")} value={f.h} unit="cm" min={1} max={400} onChange={(h) => set({ h })} />
        )}
      </div>
      {!calm && (
        <div className="pl-fg3">
          <NumField label={t("fromLeft")} value={f.x} unit="cm" onChange={(x) => set({ x })} testId="sel-x" />
          <NumField label={t("fromTop")} value={f.y} unit="cm" onChange={(y) => set({ y })} testId="sel-y" />
          <NumField label={t("turn")} value={f.rotation} unit="°" min={0} max={359} onChange={(rotation) => set({ rotation })} />
        </div>
      )}
      <div className="pl-row">
        <Button size="sm" onClick={() => dispatch({ type: "set", patch: { swapFor: f.id, drawerOpen: true } })}>
          <Sparkles /> {t("swapPiece")}
        </Button>
        <Button
          size="sm"
          variant="ghost-destructive"
          onClick={() => {
            dispatch({ type: "edit", fn: (p) => removeSelected(p, { kind: "item", roomId, id: f.id }) });
            dispatch({ type: "select", selection: null });
            toast(t("removed", { name: f.name }));
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}

function OpeningBlock({ roomId, o, wallLength, ceiling }: { roomId: string; o: Opening; wallLength: number; ceiling: number }) {
  const t = useTranslations("Planner");
  const tk = useTranslations("OpeningKind");
  const tst = useTranslations("SocketType");
  const { dispatch } = usePlanner();
  const set = (patch: Partial<Opening>) =>
    dispatch({
      type: "edit",
      fn: (p) =>
        mapRoom(p, roomId, (r) => ({
          ...r,
          room: {
            ...r.room,
            openings: r.room.openings.map((x) => {
              if (x.id !== o.id) return x;
              const next = { ...x, ...patch } as Opening;
              return { ...next, offset: clampOffset(next.offset, next.width, wallLength) };
            }),
          },
        })),
    });
  const title = o.kind === "door" && o.swing === "none" ? t("tool_pass") : tk(o.kind);

  return (
    <div className="pl-blk" data-testid="planner-selection">
      <h3>
        <span>{t("selected")}</span>
        <span>{t("onWall", { n: o.wallIndex + 1 })}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: o.kind === "window" ? "#dbe6ee" : o.kind === "door" ? "#b58a60" : "#fbf6ec" }} />
        <div>
          <b>{title}</b>
          <small>
            {o.width} {t("cmWide")} · {t("fromStart", { n: o.offset })}
          </small>
        </div>
      </div>
      <div className="pl-fg3">
        <NumField label={t("width")} value={o.width} unit="cm" min={5} max={Math.floor(wallLength)} onChange={(width) => set({ width })} />
        <NumField label={t("offset")} value={o.offset} unit="cm" min={0} max={Math.floor(wallLength)} onChange={(offset) => set({ offset })} />
        {o.kind !== "socket" && <NumField label={t("height")} value={o.height} unit="cm" min={5} max={ceiling} onChange={(height) => set({ height })} />}
      </div>
      {o.kind === "window" && (
        <div className="pl-fg3">
          <NumField label={t("sill")} value={o.sillHeight} unit="cm" min={0} max={ceiling} onChange={(sillHeight) => set({ sillHeight })} />
        </div>
      )}
      {o.kind === "socket" && (
        <div className="pl-tg" role="radiogroup" aria-label={tk("socket")}>
          {(["power", "tv", "network"] as const).map((st) => (
            <button key={st} type="button" role="radio" aria-checked={o.socketType === st} style={{ flex: 1 }} onClick={() => set({ socketType: st })}>
              {tst(st)}
            </button>
          ))}
        </div>
      )}
      {o.kind === "door" && (
        <>
          <div className="pl-tg" role="radiogroup" aria-label={t("swing")}>
            {(["in", "out", "sliding", "none"] as const).map((sw) => (
              <button key={sw} type="button" role="radio" aria-checked={o.swing === sw} style={{ flex: 1 }} onClick={() => set({ swing: sw })}>
                {t(`swing_${sw}`)}
              </button>
            ))}
          </div>
          {(o.swing === "in" || o.swing === "out") && (
            <div className="pl-tg" role="radiogroup" aria-label={t("hinge")}>
              {(["start", "end"] as const).map((h) => (
                <button key={h} type="button" role="radio" aria-checked={o.hinge === h} style={{ flex: 1 }} onClick={() => set({ hinge: h })}>
                  {t(`hinge_${h}`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="pl-row">
        <Button
          size="sm"
          variant="ghost-destructive"
          onClick={() => {
            dispatch({ type: "edit", fn: (p) => removeSelected(p, { kind: "opening", roomId, id: o.id }) });
            dispatch({ type: "select", selection: null });
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}

function LayersBlock() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const [all, setAll] = useState(false);
  const on = LAYERS.filter((l) => !s.hidden.includes(l)).length;
  return (
    <div className="pl-layers" data-alllayers={all ? "" : undefined}>
      <div className="pl-blk" style={{ border: 0, paddingBottom: 4 }}>
        <h3>
          <span>{t("layers")}</span>
          <span>{t("layersCount", { on, total: LAYERS.length })}</span>
        </h3>
      </div>
      <div style={{ paddingBottom: 14 }}>
        {LAYERS.map((l) => {
          const Icon = LAYER_ICON[l];
          const visible = !s.hidden.includes(l);
          return (
            <button
              key={l}
              type="button"
              className={`pl-layer${BASIC_LAYERS.includes(l) ? "" : " adv-l"}`}
              aria-pressed={visible}
              data-ai={l === "suggestions" ? "" : undefined}
              data-testid={`planner-layer-${l}`}
              onClick={() => {
                if (l === "reference" && !visible) {
                  document.getElementById("pl-reference-input")?.click();
                  return;
                }
                dispatch({ type: "toggle-layer", layer: l });
              }}
            >
              <Icon className="ic" />
              <span className="nm">{t(`layer_${l}`)}</span>
              {l === "walls" && <small>{t("base")}</small>}
              <span className="eye">{visible ? <Eye className="ic" /> : <EyeOff className="ic" />}</span>
            </button>
          );
        })}
        <button type="button" className="pl-lymore calm-only" onClick={() => setAll((x) => !x)}>
          {all ? t("fewerLayers") : t("allLayers")}
        </button>
      </div>
    </div>
  );
}
