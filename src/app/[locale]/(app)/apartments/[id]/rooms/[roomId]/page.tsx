import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader, SplitTitle } from "@/components/atelier/page-header";
import { RoomEditor } from "@/components/plan-editor/room-editor";
import { area } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getRoom } from "@/server/repo/rooms";

export default async function EditRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/[roomId]">) {
  const { id, roomId } = await params;
  const userId = await requireUserId();
  const [apartment, room] = await Promise.all([getApartment(userId, id), getRoom(userId, roomId)]);
  if (!apartment || !room || room.apartmentId !== apartment.id) notFound();
  const [t, tc, tn, tt, to] = await Promise.all([
    getTranslations("RoomEditor"),
    getTranslations("Common"),
    getTranslations("Nav"),
    getTranslations("RoomType"),
    getTranslations("Overview"),
  ]);
  const doors = room.openings.filter((o) => o.kind === "door").length;
  const windows = room.openings.filter((o) => o.kind === "window").length;
  return (
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartment.name, href: `/apartments/${id}` }, { label: room.name }]}
        title={<SplitTitle text={room.name} />}
        meta={[tt(room.type), `${m2(area(room.polygon)).toFixed(2)} ${tc("m2")}`, `${t("ceiling")} ${room.ceilingHeight} ${tc("cm")}`, to("openings", { doors, windows })]}
      />
      {/* The editor owns its state after mount; the key resets it per room. */}
      <RoomEditor key={room.id} apartmentId={id} northAngleDeg={apartment.northAngleDeg} room={room} />
    </div>
  );
}
