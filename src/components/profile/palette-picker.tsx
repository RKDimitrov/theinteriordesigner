"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SWATCHES } from "@/domain/profile/swatches";
import { cn } from "@/lib/utils";

interface Props {
  liked: string[];
  disliked: string[];
  onChange: (next: { liked: string[]; disliked: string[] }) => void;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const MAX = 12;

export function PalettePicker({ liked, disliked, onChange }: Props) {
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
    <Card>
      <CardHeader>
        <CardTitle>{t("colors")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Panel list="liked" title={t("liked")} selected={liked} onToggle={toggle} />
        <Panel list="disliked" title={t("disliked")} selected={disliked} onToggle={toggle} />
      </CardContent>
    </Card>
  );
}

interface PanelProps {
  list: "liked" | "disliked";
  title: string;
  selected: string[];
  onToggle: (list: "liked" | "disliked", hex: string) => void;
}

function Panel({ list, title, selected, onToggle }: PanelProps) {
  const t = useTranslations("Profile");
  const [custom, setCustom] = useState("#888888");
  const isOn = (hex: string) => selected.some((h) => same(h, hex));

  return (
    <div className="flex flex-col gap-3" data-testid={`palette-${list}`}>
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-8 gap-2">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            type="button"
            title={s.name}
            aria-label={`${title}: ${s.name}`}
            aria-pressed={isOn(s.hex)}
            onClick={() => onToggle(list, s.hex)}
            className={cn(
              "aspect-square rounded-md border ring-offset-2 ring-offset-background transition",
              isOn(s.hex) && (list === "liked" ? "ring-2 ring-emerald-600" : "ring-2 ring-red-600"),
            )}
            style={{ backgroundColor: s.hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={custom}
          aria-label={`${title}: ${t("customColor")}`}
          onChange={(e) => setCustom(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border bg-transparent"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => onToggle(list, custom)} disabled={isOn(custom)}>
          {t("addColor")}
        </Button>
      </div>
      <div className="flex min-h-7 flex-wrap gap-1.5">
        {selected.length === 0 && <span className="text-sm text-muted-foreground">{t("noColors")}</span>}
        {selected.map((h) => (
          <button
            key={h}
            type="button"
            data-testid={`chip-${list}-${h.slice(1).toLowerCase()}`}
            onClick={() => onToggle(list, h)}
            className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
          >
            <span className="size-3 rounded-full border" style={{ backgroundColor: h }} />
            {h} ×
          </button>
        ))}
      </div>
    </div>
  );
}
