"use client";

import { useFormatter } from "next-intl";

/** Whole-euro formatter in the current locale ("€1,800" in English, "1.800 €" in German). */
export function useEur(): (n: number) => string {
  const format = useFormatter();
  return (n) => format.number(n, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
