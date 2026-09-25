import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { HeaderNav } from "@/components/layout/header-nav";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, requireUserId } from "@/server/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-[clamp(20px,4vw,48px)] pt-[30px] pb-[72px]">{children}</main>
    </>
  );
}

async function Header() {
  const [t, user] = await Promise.all([getTranslations(), getCurrentUser()]);
  const nav = [
    { href: "/apartments", label: t("Nav.apartments") },
    { href: "/library", label: t("Nav.library") },
    { href: "/moodboard", label: t("Nav.moodboards") },
    { href: "/settings", label: t("Nav.settings") },
  ];
  return (
    <header className="double-rule flex flex-wrap items-center gap-x-7 gap-y-3 px-[clamp(20px,4vw,48px)] pt-[22px] pb-[18px]">
      <Link href="/apartments" className="font-heading text-[32px] leading-none italic">
        {t("Common.appName")}
        <sup className="ml-1.5 align-top font-mono text-[10px] font-medium tracking-[0.1em] text-primary not-italic">{t("Nav.edition")}</sup>
      </Link>
      <HeaderNav items={nav} label={t("Nav.main")} />
      <div className="ml-auto flex items-center gap-[18px] font-mono text-xs font-medium tracking-[0.08em] uppercase">
        {user && <span className="max-[560px]:sr-only">{user.name}</span>}
        {user && (
          <Link
            href="/settings"
            aria-label={t("Nav.settings")}
            className="grid size-8 place-items-center rounded-full bg-foreground text-[11px] text-card hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {user.initials}
          </Link>
        )}
      </div>
    </header>
  );
}
