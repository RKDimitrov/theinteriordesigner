import "server-only";
import { effectiveAnswers, QUIZ_PAIRS } from "@/domain/profile/quiz";
import { type ProfileStatus, profileStatus } from "@/domain/profile/status";
import type { StyleProfile } from "@/domain/schemas/profile";
import type { Room } from "@/domain/schemas/room";
import { contextStatus } from "./context/status";
import { type DesignStatus, latestStatusByRoom } from "./repo/designs";
import { getProfile } from "./repo/profiles";
import { listRooms } from "./repo/rooms";

export interface ApartmentProgress {
  rooms: Room[];
  doors: number;
  windows: number;
  profile: StyleProfile | null;
  profileState: ProfileStatus;
  quizAnswered: number;
  quizTotal: number;
  contextDone: boolean;
  designStatus: Map<string, DesignStatus>;
  /** Rooms whose latest design is not invalid. */
  designedRooms: number;
  /** Done flags of steps 1–4. */
  done: readonly [boolean, boolean, boolean, boolean];
  /** Index (0–3) of the first step not done, or 3 when all are done. */
  current: number;
}

/** Everything the four-step progress needs, from stored data only (never fetches). */
export async function apartmentProgress(userId: string, apartmentId: string): Promise<ApartmentProgress> {
  const [rooms, profile, contextDone, designStatus] = await Promise.all([
    listRooms(userId, apartmentId),
    getProfile(userId, apartmentId),
    contextStatus(userId, apartmentId),
    latestStatusByRoom(userId, apartmentId),
  ]);
  const openings = rooms.flatMap((r) => r.openings);
  const profileState = profileStatus(profile, rooms.map((r) => r.id));
  const designedRooms = rooms.filter((r) => (designStatus.get(r.id) ?? "invalid") !== "invalid").length;
  const done = [rooms.length > 0, profileState.done, contextDone, rooms.length > 0 && designedRooms === rooms.length] as const;
  const firstOpen = done.indexOf(false);
  return {
    rooms,
    doors: openings.filter((o) => o.kind === "door").length,
    windows: openings.filter((o) => o.kind === "window").length,
    profile,
    profileState,
    quizAnswered: profile ? effectiveAnswers(profile.quizAnswers).size : 0,
    quizTotal: QUIZ_PAIRS.length,
    contextDone,
    designStatus,
    designedRooms,
    done,
    current: firstOpen === -1 ? 3 : firstOpen,
  };
}
