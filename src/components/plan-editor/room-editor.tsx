"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-3">
        <div role="toolbar" aria-label={t("tools")} className="flex flex-wrap gap-2">
          {(["select", ...KINDS] as const).map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={tool === k ? "default" : "outline"}
              aria-pressed={tool === k}
              disabled={k !== "select" && !shape}
              onClick={() => setTool(k)}
            >
              {k === "select" ? t("toolSelect") : tk(k)}
            </Button>
          ))}
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

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{room ? t("editTitle") : t("newTitle")}</CardTitle>
            <CardAction>
              <FillSampleButton onFill={fillSample} />
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
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
            <div className="flex flex-col justify-end gap-1.5 text-sm">
              <span className="font-medium">{t("area")}</span>
              <span data-testid="room-area">{shape ? `${m2(area(shape.polygon)).toFixed(2)} ${tc("m2")}` : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("openings")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {meta.openings.length === 0 && <p className="text-sm text-muted-foreground">{t("noOpenings")}</p>}
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
                  size="sm"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("fixedElements")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {meta.fixedElements.map((f, i) => (
              <fieldset key={f.id} className="grid grid-cols-3 gap-2 rounded-lg border p-3">
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFixed((fs) => fs.filter((x) => x.id !== f.id))}>
                    {t("remove")}
                  </Button>
                </div>
              </fieldset>
            ))}
            <Button type="button" size="sm" variant="outline" disabled={!shape} onClick={addFixed} className="self-start">
              {t("addFixed")}
            </Button>
          </CardContent>
        </Card>

        {issues.length > 0 && (
          <Alert variant="destructive" data-testid="room-issues">
            <AlertTitle>{t("problems")}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {issues.map((i) => (
                  <li key={i.path}>{i.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className={cn("flex gap-2", room ? "justify-between" : "justify-end")}>
          {room && (
            <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
              {t("deleteRoom")}
            </Button>
          )}
          <Button type="button" size="lg" disabled={pending || !shape || issues.length > 0} onClick={save}>
            {pending ? tc("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
