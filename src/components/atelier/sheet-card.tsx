import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Taped sheet. Place inside `.sheet-grid` for the alternating tilt and hover lift. */
export function TapedCard({ as: Tag = "article", className, ...props }: { as?: "article" | "li" | "div" } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={cn("taped tape relative flex flex-col border border-border bg-card shadow-card", className)} {...props} />;
}

/** Serif title with a mono value on the right, closed by a hairline. */
export function SheetCardHead({ title, value, sub }: { title: ReactNode; value?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="border-b border-line px-4 pt-3.5 pb-2.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="font-heading text-[30px] leading-none font-normal">{title}</h3>
        {value != null && <span className="shrink-0 font-mono text-xs font-medium tabular-nums">{value}</span>}
      </div>
      {sub && <p className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">{sub}</p>}
    </header>
  );
}

/** Blueprint-grid area that holds a plan. */
export function SheetCardPlan({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-blueprint p-2.5", className)}>{children}</div>;
}

export function SheetCardFoot({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-4 pt-2.5 pb-3.5 font-mono text-[11.5px]">{children}</footer>
  );
}

/** Mono underlined link; the first one in a footer is pushed right. */
export function SheetLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("underline underline-offset-3 first-of-type:ml-auto hover:text-primary", className)}
      {...props}
    />
  );
}

/** Dashed tile with a clay "+", for starting something new. */
export function AddTile({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "grid min-h-[220px] place-items-center border-[1.5px] border-dashed border-rule p-6 text-center font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      <span>
        <span aria-hidden className="block font-heading text-[56px] leading-none text-primary normal-case">
          +
        </span>
        {children}
      </span>
    </Link>
  );
}
