import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "bg"],
  defaultLocale: "en",
  // English lives at the bare paths; German and Bulgarian get /de and /bg.
  localePrefix: "as-needed",
  // The app is mainly used in English: never redirect by Accept-Language.
  // A locale is only chosen explicitly (URL or the language switch in Settings).
  localeDetection: false,
});
