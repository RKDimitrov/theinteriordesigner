"use client";

import { Bookmark, Camera as CameraIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { clamp } from "@/domain/geometry/units";
import { SelectionBlock } from "./inspector";
import { usePlanner } from "./planner-context";
import { type Camera, CAMERA_PRESETS, type CameraPreset, DEFAULT_FINISH, FLOOR_FINISHES, WALL_FINISHES } from "./state";
import { FLOOR_SWATCH, WALL_COLOR } from "./three/materials";

const PRESETS: readonly CameraPreset[] = ["eye", "architect", "bird", "plan"];

/* ---------------- camera panel (left, 3D) ---------------- */

export function CameraPanel() {
  const t = useTranslations("Planner");
  const { s, dispatch, roomArea } = usePlanner();
  const [fine, setFine] = useState(false);
  const cam = s.camera;
  const set = (patch: Partial<Camera>) => dispatch({ type: "camera", patch });
  const ids = s.plan.rooms.map((r) => r.room.id);

  const setVisible = (visible: string[]) => {
    const ordered = ids.filter((id) => visible.includes(id));
    // The scope switch mirrors 3D: every room ticked = whole apartment, one room = that room.
    const scope = ordered.length === ids.length ? "all" : ordered.length === 1 ? ordered[0]! : s.scope;
    dispatch({ type: "set", patch: { visible3d: ordered, scope } });
  };

  const saveView = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".pl-scene3 canvas");
    let thumb: string | null = null;
    try {
      if (canvas) {
        const c = document.createElement("canvas");
        c.width = 112;
        c.height = 76;
        c.getContext("2d")?.drawImage(canvas, 0, 0, c.width, c.height);
        thumb = c.toDataURL("image/jpeg", 0.7);
      }
    } catch {
      thumb = null;
    }
    const n = s.savedViews.length + 1;
    dispatch({ type: "set", patch: { savedViews: [...s.savedViews, { id: `view-${Date.now()}`, name: t("savedViewName", { n }), camera: cam, thumb }] } });
  };

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button key={label} type="button" className="pl-chip" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <aside className="pl-rail pl-cam" aria-label={t("camera")} data-finecam={fine ? "" : undefined}>
      <h2>
        <CameraIcon className="ic" /> {t("camera")}
      </h2>
      <div className="pl-scroll">
        <div className="pl-grp">
          <h3>
            <span>—</span>
            {t("roomsInView")}
          </h3>
        </div>
        <div role="group" aria-label={t("roomsInView")}>
          {s.plan.rooms.map((r) => {
            const on = s.visible3d.includes(r.room.id);
            return (
              <div key={r.room.id} className="pl-rv-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className="pl-rv"
                  onClick={() => setVisible(on ? s.visible3d.filter((id) => id !== r.room.id) : [...s.visible3d, r.room.id])}
                >
                  <i />
                  <span>{r.room.name}</span>
                  <small>{roomArea(r.room.id).toFixed(2)} m²</small>
                </button>
                <button type="button" className="only" onClick={() => setVisible([r.room.id])}>
                  {t("only")}
                </button>
              </div>
            );
          })}
        </div>

        <CameraDiagram cam={cam} />
        <Stepper label={t("eyeHeight")} value={`${cam.eyeHeight} cm`} onStep={(d) => set({ eyeHeight: clamp(cam.eyeHeight + d * 10, 60, 600) })}>
          {[120, 165, 250, 400].map((h) => chip(String(h), cam.eyeHeight === h, () => set({ eyeHeight: h })))}
        </Stepper>
        <Stepper label={t("rotation")} value={`${cam.rotation}°`} onStep={(d) => set({ rotation: (cam.rotation + d * 15 + 360) % 360 })}>
          {[0, 90, 180, 270].map((r) => chip(`${r}°`, cam.rotation === r, () => set({ rotation: r })))}
        </Stepper>
        <Stepper label={t("tilt")} value={`${cam.tilt}°`} onStep={(d) => set({ tilt: clamp(cam.tilt + d * 5, 0, 88) })}>
          {chip(t("tiltPlan"), cam.tilt === 0, () => set({ tilt: 0 }))}
          {chip(t("tiltAngled"), cam.tilt === 55, () => set({ tilt: 55 }))}
          {chip(t("tiltLevel"), cam.tilt === 80, () => set({ tilt: 80 }))}
        </Stepper>
        <Stepper label={t("lens")} value={t(`lens_${cam.lens}`)}>
          {([24, 35, 85] as const).map((l) => chip(t(`lens_${l}`), cam.lens === l, () => set({ lens: l })))}
        </Stepper>
        <Stepper label={t("distance")} value={`× ${cam.distance.toFixed(2)}`} onStep={(d) => set({ distance: clamp(Math.round((cam.distance + d * 0.1) * 100) / 100, 0.4, 2.5) })}>
          {chip(t("distNear"), cam.distance === 0.7, () => set({ distance: 0.7 }))}
          {chip(t("distRoom"), cam.distance === 1, () => set({ distance: 1 }))}
          {chip(t("distFar"), cam.distance === 1.45, () => set({ distance: 1.45 }))}
        </Stepper>

        <div className="pl-grp">
          <h3>
            <span>—</span>
            {t("views")}
          </h3>
        </div>
        <div className="pl-presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" className="pl-pre" aria-pressed={s.preset === p} onClick={() => dispatch({ type: "camera", patch: CAMERA_PRESETS[p], preset: p })}>
              <b>{t(`preset_${p}`)}</b>
              <small>{t(`presetSub_${p}`)}</small>
            </button>
          ))}
        </div>

        <div className="pl-grp">
          <h3>
            <span>—</span>
            {t("savedViews")}
          </h3>
        </div>
        <div className="pl-saved">
          {s.savedViews.map((v) => (
            <div key={v.id} className="pl-saved-row">
              <button type="button" onClick={() => dispatch({ type: "camera", patch: v.camera, preset: null })}>
                <span className="pl-thumb" style={v.thumb ? { backgroundImage: `url(${v.thumb})` } : undefined} />
                <div>
                  <b>{v.name}</b>
                  <small>
                    {v.camera.eyeHeight} cm · {v.camera.rotation}° · {t(`lens_${v.camera.lens}`)}
                  </small>
                </div>
              </button>
              <button
                type="button"
                className="pl-ib"
                aria-label={t("deleteView", { name: v.name })}
                onClick={() => dispatch({ type: "set", patch: { savedViews: s.savedViews.filter((x) => x.id !== v.id) } })}
              >
                ×
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={saveView}>
            <Bookmark /> {t("saveView")}
          </Button>
        </div>
        <button type="button" className="pl-tool calm-only" style={{ color: "var(--mute)" }} aria-expanded={fine} onClick={() => setFine((f) => !f)}>
          <span>{t("fineTune")}</span>
          <span aria-hidden>{fine ? "−" : "+"}</span>
        </button>
        <p className="pl-hint adv" style={{ padding: "0 14px 10px" }}>
          {t("camHint")}
        </p>
      </div>
    </aside>
  );
}

function Stepper({ label, value, onStep, children }: { label: string; value: string; onStep?: (dir: 1 | -1) => void; children?: React.ReactNode }) {
  return (
    <div className="pl-stp adv-c">
      <span>{label}</span>
      <div className="pl-tg">
        {onStep && (
          <button type="button" onClick={() => onStep(-1)} aria-label={`${label} −`}>
            −
          </button>
        )}
        <span>{value}</span>
        {onStep && (
          <button type="button" onClick={() => onStep(1)} aria-label={`${label} +`}>
            +
          </button>
        )}
      </div>
      <div className="pl-chiprow">{children}</div>
    </div>
  );
}

/** Side view on blueprint grid: ground, dashed ceiling, camera at eye height, clay sight line. */
function CameraDiagram({ cam }: { cam: Camera }) {
  const ground = 96;
  const k = 0.2; // px per cm
  const ceiling = ground - 250 * k;
  const cx = 40;
  const cy = ground - Math.min(cam.eyeHeight, 450) * k;
  const a = ((90 - cam.tilt) * Math.PI) / 180;
  const len = 170;
  return (
    <svg className="pl-camdia adv-c bg-blueprint" viewBox="0 0 240 110" aria-hidden>
      <line x1={8} y1={ground} x2={232} y2={ground} stroke="#2b2622" strokeWidth={1.2} />
      <rect x={110} y={ceiling} width={110} height={ground - ceiling} fill="none" stroke="#2b2622" strokeDasharray="4 3" strokeWidth={1} />
      <line x1={cx} y1={cy} x2={cx + Math.cos(a) * len} y2={cy + Math.sin(a) * len} stroke="#c8794a" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={5} fill="#c8794a" stroke="#2b2622" strokeWidth={1} />
      <line x1={cx} y1={cy + 6} x2={cx} y2={ground} stroke="#2b2622" strokeWidth={1} strokeDasharray="2 2" />
      <text x={cx + 6} y={(cy + ground) / 2} fontSize={8} fontFamily="var(--mono)" fill="#2b2622">
        {cam.eyeHeight}
      </text>
    </svg>
  );
}

/* ---------------- inspector (right, 3D) ---------------- */

export function Inspector3D() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const tabs = ["selection", "finishes", "scene"] as const;
  return (
    <aside className="pl-insp" aria-label={t("inspector")}>
      <div className="pl-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={tab === "scene" ? "adv" : undefined}
            aria-selected={s.tab3d === tab}
            onClick={() => dispatch({ type: "set", patch: { tab3d: tab } })}
          >
            {t(`tab_${tab}`)}
          </button>
        ))}
      </div>
      <div className="pl-pane" role="tabpanel">
        {s.tab3d === "selection" && <SelectionBlock />}
        {s.tab3d === "finishes" && <Finishes />}
        {s.tab3d === "scene" && <Scene />}
      </div>
    </aside>
  );
}

function Finishes() {
  const t = useTranslations("Planner");
  const { s, dispatch, data } = usePlanner();
  const targets = s.visible3d.length > 0 ? s.visible3d : s.plan.rooms.map((r) => r.room.id);
  const current = s.finishes[targets[0] ?? ""] ?? DEFAULT_FINISH;
  const apply = (patch: Partial<typeof current>) =>
    dispatch({
      type: "set",
      patch: { finishes: { ...s.finishes, ...Object.fromEntries(targets.map((id) => [id, { ...(s.finishes[id] ?? DEFAULT_FINISH), ...patch }])) } },
    });
  const palette = data.rooms.find((r) => targets.includes(r.room.id) && r.design)?.design?.palette ?? [];

  return (
    <>
      <div className="pl-blk">
        <h3>
          <span>{t("floor")}</span>
          <span>{t(`floor_${current.floor}`)}</span>
        </h3>
        <div className="pl-sws" role="radiogroup" aria-label={t("floor")}>
          {FLOOR_FINISHES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={current.floor === f} aria-label={t(`floor_${f}`)} title={t(`floor_${f}`)} style={{ background: FLOOR_SWATCH[f] }} onClick={() => apply({ floor: f })} />
          ))}
        </div>
      </div>
      <div className="pl-blk">
        <h3>
          <span>{t("walls")}</span>
          <span>{t(`wall_${current.walls}`)}</span>
        </h3>
        <div className="pl-sws" role="radiogroup" aria-label={t("walls")}>
          {WALL_FINISHES.map((w) => (
            <button key={w} type="button" role="radio" aria-checked={current.walls === w} aria-label={t(`wall_${w}`)} title={t(`wall_${w}`)} style={{ background: WALL_COLOR[w] }} onClick={() => apply({ walls: w })} />
          ))}
        </div>
        <p className="pl-hint">{t("finishesLocal")}</p>
      </div>
      <div className="pl-blk">
        <h3>
          <span>{t("textiles")}</span>
          <span>{t("fromPalette")}</span>
        </h3>
        {palette.length > 0 ? (
          <div className="pl-palette">
            {palette.map((c) => (
              <i key={c.hex + c.name} style={{ background: c.hex, flex: Math.max(1, Math.round(c.share * 100)) }} title={c.name} />
            ))}
          </div>
        ) : (
          <p className="pl-hint">{t("noPalette")}</p>
        )}
        <p className="pl-hint">{t("textilesHint")}</p>
      </div>
    </>
  );
}

function Scene() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const set = (patch: Partial<typeof s.scene>) => dispatch({ type: "set", patch: { scene: { ...s.scene, ...patch } } });
  return (
    <>
      <div className="pl-blk">
        <h3>
          <span>{t("timeOfDay")}</span>
          <span>{String(s.scene.hour).padStart(2, "0")}:00</span>
        </h3>
        <input
          type="range"
          min={7}
          max={21}
          step={1}
          value={s.scene.hour}
          aria-label={t("timeOfDay")}
          onChange={(e) => set({ hour: Number(e.target.value) })}
          style={{ accentColor: "var(--clay)" }}
        />
        <p className="pl-hint">{t("timeHint")}</p>
      </div>
      <div className="pl-blk">
        {(
          [
            ["ceilingLights", t("ceilingLights")],
            ["labels", t("pieceLabels")],
            ["foldWalls", t("foldWalls")],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="pl-toggle">
            <span>{label}</span>
            <Switch checked={s.scene[key]} onCheckedChange={(v) => set({ [key]: v })} />
          </label>
        ))}
      </div>
    </>
  );
}
