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

export interface CurrentUser {
  id: string;
  /** Display name: profile full name, else the part of the email before "@". */
  name: string;
  email: string;
  initials: string;
}

/** Current user for the header, from the auth claims. Null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
  const email = typeof claims.email === "string" ? claims.email : "";
  const name = (full ?? email.split("@")[0] ?? "").trim() || "—";
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2)).toUpperCase();
  return { id: claims.sub, name, email, initials };
});

/** Current user id; redirects to the login page when signed out. */
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (id) return id;
  const locale = await getLocale();
  return redirect({ href: "/login", locale });
}
