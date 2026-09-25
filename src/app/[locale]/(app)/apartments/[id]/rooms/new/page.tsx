import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/atelier/page-header";
import { RoomEditor } from "@/components/plan-editor/room-editor";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";

export default async function NewRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/new">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const [t, tn] = await Promise.all([getTranslations("RoomEditor"), getTranslations("Nav")]);
  return (
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartment.name, href: `/apartments/${id}` }, { label: t("newTitle") }]}
        title={t("newTitle")}
      />
      <RoomEditor apartmentId={id} northAngleDeg={apartment.northAngleDeg} />
    </div>
  );
}
