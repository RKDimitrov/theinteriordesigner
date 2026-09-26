import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LandingPage() {
  const t = useTranslations("Landing");
  const tr = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <p className="font-heading text-[32px] leading-none italic">
        {tr("Common.appName")}
        <sup className="ml-1.5 align-top font-mono text-[10px] font-medium tracking-[0.1em] text-primary not-italic">{tr("Nav.edition")}</sup>
      </p>
      <h1 className="font-heading text-[clamp(48px,6vw,72px)] leading-[0.95] font-normal tracking-[-0.02em] text-balance">{t("title")}</h1>
      <p className="max-w-prose text-lg text-muted-foreground">{t("tagline")}</p>
      <Link href="/apartments" className={buttonVariants({ size: "lg" })}>
        {t("cta")}
      </Link>
    </main>
  );
}
