"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormSection } from "@/components/atelier/form-section";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { isQuizComplete, MIN_CHOICES, nextPairIndex, QUIZ_PAIRS, scoreQuiz, topStyles } from "@/domain/profile/quiz";
import type { QuizAnswer, StyleKey } from "@/domain/schemas/profile";

interface Props {
  value: QuizAnswer[];
  onChange: (next: QuizAnswer[]) => void;
  number?: string;
}

export function StyleQuiz({ value, onChange, number }: Props) {
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
    <FormSection
      number={number}
      title={t("quiz")}
      hint={t("quizIntro")}
      action={
        pair && (
          <p className="font-mono text-[13px] tabular-nums" data-testid="quiz-progress">
            {t("quizProgress", { current: index + 1, total: QUIZ_PAIRS.length })}
          </p>
        )
      }
    >
      {pair ? (
        <>
          <div className="sheet-grid pt-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
            {([pair.a, pair.b] as const).map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`quiz-option-${s}`}
                aria-pressed={current === s}
                onClick={() => answer(s)}
                className="taped tape flex flex-col border border-border bg-card p-2.5 pb-3.5 text-left shadow-card outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring aria-pressed:border-foreground aria-pressed:shadow-offset-clay"
              >
                <Image src={`/quiz/${s}.svg`} alt="" width={400} height={300} className="aspect-[4/3] w-full border border-line object-cover" unoptimized />
                <span className="mt-2.5 font-heading text-[30px] leading-none">{tn(s)}</span>
                <span className="mt-1 text-[13px] text-[#5a4f45]">{td(s)}</span>
                {current === s && (
                  <Stamp className="absolute top-4 right-4 bg-card/80">
                    {t("chosen")} <span aria-hidden>✓</span>
                  </Stamp>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <span aria-hidden>←</span> {t("prev")}
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
    </FormSection>
  );
}

function QuizResult({ answers, complete }: { answers: QuizAnswer[]; complete: boolean }) {
  const t = useTranslations("Profile");
  const tn = useTranslations("StyleName");
  if (!complete) return <p className="text-[12.5px] text-muted-foreground">{t("quizIncomplete", { min: MIN_CHOICES })}</p>;
  return (
    <div className="flex flex-col" data-testid="quiz-result">
      <p className="mb-2 font-heading text-2xl italic">{t("quizDone")}</p>
      {topStyles(scoreQuiz(answers), 3).map(({ style, score }) => (
        <div key={style} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 border-b border-dotted border-rule py-2 text-[13.5px]">
          <span>{tn(style)}</span>
          <span className="h-2 border border-foreground bg-card">
            <span className="block h-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
          </span>
          <span className="text-right font-mono tabular-nums">{Math.round(score * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
