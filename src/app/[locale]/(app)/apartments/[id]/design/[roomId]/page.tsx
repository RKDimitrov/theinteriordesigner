import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { DesignView } from "@/components/design/design-view";
import { GenerateButton, GenerateProgress, GenerateProvider } from "@/components/design/generate-button";
import { roomDaylight } from "@/domain/context/daylight";
import { area } from "@/domain/geometry/polygon";
import { topStyles } from "@/domain/profile/quiz";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getDesign, listVersions } from "@/server/repo/designs";
import { getProfile } from "@/server/repo/profiles";
import { listRooms } from "@/server/repo/rooms";

export default async function DesignPage({ params, searchParams }: PageProps<"/[locale]/apartments/[id]/design/[roomId]">) {
  const { id, roomId } = await params;
  const { v } = await searchParams;
  const userId = await requireUserId();
  const [apartment, rooms, profile, t, tc, tn, tl, ts] = await Promise.all([
    getApartment(userId, id),
    listRooms(userId, id),
    getProfile(userId, id),
    getTranslations("Design"),
    getTranslations("Common"),
    getTranslations("Nav"),
    getTranslations("LightTemp"),
    getTranslations("StyleName"),
  ]);
  const room = rooms.find((r) => r.id === roomId);
  if (!apartment || !room) notFound();

  const version = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;
  const [design, versions, format] = await Promise.all([getDesign(userId, roomId, version), listVersions(userId, roomId), getFormatter()]);
  const budgetEur = profile?.budgetPerRoom[roomId] ?? null;
  const areaM2 = Math.round(area(room.polygon) / 1000) / 10;
  const light = roomDaylight(room, apartment.northAngleDeg, apartment.lat, apartment.floorLevel);
  const style = profile ? topStyles(profile.scores, 1)[0] : undefined;
  const base = `/apartments/${id}/design/${roomId}`;

  return (
    <GenerateProvider apartmentId={id} roomId={roomId} hasDesign={design !== null}>
      <div className="stagger">
        <PageHeader
          crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartment.name, href: `/apartments/${id}` }, { label: room.name }]}
          title={
            <>
              {room.name} · <em>{t("titleLower")}</em>
            </>
          }
          meta={[
            `${areaM2} ${tc("m2")}`,
            t("lightMeta", { dir: light.dominantOrientation ?? "—", temp: tl(light.lightTemperature) }),
            ...(style ? [ts(style.style)] : []),
            ...(design ? [t("version", { version: design.version })] : []),
          ]}
          aside={
            <>
              {versions.length > 1 && (
                <nav aria-label={t("versions")} className="flex w-max max-w-full flex-wrap border-[1.5px] border-foreground bg-card">
                  {[...versions].reverse().map((ver) => {
                    const latest = ver.version === versions[0]!.version;
                    const on = design?.version === ver.version;
                    return (
                      <Link
                        key={ver.version}
                        href={latest ? base : `${base}?v=${ver.version}`}
                        aria-current={on ? "page" : undefined}
                        aria-label={latest ? `${t("version", { version: ver.version })} · ${t("latest")}` : t("version", { version: ver.version })}
                        className={cn(
                          "border-r border-foreground px-3.5 py-2 font-mono text-[11.5px] font-medium last:border-r-0 hover:bg-secondary",
                          on && "bg-foreground text-card hover:bg-foreground"
                        )}
                      >
                        v{ver.version}
                        {latest && <span aria-hidden> ★</span>}
                      </Link>
                    );
                  })}
                </nav>
              )}
              <GenerateButton />
            </>
          }
        />

        {rooms.length > 1 && (
          <nav aria-label={t("rooms")} className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">{t("rooms")}</span>
            {rooms.map((r) => (
              <Link
                key={r.id}
                href={`/apartments/${id}/design/${r.id}`}
                aria-current={r.id === roomId ? "page" : undefined}
                className={cn(
                  "border border-foreground px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase hover:bg-secondary",
                  r.id === roomId && "bg-foreground text-background hover:bg-foreground"
                )}
              >
                {r.name}
              </Link>
            ))}
          </nav>
        )}

        {(!profile || budgetEur === null) && (
          <p className="mb-4 text-[12.5px] text-muted-foreground">
            {t("prereqProfile")}{" "}
            <Link href={`/apartments/${id}/profile`} className="font-mono text-foreground underline underline-offset-3">
              {t("completeProfile")} <span aria-hidden>→</span>
            </Link>
          </p>
        )}

        <GenerateProgress />

        {!design ? (
          <p className="font-heading text-2xl italic">{t("none")}</p>
        ) : (
          <DesignView
            room={room}
            northAngleDeg={apartment.northAngleDeg}
            design={design.content}
            issues={design.validation.issues}
            status={design.validation.status}
            budgetEur={budgetEur}
            solver={design.validation.solver}
            areaM2={areaM2}
            generation={{
              model: design.source.model,
              seconds: Math.round(design.durationMs / 1000),
              repairs: design.validation.repairAttempts,
              cost: format.number(design.costEstimateEur, { style: "currency", currency: "EUR" }),
              date: format.dateTime(design.createdAt, { dateStyle: "medium", timeStyle: "short" }),
            }}
          />
        )}
      </div>
    </GenerateProvider>
  );
}
