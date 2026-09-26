import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Planner } from "@/components/planner/planner";
import { OPENS_3D_COOKIE, parseOpens3d, parsePlannerView, PLANNER_VIEW_COOKIE } from "@/lib/planner-prefs";
import { requireUserId } from "@/server/auth";
import { plannerData } from "@/server/planner";
import { getApartment } from "@/server/repo/apartments";

export async function generateMetadata({ params }: PageProps<"/[locale]/apartments/[id]/planner">): Promise<Metadata> {
  const { id } = await params;
  const userId = await requireUserId();
  const [apartment, t] = await Promise.all([getApartment(userId, id), getTranslations("Planner")]);
  return { title: apartment ? t("pageTitle", { name: apartment.name }) : undefined };
}

export default async function PlannerPage({ params, searchParams }: PageProps<"/[locale]/apartments/[id]/planner">) {
  const [{ id }, sp, jar] = await Promise.all([params, searchParams, cookies()]);
  const userId = await requireUserId();
  const data = await plannerData(userId, id);
  if (!data) notFound();

  const room = typeof sp["room"] === "string" ? sp["room"] : "all";
  const scope = room !== "all" && data.rooms.some((r) => r.room.id === room) ? room : "all";
  const arm = typeof sp["arm"] === "string" && /^[a-z0-9_-]{1,80}$/i.test(sp["arm"]) ? sp["arm"] : null;
  const view = parsePlannerView(jar.get(PLANNER_VIEW_COOKIE)?.value);
  const opens3d = parseOpens3d(jar.get(OPENS_3D_COOKIE)?.value);
  // Remount after a redesign (a new generated version), not after the planner's own saves.
  const key = data.rooms
    .filter((r) => r.generatedVersion !== null)
    .map((r) => `${r.room.id}:${r.generatedVersion}`)
    .join(",");

  return <Planner key={key} data={data} scope={scope} view={view} opens3d={opens3d} arm={arm} />;
}
