import { describe, expect, it } from "vitest";
import type { QuizAnswer } from "../schemas/profile";
import { isQuizComplete, nextPairIndex, QUIZ_PAIRS, scoreQuiz, STYLES, topStyles } from "./quiz";

const all = (pick: "a" | "b"): QuizAnswer[] => QUIZ_PAIRS.map((p) => ({ pairId: p.id, choice: p[pick] }));

describe("QUIZ_PAIRS", () => {
  it("has 10 unique pairs covering every style 2–3 times", () => {
    expect(QUIZ_PAIRS).toHaveLength(10);
    expect(new Set(QUIZ_PAIRS.map((p) => p.id)).size).toBe(10);
    const keys = new Set(QUIZ_PAIRS.map((p) => [p.a, p.b].sort().join("|")));
    expect(keys.size).toBe(10);
    for (const s of STYLES) {
      const n = QUIZ_PAIRS.filter((p) => p.a === s || p.b === s).length;
      expect(n, s).toBeGreaterThanOrEqual(2);
      expect(n, s).toBeLessThanOrEqual(3);
    }
  });
});

describe("scoreQuiz", () => {
  it("returns zeros for no answers", () => {
    expect(Object.values(scoreQuiz([])).every((v) => v === 0)).toBe(true);
  });

  it("normalises to sum 1", () => {
    const s = scoreQuiz(all("a"));
    const sum = Object.values(s).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(s.scandinavian).toBeCloseTo(3 / 10);
  });

  it("ignores skips, unknown pairs and choices outside the pair", () => {
    const s = scoreQuiz([
      { pairId: "p1", choice: null },
      { pairId: "nope", choice: "boho" },
      { pairId: "p2", choice: "minimal" },
      { pairId: "p3", choice: "minimal" },
    ]);
    expect(s.minimal).toBe(1);
    expect(s.boho).toBe(0);
  });

  it("uses the last answer for a repeated pair", () => {
    const s = scoreQuiz([
      { pairId: "p1", choice: "scandinavian" },
      { pairId: "p1", choice: "industrial" },
    ]);
    expect(s.industrial).toBe(1);
    expect(s.scandinavian).toBe(0);
  });
});

describe("topStyles", () => {
  it("sorts by score and drops zeros", () => {
    const top = topStyles(scoreQuiz(all("a")), 3);
    expect(top.map((t) => t.style)).toEqual(["scandinavian", "japandi", "mid_century"]);
    expect(topStyles(scoreQuiz([]), 3)).toEqual([]);
  });
});

describe("isQuizComplete / nextPairIndex", () => {
  it("needs every pair answered and at least 5 real choices", () => {
    expect(isQuizComplete(all("b"))).toBe(true);
    const skipped = QUIZ_PAIRS.map((p, i) => ({ pairId: p.id, choice: i < 6 ? null : p.a }));
    expect(isQuizComplete(skipped)).toBe(false);
    expect(isQuizComplete(all("a").slice(0, 9))).toBe(false);
  });

  it("points at the first unanswered pair", () => {
    expect(nextPairIndex([])).toBe(0);
    expect(nextPairIndex(all("a").slice(0, 4))).toBe(4);
    expect(nextPairIndex(all("a"))).toBe(10);
  });
});
