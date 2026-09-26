import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Mono label above the title (used when there is no breadcrumb). */
  eyebrow?: ReactNode;
  crumbs?: readonly Crumb[];
  title: ReactNode;
  /** Items of the mono meta row, separated by rules. */
  meta?: readonly ReactNode[];
  /** Right column: primary actions, title block. */
  aside?: ReactNode;
  className?: string;
}

/** Breadcrumb, h1, meta row and right-aligned actions, closed by a dashed rule. */
export function PageHeader({ eyebrow, crumbs, title, meta, aside, className }: PageHeaderProps) {
  const t = useTranslations("Nav");
  return (
    <header
      className={cn(
        "mb-7 grid items-end gap-7 border-b border-dashed border-rule pb-[22px] min-[900px]:grid-cols-[minmax(0,1fr)_auto]",
        className
      )}
    >
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label={t("breadcrumb")} className="eyebrow mb-1.5 flex flex-wrap gap-2">
            {crumbs.map((c, i) => (
              <Fragment key={`${c.label}-${i}`}>
                {i > 0 && <span aria-hidden>/</span>}
                {c.href ? (
                  <Link href={c.href} className="underline underline-offset-3 hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-1.5 mb-3 font-heading text-[clamp(48px,6vw,72px)] leading-[0.95] font-normal tracking-[-0.02em] text-balance [&_em]:text-primary">
          {title}
        </h1>
        {meta && meta.length > 0 && (
          <div className="flex flex-wrap font-mono text-[13px]">
            {meta.map((m, i) => (
              <span key={i} className="border-l border-rule px-3.5 first:border-l-0 first:pl-0">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      {aside && <div className="flex flex-col items-stretch gap-3 min-[900px]:items-end">{aside}</div>}
    </header>
  );
}

/** Title with its second half set in italic clay, e.g. "Nov<em>Apartament</em>". */
export function SplitTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length > 1) {
    const cut = Math.ceil(words.length / 2);
    return (
      <>
        {words.slice(0, cut).join(" ")} <em>{words.slice(cut).join(" ")}</em>
      </>
    );
  }
  // Single word: italicise a camel-case tail if there is one.
  const m = /^(.+?)([A-Z][a-z].*)$/.exec(text);
  return m ? (
    <>
      {m[1]}
      <em>{m[2]}</em>
    </>
  ) : (
    <>{text}</>
  );
}

/** Two-column page body: content and a 340px sidebar that stacks below 900px. */
export function SheetColumns({
  children,
  side,
  sideWidth = 340,
  sticky = false,
}: {
  children: ReactNode;
  side: ReactNode;
  sideWidth?: number;
  /** Keep the sidebar in view while the main column scrolls (wide screens). */
  sticky?: boolean;
}) {
  return (
    <div
      className="grid items-start gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_var(--side)]"
      style={{ "--side": `${sideWidth}px` } as React.CSSProperties}
    >
      <div className="min-w-0">{children}</div>
      <aside className={cn("min-w-0", sticky && "min-[900px]:sticky min-[900px]:top-4")}>{side}</aside>
    </div>
  );
}

/** Serif section title followed by a mono note and an optional action on the right. */
export function SectionTitle({
  children,
  note,
  action,
  className,
  id,
}: {
  children: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-[18px] flex flex-wrap items-baseline gap-3.5", className)}>
      <h2 id={id} className="font-heading text-[40px] leading-none font-normal">
        {children}
      </h2>
      {note && <span className="eyebrow">{note}</span>}
      {action && <div className="ml-auto self-center">{action}</div>}
    </div>
  );
}
