"use client";

import { ArrowLeft, Box, Download, Layers, Magnet, Redo2, Scan, Sparkles, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { usePlanner, useView } from "./planner-context";

/** Back, project, scope switch, mode, undo/redo, zoom, units, snap, Designer and Export. */
export function TopBar() {
  const t = useTranslations("Planner");
  const tc = useTranslations("Common");
  const format = useFormatter();
  const { s, dispatch, data, save } = usePlanner();
  const { v, stage } = useView();
  const router = useRouter();
  const pathname = usePathname();
  const is2d = s.mode === "2d";

  const setScope = (scope: string) => {
    dispatch({ type: "scope", scope });
    router.replace(`${pathname}?room=${scope}`, { scroll: false });
  };

  const exportPlan = () => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="plan-canvas"] svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(svg.clientWidth));
    clone.setAttribute("height", String(svg.clientHeight));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.projectCode}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const savedLabel =
    save.state === "saving"
      ? t("saving")
      : save.state === "error"
        ? t("saveFailed")
        : save.at
          ? t("savedAt", { time: format.dateTime(save.at, { hour: "2-digit", minute: "2-digit" }) })
          : t("notSaved");

  return (
    <header className="pl-top">
      <Link href={`/apartments/${data.apartment.id}`} className="pl-ib" aria-label={t("back")} title={t("back")}>
        <ArrowLeft className="ic" />
      </Link>
      <Link href="/apartments" className="pl-logo">
        {tc("appName")}
      </Link>
      <div className="pl-proj">
        <b>{data.apartment.name}</b>
        <small className="adv" aria-live="polite" suppressHydrationWarning>
          <i data-state={save.state} />
          {savedLabel}
        </small>
      </div>

      <div className="pl-tg pl-scope" role="radiogroup" aria-label={t("scope")}>
        <button type="button" role="radio" aria-checked={s.scope === "all"} data-testid="planner-scope-all" onClick={() => setScope("all")}>
          <Layers className="ic" /> <span>{t("wholeApartment")}</span>
        </button>
        {s.plan.rooms.map((r) => (
          <button
            key={r.room.id}
            type="button"
            role="radio"
            aria-checked={s.scope === r.room.id}
            data-testid={`planner-scope-${r.room.id}`}
            onClick={() => setScope(r.room.id)}
            title={r.room.name}
          >
            <span>{r.room.name}</span>
          </button>
        ))}
      </div>

      <div className="pl-sp" />

      <div className="pl-tg pl-mode" role="radiogroup" aria-label={t("mode")}>
        <button type="button" role="radio" aria-checked={is2d} data-testid="planner-mode-2d" onClick={() => dispatch({ type: "mode", mode: "2d" })}>
          {t("mode2d")}
        </button>
        <button type="button" role="radio" aria-checked={!is2d} data-testid="planner-mode-3d" onClick={() => dispatch({ type: "mode", mode: "3d" })}>
          <Box className="ic" /> {t("mode3d")}
        </button>
      </div>

      <div className="pl-tg" role="group" aria-label={t("history")}>
        <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={s.past.length === 0} aria-label={t("undo")} title={t("undo")}>
          <Undo2 className="ic" />
        </button>
        <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={s.future.length === 0} aria-label={t("redo")} title={t("redo")}>
          <Redo2 className="ic" />
        </button>
      </div>

      {is2d && (
        <>
          <div className="pl-tg adv" role="group" aria-label={t("zoom")}>
            <button type="button" onClick={() => stage.current?.zoomBy(1 / 1.2)} aria-label={t("zoomOut")} title={t("zoomOut")}>
              −
            </button>
            <span className="pl-zv" aria-live="polite">
              {Math.round(v.zoom * 100)}%
            </span>
            <button type="button" onClick={() => stage.current?.zoomBy(1.2)} aria-label={t("zoomIn")} title={t("zoomIn")}>
              +
            </button>
            <button type="button" onClick={() => stage.current?.fit()} aria-label={t("fit")} title={t("fit")}>
              <Scan className="ic" />
            </button>
          </div>
          <div className="pl-tg pl-units adv" role="radiogroup" aria-label={t("units")}>
            {(["cm", "in"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={s.units === u} onClick={() => dispatch({ type: "set", patch: { units: u } })}>
                {u}
              </button>
            ))}
          </div>
          <div className="pl-tg pl-snap adv">
            <button type="button" aria-pressed={s.snap} onClick={() => dispatch({ type: "set", patch: { snap: !s.snap } })}>
              <Magnet className="ic" /> {t("snap", { n: 5 })}
            </button>
          </div>
        </>
      )}

      <div className="pl-sp" />

      <Button size="sm" onClick={() => dispatch({ type: "set", patch: { mode: "2d", tab2d: "designer" } })}>
        <Sparkles /> {t("designer")}
      </Button>
      <Button size="sm" variant="outline" className="pl-export" onClick={exportPlan} disabled={!is2d}>
        <Download /> {t("export")}
      </Button>
    </header>
  );
}
