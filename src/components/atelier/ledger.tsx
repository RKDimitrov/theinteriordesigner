import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LedgerEntry {
  key: string;
  time: ReactNode;
  /** ISO timestamp for the <time> element. */
  dateTime?: string;
  text: ReactNode;
  chip?: ReactNode;
}

/** History list: mono date, text and an optional label chip, dotted dividers. */
export function Ledger({ entries, className, ...props }: { entries: readonly LedgerEntry[]; className?: string } & React.ComponentProps<"ol">) {
  return (
    <ol className={cn("flex flex-col", className)} {...props}>
      {entries.map((e) => (
        <li
          key={e.key}
          className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-dotted border-rule py-2.5"
        >
          <time dateTime={e.dateTime} className="font-mono text-[11.5px] text-muted-foreground">
            {e.time}
          </time>
          <p className="text-sm [&_b]:font-semibold">{e.text}</p>
          <span>{e.chip}</span>
        </li>
      ))}
    </ol>
  );
}
