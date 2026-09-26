import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader, SectionTitle, SheetColumns } from "@/components/atelier/page-header";
import { MarginNote, Rows, SideSection } from "@/components/atelier/sidebar";
import { RefreshLocationButton, RefreshTrendsButton } from "@/components/context/refresh-buttons";
import { Badge } from "@/components/ui/badge";
import type { DesignContext, Level3 } from "@/domain/schemas/context";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { buildDesignContext } from "@/server/context/build";
import { getApartment } from "@/server/repo/apartments";

export default async function ContextPage({ params }: PageProps<"/[locale]/apartments/[id]/context">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const [ctx, t, tn] = await Promise.all([buildDesignContext(userId, id), getTranslations("Context"), getTranslations("Nav")]);
  if (!ctx) notFound();

  return (
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartment.name, href: `/apartments/${id}` }, { label: t("title") }]}
        title={t("title")}
        meta={[t("intro")]}
      />
      <Warnings ctx={ctx} />
      <SheetColumns
        side={
          <>
            <ClimateSection ctx={ctx} apartmentId={id} />
            <RenterSection ctx={ctx} />
            <StyleSection ctx={ctx} apartmentId={id} />
          </>
        }
      >
        <DaylightSection ctx={ctx} />
        <TrendsSection ctx={ctx} apartmentId={id} />
      </SheetColumns>
    </div>
  );
}

const levelChip = (l: Level3) => (l === "high" ? "olive" : l === "medium" ? "outline" : "clay") as "olive" | "outline" | "clay";

async function Warnings({ ctx }: { ctx: DesignContext }) {
  const t = await getTranslations("Context");
  if (ctx.warnings.length === 0) return null;
  return (
    <section data-testid="context-warnings" role="alert" className="mb-8 border-[1.5px] border-foreground bg-card px-[18px] py-3.5">
      <h2 className="mb-1 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">{t("warnings")}</h2>
      <ul>
        {ctx.warnings.map((w) => (
          <li key={w} className="grid grid-cols-[auto_1fr] gap-2.5 border-b border-dotted border-rule py-2 text-[13.5px] last:border-b-0">
            <Badge variant="clay" className="self-start">
              {t("missing")}
            </Badge>
            {t(`warn_${w}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ClimateSection({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
  const [t, tl, format] = await Promise.all([getTranslations("Context"), getTranslations("Level"), getFormatter()]);
  const c = ctx.climate;
  return (
    <SideSection title={t("location")} value={<RefreshLocationButton apartmentId={apartmentId} variant="link" />} data-testid="climate-card">
      <p className="mb-2 font-mono text-[13px]">
        {ctx.location ? (
          <>
            <span data-testid="location-label">{ctx.location.label}</span>
            <span className="text-muted-foreground"> · {t("coordinates", { lat: ctx.location.lat.toFixed(2), lng: ctx.location.lng.toFixed(2) })}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{t("locationUnknown")}</span>
        )}
      </p>
      {!c ? (
        ctx.location && <p className="text-[12.5px] text-muted-foreground">{t("climateUnavailable")}</p>
      ) : (
        <>
          {c.classes.hints[0] && <MarginNote className="mt-3">{c.classes.hints[0]}</MarginNote>}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{t("heating", { level: tl(c.classes.heating) })}</Badge>
            <Badge variant="outline">{t("humidityClass", { level: tl(c.classes.humidity) })}</Badge>
            <Badge variant="outline">{t("winterLight", { level: tl(c.classes.winterLight) })}</Badge>
          </div>
          <Rows
            rows={[
              { label: t("hdd"), value: String(c.summary.heatingDegreeDays) },
              { label: t("meanTemp"), value: `${c.summary.meanTempC} °C` },
              { label: t("humidity"), value: `${c.summary.meanHumidityPct} %` },
              { label: t("winterDaylight"), value: t("hoursPerDay", { value: c.summary.winterDaylightHours }) },
              { label: t("winterSun"), value: t("hoursPerDay", { value: c.summary.winterSunshineHours }) },
            ]}
          />
          {c.classes.hints.length > 1 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
              {c.classes.hints.slice(1).map((h) => (
                <li key={h}>— {h}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            {t("period", { from: c.period.from, to: c.period.to, date: format.dateTime(new Date(c.fetchedAt), { dateStyle: "medium" }) })}
          </p>
        </>
      )}
    </SideSection>
  );
}

async function DaylightSection({ ctx }: { ctx: DesignContext }) {
  const [t, tl, tt] = await Promise.all([getTranslations("Context"), getTranslations("Level"), getTranslations("LightTemp")]);
  return (
    <section aria-labelledby="daylight-title">
      <SectionTitle id="daylight-title" note={t("daylightNote")}>
        {t("daylight")}
      </SectionTitle>
      <p className="-mt-2 mb-3 text-[12.5px] text-muted-foreground">{t("daylightHint")}</p>
      {ctx.rooms.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{t("noRooms")}</p>
      ) : (
        <ul>
          {ctx.rooms.map((r) => (
            <li
              key={r.roomId}
              data-testid={`daylight-${r.name}`}
              className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-dotted border-rule py-2.5 max-[560px]:grid-cols-[minmax(0,1fr)_auto]"
            >
              <span className="font-heading text-[22px] leading-none">{r.name}</span>
              <span className="text-sm max-[560px]:order-3 max-[560px]:col-span-2">
                <span className="block font-mono text-[11.5px] text-muted-foreground">
                  {t("ratio")} {Math.round(r.windowFloorRatio * 100)} % · {t("orientation")} {r.dominantOrientation ?? t("noWindows")} · {t("temperature")}{" "}
                  {tt(r.lightTemperature)}
                </span>
                <span className="mt-0.5 block">{r.hint}</span>
              </span>
              <Badge variant={levelChip(r.level)}>
                {t("level")}: {tl(r.level)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function RenterSection({ ctx }: { ctx: DesignContext }) {
  const [t, tl] = await Promise.all([getTranslations("Context"), getTranslations("Level")]);
  return (
    <SideSection title={t("renter")} value={ctx.renter.applies ? t("drilling", { level: tl(ctx.renter.drilling) }) : undefined} data-testid="renter-card">
      {ctx.renter.applies ? (
        <ul>
          {ctx.renter.rules.map((r) => (
            <li key={r.id} className="border-b border-dotted border-rule py-2 text-[13.5px]">
              {r.text}
            </li>
          ))}
        </ul>
      ) : (
        <MarginNote>{t("renterOwner")}</MarginNote>
      )}
    </SideSection>
  );
}

async function StyleSection({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
  const [t, tn] = await Promise.all([getTranslations("Context"), getTranslations("StyleName")]);
  return (
    <SideSection title={t("style")}>
      {ctx.topStyles.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          {t("noProfile")}{" "}
          <Link href={`/apartments/${apartmentId}/profile`} className="font-mono text-foreground underline underline-offset-3">
            {t("completeProfile")} <span aria-hidden>→</span>
          </Link>
        </p>
      ) : (
        ctx.topStyles.map(({ style, score }) => (
          <div key={style} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 border-b border-dotted border-rule py-2 text-[13.5px]">
            <span>{tn(style)}</span>
            <span className="h-2 border border-foreground bg-card">
              <span className="block h-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
            </span>
            <span className="text-right font-mono tabular-nums">{Math.round(score * 100)}%</span>
          </div>
        ))
      )}
    </SideSection>
  );
}

async function TrendsSection({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
  const [t, tn, tlong, tcat, format] = await Promise.all([
    getTranslations("Context"),
    getTranslations("StyleName"),
    getTranslations("Longevity"),
    getTranslations("TrendCategory"),
    getFormatter(),
  ]);
  const main = ctx.topStyles[0];
  const tr = ctx.trends;
  return (
    <section aria-labelledby="trends-title" data-testid="trends-card" className="mt-11">
      <SectionTitle
        id="trends-title"
        note={main ? t("trendsFor", { style: tn(main.style), country: ctx.renter.country }) : undefined}
        action={<RefreshTrendsButton apartmentId={apartmentId} disabled={!main} />}
      >
        {t("trends")}
      </SectionTitle>
      <p className="-mt-2 mb-4 text-[12.5px] text-muted-foreground">{t("trendsCost")}</p>
      {!main ? (
        <MarginNote>{t("trendsNeedProfile")}</MarginNote>
      ) : !tr ? (
        <MarginNote>{t("trendsNone")}</MarginNote>
      ) : (
        <>
          <ul className="sheet-grid [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
            {tr.trends.map((x) => (
              <li key={x.name} className="taped tape border border-border bg-card px-4 pt-4 pb-3.5 shadow-card">
                <h3 className="font-heading text-2xl leading-[1.1]">{x.name}</h3>
                <div className="my-2 flex flex-wrap gap-1.5">
                  <Badge variant={x.longevity === "lasting" ? "olive" : x.longevity === "mid" ? "outline" : "clay"}>{tlong(x.longevity)}</Badge>
                  <Badge variant="outline">{tcat(x.category)}</Badge>
                </div>
                <p className="text-[13.5px] text-[#5a4f45]">{x.description}</p>
              </li>
            ))}
          </ul>
          {tr.regionalCues.length > 0 && (
            <SideSection title={t("regionalCues")} className="mt-8">
              <ul>
                {tr.regionalCues.map((c) => (
                  <li key={c} className="border-b border-dotted border-rule py-2 text-[13.5px]">
                    {c}
                  </li>
                ))}
              </ul>
            </SideSection>
          )}
          {tr.sources.length > 0 && (
            <details className="mt-2 text-[13.5px]">
              <summary className="eyebrow cursor-pointer">
                {t("sources")} ({tr.sources.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {tr.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3 hover:text-primary">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            {t("trendsFetched", { date: format.dateTime(new Date(tr.fetchedAt), { dateStyle: "medium" }), model: tr.model })}
          </p>
        </>
      )}
    </section>
  );
}
