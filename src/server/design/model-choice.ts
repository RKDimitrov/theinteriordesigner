/**
 * The cheaper model designs and repairs; if the design is still invalid going
 * into the last repair, that attempt runs on the stronger model.
 */
export function modelForAttempt(attempt: number, maxRepairs: number, models: { base: string; escalate: string }): string {
  return attempt > 0 && attempt === maxRepairs ? models.escalate : models.base;
}
