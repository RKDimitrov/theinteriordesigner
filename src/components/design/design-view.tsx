"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { designCost } from "@/domain/validator";
import type { DesignContent, SolverStats } from "@/domain/schemas/design";
import type { RoomShape } from "@/domain/schemas/room";
import type { ValidationIssue } from "@/domain/schemas/validation-issue";
import { cn } from "@/lib/utils";
import { DesignPlan } from "./design-plan";

export interface DesignViewProps {
  room: RoomShape;
  northAngleDeg: number;
  design: DesignContent;
  issues: ValidationIssue[];
  status: "valid" | "valid_with_warnings" | "invalid";
  budgetEur: number | null;
  /** Placement statistics of this version, including the pieces that were left out. */
  solver?: SolverStats;
  areaM2: number;
}

const eur = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** A room this small (m²) rarely fits everything the model asked for. */
const SMALL_ROOM_M2 = 6;

export function DesignView({ room, northAngleDeg, design, issues, status, budgetEur, solver, areaM2 }: DesignViewProps) {
  const t = useTranslations("Design");
  const tc = useTranslations("FurnitureCategory");
  const [selected, setSelected] = useState<string | null>(null);
  const errorIds = new Set(issues.filter((i) => i.severity === "error").flatMap((i) => i.itemIds));
  const cost = designCost(design);
  const dropped = solver?.dropped ?? [];
  const tooSmall = status === "invalid" && (areaM2 < SMALL_ROOM_M2 || dropped.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Alert variant={status === "invalid" ? "destructive" : "default"} data-testid="design-status">
        <AlertTitle>{t(`status_${status}`)}</AlertTitle>
        <AlertDescription>{t(`banner_${status}`)}</AlertDescription>
      </Alert>

      {(dropped.length > 0 || tooSmall) && (
        <Alert data-testid="design-dropped">
          <AlertTitle>{t("droppedTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            {dropped.length > 0 && <span>{t("dropped", { count: dropped.length, items: dropped.map((d) => tc(d.category)).join(", ") })}</span>}
            {dropped.some((d) => d.reason === "over_item_cap") && <span>{t("droppedCap")}</span>}
            {tooSmall && <span>{t("tooSmall")}</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{design.concept.title}</CardTitle>
            <CardDescription>{t("planHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DesignPlan room={room} northAngleDeg={northAngleDeg} design={design} errorIds={errorIds} selectedId={selected} onSelect={setSelected} />
            <p className="mt-3 text-sm text-muted-foreground">{design.concept.summary}</p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card data-testid="design-issues">
            <CardHeader>
              <CardTitle>{t("issues")}</CardTitle>
              <CardDescription>
                {t("cost", { min: eur(cost.min), max: eur(cost.max) })}
                {budgetEur ? ` ${t("budgetOf", { budget: eur(budgetEur) })}` : ` · ${t("noBudget")}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {issues.length === 0 && <p className="text-sm text-muted-foreground">{t("noIssues")}</p>}
              {issues.map((i, idx) => (
                <button
                  key={`${i.code}-${idx}`}
                  type="button"
                  onClick={() => setSelected(i.itemIds[0] ?? null)}
                  className={cn(
                    "rounded-lg border p-2 text-left text-sm",
                    i.severity === "error" ? "border-destructive/50" : "border-amber-500/50",
                    i.itemIds.includes(selected ?? "") && "ring-2 ring-blue-600/30",
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant={i.severity === "error" ? "destructive" : "secondary"}>{t(i.severity === "error" ? "error" : "warning")}</Badge>
                    <span className="font-medium">{i.message}</span>
                  </span>
                  {i.hint && <span className="mt-1 block text-muted-foreground">{i.hint}</span>}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("palette")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(["base", "secondary", "accent"] as const).map((role) => {
                const c = design.palette[role];
                return (
                  <div key={role} className="flex items-center gap-3 text-sm">
                    <span className="size-8 rounded-md border" style={{ backgroundColor: c.hex }} />
                    <span className="flex-1">
                      <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">{c.hex}</span>
                      {c.paint.system !== "none" && <span className="text-muted-foreground"> · {c.paint.system} {c.paint.code}</span>}
                      <span className="block text-xs text-muted-foreground">{c.usage.join(", ")}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{t("share", { value: Math.round(c.share * 100) })}</span>
                  </div>
                );
              })}
              <p className="text-sm text-muted-foreground">{design.palette.rationale}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("furniture")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {design.furniture.map((f) => (
            <button
              key={f.id}
              type="button"
              data-testid={`item-${f.id}`}
              onClick={() => setSelected(f.id === selected ? null : f.id)}
              className={cn(
                "rounded-lg border p-3 text-left",
                errorIds.has(f.id) && "border-destructive/60",
                f.id === selected && "ring-2 ring-blue-600/30",
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="size-4 rounded-sm border" style={{ backgroundColor: f.colorHex }} />
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-muted-foreground">{tc(f.category)}</span>
                <Badge variant="outline">{t(`tier_${f.investmentTier}`)}</Badge>
                <Badge variant={f.trendRisk > 0.3 ? "secondary" : "outline"}>{t("trendRisk", { value: f.trendRisk })}</Badge>
                {f.existing && <Badge variant="outline">{t("existing")}</Badge>}
                {f.requiresDrilling && <Badge variant="outline">{t("drilling")}</Badge>}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("dims", { w: f.w, d: f.d, h: f.h })} · {f.material} · {f.existing ? "—" : `${eur(f.price.min)}–${eur(f.price.max)}`}
              </span>
              <span className="mt-1 block text-sm">{f.rationale}</span>
              {f.productQuery && <span className="mt-1 block text-xs text-muted-foreground">{t("search", { query: f.productQuery })}</span>}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("lighting")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {design.lighting.map((l) => (
              <div key={l.id}>
                <span className="font-medium">{l.fixture}</span> <Badge variant="outline">{t(`layer_${l.layer}`)}</Badge>
                <span className="block text-muted-foreground">
                  {l.colorTempK} K · {l.lumens} lm{l.dimmable ? " · dimmable" : ""} · {eur(l.price.min)}–{eur(l.price.max)}
                </span>
                <span className="block text-muted-foreground">{l.rationale}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("surfaces")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {design.surfaces.map((s) => (
              <div key={`${s.surface}-${s.material}`}>
                <span className="font-medium">{s.surface}</span>: {s.material} ({s.finish})
                <span className="block text-muted-foreground">{s.rationale}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("textiles")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {design.textiles.map((x) => (
              <div key={x.id}>
                <span className="font-medium">{x.type}</span>: {x.material}
                {x.size ? `, ${x.size}` : ""}
                <span className="block text-muted-foreground">
                  {eur(x.price.min)}–{eur(x.price.max)} · {t("trendRisk", { value: x.trendRisk })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("longevity")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{design.longevity.summary}</p>
          {design.longevity.trendItems.length > 0 && (
            <p className="mt-1 text-muted-foreground">{design.longevity.trendItems.join(", ")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
