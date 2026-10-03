"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { area } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { wallsOf } from "@/domain/geometry/walls";
import { editDimension } from "@/domain/room/edit-dimensions";
import { moveCorner } from "@/domain/room/edit-shape";
import type { Room } from "@/domain/schemas/room";
import { NumField } from "./inspector";
import { deleteSelection, usePlanner } from "./planner-context";
import { type Annotation, mapRoom, PLAN_LEVEL } from "./state";

/*
 * Inspector blocks for a room's outline: a selected corner, wall or whole
 * room, and plan annotations (dimension lines, notes). Delete here does what
 * the Delete key does.
 */

function useDelete() {
  const { s, dispatch, toast } = usePlanner();
  return (sel: Parameters<typeof deleteSelection>[1]) => {
    const res = deleteSelection(s.plan, sel);
    if (!res.ok) return toast(res.reason);
    dispatch({ type: "edit", fn: () => res.plan });
    dispatch({ type: "select", selection: null });
  };
}

function Head({ kind, title, hint }: { kind: string; title: string; hint: string }) {
  const t = useTranslations("Planner");
  return (
    <>
      <h3>
        <span>{t("selected")}</span>
        <span>{kind}</span>
      </h3>
      <div className="pl-selhead">
        <i style={{ background: "#2b2620" }} />
        <div>
          <b>{title}</b>
          <small>{hint}</small>
        </div>
      </div>
    </>
  );
}

export function CornerBlock({ room, index }: { room: Room; index: number }) {
  const t = useTranslations("Planner");
  const { dispatch, toast } = usePlanner();
  const remove = useDelete();
  const p = room.polygon[index];
  if (!p) return null;
  const move = (q: { x: number; y: number }) => {
    const res = moveCorner(room, index, q);
    if (!res.ok) return toast(res.reason);
    dispatch({ type: "edit", fn: (pl) => mapRoom(pl, room.id, (r) => ({ ...r, room: { ...r.room, ...res.room } })) });
  };
  return (
    <div className="pl-blk" data-testid="planner-selection">
      <Head kind={room.name} title={t("cornerN", { n: index + 1 })} hint={t("cornerHint")} />
      <div className="pl-fg3">
        <NumField label="x" value={p.x} unit="cm" onChange={(x) => move({ x, y: p.y })} testId="corner-x" />
        <NumField label="y" value={p.y} unit="cm" onChange={(y) => move({ x: p.x, y })} testId="corner-y" />
      </div>
      <div className="pl-row">
        <Button size="sm" variant="ghost-destructive" data-testid="delete-corner" onClick={() => remove({ kind: "corner", roomId: room.id, id: String(index) })}>
          {t("deleteCorner")}
        </Button>
      </div>
    </div>
  );
}

export function WallBlock({ room, index }: { room: Room; index: number }) {
  const t = useTranslations("Planner");
  const { dispatch, toast, deleteRoom } = usePlanner();
  const remove = useDelete();
  const wall = wallsOf(room.polygon)[index];
  if (!wall) return null;
  const setLength = (cm: number) => {
    const res = editDimension(room, { kind: "wall", wallIndex: index }, cm);
    if (!res.ok) return toast(res.reason);
    dispatch({ type: "edit", fn: (pl) => mapRoom(pl, room.id, (r) => ({ ...r, room: { ...r.room, ...res.room } })) });
    if (res.warning) toast(res.warning);
  };
  return (
    <div className="pl-blk" data-testid="planner-selection">
      <Head kind={room.name} title={t("wallN", { n: index + 1 })} hint={t("wallSelHint")} />
      <div className="pl-fg3">
        <NumField label={t("innerWallLength")} value={Math.round(wall.length)} unit="cm" min={1} max={5000} onChange={setLength} testId="wall-length" />
      </div>
      <div className="pl-row">
        <Button size="sm" variant="ghost-destructive" data-testid="delete-wall" onClick={() => remove({ kind: "wall", roomId: room.id, id: String(index) })}>
          {t("deleteWall")}
        </Button>
        <Button size="sm" variant="ghost-destructive" onClick={() => void deleteRoom(room.id)}>
          {t("deleteRoom")}
        </Button>
      </div>
    </div>
  );
}

export function RoomBlock({ room }: { room: Room }) {
  const t = useTranslations("Planner");
  const { dispatch, deleteRoom } = usePlanner();
  return (
    <div className="pl-blk" data-testid="planner-selection">
      <Head kind={t("roomWord")} title={room.name} hint={t("roomSelHint", { area: m2(area(room.polygon)).toFixed(2), walls: room.polygon.length })} />
      <div className="pl-field">
        <label>
          {t("roomName")}
          <span className="pl-inp" style={{ marginTop: 4 }}>
            <input
              value={room.name}
              maxLength={60}
              data-testid="room-name"
              onChange={(e) => {
                const name = e.target.value;
                if (name.trim()) dispatch({ type: "edit", fn: (pl) => mapRoom(pl, room.id, (r) => ({ ...r, room: { ...r.room, name } })) });
              }}
            />
          </span>
        </label>
      </div>
      <div className="pl-row">
        <Button size="sm" variant="ghost-destructive" data-testid="delete-room" onClick={() => void deleteRoom(room.id)}>
          {t("deleteRoom")}
        </Button>
      </div>
    </div>
  );
}

export function AnnotationBlock({ a }: { a: Annotation }) {
  const t = useTranslations("Planner");
  const { dispatch } = usePlanner();
  const remove = useDelete();
  const title = a.kind === "note" ? t("tool_note") : t("tool_dimension");
  return (
    <div className="pl-blk" data-testid="planner-selection">
      <Head kind={title} title={a.kind === "note" ? (a.text ?? "") : title} hint={t("annotationHint")} />
      {a.kind === "note" && (
        <div className="pl-field">
          <label>
            {t("noteLabel")}
            <span className="pl-inp" style={{ marginTop: 4 }}>
              <input
                value={a.text ?? ""}
                maxLength={200}
                onChange={(e) => {
                  const text = e.target.value;
                  dispatch({ type: "edit", fn: (pl) => ({ ...pl, annotations: pl.annotations.map((x) => (x.id === a.id ? { ...x, text } : x)) }) });
                }}
              />
            </span>
          </label>
        </div>
      )}
      <div className="pl-row">
        <Button size="sm" variant="ghost-destructive" data-testid="delete-annotation" onClick={() => remove({ kind: "annotation", roomId: PLAN_LEVEL, id: a.id })}>
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}
