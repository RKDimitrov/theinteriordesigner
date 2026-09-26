"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { fieldLabelClass } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Opens3dPref, PlannerViewPref } from "@/lib/planner-prefs";
import { setPlannerPrefAction } from "@/server/actions/preferences";

const LANGUAGE_NAME: Record<(typeof routing.locales)[number], string> = { en: "English", de: "Deutsch", bg: "Български" };

/** Switches the interface language; English stays at the bare URLs, the others get /de and /bg. */
export function LanguageChoice({ label }: { label: string }) {
  const id = useId();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={fieldLabelClass}>
        {label}
      </span>
      <Segmented
        aria-labelledby={id}
        value={locale}
        options={routing.locales.map((l) => ({ value: l, label: LANGUAGE_NAME[l], disabled: pending }))}
        onChange={(next) => startTransition(() => router.replace(pathname, { locale: next as (typeof routing.locales)[number] }))}
      />
    </div>
  );
}

function PrefChoice<T extends string>({
  label,
  hint,
  initial,
  options,
  save,
}: {
  label: string;
  hint?: string;
  initial: T;
  options: readonly { value: T; label: string }[];
  save: (value: T) => Promise<{ ok: boolean }>;
}) {
  const id = useId();
  const t = useTranslations("Common");
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={fieldLabelClass}>
        {label}
      </span>
      <Segmented
        aria-labelledby={id}
        value={value}
        options={options}
        onChange={(next) => {
          setValue(next);
          startTransition(async () => {
            const res = await save(next);
            if (res.ok) toast.success(t("saved"));
            else setValue(value);
          });
        }}
      />
      {hint && <p className="text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PlannerPrefs({ view, opens3d }: { view: PlannerViewPref; opens3d: Opens3dPref }) {
  const t = useTranslations("Settings");
  return (
    <>
      <PrefChoice
        label={t("layout")}
        hint={t("layoutHint")}
        initial={view}
        options={[
          { value: "calm", label: t("layout_calm") },
          { value: "quiet", label: t("layout_quiet") },
          { value: "full", label: t("layout_full") },
        ]}
        save={(value) => setPlannerPrefAction({ key: "plannerView", value })}
      />
      <PrefChoice
        label={t("opens3d")}
        initial={opens3d}
        options={[
          { value: "room", label: t("opens3d_room") },
          { value: "all", label: t("opens3d_all") },
        ]}
        save={(value) => setPlannerPrefAction({ key: "opens3d", value })}
      />
    </>
  );
}
