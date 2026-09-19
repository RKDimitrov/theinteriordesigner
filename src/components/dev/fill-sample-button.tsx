"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** True outside production builds. Next inlines NODE_ENV at build time. */
export const DEV_TOOLS = process.env.NODE_ENV !== "production";

/**
 * Dev-only button that fills a form with template data. Each click passes an
 * increasing counter so callers can cycle through several presets.
 */
export function FillSampleButton({ onFill, label, disabled }: { onFill: (counter: number) => void; label?: string; disabled?: boolean }) {
  const t = useTranslations("Dev");
  const [counter, setCounter] = useState(0);
  if (!DEV_TOOLS) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-dashed"
      disabled={disabled}
      onClick={() => {
        onFill(counter);
        setCounter((c) => c + 1);
      }}
    >
      {label ?? t("fillSample")}
    </Button>
  );
}
