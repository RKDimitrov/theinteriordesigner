import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sheet panel with a serif title row and a padded body. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  ...props
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section className={cn("border border-border bg-card shadow-panel", className)} {...props}>
      <header className="flex items-baseline justify-between gap-2.5 border-b border-line px-[18px] py-3.5">
        <h2 className="font-heading text-[26px] leading-none font-normal">{title}</h2>
        {action}
      </header>
      <div className={cn("flex flex-col gap-3.5 px-[18px] py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
