"use client";

import { useTranslations } from "next-intl";
import { FormSection } from "@/components/atelier/form-section";
import { buttonVariants } from "@/components/ui/button";
import { NumberField } from "@/components/wizard/fields";
import { budgetTotal } from "@/domain/profile/status";
import { MAX_BUDGET_EUR } from "@/domain/schemas/profile";
import { Link } from "@/i18n/navigation";
import { useEur } from "@/lib/use-eur";

export interface RoomRef {
  id: string;
  name: string;
  type: string;
}

interface Props {
  apartmentId: string;
  rooms: readonly RoomRef[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  number?: string;
}

const SLIDER_MAX = 20_000;

export function BudgetSection({ apartmentId, rooms, value, onChange, number }: Props) {
  const eur = useEur();
  const t = useTranslations("Profile");
  const set = (id: string, v: number) => onChange({ ...value, [id]: Math.min(MAX_BUDGET_EUR, Math.max(0, Math.round(v))) });
  const missing = rooms.filter((r) => !((value[r.id] ?? 0) > 0));

  return (
    <FormSection number={number} title={t("budget")} hint={t("budgetHint")}>
      {rooms.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12.5px] text-muted-foreground">{t("noRooms")}</p>
          <Link href={`/apartments/${apartmentId}/rooms/new`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("addRooms")}
          </Link>
        </div>
      ) : (
        <>
          {rooms.map((r) => {
            const v = value[r.id] ?? 0;
            return (
              <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-x-4 gap-y-1.5" data-testid={`budget-${r.name}`}>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-[22px] leading-none">{r.name}</span>
                    <b aria-hidden className="font-mono text-[22px] font-normal tabular-nums">
                      {eur(v)}
                    </b>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={SLIDER_MAX}
                    step={50}
                    value={Math.min(v, SLIDER_MAX)}
                    aria-label={r.name}
                    className="w-full accent-primary"
                    onChange={(e) => set(r.id, Number(e.target.value))}
                  />
                </div>
                <NumberField label="EUR" value={v} min={0} max={MAX_BUDGET_EUR} step={50} suffix="€" onChange={(n) => set(r.id, n ?? 0)} />
              </div>
            );
          })}
          <p className="border-t border-dotted border-rule pt-2.5 font-mono text-[13.5px] font-medium" data-testid="budget-total">
            {t("budgetTotal", { total: eur(budgetTotal(value, rooms.map((r) => r.id))) })}
          </p>
          {missing.length > 0 && <p className="text-[12.5px] text-muted-foreground">{t("budgetMissing", { rooms: missing.map((r) => r.name).join(", ") })}</p>}
        </>
      )}
    </FormSection>
  );
}
