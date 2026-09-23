import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { DesignView } from "@/components/design/design-view";
import { area } from "@/domain/geometry/polygon";
import { GenerateButton } from "@/components/design/generate-button";
import { buttonVariants } from "@/components/ui/button";
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
  const [apartment, rooms, profile, t, tc] = await Promise.all([
    getApartment(userId, id),
    listRooms(userId, id),
    getProfile(userId, id),
    getTranslations("Design"),
    getTranslations("Common"),
  ]);
  const room = rooms.find((r) => r.id === roomId);
  if (!apartment || !room) notFound();

  const version = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;
  const [design, versions, format] = await Promise.all([getDesign(userId, roomId, version), listVersions(userId, roomId), getFormatter()]);
  const budgetEur = profile?.budgetPerRoom[roomId] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/apartments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {tc("back")} · {apartment.name}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t("title")}: {room.name}
        </h1>
        <nav aria-label={t("rooms")} className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/apartments/${id}/design/${r.id}`}
              className={buttonVariants({ variant: r.id === roomId ? "default" : "outline", size: "sm" })}
            >
              {r.name}
            </Link>
          ))}
        </nav>
      </div>

      {(!profile || budgetEur === null) && (
        <p className="text-sm text-muted-foreground">
          {t("prereqProfile")}{" "}
          <Link href={`/apartments/${id}/profile`} className="underline underline-offset-2">
            {t("completeProfile")}
          </Link>
        </p>
      )}

      <GenerateButton apartmentId={id} roomId={roomId} hasDesign={design !== null} />

      {versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-label={t("versions")}>
          {versions.map((ver, i) => (
            <Link
              key={ver.version}
              href={i === 0 ? `/apartments/${id}/design/${roomId}` : `/apartments/${id}/design/${roomId}?v=${ver.version}`}
              className={cn("rounded-full border px-2 py-0.5", design?.version === ver.version && "border-foreground font-medium")}
            >
              {t("version", { version: ver.version })}
              {i === 0 ? ` · ${t("latest")}` : ""}
            </Link>
          ))}
        </div>
      )}

      {!design ? (
        <p className="text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          <DesignView
            room={room}
            northAngleDeg={apartment.northAngleDeg}
            design={design.content}
            issues={design.validation.issues}
            status={design.validation.status}
            budgetEur={budgetEur}
            solver={design.validation.solver}
            areaM2={Math.round(area(room.polygon) / 1000) / 10}
          />
          <p className="text-xs text-muted-foreground">
            {t("generation", {
              model: design.source.model,
              cost: format.number(design.costEstimateEur, { style: "currency", currency: "EUR" }),
              seconds: Math.round(design.durationMs / 1000),
              repairs: design.validation.repairAttempts,
            })}
            {" · "}
            {format.dateTime(design.createdAt, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </>
      )}
    </div>
  );
}
