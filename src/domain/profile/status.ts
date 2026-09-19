import type { StyleProfileInput } from "../schemas/profile";
import { isQuizComplete } from "./quiz";

export interface ProfileStatus {
  exists: boolean;
  quizComplete: boolean;
  missingBudgetRoomIds: string[];
  done: boolean;
}

/** Sum of budgets for rooms that still exist. */
export function budgetTotal(budgetPerRoom: Readonly<Record<string, number>>, roomIds: readonly string[]): number {
  return roomIds.reduce((sum, id) => sum + (budgetPerRoom[id] ?? 0), 0);
}

/** Done = quiz complete and every existing room has a budget above zero. */
export function profileStatus(profile: StyleProfileInput | null, roomIds: readonly string[]): ProfileStatus {
  if (!profile) return { exists: false, quizComplete: false, missingBudgetRoomIds: [...roomIds], done: false };
  const quizComplete = isQuizComplete(profile.quizAnswers);
  const missingBudgetRoomIds = roomIds.filter((id) => !((profile.budgetPerRoom[id] ?? 0) > 0));
  return {
    exists: true,
    quizComplete,
    missingBudgetRoomIds,
    done: quizComplete && missingBudgetRoomIds.length === 0 && roomIds.length > 0,
  };
}

/**
 * Drop data that points at rooms outside this apartment: budget keys for
 * unknown rooms are removed and must-keep items become unassigned.
 */
export function pruneToRooms(input: StyleProfileInput, roomIds: readonly string[]): StyleProfileInput {
  const known = new Set(roomIds);
  return {
    ...input,
    budgetPerRoom: Object.fromEntries(Object.entries(input.budgetPerRoom).filter(([id]) => known.has(id))),
    mustKeep: input.mustKeep.map((m) => (m.roomId !== null && !known.has(m.roomId) ? { ...m, roomId: null } : m)),
  };
}
