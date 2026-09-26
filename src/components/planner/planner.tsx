"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CatalogueGroup } from "@/domain/planner/items";
import type { Opens3dPref } from "@/lib/planner-prefs";
import type { PlannerData } from "@/server/planner";
import "./planner.css";
import { CatalogueDrawer } from "./catalogue-drawer";
import { Inspector2D } from "./inspector";
import { CameraPanel, Inspector3D } from "./panels-3d";
import { PlannerProvider, usePlanner } from "./planner-context";
import { Stage2D } from "./stage-2d";
import type { PlannerView } from "./state";
import { ToolRail } from "./tool-rail";
import { TopBar } from "./top-bar";

/** three.js and friends load only when 3D is opened. */
const Stage3D = dynamic(() => import("./stage-3d"), { ssr: false, loading: () => <Loading3D /> });

function Loading3D() {
  const t = useTranslations("Planner");
  return (
    <div className="pl-stage">
      <div className="pl-scene3" style={{ display: "grid", placeItems: "center" }}>
        <p className="pl-hint">{t("loading3d")}</p>
      </div>
    </div>
  );
}

export type Opens3d = Opens3dPref;

export function Planner({
  data,
  scope,
  view,
  opens3d,
  arm = null,
}: {
  data: PlannerData;
  scope: "all" | string;
  view: PlannerView;
  opens3d: Opens3d;
  /** Catalogue piece to start with, ready to place (e.g. "+ Add" in the Library). */
  arm?: string | null;
}) {
  return (
    <PlannerProvider data={data} scope={scope} view={view} arm={arm}>
      <Shell opens3d={opens3d} />
    </PlannerProvider>
  );
}

function Shell({ opens3d }: { opens3d: Opens3d }) {
  const { s, dispatch, view, toastMessage } = usePlanner();
  const [category, setCategory] = useState<CatalogueGroup | null>(null);

  // "3D opens with": the current room, or every room.
  const prevMode = useRef(s.mode);
  useEffect(() => {
    if (prevMode.current === "2d" && s.mode === "3d") {
      const ids = s.plan.rooms.map((r) => r.room.id);
      const visible3d = opens3d === "room" && s.scope !== "all" ? [s.scope] : ids;
      dispatch({ type: "set", patch: { visible3d, scope: visible3d.length === ids.length ? "all" : s.scope } });
    }
    prevMode.current = s.mode;
  }, [s.mode, s.scope, s.plan.rooms, opens3d, dispatch]);

  return (
    <div
      className="pl"
      data-view={view}
      data-mode={s.mode}
      data-drawer={s.drawerOpen === null ? "auto" : s.drawerOpen ? "open" : "closed"}
      data-walk={s.walking ? "" : undefined}
      data-testid="planner"
    >
      <TopBar />
      <div className="pl-ws">
        {s.mode === "2d" ? (
          <>
            <ToolRail
              onCategory={(g) => {
                setCategory(g);
                dispatch({ type: "set", patch: { drawerOpen: true } });
              }}
            />
            {s.drawerOpen !== false && <CatalogueDrawer category={category} onCategory={setCategory} />}
            <Stage2D />
            <Inspector2D />
          </>
        ) : (
          <>
            <CameraPanel />
            <Stage3D />
            <Inspector3D />
          </>
        )}
      </div>
      {toastMessage && (
        <div className="pl-toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
