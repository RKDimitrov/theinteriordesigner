import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Ledger } from "@/components/atelier/ledger";
import { PageHeader, SectionTitle, SheetColumns, SplitTitle } from "@/components/atelier/page-header";
import { SheetCardFoot, SheetCardHead, SheetCardPlan, SheetLink, TapedCard } from "@/components/atelier/sheet-card";
import { MarginNote, Rows, SideSection, SwatchCard } from "@/components/atelier/sidebar";
import { type TicketStep, TicketStepper } from "@/components/atelier/ticket-stepper";
import { TitleBlock } from "@/components/atelier/title-block";
import { RefreshLocationButton } from "@/components/context/refresh-buttons";
import { RoomPlan } from "@/components/plan-view/room-plan";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DeleteApartmentButton } from "@/components/wizard/delete-apartment-button";
import { roomDaylight } from "@/domain/context/daylight";
import { area } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { topStyles } from "@/domain/profile/quiz";
import { SWATCHES } from "@/domain/profile/swatches";
import type { Apartment } from "@/domain/schemas/apartment";
import { Climate } from "@/domain/schemas/context";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { cacheKeys, getCached } from "@/server/context/cache";
import { type ApartmentProgress, apartmentProgress } from "@/server/progress";
import { apartmentRevisedAt, getApartment } from "@/server/repo/apartments";
import { type DesignStatus, designHistory, getDesign } from "@/server/repo/designs";

export default async function ApartmentOverviewPage({ params }: PageProps<"/[locale]/apartments/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const [progress, revisedAt, t, tc, tf, format] = await Promise.all([
    apartmentProgress(userId, id),
    apartmentRevisedAt(userId, id),
    getTranslations("Overview"),
    getTranslations("Common"),
    getTranslations("ApartmentForm"),
    getFormatter(),
  ]);
  const { rooms } = progress;

  return (
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: t("crumbApartments"), href: "/apartments" }, { label: apartment.name }]}
        title={<SplitTitle text={apartment.name} />}
        meta={[
          [apartment.address, apartment.city, apartment.country].filter(Boolean).join(", "),
          `${apartment.totalAreaM2} ${tc("m2")}`,
          t("floor", { level: apartment.floorLevel }),
          apartment.tenure === "rent" ? tf("rent") : tf("own"),
        ]}
        aside={
          <>
            <TitleBlock
              cells={[
                { key: t("project"), value: projectCode(apartment) },
                { key: t("north"), value: t("northValue", { deg: Math.round(apartment.northAngleDeg) }) },
                { key: t("roomsKey"), value: String(rooms.length).padStart(2, "0") },
                { key: t("revised"), value: revisedAt ? format.dateTime(revisedAt, { dateStyle: "medium" }) : "—" },
              ]}
            />
            <div className="flex flex-wrap justify-end gap-2.5">
              <DeleteApartmentButton id={id} />
              <Link href={`/apartments/${id}/edit`} className={buttonVariants({ variant: "ghost" })}>
                {t("editDetails")}
              </Link>
              <Link href={`/apartments/${id}/planner?room=all`} className={buttonVariants()} data-testid="open-planner">
                {t("openPlanner")} <span aria-hidden>→</span>
              </Link>
            </div>
          </>
        }
      />

      <Stepper apartmentId={id} progress={progress} />

      <SheetColumns side={<Sidebar apartment={apartment} progress={progress} />}>
        <section id="rooms" aria-labelledby="rooms-title">
          <SectionTitle
            id="rooms-title"
            note={t("sheets", { count: rooms.length })}
            action={
              <Link href={`/apartments/${id}/rooms/new`} className={buttonVariants({ size: "sm" })}>
                <span aria-hidden>+</span> {t("addRoom")}
              </Link>
            }
          >
            {t("rooms")}
          </SectionTitle>
          {rooms.length === 0 ? (
            <p className="max-w-prose text-muted-foreground">{t("noRooms")}</p>
          ) : (
            <RoomCards apartment={apartment} progress={progress} userId={userId} />
          )}
        </section>

        <section aria-labelledby="history-title" className="mt-11">
          <SectionTitle id="history-title" note={t("historyNote")}>
            {t("history")}
          </SectionTitle>
          <History userId={userId} apartmentId={id} />
        </section>
      </SheetColumns>
    </div>
  );
}

/** Short drawing number, e.g. "NOV-3F2A". */
function projectCode(a: Apartment): string {
  const letters = a.name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "APT";
  return `${letters}-${a.id.slice(0, 4).toUpperCase()}`;
}

async function Stepper({ apartmentId: id, progress: p }: { apartmentId: string; progress: ApartmentProgress }) {
  const t = await getTranslations("Overview");
  const tc = await getTranslations("Common");
  const summaries = [
    p.rooms.length === 0 ? t("sumRoomsNone") : t("sumRooms", { rooms: p.rooms.length, doors: p.doors, windows: p.windows }),
    !p.profile
      ? t("sumProfileNone")
      : p.profileState.missingBudgetRoomIds.length > 0
        ? t("sumProfileMissing", { answered: p.quizAnswered, total: p.quizTotal, count: p.profileState.missingBudgetRoomIds.length })
        : t("sumProfile", { answered: p.quizAnswered, total: p.quizTotal }),
    p.contextDone ? t("sumContextDone") : t("sumContextOpen"),
    p.rooms.length === 0 ? t("sumDesignNoRooms") : t("sumDesign", { designed: p.designedRooms, total: p.rooms.length }),
  ];
  const meta = [
    { title: t("stepRooms"), href: `/apartments/${id}/planner?room=all` },
    { title: t("stepProfile"), href: `/apartments/${id}/profile` },
    { title: t("stepContext"), href: `/apartments/${id}/context` },
    { title: t("stepDesign"), href: p.rooms[0] ? `/apartments/${id}/design/${p.rooms[0].id}` : null },
  ];
  const steps: TicketStep[] = meta.map((m, i) => {
    const n = String(i + 1).padStart(2, "0");
    const current = i === p.current && !p.done[i];
    return {
      eyebrow: current ? t("stepEyebrowNow", { n }) : t("stepEyebrow", { n }),
      title: m.title,
      summary: summaries[i],
      href: m.href,
      done: p.done[i]!,
      current,
      testId: m.href ? `step-${i + 1}` : undefined,
      stamp: !m.href ? (
        tc("comingSoon")
      ) : p.done[i] ? (
        <>
          {t("done")} <span aria-hidden>✓</span>
        </>
      ) : (
        t("notDone")
      ),
    };
  });
  return <TicketStepper steps={steps} label={t("steps")} />;
}

async function RoomCards({ apartment, progress, userId }: { apartment: Apartment; progress: ApartmentProgress; userId: string }) {
  const [t, tc, tt, tl] = await Promise.all([
    getTranslations("Overview"),
    getTranslations("Common"),
    getTranslations("RoomType"),
    getTranslations("LightTemp"),
  ]);
  const designs = await Promise.all(progress.rooms.map((r) => (progress.designStatus.has(r.id) ? getDesign(userId, r.id) : null)));
  const base = `/apartments/${apartment.id}`;

  return (
    <ul className="sheet-grid">
      {progress.rooms.map((r, i) => {
        const doors = r.openings.filter((o) => o.kind === "door").length;
        const windows = r.openings.filter((o) => o.kind === "window").length;
        const design = designs[i];
        const status = progress.designStatus.get(r.id);
        const light = roomDaylight(r, apartment.northAngleDeg, apartment.lat, apartment.floorLevel);
        return (
          <TapedCard as="li" key={r.id} data-testid="room-card">
            <SheetCardHead
              title={r.name}
              value={`${m2(area(r.polygon)).toFixed(2)} ${tc("m2")}`}
              sub={`${tt(r.type)} · ${t("openings", { doors, windows })}`}
            />
            <SheetCardPlan>
              <RoomPlan room={r} northAngleDeg={apartment.northAngleDeg} furniture={design?.content.furniture} />
            </SheetCardPlan>
            <SheetCardFoot>
              {design && status ? (
                <Badge variant={chipFor(status)}>
                  {status === "invalid" ? t("designedInvalid", { version: design.version }) : t("designed", { version: design.version })}
                </Badge>
              ) : (
                <Badge variant="clay">{t("noDesign")}</Badge>
              )}
              {light.dominantOrientation && (
                <Badge variant="outline">{t("orientation", { dir: light.dominantOrientation, temp: tl(light.lightTemperature) })}</Badge>
              )}
              <SheetLink href={`${base}/planner?room=${r.id}`} aria-label={`${t("editPlan")}: ${r.name}`}>
                {t("editPlan")}
              </SheetLink>
              {design ? (
                <SheetLink href={`${base}/design/${r.id}`} aria-label={`${t("open")}: ${r.name}`}>
                  {t("open")} <span aria-hidden>→</span>
                </SheetLink>
              ) : (
                <SheetLink href={`${base}/design/${r.id}`} className="text-primary" aria-label={`${t("generate")}: ${r.name}`}>
                  {t("generate")} <span aria-hidden>→</span>
                </SheetLink>
              )}
            </SheetCardFoot>
          </TapedCard>
        );
      })}
    </ul>
  );
}

const chipFor = (s: DesignStatus): "default" | "destructive" | "warn" => (s === "valid" ? "default" : s === "invalid" ? "destructive" : "warn");

async function History({ userId, apartmentId }: { userId: string; apartmentId: string }) {
  const [entries, t, td, format] = await Promise.all([
    designHistory(userId, apartmentId),
    getTranslations("Overview"),
    getTranslations("Design"),
    getFormatter(),
  ]);
  if (entries.length === 0) return <p className="text-[12.5px] text-muted-foreground">{t("historyEmpty")}</p>;
  return (
    <Ledger
      data-testid="design-history"
      entries={entries.map((e) => ({
        key: `${e.roomId}-${e.version}`,
        dateTime: e.createdAt.toISOString(),
        time: format.dateTime(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        text: t.rich("historyEntry", {
          room: e.roomName,
          version: e.version,
          repairs: e.repairAttempts,
          seconds: Math.round(e.durationMs / 1000),
          cost: format.number(e.costEstimateEur, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
          b: (chunks) => <b>{chunks}</b>,
        }),
        chip: <Badge variant={e.status === "valid" ? "olive" : e.status === "invalid" ? "destructive" : "warn"}>{td(`status_${e.status}`)}</Badge>,
      }))}
    />
  );
}

async function Sidebar({ apartment, progress }: { apartment: Apartment; progress: ApartmentProgress }) {
  const [t, tx, ts, climate] = await Promise.all([
    getTranslations("Overview"),
    getTranslations("Context"),
    getTranslations("StyleName"),
    apartment.lat !== null && apartment.lng !== null ? getCached(cacheKeys.climate(apartment.lat, apartment.lng), Climate) : null,
  ]);
  const c = climate?.value;
  const tip = c?.classes.hints[0];
  const liked = (progress.profile?.colorsLiked ?? []).slice(0, 4).map((hex) => ({
    hex,
    name: SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex,
  }));
  const styles = progress.profile ? topStyles(progress.profile.scores, 2) : [];
  const base = `/apartments/${apartment.id}`;

  return (
    <>
      {tip && (
        <SideSection title={t("marginNote")} value={t("marginNoteSource")}>
          <MarginNote>{tip}</MarginNote>
        </SideSection>
      )}
      <SideSection
        title={t("climate", { city: apartment.city })}
        value={<RefreshLocationButton apartmentId={apartment.id} label={t("recheck")} variant="link" />}
      >
        {c ? (
          <Rows
            rows={[
              { label: tx("hdd"), value: String(c.summary.heatingDegreeDays) },
              { label: tx("meanTemp"), value: `${c.summary.meanTempC} °C` },
              { label: tx("humidity"), value: `${c.summary.meanHumidityPct} %` },
              { label: tx("winterDaylight"), value: tx("hoursPerDay", { value: c.summary.winterDaylightHours }) },
              { label: tx("winterSun"), value: tx("hoursPerDay", { value: c.summary.winterSunshineHours }) },
            ]}
          />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            {t("climateNone")}{" "}
            <Link href={`${base}/context`} className="font-mono text-foreground underline underline-offset-3">
              {t("openContext")} <span aria-hidden>→</span>
            </Link>
          </p>
        )}
      </SideSection>
      <SideSection title={t("swatches")} value={styles.length > 0 ? styles.map((s) => ts(s.style)).join(" · ") : undefined}>
        {liked.length > 0 ? (
          <SwatchCard swatches={liked} />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            {t("swatchesNone")}{" "}
            <Link href={`${base}/profile`} className="font-mono text-foreground underline underline-offset-3">
              {t("openProfile")} <span aria-hidden>→</span>
            </Link>
          </p>
        )}
      </SideSection>
    </>
  );
}
