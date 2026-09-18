"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Cardinal, Opening } from "@/domain/schemas/room";
import type { Wall } from "@/domain/geometry/walls";
import { cn } from "@/lib/utils";
import { NumberField, SelectField } from "@/components/wizard/fields";

interface OpeningFormProps {
  index: number;
  opening: Opening;
  walls: readonly Wall[];
  dirs: readonly Cardinal[];
  selected: boolean;
  errors: Record<string, string>;
  onSelect: () => void;
  onChange: (next: Opening) => void;
  onRemove: () => void;
}

export function OpeningForm({ index, opening, walls, dirs, selected, errors, onSelect, onChange, onRemove }: OpeningFormProps) {
  const t = useTranslations("RoomEditor");
  const tk = useTranslations("OpeningKind");
  const ts = useTranslations("SocketType");
  const err = (field: string) => errors[`openings.${index}.${field}`];
  const num = (v: number | null) => Math.max(0, Math.round(v ?? 0));
  const cm = useTranslations("Common")("cm");

  const wallOptions = walls.map((w) => ({
    value: String(w.index),
    label: t("wallLabel", { index: w.index + 1, dir: dirs[w.index] ?? "", length: Math.round(w.length) }),
  }));

  return (
    <fieldset
      data-testid={`opening-${opening.id}`}
      onFocusCapture={onSelect}
      className={cn("rounded-lg border p-3", selected && "border-blue-600 ring-2 ring-blue-600/20")}
    >
      <legend className="px-1 text-sm font-medium">
        {tk(opening.kind)} <span className="text-muted-foreground">({opening.id})</span>
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          className="col-span-2"
          label={t("wall")}
          value={String(opening.wallIndex)}
          options={wallOptions}
          error={err("wallIndex")}
          onChange={(v) => onChange({ ...opening, wallIndex: Number(v) })}
        />
        <NumberField label={t("offset")} value={opening.offset} min={0} suffix={cm} error={err("offset")} onChange={(v) => onChange({ ...opening, offset: num(v) })} />
        <NumberField
          label={t("openingWidth")}
          value={opening.width}
          min={5}
          suffix={cm}
          error={err("width")}
          onChange={(v) => onChange({ ...opening, width: Math.max(1, num(v)) })}
        />
        {opening.kind === "door" && (
          <>
            <NumberField label={t("openingHeight")} value={opening.height} suffix={cm} error={err("height")} onChange={(v) => onChange({ ...opening, height: Math.max(1, num(v)) })} />
            <SelectField
              label={t("swing")}
              value={opening.swing}
              options={[
                { value: "in", label: t("swingIn") },
                { value: "out", label: t("swingOut") },
                { value: "sliding", label: t("swingSliding") },
              ]}
              onChange={(v) => onChange({ ...opening, swing: v })}
            />
            <SelectField
              label={t("hinge")}
              value={opening.hinge}
              options={[
                { value: "start", label: t("hingeStart") },
                { value: "end", label: t("hingeEnd") },
              ]}
              onChange={(v) => onChange({ ...opening, hinge: v })}
            />
          </>
        )}
        {opening.kind === "window" && (
          <>
            <NumberField label={t("openingHeight")} value={opening.height} suffix={cm} error={err("height")} onChange={(v) => onChange({ ...opening, height: Math.max(1, num(v)) })} />
            <NumberField label={t("sillHeight")} value={opening.sillHeight} suffix={cm} error={err("sillHeight")} onChange={(v) => onChange({ ...opening, sillHeight: num(v) })} />
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={opening.openable} onChange={(e) => onChange({ ...opening, openable: e.target.checked })} />
              {t("openable")}
            </label>
          </>
        )}
        {opening.kind === "radiator" && (
          <>
            <NumberField label={t("openingHeight")} value={opening.height} suffix={cm} onChange={(v) => onChange({ ...opening, height: Math.max(1, num(v)) })} />
            <NumberField label={t("depth")} value={opening.depth} suffix={cm} onChange={(v) => onChange({ ...opening, depth: Math.max(1, num(v)) })} />
          </>
        )}
        {opening.kind === "socket" && (
          <>
            <NumberField label={t("openingHeight")} value={opening.height} suffix={cm} onChange={(v) => onChange({ ...opening, height: num(v) })} />
            <SelectField
              label={t("socketType")}
              value={opening.socketType}
              options={(["power", "tv", "network"] as const).map((v) => ({ value: v, label: ts(v) }))}
              onChange={(v) => onChange({ ...opening, socketType: v })}
            />
          </>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t("remove")}
        </Button>
      </div>
    </fieldset>
  );
}
