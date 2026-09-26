"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { refreshLocationAction, refreshTrendsAction } from "@/server/actions/context";

export function RefreshTrendsButton({ apartmentId, disabled }: { apartmentId: string; disabled?: boolean }) {
  const t = useTranslations("Context");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const res = await refreshTrendsAction(apartmentId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(t("trendsDone", { count: res.data.count }));
          router.refresh();
        })
      }
    >
      {pending ? t("refreshingTrends") : t("refreshTrends")}
    </Button>
  );
}

export function RefreshLocationButton({
  apartmentId,
  label,
  variant = "outline",
}: {
  apartmentId: string;
  label?: string;
  variant?: "outline" | "link";
}) {
  const t = useTranslations("Context");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size={variant === "link" ? "xs" : "sm"}
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await refreshLocationAction(apartmentId);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
    >
      {label ?? t("refreshLocation")}
    </Button>
  );
}
