"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CompassInput } from "@/components/plan-editor/compass";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Apartment, ApartmentInput, Tenure } from "@/domain/schemas/apartment";
import { useRouter } from "@/i18n/navigation";
import { createApartmentAction, updateApartmentAction } from "@/server/actions/apartments";
import { NumberField, SelectField, TextField } from "./fields";

type Draft = Omit<ApartmentInput, "floorLevel" | "totalAreaM2"> & { floorLevel: number | null; totalAreaM2: number | null };

const EMPTY: Draft = {
  name: "",
  address: "",
  city: "",
  country: "DE",
  floorLevel: 0,
  tenure: "rent",
  totalAreaM2: null,
  yearBuilt: null,
  northAngleDeg: 0,
};

export function ApartmentForm({ apartment }: { apartment?: Apartment }) {
  const t = useTranslations("ApartmentForm");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(apartment ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () =>
    startTransition(async () => {
      const res = apartment ? await updateApartmentAction(apartment.id, draft) : await createApartmentAction(draft);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      router.push(`/apartments/${res.data.id}`);
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{apartment ? t("editTitle") : t("createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label={t("name")}
            placeholder={t("namePlaceholder")}
            value={draft.name}
            maxLength={80}
            error={errors["name"]}
            onChange={(v) => set("name", v)}
          />
          <TextField
            className="sm:col-span-2"
            label={t("address")}
            value={draft.address}
            maxLength={200}
            error={errors["address"]}
            onChange={(v) => set("address", v)}
          />
          <TextField label={t("city")} value={draft.city} error={errors["city"]} onChange={(v) => set("city", v)} />
          <TextField
            label={t("country")}
            hint={t("countryHint")}
            value={draft.country}
            maxLength={2}
            error={errors["country"]}
            onChange={(v) => set("country", v.toUpperCase())}
          />
          <NumberField
            label={t("floorLevel")}
            hint={t("floorHint")}
            value={draft.floorLevel}
            min={-2}
            max={100}
            error={errors["floorLevel"]}
            onChange={(v) => set("floorLevel", v)}
          />
          <SelectField<Tenure>
            label={t("tenure")}
            value={draft.tenure}
            options={[
              { value: "rent", label: t("rent") },
              { value: "own", label: t("own") },
            ]}
            onChange={(v) => set("tenure", v)}
          />
          <NumberField
            label={t("totalArea")}
            value={draft.totalAreaM2}
            min={1}
            step={0.1}
            suffix="m²"
            error={errors["totalAreaM2"]}
            onChange={(v) => set("totalAreaM2", v)}
          />
          <NumberField
            label={t("yearBuilt")}
            value={draft.yearBuilt}
            min={1500}
            max={2100}
            optional
            error={errors["yearBuilt"]}
            onChange={(v) => set("yearBuilt", v)}
          />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p className="text-sm font-medium">{t("north")}</p>
            <p className="text-xs text-muted-foreground">{t("northHint")}</p>
            <CompassInput value={draft.northAngleDeg} onChange={(v) => set("northAngleDeg", v)} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {apartment ? t("submitEdit") : t("submitCreate")}
        </Button>
      </div>
    </form>
  );
}
