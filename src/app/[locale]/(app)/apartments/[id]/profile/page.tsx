import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";
import { getApartment } from "@/server/repo/apartments";
import { getProfile } from "@/server/repo/profiles";
import { listRooms } from "@/server/repo/rooms";

export default async function ProfilePage({ params }: PageProps<"/[locale]/apartments/[id]/profile">) {
  const { id } = await params;
  const userId = await requireUserId();
  const [apartment, rooms, profile, tc] = await Promise.all([
    getApartment(userId, id),
    listRooms(userId, id),
    getProfile(userId, id),
    getTranslations("Common"),
  ]);
  if (!apartment) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href={`/apartments/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {tc("back")} · {apartment.name}
      </Link>
      <ProfileForm
        key={profile ? "saved" : "new"}
        apartmentId={id}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name, type: r.type }))}
        profile={profile}
      />
    </div>
  );
}
