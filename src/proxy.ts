import createIntlProxy from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/server/supabase/proxy";

const intlProxy = createIntlProxy(routing);

export default async function proxy(request: NextRequest) {
  const response = intlProxy(request);
  return updateSession(request, response);
}

export const config = {
  // Skip API routes, Next internals, the auth callback and static files.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
