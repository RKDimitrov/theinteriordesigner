"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isQuizComplete, MIN_CHOICES, nextPairIndex, QUIZ_PAIRS, scoreQuiz, topStyles } from "@/domain/profile/quiz";
import type { QuizAnswer, StyleKey } from "@/domain/schemas/profile";

interface Props {
  value: QuizAnswer[];
  onChange: (next: QuizAnswer[]) => void;
}

export function StyleQuiz({ value, onChange }: Props) {
  const t = useTranslations("Profile");
  const tn = useTranslations("StyleName");
  const td = useTranslations("StyleDesc");
  // Which pair is on screen; starts at the first unanswered one.
  const [index, setIndex] = useState(() => nextPairIndex(value));
  const pair = QUIZ_PAIRS[index];
  const complete = isQuizComplete(value);

  const answer = (choice: StyleKey | null) => {
    if (!pair) return;
    const next = [...value.filter((a) => a.pairId !== pair.id), { pairId: pair.id, choice }];
    onChange(next);
    setIndex(index + 1);
  };

  const current = pair ? value.find((a) => a.pairId === pair.id)?.choice : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("quiz")}</CardTitle>
        <CardDescription>{t("quizIntro")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pair ? (
          <>
            <p className="text-sm text-muted-foreground" data-testid="quiz-progress">
              {t("quizProgress", { current: index + 1, total: QUIZ_PAIRS.length })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([pair.a, pair.b] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`quiz-option-${s}`}
                  aria-pressed={current === s}
                  onClick={() => answer(s)}
                  className="flex flex-col overflow-hidden rounded-lg border text-left transition hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-blue-600 aria-pressed:ring-2 aria-pressed:ring-blue-600/30"
                >
                  <Image src={`/quiz/${s}.svg`} alt="" width={400} height={300} className="aspect-[4/3] w-full object-cover" unoptimized />
                  <span className="px-3 pt-2 font-medium">{tn(s)}</span>
                  <span className="px-3 pb-3 text-sm text-muted-foreground">{td(s)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                {t("prev")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => answer(null)}>
                {t("skip")}
              </Button>
            </div>
          </>
        ) : (
          <QuizResult answers={value} complete={complete} />
        )}
        {(index > 0 || !pair) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              onChange([]);
              setIndex(0);
            }}
          >
            {t("redo")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function QuizResult({ answers, complete }: { answers: QuizAnswer[]; complete: boolean }) {
  const t = useTranslations("Profile");
  const tn = useTranslations("StyleName");
  if (!complete) return <p className="text-sm text-muted-foreground">{t("quizIncomplete", { min: MIN_CHOICES })}</p>;
  return (
    <div className="flex flex-col gap-2" data-testid="quiz-result">
      <p className="text-sm">{t("quizDone")}</p>
      {topStyles(scoreQuiz(answers), 3).map(({ style, score }) => (
        <div key={style} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
          <span>{tn(style)}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums">{Math.round(score * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
