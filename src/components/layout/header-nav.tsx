"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Main nav; the active item gets a 2px clay underline. */
export function HeaderNav({ items, label }: { items: readonly { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-wrap gap-[22px] font-mono text-xs font-medium tracking-[0.08em] uppercase min-[700px]:ml-5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("border-b-2 border-transparent pb-[3px] hover:border-rule", active && "border-primary hover:border-primary")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
