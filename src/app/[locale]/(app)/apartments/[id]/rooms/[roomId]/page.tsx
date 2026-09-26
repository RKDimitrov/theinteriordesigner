import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** The inline room editor was replaced by the planner; old links open the planner scoped to the room. */
export default async function EditRoomPage({ params }: PageProps<"/[locale]/apartments/[id]/rooms/[roomId]">) {
  const { locale, id, roomId } = await params;
  redirect({ href: `/apartments/${id}/planner?room=${roomId}`, locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale });
}
