import type { ReactNode } from "react";
import { requireUserId } from "@/server/auth";

/** Full-viewport tools (the planner): signed in, but without the app header. */
export default async function PlannerLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  return children;
}
