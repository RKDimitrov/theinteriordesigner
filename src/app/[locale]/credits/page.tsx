import { getTranslations } from "next-intl/server";
import { FormSection } from "@/components/atelier/form-section";
import { PageHeader } from "@/components/atelier/page-header";
import CATALOGUE_JSON from "@/components/planner/three/asset-catalogue.json";
import { Catalogue } from "@/domain/assets/catalogue";
import { creditGroups } from "@/domain/assets/credits";

/** Public: CC-BY requires the credit to be reachable by anyone who gets the files. */
export default async function CreditsPage() {
  const t = await getTranslations("Credits");
  const catalogue = Catalogue.parse(CATALOGUE_JSON);
  const { attribution, publicDomain } = creditGroups(catalogue);
  const ext = "underline underline-offset-3 hover:text-primary";

  return (
    <main className="stagger mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} meta={[t("count", { count: Object.keys(catalogue).length })]} />
      <p className="mb-8 max-w-prose text-[14px] text-muted-foreground">{t("intro")}</p>

      <FormSection title={t("attribution")} hint={t("attributionHint")}>
        {attribution.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("noAttribution")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-[13.5px]" data-testid="credits-attribution">
            {attribution.map((a) => (
              <li key={a.id}>
                <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className={`font-medium ${ext}`}>
                  {a.title}
                </a>{" "}
                <span className="text-muted-foreground">{t("by", { author: a.author })}</span> ·{" "}
                <a href={a.licenceUrl} target="_blank" rel="noopener noreferrer" className={`font-mono text-[12px] ${ext}`}>
                  {a.licenceLabel}
                </a>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection title={t("publicDomain")} hint={t("publicDomainHint")}>
        <ul className="flex flex-col gap-3 text-[13.5px]" data-testid="credits-public-domain">
          {publicDomain.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className={`font-medium ${ext}`}>
                {t("fromSource", { count: s.count, source: s.name })}
              </a>
              <p className="text-[12.5px] text-muted-foreground">{t("authors", { authors: s.authors.join(", ") })}</p>
            </li>
          ))}
        </ul>
      </FormSection>
    </main>
  );
}
