"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton({ label, variant = "link" }: { label: string; variant?: "link" | "outline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size={variant === "link" ? "xs" : "sm"}
      className={variant === "link" ? "text-muted-foreground" : undefined}
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
