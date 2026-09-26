import { cookies } from "next/headers";
import { getFormatter, getTranslations } from "next-intl/server";
import { FormSection } from "@/components/atelier/form-section";
import { PageHeader } from "@/components/atelier/page-header";
import { Rows } from "@/components/atelier/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { FixedChoice, FixedToggle } from "@/components/settings/fixed-controls";
import { LanguageChoice, PlannerPrefs } from "@/components/settings/preference-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { OPENS_3D_COOKIE, parseOpens3d, parsePlannerView, PLANNER_VIEW_COOKIE } from "@/lib/planner-prefs";
import { getCurrentUser, requireUserId } from "@/server/auth";
import { monthlyUsage } from "@/server/llm/usage";
import { listApartments } from "@/server/repo/apartments";
import { getProfile } from "@/server/repo/profiles";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [user, apartments, usage, t, tn, tp, format, jar] = await Promise.all([
    getCurrentUser(),
    listApartments(userId),
    monthlyUsage(userId),
    getTranslations("Settings"),
    getTranslations("Nav"),
    getTranslations("PetType"),
    getFormatter(),
    cookies(),
  ]);
  const profiles = await Promise.all(apartments.map((a) => getProfile(userId, a.id)));
  const money = (n: number) => format.number(n, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const purpose = (p: string) => usage.byPurpose.find((r) => r.purpose === p) ?? { calls: 0, costEur: 0 };
  const renting = apartments.some((a) => a.tenure === "rent");

  return (
    <div className="stagger">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} meta={[user?.email ?? "—"]} />

      <FormSection title={t("profile")} hint={t("profileHint")}>
        <Rows
          rows={[
            { label: t("name"), value: user?.name ?? "—" },
            { label: t("email"), value: user?.email ?? "—" },
          ]}
        />
        <div>
          <SignOutButton label={tn("signOut")} variant="outline" />
        </div>
      </FormSection>

      <FormSection title={t("household")} hint={t("householdHint")}>
        {apartments.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">{t("noApartments")}</p>
        ) : (
          <ul>
            {apartments.map((a, i) => {
              const h = profiles[i]?.household;
              return (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-b border-dotted border-rule py-2.5">
                  <span className="font-heading text-[22px] leading-none">{a.name}</span>
                  {h ? (
                    <span className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
                      {t("householdLine", { adults: h.adults, kids: h.kids.length, wfh: h.wfhDaysPerWeek })}
                      {h.pets.map((p) => (
                        <Badge key={p.type} variant="outline">
                          {p.count} × {tp(p.type)}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-muted-foreground">{t("noProfile")}</span>
                  )}
                  <Link href={`/apartments/${a.id}/profile`} className="w-full font-mono text-[11.5px] underline underline-offset-3 hover:text-primary">
                    {t("editHousehold")} <span aria-hidden>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>

      <FormSection title={t("units")} hint={t("unitsHint")}>
        <FixedChoice
          label={t("length")}
          value="cm"
          options={[
            { value: "cm", label: "cm" },
            { value: "in", label: "in" },
          ]}
        />
        <FixedChoice
          label={t("currency")}
          value="EUR"
          options={[
            { value: "EUR", label: "EUR" },
            { value: "BGN", label: "BGN" },
            { value: "USD", label: "USD" },
          ]}
        />
        <LanguageChoice label={t("language")} />
      </FormSection>

      <FormSection title={t("planner")} hint={t("plannerHint")}>
        <PlannerPrefs view={parsePlannerView(jar.get(PLANNER_VIEW_COOKIE)?.value)} opens3d={parseOpens3d(jar.get(OPENS_3D_COOKIE)?.value)} />
      </FormSection>

      <FormSection title={t("designer")} hint={t("designerHint")}>
        <div>
          <FixedToggle label={t("autoRepair")} hint={t("autoRepairHint")} checked />
          <FixedToggle label={t("autoTrends")} hint={t("autoTrendsHint")} checked={false} />
          <FixedToggle label={t("renterFriendly")} hint={t("renterFriendlyHint")} checked={renting} />
        </div>
        <div>
          <h3 className="mb-1 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">{t("spent")}</h3>
          <Rows
            rows={[
              { label: t("spentDesigns", { count: purpose("design").calls }), value: money(purpose("design").costEur) },
              { label: t("spentRepairs", { count: purpose("repair").calls }), value: money(purpose("repair").costEur) },
              { label: t("spentTrends", { count: purpose("trends").calls }), value: money(purpose("trends").costEur) },
              { label: <b className="font-semibold">{t("spentTotal")}</b>, value: money(usage.totalEur) },
            ]}
          />
        </div>
      </FormSection>

      <FormSection title={t("danger")} hint={t("dangerHint")} titleClassName="text-destructive">
        <div>
          <Button variant="destructive" disabled>
            {t("deleteAccount")}
          </Button>
          <p className="mt-2 text-[12.5px] text-muted-foreground">{t("deleteAccountSoon")}</p>
        </div>
      </FormSection>
    </div>
  );
}
