import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { listApartments } from "@/server/repo/apartments";

export default async function ApartmentsPage() {
  const userId = await requireUserId();
  const [apartments, t] = await Promise.all([listApartments(userId), getTranslations("Apartments")]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/apartments/new" className={buttonVariants()}>
          {t("new")}
        </Link>
      </div>
      {apartments.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apartments.map((a) => (
            <li key={a.id}>
              <Link href={`/apartments/${a.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle>{a.name}</CardTitle>
                    <CardDescription>
                      {a.city}, {a.country} · {a.totalAreaM2} m² · {t("rooms", { count: a.roomCount })}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
