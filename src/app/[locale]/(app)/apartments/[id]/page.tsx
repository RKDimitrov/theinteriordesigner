import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoomPlan } from "@/components/plan-view/room-plan";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteApartmentButton } from "@/components/wizard/delete-apartment-button";
import { area } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { listRooms } from "@/server/repo/rooms";

export default async function ApartmentOverviewPage({ params }: PageProps<"/[locale]/apartments/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const [rooms, t, tc, tt, tf] = await Promise.all([
    listRooms(userId, id),
    getTranslations("Overview"),
    getTranslations("Common"),
    getTranslations("RoomType"),
    getTranslations("ApartmentForm"),
  ]);

  const steps = [
    { label: t("stepRooms"), active: true },
    { label: t("stepProfile"), active: false },
    { label: t("stepContext"), active: false },
    { label: t("stepDesign"), active: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{apartment.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[apartment.address, apartment.city, apartment.country].filter(Boolean).join(", ")} · {apartment.totalAreaM2} {tc("m2")} ·{" "}
            {t("floor", { level: apartment.floorLevel })} · {apartment.tenure === "rent" ? tf("rent") : tf("own")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/apartments/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {tc("edit")}
          </Link>
          <DeleteApartmentButton id={id} />
        </div>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label={t("steps")}>
        {steps.map((s) => (
          <li key={s.label}>
            <Badge variant={s.active ? "default" : "outline"}>
              {s.label}
              {!s.active && ` · ${tc("comingSoon")}`}
            </Badge>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("rooms")}</h2>
          <Link href={`/apartments/${id}/rooms/new`} className={buttonVariants()}>
            {t("addRoom")}
          </Link>
        </div>
        {rooms.length === 0 ? (
          <p className="text-muted-foreground">{t("noRooms")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => {
              const doors = r.openings.filter((o) => o.kind === "door").length;
              const windows = r.openings.filter((o) => o.kind === "window").length;
              return (
                <li key={r.id}>
                  <Link href={`/apartments/${id}/rooms/${r.id}`} className="block" data-testid="room-card">
                    <Card className="transition-colors hover:bg-muted/40">
                      <CardHeader>
                        <CardTitle>{r.name}</CardTitle>
                        <CardDescription>
                          {tt(r.type)} · {m2(area(r.polygon)).toFixed(1)} {tc("m2")} · {t("openings", { doors, windows })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RoomPlan room={r} northAngleDeg={apartment.northAngleDeg} />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
