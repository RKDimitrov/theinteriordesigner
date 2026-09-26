import { notFound } from "next/navigation";
import { NewRoomForm } from "@/components/room/new-room-form";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getProfile } from "@/server/repo/profiles";

export default async function NewRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/new">) {
  const { id } = await params;
  const userId = await requireUserId();
  const [apartment, profile] = await Promise.all([getApartment(userId, id), getProfile(userId, id)]);
  if (!apartment) notFound();
  return <NewRoomForm apartmentId={id} apartmentName={apartment.name} northAngleDeg={apartment.northAngleDeg} hasProfile={profile !== null} />;
}
