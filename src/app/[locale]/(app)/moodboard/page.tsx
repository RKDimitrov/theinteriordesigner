import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { MarginNote } from "@/components/atelier/sidebar";
import { RoomPlan } from "@/components/plan-view/room-plan";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUserId } from "@/server/auth";
import { type Pin, moodboardPins } from "@/server/moodboard";
import { getApartment, listApartments } from "@/server/repo/apartments";

/** Estimated pin heights (px) for the wide-screen column layout. */
const HEIGHT: Record<Pin["kind"], number> = { photo: 270, slip: 170, fabric: 130, palette: 150, trend: 210 };
const WIDTH: Record<Pin["kind"], number> = { photo: 300, slip: 250, fabric: 120, palette: 240, trend: 260 };
const TILT = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.1, -0.8, 2];
const COLUMNS = 3;

export default async function MoodboardPage({ searchParams }: PageProps<"/[locale]/moodboard">) {
  const userId = await requireUserId();
  const { apt } = await searchParams;
  const [apartments, t] = await Promise.all([listApartments(userId), getTranslations("Moodboard")]);
  const chosen = (typeof apt === "string" ? apartments.find((a) => a.id === apt) : undefined) ?? apartments[0];
  const [apartment, pins] = chosen ? await Promise.all([getApartment(userId, chosen.id), moodboardPins(userId, chosen.id)]) : [null, null];

  // Greedy column layout: each pin goes into the shortest column.
  const tops = Array.from({ length: COLUMNS }, (_, i) => 36 + i * 28);
  const placed = (pins ?? []).map((pin, i) => {
    const col = tops.indexOf(Math.min(...tops));
    const y = tops[col]!;
    tops[col] = y + HEIGHT[pin.kind] + 40;
    const jitter = ((i * 37) % 7) - 3;
    return { pin, x: `calc(${(col * 100) / COLUMNS}% + ${24 + jitter * 4}px)`, y, r: TILT[i % TILT.length]! };
  });
  const boardHeight = Math.max(...tops) + 40;

  return (
    <div className="stagger">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        meta={chosen ? [chosen.name, t("pins", { count: placed.length })] : undefined}
        aside={
          apartments.length > 1 && (
            <nav aria-label={t("apartments")} className="flex flex-wrap justify-end gap-2">
              {apartments.map((a) => (
                <Link
                  key={a.id}
                  href={`/moodboard?apt=${a.id}`}
                  aria-current={a.id === chosen?.id ? "page" : undefined}
                  className={cn(
                    "border border-foreground px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase hover:bg-secondary",
                    a.id === chosen?.id && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {a.name}
                </Link>
              ))}
            </nav>
          )
        }
      />

      {!chosen || !apartment ? (
        <MarginNote>{t("noApartments")}</MarginNote>
      ) : placed.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <MarginNote>{t("empty")}</MarginNote>
          <Link href={`/apartments/${chosen.id}`} className={buttonVariants({ variant: "outline" })}>
            {t("openApartment")} <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 max-w-prose text-[12.5px] text-muted-foreground">{t("autoNote")}</p>
          <ul className="board" style={{ "--h": `${boardHeight}px` } as React.CSSProperties} aria-label={t("title")}>
            {placed.map(({ pin, x, y, r }) => (
              <li
                key={pin.key}
                className="pin"
                style={{ "--x": x, "--y": `${y}px`, "--r": `${r}deg`, "--w": `${WIDTH[pin.kind]}px` } as React.CSSProperties}
              >
                <PinBody pin={pin} northAngleDeg={apartment.northAngleDeg} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

async function PinBody({ pin, northAngleDeg }: { pin: Pin; northAngleDeg: number }) {
  const [t, tlong, tcat] = await Promise.all([getTranslations("Moodboard"), getTranslations("Longevity"), getTranslations("TrendCategory")]);
  const paper = "border border-border bg-card shadow-[0_18px_22px_-14px_rgba(40,25,10,.5)]";
  switch (pin.kind) {
    case "photo":
      return (
        <figure className={cn(paper, "tape p-2.5")}>
          <Link href={pin.href} className="block bg-blueprint p-1.5" aria-label={t("openDesign", { room: pin.room.name })}>
            <RoomPlan room={pin.room} northAngleDeg={northAngleDeg} showDimensions={false} className="h-[190px]" />
          </Link>
          <figcaption className="pt-2 font-mono text-[11px] tracking-[0.08em] uppercase">{pin.room.name}</figcaption>
        </figure>
      );
    case "slip":
      return (
        <blockquote className={cn(paper, "px-4 py-3.5 font-heading text-[22px] leading-[1.25] italic")}>
          “{pin.text}”
          <footer className="mt-2 font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase not-italic">{pin.source}</footer>
        </blockquote>
      );
    case "fabric":
      return (
        <div
          role="img"
          aria-label={t("fabric", { label: pin.label })}
          className="relative h-[120px] w-[120px] border border-black/25 shadow-[0_12px_16px_-10px_rgba(40,25,10,.5)] [clip-path:polygon(0_4%,8%_0,16%_4%,24%_0,32%_4%,40%_0,48%_4%,56%_0,64%_4%,72%_0,80%_4%,88%_0,96%_4%,100%_0,100%_100%,0_100%)]"
          style={{ background: pin.hex }}
        >
          <span className="absolute bottom-2 left-2 max-w-[104px] truncate bg-card px-1.5 py-px font-mono text-[10px] uppercase">{pin.label}</span>
        </div>
      );
    case "palette":
      return (
        <div className={cn(paper, "tape p-2.5")}>
          <div className="flex h-[90px] border border-foreground">
            {pin.colors.map((c) => (
              <span key={c.hex + c.name} title={c.name} className="border-r border-foreground last:border-r-0" style={{ background: c.hex, flex: Math.max(c.share, 0.05) }} />
            ))}
          </div>
          <p className="pt-2 font-mono text-[11px] tracking-[0.08em] uppercase">
            {t("paletteOf", { room: pin.caption })} · {pin.colors.map((c) => c.name).join(" · ")}
          </p>
        </div>
      );
    case "trend":
      return (
        <article className={cn(paper, "px-4 pt-3.5 pb-4")}>
          <div className="eyebrow mb-1">{t("trend")}</div>
          <h2 className="font-heading text-2xl leading-[1.1] font-normal">{pin.trend.name}</h2>
          <div className="my-2 flex flex-wrap gap-1.5">
            <Badge variant={pin.trend.longevity === "lasting" ? "olive" : pin.trend.longevity === "mid" ? "outline" : "clay"}>{tlong(pin.trend.longevity)}</Badge>
            <Badge variant="outline">{tcat(pin.trend.category)}</Badge>
          </div>
          <p className="line-clamp-4 text-[13px] text-[#5a4f45]">{pin.trend.description}</p>
        </article>
      );
  }
}
