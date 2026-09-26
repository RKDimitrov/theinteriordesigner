"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GenerateProgress, GenerateProvider, useGenerate } from "@/components/design/generate-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { catalogueSize } from "@/domain/design/catalogue";
import { bbox } from "@/domain/geometry/polygon";
import { nextItemId, newPlannerItem, PIECE_COLOR } from "@/domain/planner/items";
import { useRouter } from "@/i18n/navigation";
import type { PlannerSuggestion } from "@/server/planner";
import { usePlanner } from "./planner-context";
import { inScope, mapRoom } from "./state";

const TINY_ROOM_M2 = 6;
const QUICK = ["quick_fill", "quick_walkways", "quick_renter"] as const;

export function DesignerTab() {
  const { s, data } = usePlanner();
  const router = useRouter();
  const roomId = s.scope !== "all" ? s.scope : null;
  const info = roomId ? data.rooms.find((r) => r.room.id === roomId) : null;

  const body = <DesignerBody roomId={roomId} />;
  if (!roomId || !info) return body;
  return (
    <GenerateProvider apartmentId={data.apartment.id} roomId={roomId} hasDesign={!!info.design} onDone={() => router.refresh()}>
      {body}
    </GenerateProvider>
  );
}

function DesignerBody({ roomId }: { roomId: string | null }) {
  const t = useTranslations("Planner");
  const td = useTranslations("Design");
  const { s, dispatch, data, checks, roomArea, toast, pieceName, pieces } = usePlanner();
  const info = roomId ? data.rooms.find((r) => r.room.id === roomId) : null;

  const suggestions = data.rooms.flatMap((pr) =>
    inScope(s.scope, pr.room.id)
      ? pr.suggestions
          .filter((sg) => !s.skipped.includes(`${pr.room.id}:${sg.id}`))
          .filter((sg) => !s.plan.rooms.find((r) => r.room.id === pr.room.id)?.furniture.some((f) => f.id === sg.id))
          .map((sg) => ({ roomId: pr.room.id, sg }))
      : [],
  );

  const accept = (rid: string, sg: PlannerSuggestion) => {
    const room = s.plan.rooms.find((r) => r.room.id === rid);
    if (!room) return;
    const taken = s.plan.rooms.flatMap((r) => r.furniture.map((f) => f.id));
    let item;
    if (sg.item) {
      item = { ...sg.item, id: taken.includes(sg.item.id) ? nextItemId(sg.item.category, taken) : sg.item.id };
    } else {
      const b = bbox(room.room.polygon);
      const size = catalogueSize(sg.category, "medium");
      const piece = pieces.find((p) => p.key === `${sg.category}-medium`) ?? { key: sg.id, category: sg.category, sizeClass: "medium" as const, ...size, colorHex: PIECE_COLOR[sg.category] };
      item = { ...newPlannerItem(piece, { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.d / 2) }, sg.name || pieceName(piece), taken), locked: false };
    }
    dispatch({ type: "edit", fn: (p) => mapRoom(p, rid, (r) => ({ ...r, furniture: [...r.furniture, item] })) });
    dispatch({ type: "set", patch: { selection: { kind: "item", roomId: rid, id: item.id } } });
    toast(t("accepted", { name: item.name }));
  };
  const skip = (rid: string, id: string) => dispatch({ type: "set", patch: { skipped: [...s.skipped, `${rid}:${id}`] } });

  const scopeChecks = s.plan.rooms.filter((r) => inScope(s.scope, r.room.id)).map((r) => ({ r, c: checks.get(r.room.id) }));
  const roomIssues = scopeChecks.flatMap(({ r, c }) => (c?.room ?? []).map((i) => ({ room: r.room.name, message: i.message })));
  const designIssues = scopeChecks.flatMap(({ r, c }) =>
    (c?.design ?? []).map((i) => ({
      room: r.room.name,
      ...i,
      tiny: (i.code === "WALKWAY_TOO_NARROW" || i.code === "OVERLAP") && roomArea(r.room.id) < TINY_ROOM_M2,
    })),
  );
  const multi = s.scope === "all" && s.plan.rooms.length > 1;
  const total = roomIssues.length + designIssues.length;

  return (
    <>
      <div className="pl-blk adv">
        <h3>
          <span>{t("designerTitle")}</span>
          <span>{info?.design ? `v${info.design.version} · ${td(`status_${info.design.status}`)}` : ""}</span>
        </h3>
        <p className="pl-note">“{info?.design?.concept.summary || info?.design?.concept.title || (roomId ? t("noConcept") : t("pickRoomConcept"))}”</p>
      </div>

      <div className="pl-blk">
        <h3>
          <span>{t("onPlan")}</span>
          <span>{t("suggestionsCount", { count: suggestions.length })}</span>
        </h3>
        {suggestions.length === 0 ? (
          <p className="pl-hint">{t("noSuggestions")}</p>
        ) : (
          <div>
            {suggestions.map(({ roomId: rid, sg }) => (
              <div key={`${rid}-${sg.id}`} className="pl-sug" data-testid={`designer-suggestion-${sg.id}`}>
                <b>{sg.name}</b>
                <p>
                  {multi && `${s.plan.rooms.find((r) => r.room.id === rid)?.room.name} · `}
                  {t(`sug_${sg.reason}`)}
                </p>
                <div className="pl-sug-acts">
                  <Button size="sm" onClick={() => accept(rid, sg)}>
                    {t("accept")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => skip(rid, sg.id)}>
                    {t("skip")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {roomId ? <AskForChange /> : (
        <div className="pl-blk">
          <h3>
            <span>{t("askChange")}</span>
          </h3>
          <p className="pl-hint">{t("pickRoom")}</p>
        </div>
      )}

      <div className="pl-blk" data-testid="design-issues">
        <h3>
          <span>{t("checks")}</span>
          <span>{total}</span>
        </h3>
        {total === 0 ? (
          <p className="pl-hint">{t("checksNone")}</p>
        ) : (
          <div>
            {roomIssues.length > 0 && (
              <div data-testid="room-issues">
                {roomIssues.map((i, n) => (
                  <div key={`r${n}`} className="pl-issue">
                    <span className="pl-chip" style={{ borderColor: "var(--red)", color: "var(--red)", cursor: "default" }}>
                      {td("error")}
                    </span>
                    <span>
                      {multi && <b>{i.room}: </b>}
                      {i.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {designIssues.map((i, n) => (
              <div key={`d${n}`} className="pl-issue">
                <span
                  className="pl-chip"
                  style={
                    i.severity === "error"
                      ? { borderColor: "var(--red)", color: "var(--red)", cursor: "default" }
                      : { borderColor: "var(--clay)", color: "var(--clay-dark)", cursor: "default" }
                  }
                >
                  {i.severity === "error" ? td("error") : t("warn")}
                </span>
                <span>
                  {multi && <b>{i.room}: </b>}
                  {i.message}
                  {i.tiny && <span className="pl-hint"> {td("tooSmallHint")}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AskForChange() {
  const t = useTranslations("Planner");
  const { flush } = usePlanner();
  const { running, pending, generate } = useGenerate();
  const [note, setNote] = useState("");
  const [keep, setKeep] = useState(true);
  const add = (text: string) => setNote((n) => (n.includes(text) ? n : n ? `${n.trim()}. ${text}` : text));
  return (
    <div className="pl-blk">
      <h3>
        <span>{t("askChange")}</span>
      </h3>
      <textarea
        className="pl-ta"
        value={note}
        maxLength={400}
        placeholder={t("askPlaceholder")}
        aria-label={t("askChange")}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="pl-chiprow adv" style={{ padding: 0 }}>
        {QUICK.map((q) => (
          <button key={q} type="button" className="pl-chip" onClick={() => add(t(q))}>
            {t(q)}
          </button>
        ))}
      </div>
      <label className="pl-toggle adv">
        <span>{t("keepPlaced")}</span>
        <Switch checked={keep} onCheckedChange={setKeep} />
      </label>
      <Button
        className="w-full"
        data-testid="planner-redesign"
        disabled={running || pending}
        onClick={async () => {
          await flush();
          await generate({ note: note.trim() || undefined, keepPlaced: keep });
        }}
      >
        <Sparkles /> {running ? t("redesigning") : t("redesign")}
      </Button>
      <p className="pl-hint">{t("redesignCost")}</p>
      <GenerateProgress compact />
    </div>
  );
}
