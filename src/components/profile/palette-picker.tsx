"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormSection } from "@/components/atelier/form-section";
import { Button } from "@/components/ui/button";
import { fieldLabelClass } from "@/components/ui/label";
import { SWATCHES } from "@/domain/profile/swatches";
import { cn } from "@/lib/utils";

interface Props {
  liked: string[];
  disliked: string[];
  onChange: (next: { liked: string[]; disliked: string[] }) => void;
  number?: string;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const MAX = 12;

export function PalettePicker({ liked, disliked, onChange, number }: Props) {
  const t = useTranslations("Profile");

  /** Add or remove `hex` from one list; adding also removes it from the other list. */
  const toggle = (list: "liked" | "disliked", hex: string) => {
    const mine = list === "liked" ? liked : disliked;
    const other = list === "liked" ? disliked : liked;
    const has = mine.some((h) => same(h, hex));
    if (!has && mine.length >= MAX) return;
    const nextMine = has ? mine.filter((h) => !same(h, hex)) : [...mine, hex.toUpperCase()];
    const nextOther = has ? other : other.filter((h) => !same(h, hex));
    onChange(list === "liked" ? { liked: nextMine, disliked: nextOther } : { liked: nextOther, disliked: nextMine });
  };

  return (
    <FormSection number={number} title={t("colors")} hint={t("colorsHint")}>
      <SwatchPanel list="liked" title={t("liked")} selected={liked} onToggle={toggle} />
      <SwatchPanel list="disliked" title={t("disliked")} selected={disliked} onToggle={toggle} />
    </FormSection>
  );
}

interface PanelProps {
  list: "liked" | "disliked";
  title: string;
  selected: string[];
  onToggle: (list: "liked" | "disliked", hex: string) => void;
}

function SwatchPanel({ list, title, selected, onToggle }: PanelProps) {
  const t = useTranslations("Profile");
  const [custom, setCustom] = useState("#888888");
  const isOn = (hex: string) => selected.some((h) => same(h, hex));
  const name = (hex: string) => SWATCHES.find((s) => same(s.hex, hex))?.name ?? hex.toUpperCase();

  return (
    <div className="flex flex-col gap-2.5" data-testid={`palette-${list}`}>
      <p className={fieldLabelClass}>{title}</p>
      <div className="grid grid-cols-8 gap-2 max-[560px]:grid-cols-4">
        {SWATCHES.map((s) => {
          const on = isOn(s.hex);
          return (
            <button
              key={s.hex}
              type="button"
              title={s.name}
              aria-label={`${title}: ${s.name}`}
              aria-pressed={on}
              onClick={() => onToggle(list, s.hex)}
              className={cn(
                "relative aspect-square border border-foreground transition-shadow outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on && (list === "liked" ? "shadow-offset-clay" : "border-2 border-destructive")
              )}
              style={{ backgroundColor: s.hex }}
            >
              {on && (
                <span aria-hidden className="absolute top-0.5 right-0.5 grid size-4 place-items-center bg-card font-mono text-[10px]">
                  {list === "liked" ? "✓" : "✕"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={custom}
          aria-label={`${title}: ${t("customColor")}`}
          onChange={(e) => setCustom(e.target.value)}
          className="h-9 w-12 cursor-pointer border-[1.5px] border-foreground bg-card p-0.5"
        />
        <Button type="button" variant="outline" size="xs" onClick={() => onToggle(list, custom)} disabled={isOn(custom)}>
          {t("addColor")}
        </Button>
      </div>
      <div className="flex min-h-7 flex-wrap gap-2">
        {selected.length === 0 && <span className="text-[12.5px] text-muted-foreground">{t("noColors")}</span>}
        {selected.map((h) => (
          <button
            key={h}
            type="button"
            data-testid={`chip-${list}-${h.slice(1).toLowerCase()}`}
            onClick={() => onToggle(list, h)}
            className={cn(
              "flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase hover:bg-secondary",
              list === "liked" ? "border-foreground" : "border-destructive text-destructive"
            )}
          >
            <span className="size-3 border border-foreground" style={{ backgroundColor: h }} />
            {name(h)} <span aria-hidden>×</span>
          </button>
        ))}
      </div>
    </div>
  );
}
