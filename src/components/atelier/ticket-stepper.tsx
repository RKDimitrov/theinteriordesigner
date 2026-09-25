import type { ReactNode } from "react";
import { Stamp } from "@/components/ui/stamp";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface TicketStep {
  eyebrow: string;
  title: string;
  summary: ReactNode;
  href: string | null;
  done: boolean;
  current: boolean;
  stamp: ReactNode;
  testId?: string;
}

/** Four-cell ticket strip. Each cell links to its step and carries a stamp. */
export function TicketStepper({ steps, label }: { steps: readonly TicketStep[]; label: string }) {
  return (
    <ol aria-label={label} className="mb-[34px] grid grid-cols-2 border-[1.5px] border-foreground bg-card min-[900px]:grid-cols-4">
      {steps.map((s) => {
        const body = (
          <>
            <div className={cn("eyebrow", s.current && "text-primary")}>{s.eyebrow}</div>
            <h3 className="mt-1 mb-0.5 font-heading text-[28px] leading-[1.1] font-normal">{s.title}</h3>
            <p className="pr-[60px] text-[13px] text-[#5a4f45]">{s.summary}</p>
            <Stamp tone={s.done ? "done" : "progress"} className="absolute top-3 right-3.5">
              {s.stamp}
            </Stamp>
          </>
        );
        const cell = cn(
          "relative block h-full py-4 pr-[18px] pl-5",
          s.current && "bg-sticky",
          s.href && "transition-colors hover:bg-sticky focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
        );
        return (
          <li
            key={s.eyebrow}
            className={cn(
              "border-dashed border-rule",
              // dashed splits: right edge of every cell but the last in its row, bottom edge of the first row on mobile
              "border-r-[1.5px] last:border-r-0 max-[899px]:even:border-r-0 max-[899px]:nth-[-n+2]:border-b-[1.5px]"
            )}
          >
            {s.href ? (
              <Link href={s.href} data-testid={s.testId} aria-current={s.current ? "step" : undefined} className={cell}>
                {body}
              </Link>
            ) : (
              <div className={cn(cell, "opacity-60")} aria-disabled>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
