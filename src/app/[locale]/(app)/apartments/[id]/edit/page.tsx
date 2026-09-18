import { notFound } from "next/navigation";
import { ApartmentForm } from "@/components/wizard/apartment-form";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";

export default async function EditApartmentPage({ params }: PageProps<"/[locale]/apartments/[id]/edit">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ApartmentForm apartment={apartment} />
    </div>
  );
}
