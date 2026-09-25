"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SectionTitle, SheetColumns } from "@/components/atelier/page-header";
import { MarginNote, Rows, SideSection } from "@/components/atelier/sidebar";
import { Badge } from "@/components/ui/badge";
import { Stamp } from "@/components/ui/stamp";
import { designCost } from "@/domain/validator";
import type { DesignContent, FurnitureItem, SolverStats } from "@/domain/schemas/design";
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
  /** How this version was produced, already formatted. */
  generation: { model: string; seconds: number; repairs: number; cost: string; date: string };
}

const eur = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** A room this small (m²) rarely fits everything the model asked for. */
const SMALL_ROOM_M2 = 6;
/** Issue codes that usually mean "too much furniture for the floor". */
const CROWDING = new Set(["WALKWAY_TOO_NARROW", "OVERLAP"]);

const STATUS_TONE = { valid: "done", valid_with_warnings: "warn", invalid: "error" } as const;

export function DesignView({ room, northAngleDeg, design, issues, status, budgetEur, solver, areaM2, generation }: DesignViewProps) {
  const t = useTranslations("Design");
  const tc = useTranslations("FurnitureCategory");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const errorIds = new Set(issues.filter((i) => i.severity === "error").flatMap((i) => i.itemIds));
  const cost = designCost(design);
  const dropped = solver?.dropped ?? [];
  const tooSmall = status === "invalid" && (areaM2 < SMALL_ROOM_M2 || dropped.length > 0);
  const numbers = new Map(design.furniture.map((f, i) => [f.id, i + 1]));
  const highlightId = hover?.id ?? null;
  const hovered = hover ? design.furniture.find((f) => f.id === hover.id) : undefined;
  const furnitureTotal = design.furniture.reduce((sum, f) => (f.existing ? sum : { min: sum.min + f.price.min, max: sum.max + f.price.max }), { min: 0, max: 0 });
  const paletteRoles = (["base", "secondary", "accent"] as const).map((role) => ({ role, ...design.palette[role] }));

  const side = (
    <>
      <section data-testid="design-status" className="flex items-center gap-4 border-[1.5px] border-foreground bg-card px-[18px] py-4">
        <Stamp tone={STATUS_TONE[status]} size="lg">
          {t(`stamp_${status}`)}
        </Stamp>
        <div className="min-w-0">
          <h2 className="font-heading text-[26px] leading-[1.05] font-normal">{t(`status_${status}`)}</h2>
          <p className="text-[13px] text-[#5a4f45]">{t(`banner_${status}`)}</p>
        </div>
      </section>

      {(dropped.length > 0 || tooSmall) && (
        <SideSection title={t("droppedTitle")} data-testid="design-dropped" className="mt-[22px]">
          <div className="flex flex-col gap-1.5 text-[13.5px]">
            {dropped.length > 0 && <p>{t("dropped", { count: dropped.length, items: dropped.map((d) => tc(d.category)).join(", ") })}</p>}
            {dropped.some((d) => d.reason === "over_item_cap") && <p>{t("droppedCap")}</p>}
            {tooSmall && <p className="text-muted-foreground">{t("tooSmall")}</p>}
          </div>
        </SideSection>
      )}

      <SideSection title={t("issues")} value={issues.length} data-testid="design-issues" className="mt-[22px]">
        {issues.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">{t("noIssues")}</p>
        ) : (
          <ul>
            {issues.map((i, idx) => (
              <li key={`${i.code}-${idx}`}>
                <button
                  type="button"
                  onClick={() => setSelected(i.itemIds[0] ?? null)}
                  aria-pressed={i.itemIds.includes(selected ?? "")}
                  className="grid w-full grid-cols-[auto_1fr] gap-2.5 border-b border-dotted border-rule py-2.5 text-left text-[13.5px] outline-none hover:bg-highlight focus-visible:bg-highlight aria-pressed:bg-highlight"
                >
                  <Badge variant={i.severity === "error" ? "destructive" : "clay"} className="self-start">
                    {t(i.severity === "error" ? "error" : "warning")}
                  </Badge>
                  <span>
                    {i.message}
                    {i.hint && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{i.hint}</span>}
                    {CROWDING.has(i.code) && areaM2 < SMALL_ROOM_M2 && (
                      <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{t("tooSmallHint")}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SideSection>

      <SideSection title={t("concept")}>
        <p className="mb-1 font-mono text-[11px] tracking-[0.1em] uppercase">{design.concept.title}</p>
        <MarginNote>{design.concept.summary}</MarginNote>
      </SideSection>

      <SideSection title={t("palette")} value={t("shares")}>
        <div className="flex h-[72px] border-[1.5px] border-foreground">
          {paletteRoles.map((c) => (
            <span key={c.role} className="relative border-r border-foreground last:border-r-0" style={{ background: c.hex, flex: Math.max(c.share, 0.02) }}>
              <span className="absolute bottom-1 left-1.5 bg-card px-1 font-mono text-[10px]">{t("share", { value: Math.round(c.share * 100) })}</span>
            </span>
          ))}
        </div>
        <Rows
          className="mt-2"
          rows={paletteRoles.map((c) => ({
            label: (
              <span>
                {c.name}
                {c.paint.system !== "none" && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.paint.system} {c.paint.code}
                  </span>
                )}
              </span>
            ),
            value: c.hex.toUpperCase(),
          }))}
        />
        <p className="mt-2 text-[12.5px] text-muted-foreground">{design.palette.rationale}</p>
      </SideSection>

      <SideSection title={t("budget")} value={budgetEur ? eur(budgetEur) : t("noBudget")}>
        <Rows
          rows={[
            { label: t("estimate"), value: `${eur(cost.min)}–${eur(cost.max)}` },
            { label: t("generatedBy"), value: t("modelTime", { model: generation.model, seconds: generation.seconds }) },
            { label: t("repairs"), value: generation.repairs === 0 ? t("noRepairs") : generation.repairs },
            { label: t("generationCost"), value: generation.cost },
            { label: t("saved"), value: generation.date },
          ]}
        />
      </SideSection>
    </>
  );

  return (
    <SheetColumns sideWidth={360} sticky side={side}>
      <section aria-label={t("plan")} className="border border-border bg-card shadow-card">
        <div className="bg-blueprint p-3">
          <DesignPlan
            room={room}
            northAngleDeg={northAngleDeg}
            design={design}
            errorIds={errorIds}
            selectedId={selected}
            highlightId={highlightId}
            numbers={numbers}
            onSelect={setSelected}
            onHover={(id, at) => setHover(id && at ? { id, ...at } : null)}
          />
        </div>
        <Legend />
      </section>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{t("planHint")}</p>

      <section aria-labelledby="furniture-title" className="mt-10">
        <SectionTitle id="furniture-title" note={t("piecesTotal", { count: design.furniture.length, min: eur(furnitureTotal.min), max: eur(furnitureTotal.max) })}>
          {t("furniture")}
        </SectionTitle>
        <div className="border-t-[1.5px] border-foreground">
          <div aria-hidden className={cn(ROW, "cursor-default py-2 font-mono text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase")}>
            <span className="max-[899px]:hidden">#</span>
            <span />
            <span>{t("colName")}</span>
            <span className="max-[899px]:hidden">{t("colSize")}</span>
            <span className="max-[899px]:hidden">{t("colTier")}</span>
            <span className="text-right">{t("colPrice")}</span>
          </div>
          {design.furniture.map((f) => (
            <FurnitureRow
              key={f.id}
              item={f}
              n={numbers.get(f.id)!}
              selected={f.id === selected}
              lit={f.id === highlightId || f.id === selected}
              error={errorIds.has(f.id)}
              onToggle={() => setSelected(f.id === selected ? null : f.id)}
              onHover={(on) => setHover(on ? { id: f.id, x: -1, y: -1 } : null)}
            />
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-x-8 md:grid-cols-3">
        <SideSection title={t("lighting")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            {design.lighting.map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.fixture}</span> <Badge variant="outline">{t(`layer_${l.layer}`)}</Badge>
                <span className="block font-mono text-[11.5px] text-muted-foreground">
                  {l.colorTempK} K · {l.lumens} lm{l.dimmable ? ` · ${t("dimmable")}` : ""} · {eur(l.price.min)}–{eur(l.price.max)}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">{l.rationale}</span>
              </li>
            ))}
          </ul>
        </SideSection>
        <SideSection title={t("surfaces")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            {design.surfaces.map((s) => (
              <li key={`${s.surface}-${s.material}`}>
                <span className="font-medium">{t(`surface_${s.surface}`)}</span>: {s.material} ({s.finish})
                <span className="block text-[12.5px] text-muted-foreground">{s.rationale}</span>
              </li>
            ))}
          </ul>
        </SideSection>
        <SideSection title={t("textiles")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            {design.textiles.map((x) => (
              <li key={x.id}>
                <span className="font-medium">{x.type}</span>: {x.material}
                {x.size ? `, ${x.size}` : ""}
                <span className="block font-mono text-[11.5px] text-muted-foreground">
                  {eur(x.price.min)}–{eur(x.price.max)} · {t("trendRisk", { value: x.trendRisk })}
                </span>
              </li>
            ))}
          </ul>
        </SideSection>
      </div>

      <SideSection title={t("longevity")} className="mt-2">
        <p className="text-[13.5px]">{design.longevity.summary}</p>
        {design.longevity.trendItems.length > 0 && <p className="mt-1 text-[12.5px] text-muted-foreground">{design.longevity.trendItems.join(", ")}</p>}
      </SideSection>

      {hovered && hover && hover.x >= 0 && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 bg-foreground px-2.5 py-2 font-mono text-[11.5px] leading-[1.4] text-card shadow-offset-clay"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <b className="font-medium">
            {numbers.get(hovered.id)} · {hovered.name}
          </b>
          <br />
          {t("footprint", { w: hovered.w, d: hovered.d })} · {hovered.existing ? t("existing") : `${eur(hovered.price.min)}–${eur(hovered.price.max)}`}
        </div>
      )}
    </SheetColumns>
  );
}

const ROW = "grid grid-cols-[18px_minmax(0,1fr)_80px] items-center gap-3.5 px-2 min-[900px]:grid-cols-[28px_18px_minmax(0,1.6fr)_minmax(0,1fr)_90px_90px]";

function FurnitureRow({
  item: f,
  n,
  selected,
  lit,
  error,
  onToggle,
  onHover,
}: {
  item: FurnitureItem;
  n: number;
  selected: boolean;
  lit: boolean;
  error: boolean;
  onToggle: () => void;
  onHover: (on: boolean) => void;
}) {
  const t = useTranslations("Design");
  const tc = useTranslations("FurnitureCategory");
  return (
    <button
      type="button"
      data-testid={`item-${f.id}`}
      aria-pressed={selected}
      onClick={onToggle}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        ROW,
        "w-full border-b border-dotted border-rule py-[11px] text-left transition-colors outline-none hover:bg-highlight focus-visible:bg-highlight",
        lit && "bg-highlight",
        selected && "ring-2 ring-primary ring-inset",
        error && "border-l-[3px] border-l-destructive"
      )}
    >
      <span className="font-mono text-[11px] font-medium text-muted-foreground max-[899px]:hidden">{String(n).padStart(2, "0")}</span>
      <span className="size-[18px] border border-foreground" style={{ background: f.colorHex }} />
      <span className="min-w-0">
        <b className="block text-[14.5px] font-semibold">
          {f.name}
          {f.existing && (
            <Badge variant="olive" className="ml-2 align-middle">
              {t("existing")}
            </Badge>
          )}
        </b>
        <small className="block truncate font-mono text-[11.5px] text-muted-foreground">
          {tc(f.category)} · {f.material}
          {f.productQuery ? ` · ${t("search", { query: f.productQuery })}` : ""}
        </small>
        {selected && (
          <span className="mt-1.5 block text-[13px]">
            {f.rationale}
            <span className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant={f.trendRisk > 0.3 ? "clay" : "outline"}>{t("trendRisk", { value: f.trendRisk })}</Badge>
              {f.requiresDrilling && <Badge variant="outline">{t("drilling")}</Badge>}
              {!f.renterFriendly && <Badge variant="outline">{t("notRenterFriendly")}</Badge>}
            </span>
          </span>
        )}
      </span>
      <span className="font-mono text-[11.5px] text-muted-foreground max-[899px]:hidden">{t("dims", { w: f.w, d: f.d, h: f.h })}</span>
      <span className="max-[899px]:hidden">
        <Badge variant={f.investmentTier === "anchor" ? "default" : "outline"}>{t(`tier_${f.investmentTier}`)}</Badge>
      </span>
      <span className="text-right font-mono text-[13px] font-medium tabular-nums">{f.existing ? "—" : `${eur(f.price.min)}–${eur(f.price.max)}`}</span>
    </button>
  );
}

function Legend() {
  const t = useTranslations("Design");
  const swatch = "inline-block size-3 border border-foreground";
  return (
    <ul className="flex flex-wrap gap-4 border-t border-line px-3 py-2.5 font-mono text-[11px] tracking-[0.06em] uppercase">
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "bg-walnut/85")} /> {t("legendFloor")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-dashed bg-primary/55")} /> {t("legendRug")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-dashed bg-card")} /> {t("legendWall")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "rounded-full border-dashed border-primary bg-sticky")} /> {t("legendLight")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn(swatch, "border-2 border-destructive bg-card")} /> {t("legendError")}
      </li>
    </ul>
  );
}
