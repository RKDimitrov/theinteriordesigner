import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { RefreshLocationButton, RefreshTrendsButton } from "@/components/context/refresh-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [ctx, t, tc] = await Promise.all([buildDesignContext(userId, id), getTranslations("Context"), getTranslations("Common")]);
  if (!ctx) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Link href={`/apartments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {tc("back")} · {apartment.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <Warnings ctx={ctx} />
      <ClimateCard ctx={ctx} apartmentId={id} />
      <DaylightCard ctx={ctx} />
      <div className="grid gap-4 md:grid-cols-2">
        <RenterCard ctx={ctx} />
        <StyleCard ctx={ctx} apartmentId={id} />
      </div>
      <TrendsCard ctx={ctx} apartmentId={id} />
    </div>
  );
}

const levelVariant = (l: Level3) => (l === "high" ? "default" : l === "medium" ? "secondary" : "outline");

async function Warnings({ ctx }: { ctx: DesignContext }) {
  const t = await getTranslations("Context");
  if (ctx.warnings.length === 0) return null;
  return (
    <Alert data-testid="context-warnings">
      <AlertTitle>{t("warnings")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {ctx.warnings.map((w) => (
            <li key={w}>{t(`warn_${w}`)}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

async function ClimateCard({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
  const [t, tl, format] = await Promise.all([getTranslations("Context"), getTranslations("Level"), getFormatter()]);
  const c = ctx.climate;
  return (
    <Card data-testid="climate-card">
      <CardHeader>
        <CardTitle>{t("location")}</CardTitle>
        <CardDescription>
          {ctx.location ? (
            <>
              <span data-testid="location-label">{ctx.location.label}</span> ·{" "}
              {t("coordinates", { lat: ctx.location.lat.toFixed(2), lng: ctx.location.lng.toFixed(2) })}
            </>
          ) : (
            t("locationUnknown")
          )}
        </CardDescription>
        <CardAction>
          <RefreshLocationButton apartmentId={apartmentId} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!c ? (
          ctx.location && <p className="text-sm text-muted-foreground">{t("climateUnavailable")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{t("heating", { level: tl(c.classes.heating) })}</Badge>
              <Badge variant="outline">{t("humidityClass", { level: tl(c.classes.humidity) })}</Badge>
              <Badge variant="outline">{t("winterLight", { level: tl(c.classes.winterLight) })}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
              <Stat label={t("hdd")} value={String(c.summary.heatingDegreeDays)} />
              <Stat label={t("meanTemp")} value={`${c.summary.meanTempC} °C`} />
              <Stat label={t("humidity")} value={`${c.summary.meanHumidityPct} %`} />
              <Stat label={t("winterDaylight")} value={t("hoursPerDay", { value: c.summary.winterDaylightHours })} />
              <Stat label={t("winterSun")} value={t("hoursPerDay", { value: c.summary.winterSunshineHours })} />
            </dl>
            <ul className="list-disc pl-4 text-sm">
              {c.classes.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("period", { from: c.period.from, to: c.period.to, date: format.dateTime(new Date(c.fetchedAt), { dateStyle: "medium" }) })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

async function DaylightCard({ ctx }: { ctx: DesignContext }) {
  const [t, tl, tt] = await Promise.all([getTranslations("Context"), getTranslations("Level"), getTranslations("LightTemp")]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("daylight")}</CardTitle>
        <CardDescription>{t("daylightHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {ctx.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRooms")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {ctx.rooms.map((r) => (
              <li key={r.roomId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0" data-testid={`daylight-${r.name}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant={levelVariant(r.level)}>
                    {t("level")}: {tl(r.level)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("ratio")} {Math.round(r.windowFloorRatio * 100)} % · {t("orientation")} {r.dominantOrientation ?? t("noWindows")} ·{" "}
                    {t("temperature")} {tt(r.lightTemperature)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{r.hint}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function RenterCard({ ctx }: { ctx: DesignContext }) {
  const [t, tl] = await Promise.all([getTranslations("Context"), getTranslations("Level")]);
  return (
    <Card data-testid="renter-card">
      <CardHeader>
        <CardTitle>{t("renter")}</CardTitle>
        {ctx.renter.applies && <CardDescription>{t("drilling", { level: tl(ctx.renter.drilling) })}</CardDescription>}
      </CardHeader>
      <CardContent>
        {ctx.renter.applies ? (
          <ul className="list-disc pl-4 text-sm">
            {ctx.renter.rules.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("renterOwner")}</p>
        )}
      </CardContent>
    </Card>
  );
}

async function StyleCard({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
  const [t, tn] = await Promise.all([getTranslations("Context"), getTranslations("StyleName")]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("style")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ctx.topStyles.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">{t("noProfile")}</p>
            <Link href={`/apartments/${apartmentId}/profile`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("completeProfile")}
            </Link>
          </>
        ) : (
          ctx.topStyles.map(({ style, score }) => (
            <div key={style} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
              <span>{tn(style)}</span>
              <span className="h-2 rounded-full bg-muted">
                <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums">{Math.round(score * 100)}%</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

async function TrendsCard({ ctx, apartmentId }: { ctx: DesignContext; apartmentId: string }) {
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
    <Card data-testid="trends-card">
      <CardHeader>
        <CardTitle>{t("trends")}</CardTitle>
        {main && <CardDescription>{t("trendsFor", { style: tn(main.style), country: ctx.renter.country })}</CardDescription>}
        <CardAction>
          <RefreshTrendsButton apartmentId={apartmentId} disabled={!main} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{t("trendsCost")}</p>
        {!main ? (
          <p className="text-sm text-muted-foreground">{t("trendsNeedProfile")}</p>
        ) : !tr ? (
          <p className="text-sm text-muted-foreground">{t("trendsNone")}</p>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {tr.trends.map((x) => (
                <li key={x.name} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{x.name}</span>
                    <Badge variant={x.longevity === "lasting" ? "default" : x.longevity === "mid" ? "secondary" : "destructive"}>{tlong(x.longevity)}</Badge>
                    <Badge variant="outline">{tcat(x.category)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{x.description}</p>
                </li>
              ))}
            </ul>
            {tr.regionalCues.length > 0 && (
              <div>
                <p className="text-sm font-medium">{t("regionalCues")}</p>
                <ul className="list-disc pl-4 text-sm">
                  {tr.regionalCues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {tr.sources.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  {t("sources")} ({tr.sources.length})
                </summary>
                <ul className="mt-1 list-disc pl-4">
                  {tr.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-xs text-muted-foreground">
              {t("trendsFetched", { date: format.dateTime(new Date(tr.fetchedAt), { dateStyle: "medium" }), model: tr.model })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
