import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LandingPage() {
  const t = useTranslations("Landing");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-lg text-muted-foreground">{t("tagline")}</p>
      <Link href="/apartments" className={buttonVariants({ size: "lg" })}>
        {t("cta")}
      </Link>
    </main>
  );
}
