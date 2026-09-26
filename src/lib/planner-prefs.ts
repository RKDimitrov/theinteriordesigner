/**
 * Planner preferences kept in cookies until they get a profile column:
 * Settings → Planner → Layout and "3D opens with".
 */
export const PLANNER_VIEW_COOKIE = "rp-planner-view";
export const OPENS_3D_COOKIE = "rp-3d-opens";

export type PlannerViewPref = "calm" | "quiet" | "full";
export type Opens3dPref = "room" | "all";

export const parsePlannerView = (v: string | undefined): PlannerViewPref => (v === "calm" || v === "full" ? v : "quiet");
export const parseOpens3d = (v: string | undefined): Opens3dPref => (v === "all" ? "all" : "room");
