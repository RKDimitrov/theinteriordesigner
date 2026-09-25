import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { ApartmentForm } from "@/components/wizard/apartment-form";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";

export default async function EditApartmentPage({ params }: PageProps<"/[locale]/apartments/[id]/edit">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const [t, tn] = await Promise.all([getTranslations("ApartmentForm"), getTranslations("Nav")]);
  return (
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartment.name, href: `/apartments/${id}` }, { label: t("editTitle") }]}
        title={t("editTitle")}
      />
      <div className="w-full max-w-2xl">
        <ApartmentForm apartment={apartment} />
      </div>
    </div>
  );
}
