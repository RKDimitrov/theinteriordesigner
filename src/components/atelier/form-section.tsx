import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Settings-style row: 1.5px ink top rule, a 220px left column with an optional
 * mono number, serif title and hint, and the controls on the right.
 */
export function FormSection({
  number,
  title,
  hint,
  action,
  children,
  className,
  titleClassName,
  ...props
}: {
  number?: string;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section
      className={cn("grid gap-x-10 gap-y-4 border-t-[1.5px] border-foreground py-[26px] min-[900px]:grid-cols-[220px_minmax(0,1fr)]", className)}
      {...props}
    >
      <div>
        <h2 className={cn("font-heading text-[30px] leading-none font-normal", titleClassName)}>
          {number && <span className="mr-2 align-top font-mono text-xs font-medium tracking-[0.1em] text-primary">{number}</span>}
          {title}
        </h2>
        {hint && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{hint}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="flex max-w-[620px] min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
