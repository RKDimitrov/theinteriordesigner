import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { ApartmentForm } from "@/components/wizard/apartment-form";

export default async function NewApartmentPage() {
  const [t, tn] = await Promise.all([getTranslations("ApartmentForm"), getTranslations("Nav")]);
  return (
    <div className="stagger">
      <PageHeader crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: t("createTitle") }]} title={t("createTitle")} />
      <div className="w-full max-w-2xl">
        <ApartmentForm />
      </div>
    </div>
  );
}
