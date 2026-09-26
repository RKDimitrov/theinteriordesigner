"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/atelier/form-section";
import { Field, NumberField, SelectField, TextField } from "@/components/wizard/fields";
import { nextId } from "@/domain/room/openings-edit";
import { FurnitureCategory } from "@/domain/schemas/design";
import type { MustKeepItem } from "@/domain/schemas/profile";
import type { RoomRef } from "./budget-section";

interface Props {
  rooms: readonly RoomRef[];
  value: MustKeepItem[];
  onChange: (next: MustKeepItem[]) => void;
  errors: Record<string, string>;
  number?: string;
}

const NONE = "__none";

export function MustKeepSection({ rooms, value, onChange, errors, number }: Props) {
  const t = useTranslations("Profile");
  const tc = useTranslations("FurnitureCategory");
  const tcm = useTranslations("Common");
  const update = (id: string, patch: Partial<MustKeepItem>) => onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const cm = (v: number | null) => Math.max(1, Math.round(v ?? 1));

  return (
    <FormSection number={number} title={t("mustKeep")} hint={t("mustKeepHint")} id="must-keep">
      {value.map((m, i) => (
        <fieldset key={m.id} className="grid grid-cols-2 gap-3 border border-dashed border-rule px-3.5 pt-3 pb-3.5 sm:grid-cols-3" data-testid={`keep-${m.id}`}>
          <legend className="px-1.5 font-mono text-[11px] font-medium tracking-[0.1em] uppercase">
            {tc(m.category)} · {m.id}
          </legend>
          <TextField
            className="col-span-2"
            label={t("itemName")}
            value={m.name}
            maxLength={60}
            error={errors[`mustKeep.${i}.name`]}
            onChange={(v) => update(m.id, { name: v })}
          />
          <SelectField
            label={t("itemCategory")}
            value={m.category}
            options={FurnitureCategory.options.map((v) => ({ value: v, label: tc(v) }))}
            onChange={(v) => update(m.id, { category: v })}
          />
          <NumberField label={t("itemW")} value={m.w} suffix={tcm("cm")} onChange={(v) => update(m.id, { w: cm(v) })} />
          <NumberField label={t("itemD")} value={m.d} suffix={tcm("cm")} onChange={(v) => update(m.id, { d: cm(v) })} />
          <NumberField label={t("itemH")} value={m.h} suffix={tcm("cm")} onChange={(v) => update(m.id, { h: cm(v) })} />
          <Field label={t("itemColor")}>
            {(id) => (
              <input
                id={id}
                type="color"
                value={m.colorHex}
                onChange={(e) => update(m.id, { colorHex: e.target.value.toUpperCase() })}
                className="h-[44px] w-full cursor-pointer border-[1.5px] border-foreground bg-card p-1"
              />
            )}
          </Field>
          <SelectField
            className="col-span-2 sm:col-span-2"
            label={t("itemRoom")}
            value={m.roomId ?? NONE}
            options={[{ value: NONE, label: t("unassigned") }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]}
            onChange={(v) => update(m.id, { roomId: v === NONE ? null : v })}
          />
          <div className="col-span-2 flex justify-end sm:col-span-3">
            <Button type="button" variant="ghost-destructive" size="xs" onClick={() => onChange(value.filter((x) => x.id !== m.id))}>
              {t("remove")}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="self-start"
        disabled={value.length >= 30}
        onClick={() =>
          onChange([
            ...value,
            { id: nextId("keep", value.map((m) => m.id)), name: "", category: "other", w: 100, d: 50, h: 80, colorHex: "#C19A6B", roomId: null },
          ])
        }
      >
        <span aria-hidden>+</span> {t("addItem")}
      </Button>
    </FormSection>
  );
}
