import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter, PT_Serif, Work_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import "../globals.css";

const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin", "latin-ext"] });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext", "cyrillic"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
});

// Work Sans and Instrument Serif have no Cyrillic, so Bulgarian swaps in these
// two (see --font-ui-body / --font-ui-display in globals.css). Not preloaded:
// only the bg locale uses them.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"], preload: false });
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
  preload: false,
});

const fontVariables = [workSans.variable, plexMono.variable, instrumentSerif.variable];
const cyrillicFontVariables = [inter.variable, ptSerif.variable];

export const metadata: Metadata = {
  title: "RaumPlan",
  description: "AI-assisted, dimensionally valid interior design for your apartment.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={cn(fontVariables, locale === "bg" && cyrillicFontVariables, "h-full antialiased")}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
