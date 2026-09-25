import { getFormatter, getTranslations } from "next-intl/server";
import { Ledger } from "@/components/atelier/ledger";
import { PageHeader, SheetColumns } from "@/components/atelier/page-header";
import { AddTile, SheetCardFoot, SheetCardHead, SheetCardPlan, SheetLink, TapedCard } from "@/components/atelier/sheet-card";
import { MarginNote, SideSection } from "@/components/atelier/sidebar";
import { RoomPlan } from "@/components/plan-view/room-plan";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { area } from "@/domain/geometry/polygon";
import type { Apartment } from "@/domain/schemas/apartment";
import { Link } from "@/i18n/navigation";
import { type ActivityEntry, recentActivity } from "@/server/activity";
import { requireUserId } from "@/server/auth";
import { apartmentProgress } from "@/server/progress";
import { listApartments } from "@/server/repo/apartments";
import { countDesigns } from "@/server/repo/designs";

export default async function ApartmentsPage() {
  const userId = await requireUserId();
  const [apartments, t] = await Promise.all([listApartments(userId), getTranslations("Apartments")]);
  const [progress, designCount, activity] = await Promise.all([
    Promise.all(apartments.map((a) => apartmentProgress(userId, a.id))),
    countDesigns(userId),
    recentActivity(userId, apartments),
  ]);
  const roomCount = apartments.reduce((n, a) => n + a.roomCount, 0);

  return (
    <div className="stagger">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        meta={[t("apartmentsCount", { count: apartments.length }), t("rooms", { count: roomCount }), t("designs", { count: designCount })]}
        aside={
          <Link href="/apartments/new" className={buttonVariants()}>
            <span aria-hidden>+</span> {t("new")}
          </Link>
        }
      />
      <SheetColumns
        side={
          <>
            {apartments.length > 0 && (
              <SideSection title={t("recent")} value={t("recentLog")}>
                {activity.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">{t("recentEmpty")}</p>
                ) : (
                  <ActivityLedger entries={activity} />
                )}
              </SideSection>
            )}
            <SideSection title={t("marginNote")}>
              <MarginNote>{apartments.length === 0 ? t("empty") : t("tip")}</MarginNote>
            </SideSection>
          </>
        }
      >
        <ul className="sheet-grid">
          {apartments.map((a, i) => (
            <ApartmentCard key={a.id} apartment={a} progress={progress[i]!} />
          ))}
          <li>
            <AddTile href="/apartments/new">{t("newTile")}</AddTile>
          </li>
        </ul>
      </SheetColumns>
    </div>
  );
}

async function ApartmentCard({ apartment: a, progress }: { apartment: Apartment; progress: Awaited<ReturnType<typeof apartmentProgress>> }) {
  const [t, tc, tf] = await Promise.all([getTranslations("Apartments"), getTranslations("Common"), getTranslations("ApartmentForm")]);
  const largest = progress.rooms.reduce<(typeof progress.rooms)[number] | null>(
    (best, r) => (!best || area(r.polygon) > area(best.polygon) ? r : best),
    null
  );
  const allDone = progress.done.every(Boolean);
  return (
    <TapedCard as="li">
      <SheetCardHead title={<Link href={`/apartments/${a.id}`}>{a.name}</Link>} value={`${a.totalAreaM2} ${tc("m2")}`} />
      <SheetCardPlan className="h-[220px]">
        {largest && <RoomPlan room={largest} northAngleDeg={a.northAngleDeg} showDimensions={false} className="h-full" />}
      </SheetCardPlan>
      <SheetCardFoot>
        <Badge variant={allDone ? "olive" : "default"}>{allDone ? t("allDone") : t("stepOf", { step: progress.current + 1, total: 4 })}</Badge>
        <Badge variant="outline">
          {a.city}, {a.country}
        </Badge>
        <Badge variant="outline">{a.tenure === "rent" ? tf("rent") : tf("own")}</Badge>
        <SheetLink href={`/apartments/${a.id}`} aria-label={`${t("open")}: ${a.name}`}>
          {t("open")} <span aria-hidden>→</span>
        </SheetLink>
      </SheetCardFoot>
    </TapedCard>
  );
}

async function ActivityLedger({ entries }: { entries: readonly ActivityEntry[] }) {
  const [t, ts, td, format] = await Promise.all([
    getTranslations("Apartments"),
    getTranslations("StyleName"),
    getTranslations("Design"),
    getFormatter(),
  ]);
  const b = (chunks: React.ReactNode) => <b>{chunks}</b>;
  return (
    <Ledger
      entries={entries.map((e) => ({
        key: e.key,
        dateTime: e.at.toISOString(),
        time: format.dateTime(e.at, { day: "numeric", month: "short" }),
        text:
          e.kind === "design"
            ? t.rich("activity_design", { room: e.room, version: e.version, b })
            : e.kind === "room"
              ? t.rich("activity_room", { room: e.room, b })
              : e.kind === "climate"
                ? t("activity_climate", { city: e.city })
                : t("activity_trends", { style: ts(e.style) }),
        chip:
          e.kind === "design" ? (
            <Badge variant={e.status === "valid" ? "olive" : e.status === "invalid" ? "destructive" : "warn"}>{td(`status_${e.status}`)}</Badge>
          ) : null,
      }))}
    />
  );
}
