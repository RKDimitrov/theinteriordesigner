"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          router.push("/login");
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}
