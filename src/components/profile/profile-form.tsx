"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardAction } from "@/components/ui/card";
import { effectiveAnswers, QUIZ_PAIRS } from "@/domain/profile/quiz";
import { profileStatus } from "@/domain/profile/status";
import { type StyleProfile, StyleProfileInput } from "@/domain/schemas/profile";
import { useRouter } from "@/i18n/navigation";
import { zodFieldErrors } from "@/lib/action-result";
import { SAMPLE_PROFILES, samplePreset } from "@/lib/dev/samples";
import { saveProfileAction } from "@/server/actions/profile";
import { type RoomRef, BudgetSection } from "./budget-section";
import { HouseholdSection } from "./household-section";
import { MustKeepSection } from "./must-keep-section";
import { PalettePicker } from "./palette-picker";
import { StyleQuiz } from "./style-quiz";

const EMPTY: StyleProfileInput = {
  household: { adults: 1, kids: [], pets: [], wfhDaysPerWeek: 0 },
  budgetPerRoom: {},
  quizAnswers: [],
  colorsLiked: [],
  colorsDisliked: [],
  mustKeep: [],
};

function toInput(p: StyleProfile): StyleProfileInput {
  return {
    household: p.household,
    budgetPerRoom: p.budgetPerRoom,
    quizAnswers: p.quizAnswers,
    colorsLiked: p.colorsLiked,
    colorsDisliked: p.colorsDisliked,
    mustKeep: p.mustKeep,
  };
}

interface Props {
  apartmentId: string;
  rooms: readonly RoomRef[];
  profile: StyleProfile | null;
}

export function ProfileForm({ apartmentId, rooms, profile }: Props) {
  const t = useTranslations("Profile");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [draft, setDraft] = useState<StyleProfileInput>(() => (profile ? toInput(profile) : EMPTY));
  // Bumped when answers are replaced from outside (sample fill) so the quiz re-reads its position.
  const [quizKey, setQuizKey] = useState(0);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const parsed = StyleProfileInput.safeParse(draft);
  const clientErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
  const errors = { ...serverErrors, ...clientErrors };
  const status = profileStatus(draft, rooms.map((r) => r.id));
  const answered = effectiveAnswers(draft.quizAnswers).size;

  const set = <K extends keyof StyleProfileInput>(k: K, v: StyleProfileInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const fill = (n: number) => {
    setDraft(samplePreset(SAMPLE_PROFILES, n)(rooms));
    setQuizKey((k) => k + 1);
    setServerErrors({});
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveProfileAction(apartmentId, draft);
      if (!res.ok) {
        setServerErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setServerErrors({});
      toast.success(tc("saved"));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <HouseholdSection
        value={draft.household}
        errors={errors}
        onChange={(v) => set("household", v)}
        action={
          <CardAction>
            <FillSampleButton onFill={fill} />
          </CardAction>
        }
      />
      <BudgetSection apartmentId={apartmentId} rooms={rooms} value={draft.budgetPerRoom} onChange={(v) => set("budgetPerRoom", v)} />
      <StyleQuiz key={quizKey} value={draft.quizAnswers} onChange={(v) => set("quizAnswers", v)} />
      <PalettePicker
        liked={draft.colorsLiked}
        disliked={draft.colorsDisliked}
        onChange={({ liked, disliked }) => setDraft((d) => ({ ...d, colorsLiked: liked, colorsDisliked: disliked }))}
      />
      <MustKeepSection rooms={rooms} value={draft.mustKeep} errors={errors} onChange={(v) => set("mustKeep", v)} />

      {!parsed.success && (
        <Alert variant="destructive" data-testid="profile-issues">
          <AlertTitle>{t("problems")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(clientErrors).map(([path, msg]) => (
                <li key={path}>
                  {path}: {msg}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Sticky on small screens so saving is always one tap away. */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-muted-foreground" data-testid="profile-summary">
          {t("summary", { answered, total: QUIZ_PAIRS.length, missing: status.missingBudgetRoomIds.length })}
        </p>
        <Button type="button" size="lg" disabled={pending || !parsed.success} onClick={save}>
          {pending ? tc("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
