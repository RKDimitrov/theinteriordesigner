"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader, SplitTitle } from "@/components/atelier/page-header";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  apartmentName: string;
  rooms: readonly RoomRef[];
  profile: StyleProfile | null;
}

export function ProfileForm({ apartmentId, apartmentName, rooms, profile }: Props) {
  const t = useTranslations("Profile");
  const tc = useTranslations("Common");
  const tn = useTranslations("Nav");
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
    <div className="stagger">
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartmentName, href: `/apartments/${apartmentId}` }, { label: t("title") }]}
        title={<SplitTitle text={t("title")} />}
        meta={[t("intro")]}
      />

      <HouseholdSection number="01" value={draft.household} errors={errors} onChange={(v) => set("household", v)} action={<FillSampleButton onFill={fill} />} />
      <BudgetSection number="02" apartmentId={apartmentId} rooms={rooms} value={draft.budgetPerRoom} onChange={(v) => set("budgetPerRoom", v)} />
      <StyleQuiz number="03" key={quizKey} value={draft.quizAnswers} onChange={(v) => set("quizAnswers", v)} />
      <PalettePicker
        number="04"
        liked={draft.colorsLiked}
        disliked={draft.colorsDisliked}
        onChange={({ liked, disliked }) => setDraft((d) => ({ ...d, colorsLiked: liked, colorsDisliked: disliked }))}
      />
      <MustKeepSection number="05" rooms={rooms} value={draft.mustKeep} errors={errors} onChange={(v) => set("mustKeep", v)} />

      {!parsed.success && (
        <section data-testid="profile-issues" role="alert" className="border-t-[1.5px] border-foreground pt-3.5">
          <h2 className="mb-1 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">{t("problems")}</h2>
          <ul>
            {Object.entries(clientErrors).map(([path, msg]) => (
              <li key={path} className="grid grid-cols-[auto_1fr] gap-2.5 border-b border-dotted border-rule py-2.5 text-[13.5px]">
                <Badge variant="destructive" className="self-start">
                  {path}
                </Badge>
                {msg}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sticky so saving is always one tap away. */}
      <div className="sticky bottom-0 z-10 -mx-[clamp(20px,4vw,48px)] mt-6 flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-foreground bg-card/95 px-[clamp(20px,4vw,48px)] py-3 backdrop-blur-sm">
        <p className="font-mono text-[13px]" data-testid="profile-summary">
          {t("summary", { answered, total: QUIZ_PAIRS.length, missing: status.missingBudgetRoomIds.length })}
        </p>
        <Button type="button" disabled={pending || !parsed.success} onClick={save}>
          {pending ? tc("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
