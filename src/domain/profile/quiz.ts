import type { QuizAnswer, StyleKey, StyleScores } from "../schemas/profile";
import { StyleKey as StyleKeyEnum } from "../schemas/profile";

export interface QuizPair {
  id: string;
  a: StyleKey;
  b: StyleKey;
}

/**
 * Fixed pairwise quiz. Each style appears 2–3 times and every pair contrasts
 * styles that people often confuse or that sit at opposite ends.
 */
export const QUIZ_PAIRS: readonly QuizPair[] = [
  { id: "p1", a: "scandinavian", b: "industrial" },
  { id: "p2", a: "japandi", b: "boho" },
  { id: "p3", a: "mid_century", b: "minimal" },
  { id: "p4", a: "modern_classic", b: "mediterranean" },
  { id: "p5", a: "scandinavian", b: "japandi" },
  { id: "p6", a: "industrial", b: "modern_classic" },
  { id: "p7", a: "boho", b: "mid_century" },
  { id: "p8", a: "minimal", b: "mediterranean" },
  { id: "p9", a: "japandi", b: "mid_century" },
  { id: "p10", a: "scandinavian", b: "boho" },
];

export const STYLES: readonly StyleKey[] = StyleKeyEnum.options;

/** Minimum real (non-skipped) choices for the quiz to count as complete. */
export const MIN_CHOICES = 5;

/** Latest valid answer per known pair; unknown pairs and choices not in the pair are dropped. */
export function effectiveAnswers(answers: readonly QuizAnswer[]): Map<string, StyleKey | null> {
  const byId = new Map(QUIZ_PAIRS.map((p) => [p.id, p]));
  const out = new Map<string, StyleKey | null>();
  for (const a of answers) {
    const pair = byId.get(a.pairId);
    if (!pair) continue;
    if (a.choice !== null && a.choice !== pair.a && a.choice !== pair.b) continue;
    out.set(a.pairId, a.choice);
  }
  return out;
}

export function emptyScores(): StyleScores {
  return {
    scandinavian: 0,
    japandi: 0,
    mid_century: 0,
    industrial: 0,
    modern_classic: 0,
    boho: 0,
    minimal: 0,
    mediterranean: 0,
  };
}

/** Normalised style scores (sum 1). All zeros when nothing was chosen. */
export function scoreQuiz(answers: readonly QuizAnswer[]): StyleScores {
  const scores = emptyScores();
  let total = 0;
  for (const choice of effectiveAnswers(answers).values()) {
    if (choice === null) continue;
    scores[choice] += 1;
    total++;
  }
  if (total === 0) return scores;
  for (const s of STYLES) scores[s] /= total;
  return scores;
}

export function topStyles(scores: StyleScores, n: number): { style: StyleKey; score: number }[] {
  return STYLES.map((style) => ({ style, score: scores[style] }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || STYLES.indexOf(a.style) - STYLES.indexOf(b.style))
    .slice(0, n);
}

export function isQuizComplete(answers: readonly QuizAnswer[]): boolean {
  const eff = effectiveAnswers(answers);
  const choices = [...eff.values()].filter((c) => c !== null).length;
  return eff.size === QUIZ_PAIRS.length && choices >= MIN_CHOICES;
}

/** Index of the first pair without an answer, or QUIZ_PAIRS.length when all are answered. */
export function nextPairIndex(answers: readonly QuizAnswer[]): number {
  const eff = effectiveAnswers(answers);
  const i = QUIZ_PAIRS.findIndex((p) => !eff.has(p.id));
  return i === -1 ? QUIZ_PAIRS.length : i;
}
