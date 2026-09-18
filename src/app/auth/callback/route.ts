import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** Magic-link landing: exchange the PKCE code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/apartments`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
