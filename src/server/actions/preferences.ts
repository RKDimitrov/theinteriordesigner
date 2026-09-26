"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { OPENS_3D_COOKIE, PLANNER_VIEW_COOKIE } from "@/lib/planner-prefs";
import { requireUserId } from "../auth";

const Pref = z.discriminatedUnion("key", [
  z.object({ key: z.literal("plannerView"), value: z.enum(["calm", "quiet", "full"]) }),
  z.object({ key: z.literal("opens3d"), value: z.enum(["room", "all"]) }),
]);

const YEAR = 60 * 60 * 24 * 365;

/** Planner preferences (Settings → Planner). Cookies until they get a profile column. */
export async function setPlannerPrefAction(input: unknown): Promise<ActionResult<null>> {
  await requireUserId();
  const parsed = Pref.safeParse(input);
  if (!parsed.success) return fail("Invalid preference");
  const jar = await cookies();
  const name = parsed.data.key === "plannerView" ? PLANNER_VIEW_COOKIE : OPENS_3D_COOKIE;
  jar.set(name, parsed.data.value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return ok(null);
}
