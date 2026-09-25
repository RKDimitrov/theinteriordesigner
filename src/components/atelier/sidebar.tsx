import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sidebar section: 1.5px ink top rule and a mono heading row. */
export function SideSection({
  title,
  value,
  children,
  className,
  ...props
}: {
  title: ReactNode;
  value?: ReactNode;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section className={cn("border-t-[1.5px] border-foreground pt-3.5 pb-[22px]", className)} {...props}>
      <h2 className="mb-2.5 flex items-baseline justify-between gap-2.5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
        <span>{title}</span>
        {value != null && <span className="text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-3">{value}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Label/value rows with dotted dividers. */
export function Rows({ rows, className }: { rows: readonly { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={className}>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-2.5 border-b border-dotted border-rule py-[7px] text-[13.5px]">
          <dt>{r.label}</dt>
          <dd className="text-right font-mono font-medium tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Italic serif quote. */
export function MarginNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mb-3 font-heading text-2xl leading-[1.25] italic", className)}>“{children}”</p>;
}

/** Colour blocks with mono captions. */
export function SwatchCard({ swatches }: { swatches: readonly { hex: string; name: string }[] }) {
  return (
    <ul className="flex gap-2.5">
      {swatches.map((s) => (
        <li key={s.hex} className="min-w-0 flex-1">
          <span className="mb-1 block h-16 border border-foreground" style={{ background: s.hex }} />
          <span className="block truncate font-mono text-[10px] uppercase">{s.name}</span>
        </li>
      ))}
    </ul>
  );
}
