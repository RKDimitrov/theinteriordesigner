"use client";

import { ArrowRight, Box, BrickWall, Columns2, DoorClosed, DoorOpen, Hand, Heater, MousePointer2, MoveHorizontal, PlugZap, Ruler, Square, StickyNote, Type, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogueGroup } from "@/domain/planner/items";
import { usePlanner } from "./planner-context";
import { TOOL_KEY, type Tool } from "./state";

const ICON: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  wall: BrickWall,
  room: Square,
  door: DoorOpen,
  window: Columns2,
  pass: DoorClosed,
  radiator: Heater,
  socket: PlugZap,
  measure: Ruler,
  dimension: MoveHorizontal,
  label: Type,
  note: StickyNote,
};

/** Tools the Simple view hides behind "More tools". */
const ADVANCED: ReadonlySet<Tool> = new Set(["pass", "radiator", "socket", "measure", "dimension", "label", "note"]);

const GROUPS: readonly { n: string; key: "group1" | "group2" | "group4"; tools: readonly Tool[] }[] = [
  { n: "01", key: "group1", tools: ["wall", "room"] },
  { n: "02", key: "group2", tools: ["door", "window", "pass", "radiator", "socket"] },
  { n: "04", key: "group4", tools: ["measure", "dimension", "label", "note"] },
];

const RAIL_CATS: readonly CatalogueGroup[] = ["living", "bedroom", "dining", "office", "plants"];

export function ToolRail({ onCategory }: { onCategory: (g: CatalogueGroup) => void }) {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  const [more, setMore] = useState(false);
  const setTool = (tool: Tool) => dispatch({ type: "tool", tool });

  return (
    <aside className="pl-rail" aria-label={t("tools")} data-more={more ? "" : undefined}>
      <div className="pl-rail-mode">
        <div className="pl-tg" role="group">
          {(["select", "pan"] as const).map((tool) => {
            const Icon = ICON[tool];
            return (
              <button key={tool} type="button" aria-pressed={s.tool === tool} data-testid={`planner-tool-${tool}`} onClick={() => setTool(tool)}>
                <Icon className="ic" /> {t(`tool_${tool}`)} <kbd>{TOOL_KEY[tool]}</kbd>
              </button>
            );
          })}
        </div>
      </div>
      <div className="pl-scroll">
        {GROUPS.slice(0, 2).map((g) => (
          <div key={g.n} className="pl-grp">
            <h3>
              <span>{g.n}</span>
              {t(g.key)}
            </h3>
            {g.tools.map((tool) => (
              <ToolButton key={tool} tool={tool} active={s.tool === tool} onPick={setTool} />
            ))}
          </div>
        ))}
        <div className="pl-grp">
          <h3>
            <span>03</span>
            {t("group3")}
          </h3>
          <Button
            className="pl-catbtn"
            data-testid="planner-catalogue"
            aria-expanded={s.drawerOpen ?? undefined}
            onClick={() => {
              // From "auto", the click flips whatever the screen currently shows.
              const shown = s.drawerOpen ?? window.matchMedia("(min-width: 1200px)").matches;
              dispatch({ type: "set", patch: { drawerOpen: !shown } });
            }}
          >
            {t("catalogue")} <ArrowRight />
          </Button>
          <div className="pl-chiprow adv">
            {RAIL_CATS.map((g) => (
              <button key={g} type="button" className="pl-chip" onClick={() => onCategory(g)}>
                {t(`cat_${g}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="pl-grp adv-t">
          <h3>
            <span>{GROUPS[2]!.n}</span>
            {t(GROUPS[2]!.key)}
          </h3>
          {GROUPS[2]!.tools.map((tool) => (
            <ToolButton key={tool} tool={tool} active={s.tool === tool} onPick={setTool} />
          ))}
        </div>
        <button type="button" className="pl-tool calm-only" style={{ color: "var(--mute)", marginTop: 10 }} aria-expanded={more} onClick={() => setMore((m) => !m)}>
          <span>{more ? t("fewerTools") : t("moreTools")}</span>
          <span aria-hidden>{more ? "−" : "+"}</span>
        </button>
      </div>
      <div className="pl-rail-foot">
        <Button variant="outline" data-testid="planner-view-3d" onClick={() => dispatch({ type: "mode", mode: "3d" })}>
          <Box /> {t("viewIn3d")}
        </Button>
      </div>
    </aside>
  );
}

function ToolButton({ tool, active, onPick }: { tool: Tool; active: boolean; onPick: (tool: Tool) => void }) {
  const t = useTranslations("Planner");
  const Icon = ICON[tool];
  const hint = tool === "wall" ? t("wallHint") : tool === "room" ? t("roomHint") : "";
  return (
    <button type="button" className={`pl-tool${ADVANCED.has(tool) ? " adv-t" : ""}`} aria-pressed={active} data-testid={`planner-tool-${tool}`} onClick={() => onPick(tool)}>
      <Icon className="ic" />
      <span>{t(`tool_${tool}`)}</span>
      <em>{hint}</em>
      <kbd>{TOOL_KEY[tool]}</kbd>
    </button>
  );
}
