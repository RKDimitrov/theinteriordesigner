"use server";

import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "../supabase/server";

const Email = z.email();
const PasswordLogin = z.object({ email: Email, password: z.string().min(6) });

export async function sendMagicLinkAction(email: unknown): Promise<ActionResult<null>> {
  const parsed = Email.safeParse(email);
  if (!parsed.success) return fail("Enter a valid email address");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  return error ? fail(error.message) : ok(null);
}

export async function signInWithPasswordAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = PasswordLogin.safeParse(input);
  if (!parsed.success) return fail("Enter email and password");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? fail(error.message) : ok(null);
}

export async function signOutAction(): Promise<ActionResult<null>> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return ok(null);
}
