import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { LibraryView } from "@/components/library/library-view";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { libraryData } from "@/server/library";

export default async function LibraryPage() {
  const userId = await requireUserId();
  const [data, t] = await Promise.all([libraryData(userId), getTranslations("Library")]);
  const owned = data.pieces.filter((p) => p.mine).length;

  return (
    <div className="stagger">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        meta={[t("pieces", { count: data.pieces.length }), t("ownedCount", { count: owned }), t("materialsCount", { count: data.materials.length })]}
        aside={
          data.addOwnHref && (
            <Link href={data.addOwnHref} className={buttonVariants({ variant: "outline" })}>
              <span aria-hidden>+</span> {t("addOwn")}
            </Link>
          )
        }
      />
      <LibraryView data={data} />
    </div>
  );
}
