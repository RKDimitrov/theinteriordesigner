"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteApartmentAction } from "@/server/actions/apartments";

export function DeleteApartmentButton({ id }: { id: string }) {
  const t = useTranslations("Apartments");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("deleteConfirm"))) return;
        startTransition(async () => {
          const res = await deleteApartmentAction(id);
          if (!res.ok) return void toast.error(res.error);
          router.push("/apartments");
          router.refresh();
        });
      }}
    >
      {tc("delete")}
    </Button>
  );
}
