"use client";

import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberField } from "@/components/wizard/fields";
import { budgetTotal } from "@/domain/profile/status";
import { MAX_BUDGET_EUR } from "@/domain/schemas/profile";
import { Link } from "@/i18n/navigation";

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
}

const SLIDER_MAX = 20_000;
const eur = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function BudgetSection({ apartmentId, rooms, value, onChange }: Props) {
  const t = useTranslations("Profile");
  const set = (id: string, v: number) => onChange({ ...value, [id]: Math.min(MAX_BUDGET_EUR, Math.max(0, Math.round(v))) });
  const missing = rooms.filter((r) => !((value[r.id] ?? 0) > 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("budget")}</CardTitle>
        <CardDescription>{t("budgetHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{t("noRooms")}</p>
            <Link href={`/apartments/${apartmentId}/rooms/new`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("addRooms")}
            </Link>
          </div>
        ) : (
          <>
            {rooms.map((r) => {
              const v = value[r.id] ?? 0;
              return (
                <div key={r.id} className="grid grid-cols-[1fr_8rem] items-end gap-3" data-testid={`budget-${r.name}`}>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{r.name}</span>
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
            <p className="text-sm font-medium" data-testid="budget-total">
              {t("budgetTotal", { total: eur(budgetTotal(value, rooms.map((r) => r.id))) })}
            </p>
            {missing.length > 0 && <p className="text-sm text-muted-foreground">{t("budgetMissing", { rooms: missing.map((r) => r.name).join(", ") })}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
