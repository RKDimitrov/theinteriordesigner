import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoomEditor } from "@/components/plan-editor/room-editor";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";

export default async function NewRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/new">) {
  const { id } = await params;
  const userId = await requireUserId();
  const apartment = await getApartment(userId, id);
  if (!apartment) notFound();
  const tc = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/apartments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {tc("back")} · {apartment.name}
      </Link>
      <RoomEditor apartmentId={id} northAngleDeg={apartment.northAngleDeg} />
    </div>
  );
}
