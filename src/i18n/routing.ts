import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  // No /en prefix while English is the only locale.
  localePrefix: "as-needed",
});
