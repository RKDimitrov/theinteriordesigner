import type { ReactNode } from "react";

/** Architect's drawing stamp: a 2×2 grid of mono key/value cells. */
export function TitleBlock({ cells }: { cells: readonly { key: string; value: ReactNode }[] }) {
  return (
    <dl className="grid min-w-[300px] grid-cols-2 border-[1.5px] border-foreground bg-titleblock font-mono text-[11px]">
      {cells.map((c, i) => (
        <div
          key={c.key}
          className={[
            "px-3 py-2",
            i % 2 === 0 ? "border-r border-foreground" : "",
            i < cells.length - 2 ? "border-b border-foreground" : "",
          ].join(" ")}
        >
          <dt className="text-[9.5px] tracking-[0.1em] text-muted-foreground uppercase">{c.key}</dt>
          <dd className="text-[13px] font-medium">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
