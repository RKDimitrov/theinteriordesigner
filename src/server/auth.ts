import "server-only";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "./supabase/server";

/** Supabase user id of the current request, or null. Cached per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims.sub;
  return typeof sub === "string" ? sub : null;
});

/** Current user id; redirects to the login page when signed out. */
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (id) return id;
  const locale = await getLocale();
  return redirect({ href: "/login", locale });
}
