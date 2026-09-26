"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/atelier/panel";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fieldLabelClass } from "@/components/ui/label";
import { NumberField, SelectField, TextField } from "@/components/wizard/fields";
import { area, bbox, rectPolygon } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { wallOrientations, wallsOf } from "@/domain/geometry/walls";
import { RoomInput } from "@/domain/room/check-room";
import { clampOffset, newOpening, nextId } from "@/domain/room/openings-edit";
import { type FixedElement, type Opening, type OpeningKind, type Room, type RoomShape, RoomType } from "@/domain/schemas/room";
import { useRouter } from "@/i18n/navigation";
import { zodFieldErrors } from "@/lib/action-result";
import { pickSample, SAMPLE_ROOMS } from "@/lib/dev/samples";
import { cn } from "@/lib/utils";
import { createRoomAction, deleteRoomAction, updateRoomAction } from "@/server/actions/rooms";
import { OpeningForm } from "./opening-form";
import { MIN_ROOM_SIDE, PlanCanvas, type Tool } from "./plan-canvas";

const KINDS: readonly OpeningKind[] = ["door", "window", "radiator", "socket"];

interface Dims {
  w: number | null;
  d: number | null;
}

interface RoomEditorProps {
  apartmentId: string;
  northAngleDeg: number;
  room?: Room;
}

type Meta = Omit<RoomShape, "polygon">;

export function RoomEditor({ apartmentId, northAngleDeg, room }: RoomEditorProps) {
  const t = useTranslations("RoomEditor");
  const tc = useTranslations("Common");
  const tt = useTranslations("RoomType");
  const tk = useTranslations("OpeningKind");
  const tf = useTranslations("FixedKind");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialBox = room ? bbox(room.polygon) : null;
  const [dims, setDims] = useState<Dims>({ w: initialBox?.w ?? null, d: initialBox?.d ?? null });
  const [meta, setMeta] = useState<Meta>(() => ({
    name: room?.name ?? "",
    type: room?.type ?? "living",
    ceilingHeight: room?.ceilingHeight ?? 250,
    openings: room?.openings ?? [],
    fixedElements: room?.fixedElements ?? [],
    wallOrientationOverrides: room?.wallOrientationOverrides ?? {},
  }));
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const hasGeometry = dims.w !== null && dims.d !== null && dims.w >= MIN_ROOM_SIDE && dims.d >= MIN_ROOM_SIDE;
  const shape: RoomShape | null = hasGeometry ? { ...meta, polygon: rectPolygon(dims.w ?? 0, dims.d ?? 0) } : null;
  const walls = shape ? wallsOf(shape.polygon) : [];
  const dirs = shape ? wallOrientations(shape.polygon, northAngleDeg, shape.wallOrientationOverrides) : [];

  // Same schema the server uses, so the user sees every problem before saving.
  const parsed = shape ? RoomInput.safeParse(shape) : null;
  const clientErrors = parsed && !parsed.success ? zodFieldErrors(parsed.error) : {};
  const issues = Object.entries(clientErrors).map(([path, message]) => ({ path, message }));
  const fieldErrors: Record<string, string> = { ...serverErrors, ...clientErrors };

  const setOpenings = (fn: (os: Opening[]) => Opening[]) => setMeta((m) => ({ ...m, openings: fn(m.openings) }));
  const setFixed = (fn: (fs: FixedElement[]) => FixedElement[]) => setMeta((m) => ({ ...m, fixedElements: fn(m.fixedElements) }));

  const addOpening = (kind: OpeningKind, wallIndex: number, centerOffset: number) => {
    const wall = walls[wallIndex];
    if (!wall) return;
    const id = nextId(kind, [...meta.openings.map((o) => o.id), ...meta.fixedElements.map((f) => f.id)]);
    setOpenings((os) => [...os, newOpening(kind, id, wallIndex, centerOffset, wall.length)]);
    setSelectedId(id);
    setTool("select");
  };

  const moveOpening = (id: string, offset: number) =>
    setOpenings((os) =>
      os.map((o) => {
        const wall = walls[o.wallIndex];
        return o.id === id && wall ? { ...o, offset: clampOffset(offset, o.width, wall.length) } : o;
      }),
    );

  const addFixed = () => {
    const id = nextId("fixed", [...meta.openings.map((o) => o.id), ...meta.fixedElements.map((f) => f.id)]);
    setFixed((fs) => [...fs, { id, label: tf("other"), kind: "other", rect: { x: 0, y: 0, w: 60, d: 60 }, height: 250 }]);
  };

  const fillSample = (counter: number) => {
    const { polygon, ...rest } = pickSample(SAMPLE_ROOMS, counter);
    const box = bbox(polygon);
    setDims({ w: box.w, d: box.d });
    setMeta(rest);
    setSelectedId(null);
    setServerErrors({});
  };

  const save = () => {
    if (!shape) return;
    startTransition(async () => {
      const res = room ? await updateRoomAction(room.id, shape) : await createRoomAction(apartmentId, shape);
      if (!res.ok) {
        setServerErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setServerErrors({});
      toast.success(tc("saved"));
      if (!room) router.replace(`/apartments/${apartmentId}/rooms/${res.data.id}`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!room || !window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteRoomAction(room.id);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/apartments/${apartmentId}`);
      router.refresh();
    });
  };

  return (
    <div className="grid items-start gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3 min-[900px]:sticky min-[900px]:top-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="toolbar" aria-label={t("tools")} className="flex flex-wrap gap-2">
            {(["select", ...KINDS] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tool === k}
                disabled={k !== "select" && !shape}
                onClick={() => setTool(k)}
                className="flex items-center gap-2 border-[1.5px] border-foreground bg-card px-3.5 py-[9px] font-mono text-[11.5px] font-medium tracking-[0.08em] uppercase transition-shadow outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-foreground aria-pressed:text-card aria-pressed:shadow-offset-clay"
              >
                <ToolGlyph kind={k} />
                {k === "select" ? t("toolSelect") : tk(k)}
              </button>
            ))}
          </div>
          <p className="eyebrow ml-auto">{!shape ? t("drawHintShort") : tool === "select" ? t("selectHint") : t("placeHint")}</p>
        </div>
        <PlanCanvas
          key={shape ? "room" : "draw"}
          room={shape}
          northAngleDeg={northAngleDeg}
          tool={tool}
          selectedId={selectedId}
          onDrawRect={(w, d) => setDims({ w, d })}
          onResize={(w, d) => setDims({ w, d })}
          onPlaceOpening={addOpening}
          onMoveOpening={moveOpening}
          onSelect={setSelectedId}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Panel title={t("roomPanel")} action={<FillSampleButton onFill={fillSample} />} bodyClassName="grid grid-cols-2 gap-3.5">
          <TextField className="col-span-2" label={t("name")} value={meta.name} maxLength={60} error={fieldErrors["name"]} onChange={(v) => setMeta((m) => ({ ...m, name: v }))} />
          <SelectField
            className="col-span-2"
            label={t("type")}
            value={meta.type}
            options={RoomType.options.map((v) => ({ value: v, label: tt(v) }))}
            onChange={(v) => setMeta((m) => ({ ...m, type: v }))}
          />
          <NumberField label={t("width")} value={dims.w} min={MIN_ROOM_SIDE} step={5} suffix={tc("cm")} optional onChange={(v) => setDims((d) => ({ ...d, w: v === null ? null : Math.round(v) }))} />
          <NumberField label={t("length")} value={dims.d} min={MIN_ROOM_SIDE} step={5} suffix={tc("cm")} optional onChange={(v) => setDims((d) => ({ ...d, d: v === null ? null : Math.round(v) }))} />
          <NumberField
            label={t("ceiling")}
            value={meta.ceilingHeight}
            min={180}
            max={600}
            suffix={tc("cm")}
            error={fieldErrors["ceilingHeight"]}
            onChange={(v) => setMeta((m) => ({ ...m, ceilingHeight: Math.round(v ?? 0) }))}
          />
          <div className="flex flex-col justify-end gap-1.5">
            <span className={fieldLabelClass}>{t("area")}</span>
            <span data-testid="room-area" className="font-heading text-[34px] leading-none tabular-nums">
              {shape ? `${m2(area(shape.polygon)).toFixed(2)} ${tc("m2")}` : "—"}
            </span>
          </div>
        </Panel>

        <Panel title={t("openings")} action={<span className="eyebrow">{t("items", { count: meta.openings.length })}</span>}>
          {meta.openings.length === 0 && <p className="text-[12.5px] text-muted-foreground">{t("noOpenings")}</p>}
          {meta.openings.map((o, i) => (
            <OpeningForm
              key={o.id}
              index={i}
              opening={o}
              walls={walls}
              dirs={dirs}
              selected={o.id === selectedId}
              errors={fieldErrors}
              onSelect={() => setSelectedId(o.id)}
              onChange={(next) => setOpenings((os) => os.map((x) => (x.id === o.id ? next : x)))}
              onRemove={() => setOpenings((os) => os.filter((x) => x.id !== o.id))}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                size="xs"
                variant="outline"
                disabled={!shape}
                onClick={() => {
                  const wall = walls[0];
                  if (wall) addOpening(k, 0, wall.length / 2);
                }}
              >
                {t("add", { kind: tk(k) })}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title={t("fixedElements")}>
          {meta.fixedElements.map((f, i) => (
            <fieldset key={f.id} className="grid grid-cols-3 gap-2.5 border border-dashed border-rule px-3.5 pt-3 pb-3.5">
              <legend className="px-1.5 font-mono text-[11px] font-medium tracking-[0.1em] uppercase">
                {tf(f.kind)} · {f.id}
              </legend>
              <TextField
                className="col-span-2"
                label={t("fixedLabel")}
                value={f.label}
                maxLength={60}
                error={fieldErrors[`fixedElements.${i}.rect`]}
                onChange={(v) => setFixed((fs) => fs.map((x) => (x.id === f.id ? { ...x, label: v } : x)))}
              />
              <SelectField
                label={t("fixedKind")}
                value={f.kind}
                options={(["chimney", "built_in", "column", "kitchen_run", "other"] as const).map((v) => ({ value: v, label: tf(v) }))}
                onChange={(v) => setFixed((fs) => fs.map((x) => (x.id === f.id ? { ...x, kind: v } : x)))}
              />
              {(["x", "y", "w", "d"] as const).map((k) => (
                <NumberField
                  key={k}
                  label={t(k === "x" ? "posX" : k === "y" ? "posY" : k === "w" ? "fixedW" : "fixedD")}
                  value={f.rect[k]}
                  step={5}
                  onChange={(v) =>
                    setFixed((fs) =>
                      fs.map((x) => (x.id === f.id ? { ...x, rect: { ...x.rect, [k]: Math.max(k === "w" || k === "d" ? 1 : 0, Math.round(v ?? 0)) } } : x)),
                    )
                  }
                />
              ))}
              <NumberField
                label={t("fixedH")}
                value={f.height}
                onChange={(v) => setFixed((fs) => fs.map((x) => (x.id === f.id ? { ...x, height: Math.max(1, Math.round(v ?? 0)) } : x)))}
              />
              <div className="col-span-3 flex justify-end">
                <Button type="button" variant="ghost-destructive" size="xs" onClick={() => setFixed((fs) => fs.filter((x) => x.id !== f.id))}>
                  {t("remove")}
                </Button>
              </div>
            </fieldset>
          ))}
          <Button type="button" size="xs" variant="outline" disabled={!shape} onClick={addFixed} className="self-start">
            {t("addFixed")}
          </Button>
        </Panel>

        {issues.length > 0 && (
          <section data-testid="room-issues" aria-labelledby="room-issues-title" role="alert" className="border-t-[1.5px] border-foreground pt-3.5">
            <h2 id="room-issues-title" className="mb-1 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
              {t("problems")}
            </h2>
            <ul>
              {issues.map((i) => (
                <li key={i.path} className="grid grid-cols-[auto_1fr] gap-2.5 border-b border-dotted border-rule py-2.5 text-[13.5px]">
                  <Badge variant="destructive" className="self-start">
                    {t("error")}
                  </Badge>
                  {i.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={cn("flex flex-wrap gap-2.5", room ? "justify-between" : "justify-end")}>
          {room && (
            <Button type="button" variant="ghost-destructive" disabled={pending} onClick={remove}>
              {t("deleteRoom")}
            </Button>
          )}
          <Button type="button" disabled={pending || !shape || issues.length > 0} onClick={save}>
            {pending ? tc("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Tiny tool glyphs drawn with borders, like the plan symbols. */
function ToolGlyph({ kind }: { kind: Tool }) {
  const base = "inline-block shrink-0 border-[1.5px] border-current";
  switch (kind) {
    case "select":
      return (
        <span aria-hidden className="inline-block w-2.5 text-center leading-none">
          ↖
        </span>
      );
    case "door":
      return <span aria-hidden className={cn(base, "size-2.5 rounded-tr-full border-b-0 border-l-0")} />;
    case "window":
      return <span aria-hidden className={cn(base, "h-1.5 w-3 border-x-0")} />;
    case "radiator":
      return <span aria-hidden className={cn(base, "h-2 w-3 border-y-0")} />;
    case "socket":
      return <span aria-hidden className={cn(base, "size-2 rounded-full bg-current")} />;
  }
}
