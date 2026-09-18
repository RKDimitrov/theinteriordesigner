import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Link } from "@/i18n/navigation";
import { requireUserId } from "@/server/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">{children}</main>
    </>
  );
}

function Header() {
  const t = useTranslations();
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/apartments" className="font-semibold">
          {t("Common.appName")}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/apartments" className="text-muted-foreground hover:text-foreground">
            {t("Nav.apartments")}
          </Link>
          <SignOutButton label={t("Nav.signOut")} />
        </nav>
      </div>
    </header>
  );
}
