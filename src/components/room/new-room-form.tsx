"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader, SheetColumns } from "@/components/atelier/page-header";
import { SideSection } from "@/components/atelier/sidebar";
import { FillSampleButton } from "@/components/dev/fill-sample-button";
import { RoomPlan } from "@/components/plan-view/room-plan";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { fieldLabelClass } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NumberField, TextField } from "@/components/wizard/fields";
import { area, bbox, rectPolygon } from "@/domain/geometry/polygon";
import { m2 } from "@/domain/geometry/units";
import { MIN_ROOM_SIDE_CM, RoomInput } from "@/domain/room/check-room";
import { type RoomShape, RoomType } from "@/domain/schemas/room";
import { Link, useRouter } from "@/i18n/navigation";
import { zodFieldErrors } from "@/lib/action-result";
import { pickSample, SAMPLE_ROOMS } from "@/lib/dev/samples";
import { setRoomBudgetAction } from "@/server/actions/profile";
import { createRoomAction } from "@/server/actions/rooms";

const BUDGET = { min: 300, max: 8000, step: 100, initial: 1800 } as const;

type Extras = Pick<RoomShape, "openings" | "fixedElements" | "wallOrientationOverrides">;
const NO_EXTRAS: Extras = { openings: [], fixedElements: [], wallOrientationOverrides: {} };

interface NewRoomFormProps {
  apartmentId: string;
  apartmentName: string;
  northAngleDeg: number;
  /** Budgets live in the style profile; without one the budget section links there instead. */
  hasProfile: boolean;
}

/** New room: name and type, size, budget, with a live sketch. Doors and windows are added in the planner. */
export function NewRoomForm({ apartmentId, apartmentName, northAngleDeg, hasProfile }: NewRoomFormProps) {
  const t = useTranslations("NewRoom");
  const tc = useTranslations("Common");
  const tn = useTranslations("Nav");
  const tt = useTranslations("RoomType");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [type, setType] = useState<RoomType>("living");
  const [w, setW] = useState<number | null>(null);
  const [d, setD] = useState<number | null>(null);
  const [ceiling, setCeiling] = useState<number | null>(250);
  const [budget, setBudget] = useState<number>(BUDGET.initial);
  // Openings etc. only come from the dev sample; users add them in the planner.
  const [extras, setExtras] = useState<Extras>(NO_EXTRAS);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const sized = w !== null && d !== null && w >= MIN_ROOM_SIDE_CM && d >= MIN_ROOM_SIDE_CM;
  const shape: RoomShape | null = sized ? { name, type, ceilingHeight: ceiling ?? 0, polygon: rectPolygon(w, d), ...extras } : null;
  const parsed = shape ? RoomInput.safeParse(shape) : null;
  const errors: Record<string, string> = { ...serverErrors, ...(parsed && !parsed.success ? zodFieldErrors(parsed.error) : {}) };
  // Name and ceiling errors show under their fields; the rest go in the issue list.
  const issues = Object.entries(errors).filter(([path]) => path !== "name" && path !== "ceilingHeight");
  const canSave = !!parsed?.success && !pending;

  const fillSample = (counter: number) => {
    const { polygon, name, type, ceilingHeight, ...rest } = pickSample(SAMPLE_ROOMS, counter);
    const box = bbox(polygon);
    setName(name);
    setType(type);
    setW(box.w);
    setD(box.d);
    setCeiling(ceilingHeight);
    setExtras(rest);
    setServerErrors({});
  };

  const save = () => {
    if (!parsed?.success) return;
    startTransition(async () => {
      const res = await createRoomAction(apartmentId, parsed.data);
      if (!res.ok) {
        setServerErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      if (hasProfile) {
        const b = await setRoomBudgetAction(apartmentId, res.data.id, budget);
        if (!b.ok) toast.error(b.error);
      }
      toast.success(tc("saved"));
      router.push(`/apartments/${apartmentId}/planner?room=all`);
    });
  };

  const areaM2 = shape ? m2(area(shape.polygon)) : null;
  const overview = `/apartments/${apartmentId}`;

  return (
    <form
      className="stagger"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <PageHeader
        crumbs={[{ label: tn("apartments"), href: "/apartments" }, { label: apartmentName, href: overview }, { label: t("crumb") }]}
        title={t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
        meta={[t("meta")]}
        aside={
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <FillSampleButton onFill={fillSample} />
            <Link href={overview} className={buttonVariants({ variant: "ghost" })}>
              {tc("cancel")}
            </Link>
            <Button type="submit" disabled={!canSave}>
              {pending ? tc("saving") : t("submit")} <span aria-hidden>→</span>
            </Button>
          </div>
        }
      />

      <SheetColumns
        sticky
        side={
          <>
            <SideSection title={t("sketch")} value={t("scale")}>
              <div className="border border-border bg-blueprint p-2.5 shadow-card">
                {shape ? (
                  <RoomPlan room={shape} northAngleDeg={northAngleDeg} className="max-h-[320px]" />
                ) : (
                  <p className="grid min-h-[180px] place-items-center p-4 text-center text-[12.5px] text-muted-foreground">{t("sketchEmpty")}</p>
                )}
              </div>
            </SideSection>
            <SideSection title={t("area")}>
              <p data-testid="room-area" className="font-heading text-[64px] leading-none">
                {areaM2 === null ? "—" : `${areaM2.toFixed(2)} ${tc("m2")}`}
              </p>
              <p className="mt-2 text-[12.5px] text-muted-foreground">{t(`areaHint_${type}`)}</p>
            </SideSection>
          </>
        }
      >
        <div className="flex flex-col gap-[34px]">
          <NumberedSection number="01" title={t("sectionName")}>
            <TextField label={t("name")} value={name} onChange={setName} maxLength={60} error={errors["name"]} className="max-w-[420px]" />
            <div className="flex flex-col gap-2">
              <span id="room-type-label" className={fieldLabelClass}>
                {t("type")}
              </span>
              <ChipGroup
                aria-labelledby="room-type-label"
                value={type}
                onChange={setType}
                options={RoomType.options.map((v) => ({ value: v, label: tt(v), testId: `chip-type-${v}` }))}
              />
            </div>
          </NumberedSection>

          <NumberedSection number="02" title={t("sectionSize")}>
            <div className="grid gap-3.5 min-[560px]:grid-cols-3">
              <NumberField label={t("width")} value={w} min={MIN_ROOM_SIDE_CM} step={5} suffix={tc("cm")} optional onChange={(v) => setW(v === null ? null : Math.round(v))} />
              <NumberField label={t("length")} value={d} min={MIN_ROOM_SIDE_CM} step={5} suffix={tc("cm")} optional onChange={(v) => setD(v === null ? null : Math.round(v))} />
              <NumberField
                label={t("ceiling")}
                value={ceiling}
                min={180}
                max={600}
                step={5}
                suffix={tc("cm")}
                optional
                error={errors["ceilingHeight"]}
                onChange={(v) => setCeiling(v === null ? null : Math.round(v))}
              />
            </div>
            <p className="text-[12.5px] text-muted-foreground">{t("sizeHint")}</p>
            {issues.length > 0 && (
              <ul data-testid="room-issues" className="flex flex-col gap-1 border-[1.5px] border-destructive bg-card px-3.5 py-2.5 text-[13px] text-destructive">
                {issues.map(([path, message]) => (
                  <li key={path}>{message}</li>
                ))}
              </ul>
            )}
          </NumberedSection>

          <NumberedSection number="03" title={t("sectionBudget")}>
            {hasProfile ? (
              <>
                <div className="flex items-center gap-5">
                  <Slider
                    aria-label={t("sectionBudget")}
                    min={BUDGET.min}
                    max={BUDGET.max}
                    step={BUDGET.step}
                    value={budget}
                    onValueChange={(v) => setBudget(Array.isArray(v) ? (v[0] ?? BUDGET.initial) : v)}
                    className="flex-1"
                  />
                  <b data-testid="budget-new-room" className="min-w-[110px] text-right font-mono text-[22px] font-normal tabular-nums">
                    {format.number(budget, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </b>
                </div>
                <p className="text-[12.5px] text-muted-foreground">{t("budgetHint")}</p>
              </>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                {t("budgetNoProfile")}{" "}
                <Link href={`${overview}/profile`} className="font-mono text-foreground underline underline-offset-3">
                  {t("openProfile")} <span aria-hidden>→</span>
                </Link>
              </p>
            )}
          </NumberedSection>
        </div>
      </SheetColumns>
    </form>
  );
}

function NumberedSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="mb-1 font-heading text-[40px] leading-none font-normal">
        <small className="mr-2 align-top font-mono text-xs font-medium tracking-[0.1em] text-primary">{number}</small>
        {title}
      </h2>
      {children}
    </section>
  );
}
