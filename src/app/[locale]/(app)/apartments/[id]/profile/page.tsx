import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getProfile } from "@/server/repo/profiles";
import { listRooms } from "@/server/repo/rooms";

export default async function ProfilePage({ params }: PageProps<"/[locale]/apartments/[id]/profile">) {
  const { id } = await params;
  const userId = await requireUserId();
  const [apartment, rooms, profile] = await Promise.all([getApartment(userId, id), listRooms(userId, id), getProfile(userId, id)]);
  if (!apartment) notFound();
  return (
    <div className="flex flex-col">
      <ProfileForm
        key={profile ? "saved" : "new"}
        apartmentId={id}
        apartmentName={apartment.name}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name, type: r.type }))}
        profile={profile}
      />
    </div>
  );
}
