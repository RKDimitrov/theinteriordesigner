import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoomEditor } from "@/components/plan-editor/room-editor";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getRoom } from "@/server/repo/rooms";

export default async function EditRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/[roomId]">) {
  const { id, roomId } = await params;
  const userId = await requireUserId();
  const [apartment, room] = await Promise.all([getApartment(userId, id), getRoom(userId, roomId)]);
  if (!apartment || !room || room.apartmentId !== apartment.id) notFound();
  const tc = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/apartments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {tc("back")} · {apartment.name}
      </Link>
      {/* The editor owns its state after mount; the key resets it per room. */}
      <RoomEditor key={room.id} apartmentId={id} northAngleDeg={apartment.northAngleDeg} room={room} />
    </div>
  );
}
