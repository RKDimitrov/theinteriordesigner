"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberField, SelectField } from "@/components/wizard/fields";
import { type Household, PetType } from "@/domain/schemas/profile";

interface Props {
  value: Household;
  onChange: (next: Household) => void;
  errors: Record<string, string>;
  action?: React.ReactNode;
}

const int = (v: number | null, min: number) => Math.max(min, Math.round(v ?? min));

export function HouseholdSection({ value, onChange, errors, action }: Props) {
  const t = useTranslations("Profile");
  const tp = useTranslations("PetType");
  const set = <K extends keyof Household>(k: K, v: Household[K]) => onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("household")}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t("adults")} value={value.adults} min={1} max={12} error={errors["household.adults"]} onChange={(v) => set("adults", int(v, 1))} />
          <NumberField
            label={t("wfhDays")}
            value={value.wfhDaysPerWeek}
            min={0}
            max={7}
            error={errors["household.wfhDaysPerWeek"]}
            onChange={(v) => set("wfhDaysPerWeek", int(v, 0))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("kids")}</p>
          {value.kids.map((k, i) => (
            <div key={i} className="flex items-end gap-2">
              <NumberField
                className="w-28"
                label={t("kidAge")}
                value={k.age}
                min={0}
                max={17}
                error={errors[`household.kids.${i}.age`]}
                onChange={(v) => set("kids", value.kids.map((x, j) => (j === i ? { age: int(v, 0) } : x)))}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("kids", value.kids.filter((_, j) => j !== i))}>
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" disabled={value.kids.length >= 10} onClick={() => set("kids", [...value.kids, { age: 5 }])}>
            {t("addKid")}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("pets")}</p>
          {value.pets.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <SelectField
                className="flex-1"
                label={t("petType")}
                value={p.type}
                options={PetType.options.map((v) => ({ value: v, label: tp(v) }))}
                onChange={(v) => set("pets", value.pets.map((x, j) => (j === i ? { ...x, type: v } : x)))}
              />
              <NumberField
                className="w-24"
                label={t("petCount")}
                value={p.count}
                min={1}
                max={10}
                onChange={(v) => set("pets", value.pets.map((x, j) => (j === i ? { ...x, count: int(v, 1) } : x)))}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("pets", value.pets.filter((_, j) => j !== i))}>
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={value.pets.length >= 10}
            onClick={() => set("pets", [...value.pets, { type: "dog", count: 1 }])}
          >
            {t("addPet")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
